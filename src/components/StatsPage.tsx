import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, RadarChart, Radar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Cell
} from 'recharts';
import { getTeamStatistics, getPlayerStatistics, TeamStatistics, PlayerStatistics } from '../firebase/Statistics';

interface StatsPageProps {
  selectedTeam: string | null;
  players: Record<string, any[]>;
  teams: { id: string; name: string }[];
  onTeamSelect: (teamId: string) => void;
}

const StatsPage: React.FC<StatsPageProps> = ({ selectedTeam, players, teams, onTeamSelect }) => {
  const [teamStats, setTeamStats] = useState<TeamStatistics | null>(null);
  const [playerStats, setPlayerStats] = useState<Record<string, PlayerStatistics[]>>({});
  const [timeRange, setTimeRange] = useState<'all' | '30days' | '90days'>('all');
  const [loading, setLoading] = useState(true);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  useEffect(() => {
    const fetchStats = async () => {
      if (selectedTeam) {
        setLoading(true);
        try {
          // Fetch team statistics
          const teamStatistics = await getTeamStatistics(selectedTeam);
          setTeamStats(teamStatistics);

          // Fetch statistics for each player
          const playerStatsPromises = players[selectedTeam].map(player =>
            getPlayerStatistics(player.id)
          );
          const playerStatsResults = await Promise.all(playerStatsPromises);
          
          const statsMap: Record<string, PlayerStatistics[]> = {};
          players[selectedTeam].forEach((player, index) => {
            statsMap[player.id] = playerStatsResults[index];
          });
          setPlayerStats(statsMap);
        } catch (error) {
          console.error('Error fetching statistics:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchStats();
  }, [selectedTeam, players]);

  if (!selectedTeam) {
    return (
      <div className="p-4">
        <div className="bg-white dark:bg-secondary/50 rounded-xl p-4 shadow-sm mb-4">
          <h3 className="text-lg font-semibold mb-4 dark:text-white">Select Team</h3>
          <select
            className="w-full px-4 py-2 rounded-lg border border-primary dark:border-primary bg-white dark:bg-secondary text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary hover:border-primary/80 cursor-pointer"
            value=""
            onChange={(e) => onTeamSelect(e.target.value)}
          >
            <option value="" className="bg-white dark:bg-secondary">Choose a team</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id} className="bg-white dark:bg-secondary">
                {team.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="mt-2 text-gray-500 dark:text-gray-400">Loading statistics...</p>
      </div>
    );
  }

  const winRateData = [
    { name: 'Wins', value: teamStats?.wins || 0 },
    { name: 'Losses', value: teamStats?.losses || 0 }
  ];

  const setDistributionData = [
    { name: 'Sets Won', value: teamStats?.setsWon || 0 },
    { name: 'Sets Lost', value: teamStats?.setsLost || 0 }
  ];

  const playerPerformanceData = players[selectedTeam].map(player => {
    const stats = playerStats[player.id] || [];
    const totalPoints = stats.reduce((sum, stat) => sum + stat.pointsScored, 0);
    const totalBlocks = stats.reduce((sum, stat) => sum + stat.blocks, 0);
    const totalServes = stats.reduce((sum, stat) => sum + stat.serves, 0);
    
    return {
      name: player.name,
      points: totalPoints,
      blocks: totalBlocks,
      serves: totalServes
    };
  });

  const positionDistribution = players[selectedTeam].reduce((acc: Record<string, number>, player) => {
    acc[player.position] = (acc[player.position] || 0) + 1;
    return acc;
  }, {});

  const positionData = Object.entries(positionDistribution).map(([position, count]) => ({
    name: position,
    value: count
  }));

  return (
    <div className="p-4 space-y-6">
      {/* Team Selection */}
      <div className="bg-white dark:bg-secondary/50 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold dark:text-white">
            {teams.find(t => t.id === selectedTeam)?.name || 'Team Statistics'}
          </h3>
          <select
            className="px-4 py-2 rounded-lg border border-primary dark:border-primary bg-white dark:bg-secondary text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary hover:border-primary/80 cursor-pointer"
            value={selectedTeam}
            onChange={(e) => onTeamSelect(e.target.value)}
          >
            {teams.map((team) => (
              <option key={team.id} value={team.id} className="bg-white dark:bg-secondary">
                {team.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Time Range Filter */}
      <div className="flex justify-end space-x-2 mb-4">
        <button
          onClick={() => setTimeRange('all')}
          className={`px-3 py-1 rounded-lg ${
            timeRange === 'all' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-secondary text-gray-600 dark:text-gray-300'
          }`}
        >
          All Time
        </button>
        <button
          onClick={() => setTimeRange('30days')}
          className={`px-3 py-1 rounded-lg ${
            timeRange === '30days' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-secondary text-gray-600 dark:text-gray-300'
          }`}
        >
          30 Days
        </button>
        <button
          onClick={() => setTimeRange('90days')}
          className={`px-3 py-1 rounded-lg ${
            timeRange === '90days' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-secondary text-gray-600 dark:text-gray-300'
          }`}
        >
          90 Days
        </button>
      </div>

      {/* Team Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-secondary/50 rounded-xl p-4 shadow-sm">
          <h3 className="text-sm text-gray-500 dark:text-gray-400">Win Rate</h3>
          <p className="text-2xl font-bold text-primary">
            {teamStats ? Math.round((teamStats.wins / teamStats.totalGames) * 100) : 0}%
          </p>
        </div>
        <div className="bg-white dark:bg-secondary/50 rounded-xl p-4 shadow-sm">
          <h3 className="text-sm text-gray-500 dark:text-gray-400">Total Games</h3>
          <p className="text-2xl font-bold text-primary">{teamStats?.totalGames || 0}</p>
        </div>
        <div className="bg-white dark:bg-secondary/50 rounded-xl p-4 shadow-sm">
          <h3 className="text-sm text-gray-500 dark:text-gray-400">Longest Win Streak</h3>
          <p className="text-2xl font-bold text-primary">{teamStats?.longestWinStreak || 0}</p>
        </div>
        <div className="bg-white dark:bg-secondary/50 rounded-xl p-4 shadow-sm">
          <h3 className="text-sm text-gray-500 dark:text-gray-400">Avg Points/Set</h3>
          <p className="text-2xl font-bold text-primary">
            {teamStats ? Math.round(teamStats.averagePointsPerSet) : 0}
          </p>
        </div>
      </div>

      {/* Win/Loss Distribution */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-secondary/50 rounded-xl p-4 shadow-sm">
          <h3 className="text-lg font-semibold mb-4 dark:text-white">Win/Loss Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={winRateData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {winRateData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Set Distribution */}
        <div className="bg-white dark:bg-secondary/50 rounded-xl p-4 shadow-sm">
          <h3 className="text-lg font-semibold mb-4 dark:text-white">Set Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={setDistributionData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {setDistributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Player Performance */}
      <div className="bg-white dark:bg-secondary/50 rounded-xl p-4 shadow-sm">
        <h3 className="text-lg font-semibold mb-4 dark:text-white">Player Performance</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={playerPerformanceData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="points" fill="#8884d8" name="Points" />
            <Bar dataKey="blocks" fill="#82ca9d" name="Blocks" />
            <Bar dataKey="serves" fill="#ffc658" name="Serves" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Position Distribution */}
      <div className="bg-white dark:bg-secondary/50 rounded-xl p-4 shadow-sm">
        <h3 className="text-lg font-semibold mb-4 dark:text-white">Position Distribution</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={positionData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {positionData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default StatsPage; 