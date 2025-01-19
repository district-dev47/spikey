import { collection, addDoc, getDocs, query, doc, updateDoc, deleteDoc, getDoc, DocumentReference, where, writeBatch, Timestamp } from 'firebase/firestore';
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
  joinedAt: string | Timestamp;
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
    const playerRef = await addDoc(collection(db, 'teams', teamId, 'players'), {
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
    const q = query(collection(db, 'teams', teamId, 'players'));
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
    await deleteDoc(doc(db, 'teams', teamId, 'players', playerId));
    
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
    console.log('Starting team deletion process for teamId:', teamId);

    // Verify team exists first
    const teamRef = doc(db, 'teams', teamId);
    const teamDoc = await getDoc(teamRef);
    
    if (!teamDoc.exists()) {
      throw new Error(`Team with ID ${teamId} does not exist`);
    }

    // Get all players
    console.log('Fetching players for team:', teamId);
    const playersQuery = query(collection(db, 'teams', teamId, 'players'));
    const playersSnapshot = await getDocs(playersQuery);
    console.log(`Found ${playersSnapshot.size} players to delete`);
    
    // Delete each player document
    const batch = writeBatch(db);
    playersSnapshot.forEach((playerDoc) => {
      batch.delete(playerDoc.ref);
    });
    
    // Add team deletion to the batch
    batch.delete(teamRef);
    
    // Commit the batch
    console.log('Committing batch delete operation');
    await batch.commit();
    console.log('Team and players deleted successfully');
    
    return true;
  } catch (e) {
    console.error("Error deleting team:", e);
    if (e instanceof Error) {
      console.error('Error details:', {
        message: e.message,
        stack: e.stack
      });
    }
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
    console.log('Updating game set with data:', { gameId, set });

    const gameRef = doc(db, 'games', gameId);
    const gameDoc = await getDoc(gameRef);
    
    if (!gameDoc.exists()) {
      throw new Error('Game not found');
    }
    
    const game = gameDoc.data() as Game;
    let updatedSets = [...(game.sets || [])];

    // Convert Timestamp to string in lineup data and remove undefined values
    const sanitizedSet: Set = {
      number: set.number,
      lineup: set.lineup.map(player => ({
        id: player.id || '',
        name: player.name || '',
        number: player.number || '',
        position: player.position || '',
        rotationPosition: player.rotationPosition || 0,
        joinedAt: player.joinedAt instanceof Timestamp 
          ? player.joinedAt.toDate().toISOString()
          : typeof player.joinedAt === 'string' 
            ? player.joinedAt 
            : new Date().toISOString()
      })),
      // Only include score if it exists
      ...(set.score && { score: set.score }),
      // Always include substitutions array, even if empty
      substitutions: (set.substitutions || []).map(sub => ({
        outPlayer: {
          id: sub.outPlayer.id || '',
          name: sub.outPlayer.name || '',
          number: sub.outPlayer.number || '',
          position: sub.outPlayer.position || '',
          rotationPosition: sub.outPlayer.rotationPosition || 0,
          joinedAt: sub.outPlayer.joinedAt instanceof Timestamp 
            ? sub.outPlayer.joinedAt.toDate().toISOString()
            : typeof sub.outPlayer.joinedAt === 'string'
              ? sub.outPlayer.joinedAt
              : new Date().toISOString()
        },
        inPlayer: {
          id: sub.inPlayer.id || '',
          name: sub.inPlayer.name || '',
          number: sub.inPlayer.number || '',
          position: sub.inPlayer.position || '',
          rotationPosition: sub.inPlayer.rotationPosition || 0,
          joinedAt: sub.inPlayer.joinedAt instanceof Timestamp 
            ? sub.inPlayer.joinedAt.toDate().toISOString()
            : typeof sub.inPlayer.joinedAt === 'string'
              ? sub.inPlayer.joinedAt
              : new Date().toISOString()
        },
        currentScore: sub.currentScore
      }))
    };

    // Find or add the set
    const setIndex = updatedSets.findIndex(s => s.number === sanitizedSet.number);
    if (setIndex >= 0) {
      updatedSets[setIndex] = sanitizedSet;
    } else {
      updatedSets.push(sanitizedSet);
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

    // A game must have at least 4 sets played before determining win/loss
    if (updatedSets.length >= 4) {
      if (setsWon.team === 3 && setsWon.opponent === 1) {
        // Win with 3-1
        status = 'win';
        finalScore = {
          team: 3,
          opponent: 1
        };
      } else if (setsWon.team === 4 && setsWon.opponent === 0) {
        // Win with 4-0
        status = 'win';
        finalScore = {
          team: 4,
          opponent: 0
        };
      } else if (setsWon.opponent === 3 && setsWon.team === 1) {
        // Loss with 1-3
        status = 'loss';
        finalScore = {
          team: 1,
          opponent: 3
        };
      } else if (setsWon.opponent === 4 && setsWon.team === 0) {
        // Loss with 0-4
        status = 'loss';
        finalScore = {
          team: 0,
          opponent: 4
        };
      } else if (updatedSets.length === 5 && sanitizedSet.score) {
        // Fifth set is played (was 2-2 after 4 sets)
        const fifthSetWinner = sanitizedSet.score.team > sanitizedSet.score.opponent ? 'team' : 'opponent';
        status = fifthSetWinner === 'team' ? 'win' : 'loss';
        finalScore = {
          team: setsWon.team + (fifthSetWinner === 'team' ? 1 : 0),
          opponent: setsWon.opponent + (fifthSetWinner === 'opponent' ? 1 : 0)
        };
      }
    }

    // Remove any undefined values from the update data
    const updateData = {
      sets: updatedSets,
      status,
      ...(finalScore && { finalScore })
    };

    // Remove any undefined values recursively
    const cleanData = JSON.parse(JSON.stringify(updateData));
    console.log('Clean update data:', cleanData);

    await updateDoc(gameRef, cleanData);

    return {
      sets: updatedSets,
      status,
      finalScore
    };
  } catch (e) {
    console.error("Error updating game set:", e);
    if (e instanceof Error) {
      console.error('Error details:', {
        message: e.message,
        stack: e.stack
      });
    }
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