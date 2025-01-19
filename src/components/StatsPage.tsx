import React, { useMemo } from 'react';
import { Player } from '../types/player';
import { Game, GameSet } from '../types/game';
import { Team } from '../types/team';

interface StatsPageProps {
    selectedTeam: string;
    players: { [key: string]: Player[] };
    teams: { id: string; name: string }[];
    onTeamSelect: (teamId: string) => void;
    games: Array<{
        id: string;
        teamId: string;
        status: 'win' | 'loss';
    }>;
    userId: string;
    darkMode?: boolean;
}

interface GameStats {
    id: string;
    teamId: string;
    status: 'win' | 'loss';
}

interface AttendanceRecord {
    playerId: string;
    present: boolean;
}

interface PlayerSetStats {
    totalSets: number;
    lastGameSets: number;
    setPercentage: number;
    totalGames: number;
    totalSubstitutions: number;
    averageRotationPosition: number;
    winPercentage: number;
}

interface ExtendedPlayerStats extends PlayerSetStats {
    rotationPositionSum: number;
    rotationPositionCount: number;
    gamesPlayed: Set<string>;
    gamesWon: number;
    setsPlayed: Set<string>;
}

interface Props {
    selectedTeam: string | null;
    players: Record<string, Player[]>;
    teams: Team[];
    onTeamSelect: (teamId: string) => void;
    games: Game[];
    userId: string | undefined;
    trainingSessions: any[];
    darkMode: boolean;
}

const calculateCurrentStreak = (teamGames: Game[]) => {
    // Sort games by date in descending order (most recent first)
    const sortedGames = [...teamGames]
        .filter(game => game.status !== 'in-progress')
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (sortedGames.length === 0) return { count: 0, type: 'none' as const };

    let count = 1;
    const firstResult = sortedGames[0].status;

    // Count consecutive games with the same result
    for (let i = 1; i < sortedGames.length; i++) {
        if (sortedGames[i].status === firstResult) {
            count++;
        } else {
            break;
        }
    }

    return {
        count,
        type: firstResult
    };
};

const calculatePlayerStats = (player: Player, games: Game[]) => {
    // Filter games where this player appeared in any set
    const playerGames = games.filter(game => 
        game.sets.some(set => 
            set.lineup?.some(p => p.id === player.id)
        )
    );

    // Count total sets played in these games
    const totalSetsInGames = playerGames.reduce((total, game) => 
        total + game.sets.length, 0
    );

    // Count sets where player was in lineup
    const setsPlayed = playerGames.reduce((total, game) => 
        total + game.sets.filter(set => 
            set.lineup?.some(p => p.id === player.id)
        ).length, 0
    );

    // Calculate percentage based on actual sets played
    const setPercentage = totalSetsInGames > 0 
        ? (setsPlayed / totalSetsInGames) * 100 
        : 0;

    return {
        gamesPlayed: playerGames.length,
        setsPlayed: setsPlayed,
        setPercentage: setPercentage,
        // ... other stats ...
    };
};

