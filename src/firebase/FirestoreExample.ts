import { collection, addDoc, getDocs, query, doc, updateDoc, deleteDoc, getDoc, DocumentReference, where } from 'firebase/firestore';
import { db } from './firebase';

export interface TeamData {
  name: string;
  playerCount: number;
  createdAt: Date;
  userId: string;
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

export interface Substitution {
  outPlayer: LineupPlayer;
  inPlayer: LineupPlayer;
  currentScore: SetScore;
}

export interface Set {
  number: number;
  lineup: LineupPlayer[];
  score?: SetScore;
  substitutions?: Substitution[];
}

export interface Game {
  id: string;
  teamId: string;
  opponent: string;
  date: string;
  status: 'win' | 'loss' | 'in-progress';
  sets: Set[];
  userId: string;
  score?: {
    team: number;
    opponent: number;
  };
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
      playerCount: 0,
      userId: teamData.userId
    };
    
    const docRef = await addDoc(collection(db, 'teams'), teamToCreate);
    return docRef;
  } catch (e) {
    console.error("Error creating team: ", e);
    throw e;
  }
}

async function getAllTeams(userId: string) {
  try {
    const q = query(
      collection(db, 'teams'),
      where('userId', '==', userId)
    );
    const querySnapshot = await getDocs(q);
    const teams: Array<TeamData & { id: string }> = [];
    querySnapshot.forEach((doc) => {
      teams.push({ id: doc.id, ...doc.data() as TeamData });
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
    const players: Array<PlayerData & { id: string }> = [];
    querySnapshot.forEach((doc) => {
      players.push({ id: doc.id, ...doc.data() as PlayerData });
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
    console.log('Creating game with data:', gameData);

    const gameToCreate = {
      ...gameData,
      sets: gameData.sets || [],
      createdAt: new Date(),
      userId: gameData.userId
    };

    const gameRef = await addDoc(collection(db, 'games'), gameToCreate);
    console.log('Game created with ID:', gameRef.id);

    const createdGame = await getDoc(gameRef);
    if (!createdGame.exists()) {
      throw new Error('Game creation failed - document not found');
    }

    console.log('Created game data:', createdGame.data());
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
      // Preserve existing substitutions if not provided in the update
      const existingSubstitutions = updatedSets[setIndex].substitutions || [];
      updatedSets[setIndex] = {
        ...set,
        substitutions: set.substitutions || existingSubstitutions
      };
    } else {
      updatedSets.push(set);
    }
    
    updatedSets = updatedSets.sort((a, b) => a.number - b.number);

    // Calculate sets won by each team
    const setsWon = updatedSets.reduce(
      (acc, currentSet) => {
        if (currentSet.score) {
          if (currentSet.score.team > currentSet.score.opponent) {
            acc.team++;
          } else if (currentSet.score.opponent > currentSet.score.team) {
            acc.opponent++;
          }
        }
        return acc;
      },
      { team: 0, opponent: 0 }
    );
    
    let status: 'win' | 'loss' | 'in-progress' = 'in-progress';
    let finalScore = null;

    // Game status logic:
    // 1. Always play 4 sets
    // 2. If after 4 sets it's tied 2-2, play fifth set
    // 3. If one team wins 3 sets, they win the match but still play 4th set
    if (updatedSets.length === 5) {
      // Fifth set is decisive
      if (set.score) {
        status = set.score.team > set.score.opponent ? 'win' : 'loss';
        finalScore = {
          team: setsWon.team + (set.score.team > set.score.opponent ? 1 : 0),
          opponent: setsWon.opponent + (set.score.opponent > set.score.team ? 1 : 0)
        };
      }
    } else if (updatedSets.length === 4) {
      // After 4 sets
      if (setsWon.team === 2 && setsWon.opponent === 2) {
        // Tied 2-2, need fifth set
        status = 'in-progress';
      } else {
        // One team has won 3 sets
        status = setsWon.team > setsWon.opponent ? 'win' : 'loss';
        finalScore = setsWon;
      }
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
async function getAllGames(userId: string) {
  try {
    const q = query(
      collection(db, 'games'),
      where('userId', '==', userId)
    );
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