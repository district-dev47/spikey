import React, { useMemo, useState } from 'react';
import { BarChart3, TrendingDown, TrendingUp } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

interface StatsPageProps {
  selectedTeam: string | null;
  players: Record<string, any[]>;
  teams: any[];
  onTeamSelect: (teamId: string) => void;
  games: any[];
  userId: string | undefined;
  trainingSessions: any[];
  darkMode?: boolean;
}

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

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
    ? games.filter(game => game.teamId === selectedTeam)
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

      // Debug logs for raw data
      console.log('Calculating attendance with:', {
        numberOfSessions: trainingSessions.length,
        numberOfPlayers: teamPlayers.length,
        sessions: trainingSessions.map(s => ({
          id: s.id,
          date: s.date?.toDate?.(),
          attendanceCount: s.attendance?.length,
          presentPlayers: s.attendance?.filter(a => a.present === true).length
        })),
        players: teamPlayers.map(p => ({
          id: p.id,
          name: p.name,
          number: p.number
        }))
      });

      // Calculate overall team attendance rate
      let totalAttendance = 0;
      trainingSessions.forEach((session, index) => {
        const presentCount = (session.attendance || [])
          .filter(record => record.present === true).length;
        
        const sessionRate = presentCount / teamPlayers.length;
        totalAttendance += sessionRate;

        console.log(`Session ${index + 1} calculation:`, {
          sessionId: session.id,
          date: session.date?.toDate?.(),
          presentCount,
          totalPlayers: teamPlayers.length,
          sessionRate: sessionRate * 100,
          calculation: `${presentCount} / ${teamPlayers.length} = ${sessionRate}`
        });
      });

      const teamAttendanceRate = (totalAttendance / trainingSessions.length) * 100;

      console.log('Final attendance calculation:', {
        totalAttendance,
        numberOfSessions: trainingSessions.length,
        finalRate: teamAttendanceRate,
        calculation: `(${totalAttendance} / ${trainingSessions.length}) * 100 = ${teamAttendanceRate}`
      });

      // Get recent sessions (last 5)
      const recentSessions = trainingSessions
        .sort((a, b) => b.date.toMillis() - a.date.toMillis())
        .slice(0, 5)
        .map(session => {
          const presentCount = (session.attendance || [])
            .filter(record => record.present === true).length;

          const rate = (presentCount / teamPlayers.length) * 100;
          
          console.log('Recent session calculation:', {
            sessionId: session.id,
            date: session.date?.toDate?.(),
            presentCount,
            totalPlayers: teamPlayers.length,
            rate,
            calculation: `(${presentCount} / ${teamPlayers.length}) * 100 = ${rate}`
          });

          return {
            date: session.date,
            presentCount,
            totalCount: teamPlayers.length,
            rate,
            sessionId: session.id
          };
        });

      // Calculate individual player attendance rates
      const playerStats = teamPlayers.map(player => {
        const playerAttendance = trainingSessions.reduce((acc, session) => {
          const record = session.attendance?.find(r => r.playerId === player.id);
          const isPresent = record?.present === true;
          
          console.log(`Player ${player.name} attendance for session ${session.id}:`, {
            present: isPresent,
            record
          });
          
          return isPresent ? acc + 1 : acc;
        }, 0);
        
        const attendanceRate = (playerAttendance / trainingSessions.length) * 100;

        console.log(`Player ${player.name} final calculation:`, {
          sessionsAttended: playerAttendance,
          totalSessions: trainingSessions.length,
          rate: attendanceRate,
          calculation: `(${playerAttendance} / ${trainingSessions.length}) * 100 = ${attendanceRate}`
        });

        return {
          ...player,
          attendanceRate,
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
      console.error('Error calculating attendance stats:', {
        error: err,
        trainingSessions,
        players: players[selectedTeam],
        selectedTeam
      });
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
        session.date.toDate().toLocaleDateString()
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

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold dark:text-white">Statistics</h2>
        <BarChart3 className="w-6 h-6 text-primary" />
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

      {/* Team Selection */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Team</h3>
        <div className="space-y-2">
          {teams.map(team => (
            <button
              key={team.id}
              onClick={() => onTeamSelect(selectedTeam === team.id ? '' : team.id)}
              className={`w-full text-left p-3 rounded-lg transition-colors ${
                selectedTeam === team.id
                  ? 'bg-primary/10 text-primary'
                  : 'bg-white dark:bg-secondary/50 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-secondary/70'
              }`}
            >
              {team.name}
            </button>
          ))}
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
                {attendanceStats.recentSessions.map((session) => (
                  <div key={`session-${session.sessionId}`} className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {session.date.toDate().toLocaleDateString()}
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