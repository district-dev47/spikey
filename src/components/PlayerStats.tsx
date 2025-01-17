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
    trend 
}) => {
    const calculateDetailedStats = (): PlayerDetailedStats => {
        const presentCount = sessions.reduce((count, session) => {
            return attendanceMap[session.id]?.[player.id] === true ? count + 1 : count;
        }, 0);

        // Calculate last 10 sessions attendance
        const lastTenSessions = sessions
            .slice(0, 10)
            .map(session => attendanceMap[session.id]?.[player.id] ?? false);

        // Calculate current streak
        let streak = 0;
        for (const session of sessions) {
            if (attendanceMap[session.id]?.[player.id]) {
                streak++;
            } else {
                break;
            }
        }

        // Calculate trend based on last 10 sessions split into two groups of 5
        const recentAttendance = sessions.slice(0, 5).filter(s => attendanceMap[s.id]?.[player.id]).length;
        const previousAttendance = sessions.slice(5, 10).filter(s => attendanceMap[s.id]?.[player.id]).length;
        const trend = recentAttendance > previousAttendance ? 'up' : recentAttendance < previousAttendance ? 'down' : 'stable';

        return {
            attendanceRate: (presentCount / sessions.length) * 100,
            totalSessions: sessions.length,
            presentCount,
            streak,
            lastTenSessions,
            trend
        };
    };

    const stats = calculateDetailedStats();

    return (
        <div className="bg-white dark:bg-secondary/50 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-lg font-semibold dark:text-white">{player.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">#{player.number} • {player.position}</p>
                </div>
                <div className="text-right">
                    <p className="text-2xl font-bold text-primary">
                        {stats.attendanceRate.toFixed(1)}%
                    </p>
                    <div className="flex items-center justify-end space-x-1">
                        {trend === 'up' ? (
                            <TrendingUp className="w-4 h-4 text-green-500" />
                        ) : (
                            <TrendingDown className="w-4 h-4 text-red-500" />
                        )}
                        <span className="text-sm text-gray-500">
                            vs team avg {teamAverageRate.toFixed(1)}%
                        </span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                    <p className="text-sm text-gray-500">Present</p>
                    <p className="text-lg font-semibold dark:text-white">
                        {stats.presentCount}/{stats.totalSessions}
                    </p>
                </div>
                <div>
                    <p className="text-sm text-gray-500">Current Streak</p>
                    <p className="text-lg font-semibold dark:text-white">{stats.streak}</p>
                </div>
                <div>
                    <p className="text-sm text-gray-500">Last 10</p>
                    <div className="flex flex-wrap gap-1">
                        {stats.lastTenSessions.map((present, idx) => (
                            <div 
                                key={idx}
                                className={`w-2 h-2 rounded-full ${
                                    present ? 'bg-green-500' : 'bg-red-500'
                                }`}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlayerStats; 