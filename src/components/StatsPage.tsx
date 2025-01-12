import React from 'react';
import { BarChart3 } from 'lucide-react';

interface StatsPageProps {
  selectedTeam: string | null;
  players: Record<string, any[]>;
  teams: any[];
  onTeamSelect: (teamId: string) => void;
  games: any[];
  userId: string | undefined;
}

const StatsPage: React.FC<StatsPageProps> = ({
  selectedTeam,
  players,
  teams,
  onTeamSelect,
  games,
  userId
}) => {
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

  return (
    <div className="p-4">
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
    </div>
  );
};

export default StatsPage; 