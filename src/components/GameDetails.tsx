import React from 'react';
import { X } from 'lucide-react';
import { Game } from '../types/game';

interface GameDetailsProps {
  game: Game;
  onClose: () => void;
}

const GameDetails: React.FC<GameDetailsProps> = ({ game, onClose }) => {
  // Calculate the actual sets won
  const setsWon = game.sets.reduce(
    (acc, set) => {
      if (set.score) {
        if (set.score.team > set.score.opponent) {
          acc.team++;
        } else if (set.score.opponent > set.score.team) {
          acc.opponent++;
        }
      }
      return acc;
    },
    { team: 0, opponent: 0 }
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-secondary rounded-xl p-6 w-[90%] max-w-md">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold dark:text-white">
              {game.opponent}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {new Date(game.date).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <span className={`text-lg font-semibold ${
              game.status === 'win' 
                ? 'text-green-600 dark:text-green-400' 
                : game.status === 'loss' 
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-600 dark:text-gray-400'
            }`}>
              {setsWon.team} - {setsWon.opponent}
            </span>
            <button 
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {game.sets.map((set, index) => (
            <div key={index} className="p-4 bg-gray-50 dark:bg-secondary-dark rounded-lg">
              <h3 className="font-medium dark:text-white mb-2">
                Set {set.number} {set.score ? `(${set.score.team}-${set.score.opponent})` : ''}
              </h3>
              {/* Add more set details as needed */}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GameDetails; 