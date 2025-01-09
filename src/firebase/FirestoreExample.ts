import { collection, addDoc, getDocs, query, doc, updateDoc, deleteDoc, getDoc, DocumentReference, where } from 'firebase/firestore';
import { db } from './firebase';

export interface TeamData {
  name: string;
  playerCount: number;
  createdAt: Date;
}

export interface PlayerData {
  name: string;
  number: string;
  position: string;
}

export interface SetScore {
  team: number;
  opponent: number;
}

export interface LineupPlayer {
  id: string;
  name: string;
  number: string;
  position: string;
  rotationPosition: number;
}

export interface Set {
  number: number;
  lineup: LineupPlayer[];
  score?: SetScore;
}

export interface Game {
  id: string;
  teamId: string;
  opponent: string;
  date: string;
  status: 'win' | 'loss' | 'in-progress';
  sets: Set[];
  finalScore?: {
    team: number;
    opponent: number;
  };
}

// Teams Functions
async function createTeam(teamData: TeamData): Promise<DocumentReference> {
  try {
    const teamToCreate = {
      name: teamData.name,
      createdAt: new Date(),
      playerCount: 0  // Always start with 0 players
    };
    
    const docRef = await addDoc(collection(db, 'teams'), teamToCreate);
    return docRef;
  } catch (e) {
    console.error("Error creating team: ", e);
    throw e;
  }
}

async function getAllTeams() {
  try {
    const q = query(collection(db, 'teams'));
    const querySnapshot = await getDocs(q);
    const teams = [];
    querySnapshot.forEach((doc) => {
      teams.push({ id: doc.id, ...doc.data() });
    });
    return teams;
  } catch (e) {
    console.error("Error fetching teams: ", e);
    throw e;
  }
}

async function addPlayerToTeam(teamId: string, playerData: PlayerData) {
  try {
    // First add the player
    const playerRef = await addDoc(collection(db, `teams/${teamId}/players`), {
      ...playerData,
      joinedAt: new Date()
    });
    
    // Get the current number of players
    const players = await getTeamPlayers(teamId);
    const currentPlayerCount = players.length;
    
    // Update team's player count with the exact number
    const teamRef = doc(db, 'teams', teamId);
    await updateDoc(teamRef, {
      playerCount: currentPlayerCount
    });
    
    return playerRef;
  } catch (e) {
    console.error("Error adding player: ", e);
    throw e;
  }
}

async function getTeamPlayers(teamId: string) {
  try {
    const q = query(collection(db, `teams/${teamId}/players`));
    const querySnapshot = await getDocs(q);
    const players = [];
    querySnapshot.forEach((doc) => {
      players.push({ id: doc.id, ...doc.data() });
    });
    return players;
  } catch (e) {
    console.error("Error fetching team players: ", e);
    throw e;
  }
}

async function deletePlayer(teamId: string, playerId: string) {
  try {
    // Delete player document
    await deleteDoc(doc(db, `teams/${teamId}/players`, playerId));
    
    // Get the current number of players after deletion
    const players = await getTeamPlayers(teamId);
    const currentPlayerCount = players.length;
    
    // Update team's player count with the exact number
    const teamRef = doc(db, 'teams', teamId);
    await updateDoc(teamRef, {
      playerCount: currentPlayerCount
    });
    
    return true;
  } catch (e) {
    console.error("Error deleting player:", e);
    throw e;
  }
}

async function deleteTeam(teamId: string) {
  try {
    // Delete all players in the team first
    const players = await getTeamPlayers(teamId);
    for (const player of players) {
      await deleteDoc(doc(db, `teams/${teamId}/players`, player.id));
    }
    
    // Delete the team document
    await deleteDoc(doc(db, 'teams', teamId));
    return true;
  } catch (e) {
    console.error("Error deleting team:", e);
    throw e;
  }
}

async function syncTeamPlayerCount(teamId: string) {
  try {
    const players = await getTeamPlayers(teamId);
    const teamRef = doc(db, 'teams', teamId);
    await updateDoc(teamRef, {
      playerCount: players.length
    });
  } catch (e) {
    console.error("Error syncing team player count:", e);
    throw e;
  }
}

