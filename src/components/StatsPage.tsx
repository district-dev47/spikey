import React, { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Player } from '../types/player';
import { TrainingSession } from '../types/training';
import { chartOptions } from '../utils/chartConfig';
import { Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js/auto';
import { Timestamp } from 'firebase/firestore';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

// Helper function to convert Firestore Timestamp or Date to Date
const toDate = (date: Date | Timestamp): Date => {
    if (date instanceof Timestamp) {
        return date.toDate();
    }
    return date;
};

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
    trainingSessions?: TrainingSession[];
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
    trainingSessions = [],
    darkMode = true
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

    // Calculate attendance statistics
    const attendanceStats = useMemo(() => {
        setError(null);
        if (!selectedTeam) return null;
        
        try {
            if (!trainingSessions || trainingSessions.length === 0) {
                console.log('No training sessions available:', { 
                    selectedTeam, 
                    trainingSessions 
                });
                setError("No training sessions found for this team");
                return null;
            }

            const teamPlayers = players[selectedTeam] || [];
            if (!teamPlayers.length) {
                setError("No players found in team");
                return null;
            }

            // Get recent sessions (last 5)
            const recentSessions = trainingSessions
                .sort((a, b) => {
                    const dateA = toDate(a.date);
                    const dateB = toDate(b.date);
                    return dateB.getTime() - dateA.getTime();
                })
                .slice(0, 5)
                .map(session => {
                    const presentCount = (session.attendance || [])
                        .filter(record => record.present === true).length;
                    
                    return {
                        date: session.date,
                        presentCount,
                        totalCount: teamPlayers.length,
                        rate: (presentCount / teamPlayers.length) * 100,
                        sessionId: session.id || ''
                    };
                });

            // Calculate overall team attendance rate
            let totalAttendance = 0;
            trainingSessions.forEach(session => {
                const presentCount = (session.attendance || [])
                    .filter(record => record.present === true).length;
                const sessionRate = presentCount / teamPlayers.length;
                totalAttendance += sessionRate;
            });

            const teamAttendanceRate = (totalAttendance / trainingSessions.length) * 100;

            // Calculate individual player attendance rates
            const playerStats = teamPlayers.map(player => {
                const playerAttendance = trainingSessions.reduce((acc, session) => {
                    const record = session.attendance?.find(r => r.playerId === player.id);
                    return record?.present === true ? acc + 1 : acc;
                }, 0);
                
                return {
                    ...player,
                    attendanceRate: (playerAttendance / trainingSessions.length) * 100,
                    trend: 'up'
                };
            });

            return {
                teamRate: teamAttendanceRate,
                recentSessions,
                playerStats,
                trend: 'up'
            };

        } catch (err) {
            console.error('Error calculating attendance stats:', err);
            setError(err instanceof Error ? err.message : "Error calculating attendance statistics");
            return null;
        }
    }, [selectedTeam, trainingSessions, players]);

    // Add loading state for initial render
    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    // Add this inside the StatsPage component, after the attendanceStats calculation
    const attendanceChartData = useMemo(() => {
        if (!attendanceStats) return null;

        return {
            labels: attendanceStats.recentSessions.map(session => 
                toDate(session.date).toLocaleDateString()
            ).reverse(),
            datasets: [
                {
                    label: 'Attendance Rate (%)',
                    data: attendanceStats.recentSessions.map(session => session.rate).reverse(),
                    backgroundColor: 'rgba(99, 102, 241, 0.5)',
                    borderColor: 'rgb(99, 102, 241)',
                    borderWidth: 1,
                },
            ],
        };
    }, [attendanceStats]);

    const chartOptions = {
        responsive: true,
        plugins: {
            legend: {
                display: false,
            },
            title: {
                display: true,
                text: 'Recent Attendance Trend',
                color: darkMode ? 'white' : 'rgb(17, 24, 39)',
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                max: 100,
                ticks: {
                    color: darkMode ? 'rgb(156, 163, 175)' : 'rgb(55, 65, 81)',
                },
                grid: {
                    color: darkMode ? 'rgba(75, 85, 99, 0.3)' : 'rgba(209, 213, 219, 0.5)',
                },
            },
            x: {
                ticks: {
                    color: darkMode ? 'rgb(156, 163, 175)' : 'rgb(55, 65, 81)',
                },
                grid: {
                    display: false,
                },
            },
        },
    };

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

            {/* Team Statistics */}
            {selectedTeam && attendanceStats && (
                <>
                    {/* Attendance Statistics */}
                    <div className="mt-6">
                        <h3 className="text-lg font-semibold dark:text-white mb-4">Attendance Statistics</h3>
                        
                        {/* Team Attendance Overview */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-white dark:bg-secondary/50 rounded-xl p-4 shadow-sm">
                                <h4 className="text-sm text-gray-500 dark:text-gray-400">Team Attendance Rate</h4>
                                <p className="text-2xl font-bold text-primary">
                                    {attendanceStats.teamRate.toFixed(1)}%
                                </p>
                                {attendanceStats.trend === 'up' ? (
                                    <TrendingUp className="w-5 h-5 text-green-500 mt-1" />
                                ) : (
                                    <TrendingDown className="w-5 h-5 text-red-500 mt-1" />
                                )}
                            </div>
                            <div className="bg-white dark:bg-secondary/50 rounded-xl p-4 shadow-sm">
                                <h4 className="text-sm text-gray-500 dark:text-gray-400">Last Session</h4>
                                <p className="text-2xl font-bold text-primary">
                                    {attendanceStats.recentSessions[0]?.rate.toFixed(1)}%
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {attendanceStats.recentSessions[0]?.presentCount}/{attendanceStats.recentSessions[0]?.totalCount} players
                                </p>
                            </div>
                        </div>

                        {/* Recent Sessions */}
                        <div className="bg-white dark:bg-secondary/50 rounded-xl p-4 shadow-sm mb-6">
                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                Last 5 Sessions
                            </h4>
                            <div className="space-y-3">
                                {attendanceStats?.recentSessions.map((session) => (
                                    <div key={session.sessionId} className="flex justify-between items-center">
                                        <span className="text-sm text-gray-600 dark:text-gray-400">
                                            {toDate(session.date).toLocaleDateString()}
                                        </span>
                                        <div className="text-right">
                                            <span className="font-medium text-primary">
                                                {session.rate.toFixed(1)}%
                                            </span>
                                            <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                                                ({session.presentCount}/{session.totalCount})
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Individual Player Stats */}
                        <div className="bg-white dark:bg-secondary/50 rounded-xl p-4 shadow-sm">
                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                Player Attendance
                            </h4>
                            <div className="space-y-3">
                                {attendanceStats.playerStats
                                    .sort((a, b) => b.attendanceRate - a.attendanceRate)
                                    .map((player) => (
                                        <div key={`player-${player.id || player.number}`} className="flex justify-between items-center">
                                            <div>
                                                <span className="text-gray-800 dark:text-white">
                                                    {player.name}
                                                </span>
                                                <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                                                    #{player.number}
                                                </span>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <span className="font-medium text-primary">
                                                    {player.attendanceRate.toFixed(1)}%
                                                </span>
                                                {player.trend === 'up' ? (
                                                    <TrendingUp className="w-4 h-4 text-green-500" />
                                                ) : (
                                                    <TrendingDown className="w-4 h-4 text-red-500" />
                                                )}
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Attendance Chart */}
            {attendanceChartData && (
                <div className="bg-white dark:bg-secondary/50 rounded-xl p-4 shadow-sm mb-6">
                    <Bar data={attendanceChartData} options={chartOptions} />
                </div>
            )}
        </div>
    );
};

export default StatsPage; 