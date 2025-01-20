import React, { useMemo, useState } from 'react';
import { Player } from '../types/player';
import { Game, GameSet } from '../types/game';
import { Team } from '../types/team';
import { TrendingUp, TrendingDown, HelpCircle, ChevronUp, ChevronDown } from 'lucide-react';

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

type SortField = 'name' | 'totalSets' | 'totalGames' | 'setPercentage' | 'winPercentage' | 'totalSubstitutions';
type SortDirection = 'asc' | 'desc';

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

                // Only process players in the starting lineup
                set.lineup?.forEach(player => {
                    if (allStats[player.name]) {
                        const setId = `${game.id}-set${set.number}`;
                        allStats[player.name].setsPlayed.add(setId);
                        allStats[player.name].gamesPlayed.add(game.id);
                        
                        // Only count wins for starting lineup players
                        if (set.score?.team > set.score?.opponent) {
                            allStats[player.name].gamesWon++;
                        }
                    }
                });

                // Only count substitutions for tracking total subs, not for win percentage
                set.substitutions?.forEach(sub => {
                    if (allStats[sub.inPlayer.name]) {
                        allStats[sub.inPlayer.name].totalSubstitutions += 1;
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

    const [sortField, setSortField] = useState<SortField>('name');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    return (
        <div className="p-4">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold dark:text-white">Statistics</h2>
                <select
                    value={selectedTeam || ''}
                    onChange={(e) => onTeamSelect(e.target.value)}
                    className="px-4 py-2 rounded-lg border dark:border-gray-600 dark:bg-secondary-dark dark:text-white"
                >
                    <option value="">Select Team</option>
                    {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                            {team.name}
                        </option>
                    ))}
                </select>
            </div>

            {!selectedTeam ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                    Please select a team to view statistics.
                </p>
            ) : (
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
                                    games.filter(game => game.teamId === selectedTeam && game.status !== 'in-progress').length) * 100 || 0).toFixed(0)}%
                            </p>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-secondary/50 rounded-xl p-4 shadow-lg">
                        <div className="flex justify-between items-center">
                            <div>
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
                            <div className="text-right">
                                <h3 className="text-sm text-gray-600 dark:text-gray-400">Team Average Win %</h3>
                                <p className="text-2xl font-bold text-primary">
                                    {(() => {
                                        const teamGames = games.filter(game => 
                                            game.teamId === selectedTeam && 
                                            game.status !== 'in-progress'
                                        );
                                        
                                        // Calculate total sets and won sets
                                        const setStats = teamGames.reduce((acc, game) => {
                                            const completedSets = game.sets.filter(set => set.score);
                                            acc.totalSets += completedSets.length;
                                            acc.wonSets += completedSets.filter(set => 
                                                (set.score?.team || 0) > (set.score?.opponent || 0)
                                            ).length;
                                            return acc;
                                        }, { totalSets: 0, wonSets: 0 });

                                        return setStats.totalSets > 0 
                                            ? ((setStats.wonSets / setStats.totalSets) * 100).toFixed(1) + '%'
                                            : '0%';
                                    })()}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-secondary/50 rounded-xl p-4 shadow-lg">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold dark:text-white">Player Statistics</h3>
                            <div className="relative group">
                                <HelpCircle className="w-5 h-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help" />
                                <div className="absolute right-0 w-72 p-4 bg-white dark:bg-secondary-dark rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 text-sm">
                                    <ul className="space-y-2 text-gray-600 dark:text-gray-300">
                                        <li><strong>Total Played Sets:</strong> Number of sets the player has participated in</li>
                                        <li><strong>Games:</strong> Total number of games played</li>
                                        <li><strong>Set %:</strong> Percentage of total sets played in their games</li>
                                        <li><strong>Win %:</strong> Percentage of sets won when playing</li>
                                        <li><strong>Trend:</strong> Performance compared to team average</li>
                                        <li><strong>Subs:</strong> Number of times substituted in</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-left text-sm text-gray-500 dark:text-gray-400">
                                        <th 
                                            className="pb-2 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                                            onClick={() => handleSort('name')}
                                        >
                                            <div className="flex items-center space-x-1">
                                                <span>Player</span>
                                                {sortField === 'name' && (
                                                    sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                                                )}
                                            </div>
                                        </th>
                                        <th 
                                            className="pb-2 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                                            onClick={() => handleSort('totalSets')}
                                        >
                                            <div className="flex items-center space-x-1">
                                                <span>Total Played Sets</span>
                                                {sortField === 'totalSets' && (
                                                    sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                                                )}
                                            </div>
                                        </th>
                                        <th 
                                            className="pb-2 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                                            onClick={() => handleSort('totalGames')}
                                        >
                                            <div className="flex items-center space-x-1">
                                                <span>Games</span>
                                                {sortField === 'totalGames' && (
                                                    sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                                                )}
                                            </div>
                                        </th>
                                        <th 
                                            className="pb-2 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                                            onClick={() => handleSort('setPercentage')}
                                        >
                                            <div className="flex items-center space-x-1">
                                                <span>Set %</span>
                                                {sortField === 'setPercentage' && (
                                                    sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                                                )}
                                            </div>
                                        </th>
                                        <th 
                                            className="pb-2 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                                            onClick={() => handleSort('winPercentage')}
                                        >
                                            <div className="flex items-center space-x-1">
                                                <span>Win %</span>
                                                {sortField === 'winPercentage' && (
                                                    sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                                                )}
                                            </div>
                                        </th>
                                        <th className="pb-2">Trend</th>
                                        <th 
                                            className="pb-2 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                                            onClick={() => handleSort('totalSubstitutions')}
                                        >
                                            <div className="flex items-center space-x-1">
                                                <span>Subs</span>
                                                {sortField === 'totalSubstitutions' && (
                                                    sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                                                )}
                                            </div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {players[selectedTeam]
                                        ?.map((player) => ({
                                            player,
                                            stats: playerStats[player.name] || {
                                                totalSets: 0,
                                                setPercentage: 0,
                                                totalGames: 0,
                                                winPercentage: 0,
                                                totalSubstitutions: 0
                                            }
                                        }))
                                        .sort((a, b) => {
                                            if (sortField === 'name') {
                                                return sortDirection === 'asc' 
                                                    ? a.player.name.localeCompare(b.player.name)
                                                    : b.player.name.localeCompare(a.player.name);
                                            }
                                            return sortDirection === 'asc'
                                                ? a.stats[sortField] - b.stats[sortField]
                                                : b.stats[sortField] - a.stats[sortField];
                                        })
                                        .map(({ player, stats }) => {
                                            // Get the team's overall set win percentage
                                            const teamSetWinRate = (() => {
                                                const teamGames = games.filter(game => 
                                                    game.teamId === selectedTeam && 
                                                    game.status !== 'in-progress'
                                                );
                                                
                                                const setStats = teamGames.reduce((acc, game) => {
                                                    const completedSets = game.sets.filter(set => set.score);
                                                    acc.totalSets += completedSets.length;
                                                    acc.wonSets += completedSets.filter(set => 
                                                        (set.score?.team || 0) > (set.score?.opponent || 0)
                                                    ).length;
                                                    return acc;
                                                }, { totalSets: 0, wonSets: 0 });

                                                return setStats.totalSets > 0 
                                                    ? (setStats.wonSets / setStats.totalSets) * 100
                                                    : 0;
                                            })();

                                            // Compare player's win percentage against team's overall set win percentage
                                            const isUpTrend = stats.winPercentage >= teamSetWinRate;
                                            
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
                                                    <td className="py-2 dark:text-white">{stats.setPercentage.toFixed(0)}%</td>
                                                    <td className="py-2 dark:text-white">{stats.winPercentage}%</td>
                                                    <td className="py-2">
                                                        {isUpTrend ? (
                                                            <TrendingUp className="w-5 h-5 text-green-500" />
                                                        ) : (
                                                            <TrendingDown className="w-5 h-5 text-red-500" />
                                                        )}
                                                    </td>
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