// Add these game functions
async function createGame(gameData: Omit<Game, 'id'>) {
  try {
    console.log('Creating game with data:', gameData);  // Debug log

    // Ensure sets array exists
    const gameToCreate = {
      ...gameData,
      sets: gameData.sets || [],
      createdAt: new Date()
    };

    const gameRef = await addDoc(collection(db, 'games'), gameToCreate);
    console.log('Game created with ID:', gameRef.id);  // Debug log

    // Verify the game was created
    const createdGame = await getDoc(gameRef);
    if (!createdGame.exists()) {
      throw new Error('Game creation failed - document not found');
    }

    console.log('Created game data:', createdGame.data());  // Debug log
    return gameRef;
  } catch (e) {
    console.error("Error creating game:", e);
    if (e instanceof Error) {
      console.error('Error details:', {
        message: e.message,
        stack: e.stack
      });
    }
    throw e;
  }
}

async function getTeamGames(teamId: string) {
  try {
    const q = query(
      collection(db, 'games'),
      where('teamId', '==', teamId)
    );
    const querySnapshot = await getDocs(q);
    const games: Game[] = [];
    querySnapshot.forEach((doc) => {
      games.push({ id: doc.id, ...doc.data() } as Game);
    });
    return games;
  } catch (e) {
    console.error("Error fetching team games:", e);
    throw e;
  }
}

async function updateGameSet(gameId: string, set: Set) {
  try {
    const gameRef = doc(db, 'games', gameId);
    const gameDoc = await getDoc(gameRef);
    
    if (!gameDoc.exists()) {
      throw new Error('Game not found');
    }
    
    const game = gameDoc.data() as Game;
    let updatedSets = [...(game.sets || [])];
    
    // Find or add the set
    const setIndex = updatedSets.findIndex(s => s.number === set.number);
    if (setIndex >= 0) {
      updatedSets[setIndex] = set;
    } else {
      updatedSets.push(set);
    }
    
    updatedSets = updatedSets.sort((a, b) => a.number - b.number);

    // Calculate game status
    const teamSets = updatedSets.filter(s => 
      s.score && s.score.team > s.score.opponent
    ).length;
    const opponentSets = updatedSets.filter(s => 
      s.score && s.score.opponent > s.score.team
    ).length;
    
    let status: 'win' | 'loss' | 'in-progress' = 'in-progress';
    let finalScore = null;

    // Must play exactly 4 sets before determining winner
    if (updatedSets.length === 4) {
      if (teamSets >= 3) {
        status = 'win';
        finalScore = { team: teamSets, opponent: opponentSets };
      } else if (opponentSets >= 3) {
        status = 'loss';
        finalScore = { team: teamSets, opponent: opponentSets };
      }
      // If neither team has 3 sets after 4 sets, game remains in progress
    }

    const updateData: any = {
      sets: updatedSets,
      status
    };
    
    if (finalScore) {
      updateData.finalScore = finalScore;
    }

    await updateDoc(gameRef, updateData);

    return {
      sets: updatedSets,
      status,
      finalScore
    };
  } catch (e) {
    console.error("Error updating game set:", e);
    throw e;
  }
}

async function deleteGame(gameId: string) {
  try {
    await deleteDoc(doc(db, 'games', gameId));
    return true;
  } catch (e) {
    console.error("Error deleting game:", e);
    throw e;
  }
}

// Add this function to fetch all games
async function getAllGames() {
  try {
    const q = query(collection(db, 'games'));
    const querySnapshot = await getDocs(q);
    const games: Game[] = [];
    querySnapshot.forEach((doc) => {
      games.push({ id: doc.id, ...doc.data() } as Game);
    });
    return games;
  } catch (e) {
    console.error("Error fetching games:", e);
    throw e;
  }
}

export { createTeam, getAllTeams, addPlayerToTeam, getTeamPlayers, deletePlayer, deleteTeam, syncTeamPlayerCount, createGame, getTeamGames, updateGameSet, deleteGame, getAllGames }; 