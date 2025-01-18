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
        
        // Include all games that have sets with scores
        const gamesWithScoredSets = teamGames.filter(game => 
            game.sets?.some(set => set.score)
        ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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
        gamesWithScoredSets.forEach(game => {
            const scoredSets = game.sets?.filter(set => set.score) || [];
            
            scoredSets.forEach(set => {
                const lineupNames = set.lineup?.map(p => p.name) || [];
                const setId = `${game.id}-set${set.number}`;
                
                // Update stats for each player in the lineup
                lineupNames.forEach(playerName => {
                    if (allStats[playerName]) {
                        allStats[playerName].setsPlayed.add(setId);
                        allStats[playerName].gamesPlayed.add(game.id);
                        
                        if (game === gamesWithScoredSets[0]) {
                            allStats[playerName].lastGameSets = 1;
                        }
                    }
                });
            });
        });

        // Calculate total scored sets
        const totalScoredSets = gamesWithScoredSets.reduce((acc, game) => 
            acc + (game.sets?.filter(set => set.score)?.length || 0), 0
        );

        // Convert to final format - use player names as keys instead of IDs
        return teamPlayers.reduce((acc, player) => {
            const stats = allStats[player.name];
            const setsCount = stats?.setsPlayed.size || 0;
            
            // Use player name as key instead of ID
            acc[player.name] = {
                totalSets: setsCount,
                lastGameSets: stats?.lastGameSets || 0,
                setPercentage: totalScoredSets > 0 ? (setsCount / totalScoredSets) * 100 : 0,
                totalGames: stats?.gamesPlayed.size || 0,
                totalSubstitutions: 0,
                averageRotationPosition: stats?.rotationPositionCount > 0 
                    ? stats.rotationPositionSum / stats.rotationPositionCount 
                    : 0,
                winPercentage: stats?.gamesPlayed.size > 0 
                    ? (stats.gamesWon / stats.gamesPlayed.size) * 100 
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
                        <h3 className="text-lg font-semibold mb-4 dark:text-white">Player Statistics</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-left text-sm text-gray-500 dark:text-gray-400">
                                        <th className="pb-2">Player</th>
                                        <th className="pb-2">Total Played Sets</th>
                                        <th className="pb-2">Last Game</th>
                                        <th className="pb-2">Set %</th>
                                        <th className="pb-2">Games</th>
                                        <th className="pb-2">Win %</th>
                                        <th className="pb-2">Avg Pos</th>
                                        <th className="pb-2">Subs</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {players[selectedTeam]?.map((player) => {
                                        // Use player name to look up stats instead of ID
                                        const stats = playerStats[player.name] || {
                                            totalSets: 0,
                                            lastGameSets: 0,
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
                                                <td className="py-2 dark:text-white">{stats.lastGameSets}</td>
                                                <td className="py-2 dark:text-white">{stats.setPercentage.toFixed(1)}%</td>
                                                <td className="py-2 dark:text-white">{stats.totalGames}</td>
                                                <td className="py-2 dark:text-white">{stats.winPercentage.toFixed(1)}%</td>
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