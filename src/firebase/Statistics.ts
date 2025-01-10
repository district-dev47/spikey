import { collection, query, getDocs, addDoc, updateDoc, deleteDoc, doc, where } from 'firebase/firestore';
import { db } from './firebase';

export interface PlayerStatistics {
  id?: string;
  playerId: string;
  gameId: string;
  setsPlayed: number;
  substitutions: number;
  pointsScored: number;
  blocks: number;
  serves: number;
  aces?: number;
  digs?: number;
  assists?: number;
  attackPercentage?: number;
  servePercentage?: number;
  receptionPercentage?: number;
}

export interface TeamStatistics {
  totalGames: number;
  wins: number;
  losses: number;
  totalSets: number;
  setsWon: number;
  setsLost: number;
  averagePointsPerSet: number;
  longestWinStreak: number;
  longestLoseStreak: number;
}

export async function getPlayerStatistics(playerId: string): Promise<PlayerStatistics[]> {
  try {
    const q = query(collection(db, 'statistics'), where('playerId', '==', playerId));
    const querySnapshot = await getDocs(q);
    const stats: PlayerStatistics[] = [];
    querySnapshot.forEach((doc) => {
      stats.push({ id: doc.id, ...doc.data() } as PlayerStatistics);
    });
    return stats;
  } catch (e) {
    console.error("Error fetching player statistics: ", e);
    throw e;
  }
}

export async function addPlayerStatistics(statistics: Omit<PlayerStatistics, 'id'>): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, 'statistics'), statistics);
    return docRef.id;
  } catch (e) {
    console.error("Error adding player statistics: ", e);
    throw e;
  }
}

export async function updatePlayerStatistics(statisticsId: string, statistics: Partial<PlayerStatistics>): Promise<void> {
  try {
    const statRef = doc(db, 'statistics', statisticsId);
    await updateDoc(statRef, statistics);
  } catch (e) {
    console.error("Error updating player statistics: ", e);
    throw e;
  }
}

export async function getTeamStatistics(teamId: string): Promise<TeamStatistics> {
  try {
    const gamesQuery = query(collection(db, 'games'), where('teamId', '==', teamId));
    const gamesSnapshot = await getDocs(gamesQuery);
    
    let stats: TeamStatistics = {
      totalGames: 0,
      wins: 0,
      losses: 0,
      totalSets: 0,
      setsWon: 0,
      setsLost: 0,
      averagePointsPerSet: 0,
      longestWinStreak: 0,
      longestLoseStreak: 0,
    };
    
    let totalPoints = 0;
    let currentWinStreak = 0;
    let currentLoseStreak = 0;
    
    gamesSnapshot.forEach((doc) => {
      const game = doc.data();
      stats.totalGames++;
      
      if (game.status === 'win') {
        stats.wins++;
        currentWinStreak++;
        currentLoseStreak = 0;
      } else if (game.status === 'loss') {
        stats.losses++;
        currentLoseStreak++;
        currentWinStreak = 0;
      }
      
      stats.longestWinStreak = Math.max(stats.longestWinStreak, currentWinStreak);
      stats.longestLoseStreak = Math.max(stats.longestLoseStreak, currentLoseStreak);
      
      game.sets.forEach((set: any) => {
        stats.totalSets++;
        if (set.score) {
          if (set.score.team > set.score.opponent) {
            stats.setsWon++;
          } else {
            stats.setsLost++;
          }
          totalPoints += set.score.team;
        }
      });
    });
    
    stats.averagePointsPerSet = stats.totalSets > 0 ? totalPoints / stats.totalSets : 0;
    
    return stats;
  } catch (e) {
    console.error("Error calculating team statistics: ", e);
    throw e;
  }
} 