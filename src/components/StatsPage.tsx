import React, { useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Player } from '../types/player';
import { TrainingSession } from '../types/training';
import { Timestamp } from 'firebase/firestore';

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

const StatsPage: React.FC<StatsPageProps> = ({
    selectedTeam,
    players,
    teams,
    onTeamSelect,
    games,
    userId,
    darkMode = false,
}) => {
    // Add loading and error states
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Calculate overall statistics
    const totalGames = games.length;
    const wins = games.filter(game => game.status === 'win').length;
    const losses = games.filter(game => game.status === 'loss').length;
    const winPercentage = totalGames > 0 ? Math.round((wins / totalGames) * 100).toString() : '0';

    // Calculate team-specific statistics if a team is selected
    const teamGames = selectedTeam
        ? games.filter((game: GameStats) => game.teamId === selectedTeam)
        : [];
    const teamWins = teamGames.filter(game => game.status === 'win').length;
    const teamLosses = teamGames.filter(game => game.status === 'loss').length;
    const teamWinPercentage = teamGames.length > 0
        ? Math.round((teamWins / teamGames.length) * 100).toString()
        : '0';

    // Add loading state for initial render
    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="p-4">
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg mb-4">
                    {error}
                </div>
            )}

            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold dark:text-white">Team Statistics</h2>
                <select
                    value={selectedTeam}
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

            {/* Overall Statistics */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-white dark:bg-secondary/50 rounded-xl p-4 shadow-sm">
                    <h3 className="text-sm text-gray-500 dark:text-gray-400">Total Games</h3>
                    <p className="text-2xl font-bold text-primary">{totalGames}</p>
                </div>
                <div className="bg-white dark:bg-secondary/50 rounded-xl p-4 shadow-sm">
                    <h3 className="text-sm text-gray-500 dark:text-gray-400">Overall Win Rate</h3>
                    <p className="text-2xl font-bold text-primary">{winPercentage}%</p>
                </div>
                <div className="bg-white dark:bg-secondary/50 rounded-xl p-4 shadow-sm">
                    <h3 className="text-sm text-gray-500 dark:text-gray-400">Wins</h3>
                    <p className="text-2xl font-bold text-green-500">{wins}</p>
                </div>
                <div className="bg-white dark:bg-secondary/50 rounded-xl p-4 shadow-sm">
                    <h3 className="text-sm text-gray-500 dark:text-gray-400">Losses</h3>
                    <p className="text-2xl font-bold text-red-500">{losses}</p>
                </div>
            </div>

            {/* Team Statistics */}
            {selectedTeam && (
                <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Team Statistics</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white dark:bg-secondary/50 rounded-xl p-4 shadow-sm">
                            <h3 className="text-sm text-gray-500 dark:text-gray-400">Team Games</h3>
                            <p className="text-2xl font-bold text-primary">{teamGames.length}</p>
                        </div>
                        <div className="bg-white dark:bg-secondary/50 rounded-xl p-4 shadow-sm">
                            <h3 className="text-sm text-gray-500 dark:text-gray-400">Team Win Rate</h3>
                            <p className="text-2xl font-bold text-primary">{teamWinPercentage}%</p>
                        </div>
                        <div className="bg-white dark:bg-secondary/50 rounded-xl p-4 shadow-sm">
                            <h3 className="text-sm text-gray-500 dark:text-gray-400">Team Wins</h3>
                            <p className="text-2xl font-bold text-green-500">{teamWins}</p>
                        </div>
                        <div className="bg-white dark:bg-secondary/50 rounded-xl p-4 shadow-sm">
                            <h3 className="text-sm text-gray-500 dark:text-gray-400">Team Losses</h3>
                            <p className="text-2xl font-bold text-red-500">{teamLosses}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StatsPage; 