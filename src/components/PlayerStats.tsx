import React from 'react';
import { Player } from '../types/player';
import { TrainingSession } from '../types/training';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface PlayerStatsProps {
    player: Player;
    sessions: TrainingSession[];
    attendanceMap: { [key: string]: { [key: string]: boolean } };
    teamAverageRate: number;
    trend: 'up' | 'down';
    longestStreak: number;
}

interface PlayerDetailedStats {
    attendanceRate: number;
    totalSessions: number;
    presentCount: number;
    streak: number;
    lastTenSessions: boolean[];
    trend: 'up' | 'down' | 'stable';
}

const PlayerStats: React.FC<PlayerStatsProps> = ({ 
    player, 
    sessions, 
    attendanceMap,
    teamAverageRate,
    trend,
    longestStreak
}) => {
    const calculateDetailedStats = () => {
        const presentCount = sessions.reduce((count, session) => {
            return attendanceMap[session.id]?.[player.id] === true ? count + 1 : count;
        }, 0);

        const attendanceRate = (presentCount / sessions.length) * 100;

        // Get last 10 sessions attendance
        const lastTenSessions = sessions
            .slice(0, 10)
            .map(session => attendanceMap[session.id]?.[player.id] ?? false);

        return {
            attendanceRate,
            presentCount,
            totalSessions: sessions.length,
            lastTenSessions,
        };
    };

    const stats = calculateDetailedStats();

    return (
        <div className="bg-white dark:bg-secondary/50 rounded-lg p-3 shadow-sm mb-2">
            <div className="flex justify-between items-center mb-2">
                <div>
                    <h3 className="text-md font-semibold dark:text-white">{player.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">#{player.number} • {player.position}</p>
                </div>
                <div className="text-right">
                    <p className="text-lg font-bold text-primary">{stats.attendanceRate.toFixed(1)}%</p>
                    <div className="flex items-center justify-end space-x-1">
                        {trend === 'up' ? (
                            <TrendingUp className="w-4 h-4 text-green-500" />
                        ) : (
                            <TrendingDown className="w-4 h-4 text-red-500" />
                        )}
                        <span className="text-xs text-gray-500">vs avg {teamAverageRate.toFixed(1)}%</span>
                    </div>
                </div>
            </div>

            <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mb-1">
                <div>
                    Present: <span className="font-semibold">{stats.presentCount}/{stats.totalSessions}</span>
                </div>
                <div>
                    Longest Streak: <span className="font-semibold text-primary">{longestStreak}</span>
                </div>
            </div>

            {/* Last 10 Attendance Dots */}
            <div className="flex items-center">
                <p className="text-sm text-gray-500 dark:text-gray-400 mr-2">Last 10:</p>
                <div className="flex space-x-1">
                    {stats.lastTenSessions.map((present, idx) => (
                        <div 
                            key={idx}
                            className={`w-2 h-2 rounded-full ${present ? 'bg-green-500' : 'bg-red-500'}`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default PlayerStats; 