const StatsPage: React.FC<Props> = ({ selectedTeam, players, teams, onTeamSelect, games, userId, trainingSessions, darkMode }) => {
    const defaultStats = {
        totalSets: 0,
        lastGameSets: 0,
        setPercentage: 0,
        totalGames: 0,
        totalSubstitutions: 0,
        averageRotationPosition: 0,
        winPercentage: 0
    };

    const calculateAllPlayerStats = () => {
        if (!selectedTeam || !players[selectedTeam]) return {};

        const teamGames = games.filter(game => game.teamId === selectedTeam);
        const teamPlayers = players[selectedTeam];
        
        console.log('Starting stats calculation for team:', selectedTeam);
        console.log('Team players:', teamPlayers.map(p => p.name));
        
        // Initialize stats using player names as keys
        const allStats: Record<string, ExtendedPlayerStats> = {};
        teamPlayers.forEach(player => {
            allStats[player.name] = {
                totalSets: 0,
                lastGameSets: 0,
                setPercentage: 0,
                totalGames: 0,
                totalSubstitutions: 0,
                averageRotationPosition: 0,
                winPercentage: 0,
                rotationPositionSum: 0,
                rotationPositionCount: 0,
                gamesPlayed: new Set<string>(),
                gamesWon: 0,
                setsPlayed: new Set<string>()
            };
        });

        // Process each game's sets
        teamGames.forEach(game => {
            if (game.status === 'in-progress') return;

            game.sets.forEach(set => {
                if (!set.score) return;

                // Process lineup positions and substitutions
                set.lineup?.forEach(player => {
                    if (allStats[player.name]) {
                        const setId = `${game.id}-set${set.number}`;
                        allStats[player.name].setsPlayed.add(setId);
                        allStats[player.name].gamesPlayed.add(game.id);
                        
                        allStats[player.name].rotationPositionSum += player.rotationPosition;
                        allStats[player.name].rotationPositionCount += 1;

                        if (set.score?.team > set.score?.opponent) {
                            allStats[player.name].gamesWon++;
                        }
                    }
                });

                // Process substitutions
                set.substitutions?.forEach(sub => {
                    if (allStats[sub.inPlayer.name]) {
                        allStats[sub.inPlayer.name].totalSubstitutions += 1;
                        if (set.score?.team > set.score?.opponent) {
                            allStats[sub.inPlayer.name].gamesWon++;
                        }
                    }
                });
            });
        });

        // Convert to final format
        return teamPlayers.reduce((acc, player) => {
            const stats = allStats[player.name];
            const setsCount = stats?.setsPlayed.size || 0;
            const gamesPlayed = stats?.gamesPlayed.size || 0;
            
            // Calculate total sets in games where this player participated
            const playerGames = new Set([...stats.gamesPlayed]);
            const totalSetsInPlayerGames = teamGames
                .filter(game => playerGames.has(game.id) && game.status !== 'in-progress')
                .reduce((total, game) => total + game.sets.length, 0);
            
            acc[player.name] = {
                totalSets: setsCount,
                lastGameSets: 0,
                setPercentage: totalSetsInPlayerGames > 0 ? (setsCount / totalSetsInPlayerGames) * 100 : 0,
                totalGames: gamesPlayed,
                totalSubstitutions: stats?.totalSubstitutions || 0,
                averageRotationPosition: stats?.rotationPositionCount > 0 
                    ? Math.round((stats.rotationPositionSum / stats.rotationPositionCount) * 10) / 10
                    : 0,
                winPercentage: setsCount > 0 
                    ? Math.round((stats.gamesWon / setsCount) * 100)
                    : 0
            };
            return acc;
        }, {} as Record<string, PlayerSetStats>);
    };

    // Use memoized stats calculation
    const playerStats = useMemo(() => calculateAllPlayerStats(), [selectedTeam, players, games]);

    return (
        <div className="p-4">
            <div className="mb-4">
                <select
                    value={selectedTeam || ''}
                    onChange={(e) => onTeamSelect(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border dark:border-gray-600 dark:bg-secondary-dark dark:text-white"
                >
                    <option value="">Select Team</option>
                    {teams.map((team) => (
                        <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                </select>
            </div>

            {selectedTeam && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white dark:bg-secondary/50 rounded-xl p-4 shadow-lg">
                            <h3 className="text-sm text-gray-600 dark:text-gray-400">Total Games</h3>
                            <p className="text-2xl font-bold text-primary">
                                {games.filter(game => game.teamId === selectedTeam).length}
                            </p>
                        </div>
                        <div className="bg-white dark:bg-secondary/50 rounded-xl p-4 shadow-lg">
                            <h3 className="text-sm text-gray-600 dark:text-gray-400">Win Rate</h3>
                            <p className="text-2xl font-bold text-primary">
                                {((games.filter(game => game.teamId === selectedTeam && game.status === 'win').length / 
                                    games.filter(game => game.teamId === selectedTeam && game.status !== 'in-progress').length) * 100 || 0).toFixed(1)}%
                            </p>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-secondary/50 rounded-xl p-4 shadow-lg">
                        <h3 className="text-sm text-gray-600 dark:text-gray-400">Current Streak</h3>
                        {(() => {
                            const streak = calculateCurrentStreak(
                                games.filter(game => game.teamId === selectedTeam)
                            );
                            if (streak.type === 'none') {
                                return <p className="text-2xl font-bold text-primary">No games played</p>;
                            }
                            return (
                                <p className="text-2xl font-bold text-primary">
                                    {streak.count} {streak.type === 'win' ? 'Wins' : 'Losses'}
                                </p>
                            );
                        })()}
                    </div>

                    <div className="bg-white dark:bg-secondary/50 rounded-xl p-4 shadow-lg">
                        <h3 className="text-lg font-semibold mb-4 dark:text-white">Player Statistics</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-left text-sm text-gray-500 dark:text-gray-400">
                                        <th className="pb-2">Player</th>
                                        <th className="pb-2">Total Played Sets</th>
                                        <th className="pb-2">Games</th>
                                        <th className="pb-2">Set %</th>
                                        <th className="pb-2">Win %</th>
                                        <th className="pb-2">Avg Pos</th>
                                        <th className="pb-2">Subs</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {players[selectedTeam]?.map((player) => {
                                        const stats = playerStats[player.name] || {
                                            totalSets: 0,
                                            setPercentage: 0,
                                            totalGames: 0,
                                            winPercentage: 0,
                                            averageRotationPosition: 0,
                                            totalSubstitutions: 0
                                        };
                                        
                                        return (
                                            <tr key={player.name} className="border-t dark:border-gray-700">
                                                <td className="py-2">
                                                    <div>
                                                        <p className="font-medium dark:text-white">{player.name}</p>
                                                        <p className="text-sm text-gray-500 dark:text-gray-400">{player.position}</p>
                                                    </div>
                                                </td>
                                                <td className="py-2 dark:text-white">{stats.totalSets}</td>
                                                <td className="py-2 dark:text-white">{stats.totalGames}</td>
                                                <td className="py-2 dark:text-white">{stats.setPercentage.toFixed(1)}%</td>
                                                <td className="py-2 dark:text-white">{stats.winPercentage}%</td>
                                                <td className="py-2 dark:text-white">{stats.averageRotationPosition.toFixed(1)}</td>
                                                <td className="py-2 dark:text-white">{stats.totalSubstitutions}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StatsPage; 