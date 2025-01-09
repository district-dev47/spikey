import React, { useState, useEffect } from 'react';
import { Trophy, Users, Calendar, BarChart3, Sun, Moon, ChevronRight, X, Plus, Edit } from 'lucide-react';
import { createTeam, getAllTeams, addPlayerToTeam, getTeamPlayers, deleteTeam, deletePlayer, syncTeamPlayerCount, createGame, updateGameSet, getAllGames, deleteGame } from './firebase/FirestoreExample';
import { db } from './firebase/firebase';

interface Player {
  name: string;
  number: string;
  position: string;
}

interface Team {
  id: string;
  name: string;
  playerCount: number;
}

interface Set {
  number: number;
  lineup: LineupPlayer[];
  score?: {
    team: number;
    opponent: number;
  };
}

interface Game {
  id: string;
  teamId: string;
  opponent: string;
  date: string;
  status: 'win' | 'loss' | 'in-progress';
  sets: Set[];
  score?: {
    team: number;
    opponent: number;
  };
}

interface LineupPlayer extends Player {
  position: string;
  rotationPosition: number;
}

function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [showNewTeamModal, setShowNewTeamModal] = useState(false);
  const [showNewPlayerModal, setShowNewPlayerModal] = useState(false);
  const [showNewGameModal, setShowNewGameModal] = useState(false);
  const [showLineupModal, setShowLineupModal] = useState(false);
  const [showSetScoreModal, setShowSetScoreModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'team' | 'games' | 'stats'>('team');
  const [newTeamName, setNewTeamName] = useState('');
  const [newPlayer, setNewPlayer] = useState<Player>({
    name: '',
    number: '',
    position: 'Setter'
  });
  const [newGame, setNewGame] = useState({
    teamId: '',
    opponent: '',
  });
  const [currentLineup, setCurrentLineup] = useState<LineupPlayer[]>([]);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [currentSetNumber, setCurrentSetNumber] = useState(1);
  const [setScore, setSetScore] = useState({ team: 0, opponent: 0 });

  const [teams, setTeams] = useState<Team[]>([
    { id: '1', name: 'Thunder Hawks', playerCount: 12 },
    { id: '2', name: 'Sky Strikers', playerCount: 10 },
    { id: '3', name: 'Lightning Spikers', playerCount: 14 },
  ]);

  const [games, setGames] = useState<Game[]>([
    {
      id: '1',
      teamId: '1',
      opponent: 'Blazing Spikes',
      date: '2024-03-15',
      status: 'win',
      sets: [
        {
          number: 1,
          lineup: [],
          score: { team: 25, opponent: 20 }
        }
      ],
      score: { team: 3, opponent: 1 }
    }
  ]);

  const [players, setPlayers] = useState<Record<string, Player[]>>({
    '1': [
      { name: 'Mike Johnson', number: '7', position: 'Setter' },
      { name: 'Sarah Lee', number: '12', position: 'Outside Hitter' },
      { name: 'Tom Wilson', number: '4', position: 'Middle Blocker' },
    ],
    '2': [
      { name: 'Alex Chen', number: '9', position: 'Libero' },
      { name: 'Emma Davis', number: '5', position: 'Outside Hitter' },
    ],
    '3': [
      { name: 'James Smith', number: '1', position: 'Setter' },
      { name: 'Lisa Brown', number: '8', position: 'Middle Blocker' },
    ],
  });

  const positions = [
    'Setter',
    'Outside Hitter',
    'Middle Blocker',
    'Opposite Hitter',
    'Libero',
    'Defensive Specialist'
  ];

  useEffect(() => {
    document.documentElement.classList.add('dark');

    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    // Verify Firebase connection
    if (!db) {
      console.error('Firestore not initialized!');
      return;
    }
    console.log('Firestore connection verified');
  }, []);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const fetchedTeams = await getAllTeams();
        
        // Sync player counts for all teams
        for (const team of fetchedTeams) {
          await syncTeamPlayerCount(team.id);
        }
        
        // Fetch teams again to get updated counts
        const updatedTeams = await getAllTeams();
        setTeams(updatedTeams);
        
        // Fetch players for each team
        const playersObj = {};
        for (const team of updatedTeams) {
          const teamPlayers = await getTeamPlayers(team.id);
          playersObj[team.id] = teamPlayers;
        }
        setPlayers(playersObj);
      } catch (error) {
        console.error("Error fetching teams:", error);
        alert("Failed to load teams. Please refresh the page.");
      }
    };

    fetchTeams();
  }, []);

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const fetchedGames = await getAllGames();
        setGames(fetchedGames);
      } catch (error) {
        console.error("Error fetching games:", error);
        alert("Failed to load games. Please refresh the page.");
      }
    };

    fetchGames();
  }, []);

  const handleAddTeam = async () => {
    if (newTeamName.trim()) {
      try {
        const docRef = await createTeam({
          name: newTeamName.trim(),
          playerCount: 0,
          createdAt: new Date()
        });

        const newTeam = {
          id: docRef.id,
          name: newTeamName.trim(),
          playerCount: 0
        };
        
        setTeams([...teams, newTeam]);
        setPlayers({ ...players, [newTeam.id]: [] });
        setNewTeamName('');
        setShowNewTeamModal(false);
        
        console.log("Team created successfully with ID:", docRef.id);
      } catch (error) {
        console.error("Error creating team:", error);
        // Add user feedback here
        alert("Failed to create team. Please try again.");
      }
    }
  };

  const handleAddPlayer = async () => {
    if (selectedTeam && newPlayer.name && newPlayer.number) {
      try {
        await addPlayerToTeam(selectedTeam, newPlayer);
        
        // Update local state
        const updatedPlayers = {
          ...players,
          [selectedTeam]: [...players[selectedTeam], newPlayer]
        };
        setPlayers(updatedPlayers);
        
        // Fetch updated team data to get new player count
        const fetchedTeams = await getAllTeams();
        setTeams(fetchedTeams);
        
        setNewPlayer({ name: '', number: '', position: 'Setter' });
        setShowNewPlayerModal(false);
      } catch (error) {
        console.error("Error adding player:", error);
        alert("Failed to add player. Please try again.");
      }
    }
  };

  const handleAddGame = async () => {
    if (newGame.teamId && newGame.opponent) {
      try {
        // Create initial game data
        const newGameData = {
          teamId: newGame.teamId,
          opponent: newGame.opponent,
          date: new Date().toISOString().split('T')[0],
          status: 'in-progress' as const,
          sets: [] as Set[],
          createdAt: new Date()
        };

        const gameRef = await createGame(newGameData);
        
        const newGameEntry: Game = {
          id: gameRef.id,
          ...newGameData
        };

        setGames(prevGames => [...prevGames, newGameEntry]);
        setSelectedGame(newGameEntry);
        setNewGame({ teamId: '', opponent: '' });
        setShowNewGameModal(false);
        setCurrentSetNumber(1);
        // Show lineup modal after creating game
        setShowLineupModal(true);
      } catch (error) {
        console.error("Error creating game:", error);
        alert("Failed to create game. Please try again.");
      }
    }
  };

  const handleSetLineup = async () => {
    if (selectedGame && currentLineup.length === 6) {
      try {
        const newSet: Set = {
          number: currentSetNumber,
          lineup: currentLineup,
        };

        const result = await updateGameSet(selectedGame.id, newSet);
        
        const updatedGame = {
          ...selectedGame,
          sets: result.sets,
          status: result.status,
          finalScore: result.finalScore
        };

        setGames(prevGames => 
          prevGames.map(game => game.id === selectedGame.id ? updatedGame : game)
        );
        
        setSelectedGame(updatedGame);
        setShowLineupModal(false);
        setCurrentLineup([]);
        // Return to games overview after setting lineup
        setActiveTab('games');
        // Show score modal for the first set
        setShowSetScoreModal(true);
      } catch (error) {
        console.error("Error setting lineup:", error);
        alert("Failed to set lineup. Please try again.");
      }
    } else {
      alert("Please select 6 players for the lineup.");
    }
  };

  const handleSetScore = async () => {
    if (selectedGame) {
      try {
        // Validate score
        if (setScore.team < 0 || setScore.opponent < 0) {
          alert("Scores cannot be negative");
          return;
        }

        // Regular set validation
        if (setScore.team < 25 && setScore.opponent < 25) {
          alert("Sets must reach at least 25 points");
          return;
        }
        if (Math.abs(setScore.team - setScore.opponent) < 2) {
          alert("One team must win by 2 points");
          return;
        }

        const newSet: Set = {
          number: currentSetNumber,
          lineup: currentLineup,
          score: setScore
        };

        const result = await updateGameSet(selectedGame.id, newSet);

        const updatedGame = {
          ...selectedGame,
          sets: result.sets,
          status: result.status,
          finalScore: result.finalScore
        };

        setGames(games.map(game => 
          game.id === selectedGame.id ? updatedGame : game
        ));

        setSelectedGame(updatedGame);
        setShowSetScoreModal(false);
        setSetScore({ team: 0, opponent: 0 });

        if (result.status === 'in-progress') {
          setCurrentSetNumber(prev => prev + 1);
          // Return to games overview
          setActiveTab('games');
        } else {
          // Game is complete
          alert(`Game Complete! ${result.status === 'win' ? 'Your team won!' : 'Your team lost.'} Final score: ${result.finalScore?.team}-${result.finalScore?.opponent}`);
          // Return to games overview
          setActiveTab('games');
        }
      } catch (error) {
        console.error("Error updating game:", error);
        alert("Failed to update game score. Please try again.");
      }
    }
  };

  const handleDeletePlayer = async (teamId: string, playerId: string, playerName: string) => {
    const isConfirmed = window.confirm(`Are you sure you want to remove ${playerName} from the team?`);
    
    if (isConfirmed) {
      try {
        await deletePlayer(teamId, playerId);
        
        // Update local state
        const updatedPlayers = {
          ...players,
          [teamId]: players[teamId].filter(p => p.id !== playerId)
        };
        setPlayers(updatedPlayers);
        
        // Fetch updated team data to get new player count
        const fetchedTeams = await getAllTeams();
        setTeams(fetchedTeams);
      } catch (error) {
        console.error("Error deleting player:", error);
        alert("Failed to remove player. Please try again.");
      }
    }
  };

  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    const isConfirmed = window.confirm(
      `Are you sure you want to delete ${teamName}?\nThis will also remove all players from this team.`
    );
    
    if (isConfirmed) {
      try {
        await deleteTeam(teamId);
        
        // Update local state
        setTeams(teams.filter(t => t.id !== teamId));
        const updatedPlayers = { ...players };
        delete updatedPlayers[teamId];
        setPlayers(updatedPlayers);
        
        // If the deleted team was selected, clear selection
        if (selectedTeam === teamId) {
          setSelectedTeam(null);
        }
      } catch (error) {
        console.error("Error deleting team:", error);
        alert("Failed to delete team. Please try again.");
      }
    }
  };

  const handleDeleteGame = async (gameId: string, opponent: string) => {
    const isConfirmed = window.confirm(
      `Are you sure you want to delete the game against ${opponent}?`
    );
    
    if (isConfirmed) {
      try {
        await deleteGame(gameId);
        setGames(prevGames => prevGames.filter(game => game.id !== gameId));
        if (selectedGame?.id === gameId) {
          setSelectedGame(null);
        }
      } catch (error) {
        console.error("Error deleting game:", error);
        alert("Failed to delete game. Please try again.");
      }
    }
  };

  const renderTeamContent = () => (
    <>
      <div className="p-4 grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-secondary/50 rounded-xl p-4 shadow-sm">
          <h3 className="text-sm text-gray-500 dark:text-gray-400">Active Players</h3>
          <p className="text-2xl font-bold text-primary">{teams.reduce((sum, team) => sum + team.playerCount, 0)}</p>
        </div>
        <div className="bg-white dark:bg-secondary/50 rounded-xl p-4 shadow-sm">
          <h3 className="text-sm text-gray-500 dark:text-gray-400">Active Teams</h3>
          <p className="text-2xl font-bold text-primary">{teams.length}</p>
        </div>
      </div>

      <section className="p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold dark:text-white">My Teams</h2>
          <button 
            onClick={() => setShowNewTeamModal(true)}
            className="text-primary text-sm font-medium"
          >
            + New Team
          </button>
        </div>
        <div className="space-y-3">
          {teams.map((team) => (
            <div
              key={team.id}
              className={`w-full bg-white dark:bg-secondary/50 rounded-xl p-4 shadow-sm 
                ${selectedTeam === team.id ? 'ring-2 ring-primary dark:ring-primary' : ''}`}
            >
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setSelectedTeam(team.id)}
                  className="flex-1 text-left group"
                >
                  <h3 className={`font-medium dark:text-white 
                    ${selectedTeam === team.id ? 'text-primary dark:text-primary' : ''}`}>
                    {team.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {team.playerCount} players
                  </p>
                </button>
                <div className="flex items-center space-x-2">
                  {selectedTeam === team.id && (
                    <div className="w-2 h-2 rounded-full bg-primary"></div>
                  )}
                  <button
                    onClick={() => handleDeleteTeam(team.id, team.name)}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {selectedTeam && (
        <section className="p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold dark:text-white">Team Roster</h2>
            <button 
              onClick={() => setShowNewPlayerModal(true)}
              className="text-primary text-sm font-medium"
            >
              + Add Player
            </button>
          </div>
          <div className="bg-white dark:bg-secondary/50 rounded-xl p-4 shadow-sm">
            <div className="space-y-4">
              {players[selectedTeam].map((player) => (
                <div key={player.id} className="flex items-center justify-between border-b dark:border-gray-700 pb-2">
                  <div>
                    <p className="font-medium dark:text-white">{player.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{player.position}</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <span className="text-primary font-medium">{player.number}</span>
                    </div>
                    <button
                      onClick={() => handleDeletePlayer(selectedTeam, player.id, player.name)}
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );

  const renderGamesContent = () => (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold dark:text-white">Games</h2>
        <button
          onClick={() => setShowNewGameModal(true)}
          className="flex items-center space-x-1 border border-primary text-primary px-3 py-1.5 rounded-lg hover:bg-primary/10 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Game</span>
        </button>
      </div>

      <div className="space-y-4">
        {games.map((game) => {
          const team = teams.find(t => t.id === game.teamId);
          const isSelected = selectedGame?.id === game.id;
          
          return (
            <div 
              key={game.id} 
              className="bg-white dark:bg-secondary/50 rounded-xl p-4 shadow-sm cursor-pointer"
              onClick={() => setSelectedGame(isSelected ? null : game)}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium dark:text-white">{team?.name} vs {game.opponent}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{game.date}</p>
                </div>
                <div className="flex items-center space-x-2">
                  {game.status !== 'in-progress' ? (
                    <div className="flex flex-col items-end">
                      <span className={`px-3 py-1 rounded-full text-sm ${
                        game.status === 'win' 
                          ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                          : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                      }`}>
                        {game.status === 'win' ? 'Win' : 'Loss'}
                      </span>
                      {game.finalScore && (
                        <span className="mt-1 text-sm font-medium dark:text-white">
                          {game.finalScore.team} - {game.finalScore.opponent}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-sm border border-yellow-500 text-yellow-500 dark:border-yellow-400 dark:text-yellow-400">
                      In Progress
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteGame(game.id, game.opponent);
                    }}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Set Details - Only show when game is selected */}
              {isSelected && (
                <div className="mt-4 space-y-2">
                  <div className="h-px bg-gray-200 dark:bg-gray-700 my-3"></div>
                  <h4 className="text-sm font-medium dark:text-white mb-2">Set Details</h4>
                  {game.sets.map((set, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-secondary-dark rounded-lg">
                      <span className="text-sm font-medium dark:text-white">Set {set.number}</span>
                      {set.score ? (
                        <div className="flex items-center space-x-2">
                          <span className={`font-semibold ${
                            set.score.team > set.score.opponent 
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            {set.score.team} - {set.score.opponent}
                          </span>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedGame(game);
                            setCurrentSetNumber(set.number);
                            setShowSetScoreModal(true);
                          }}
                          className="text-primary text-sm hover:underline"
                        >
                          Enter Score
                        </button>
                      )}
                    </div>
                  ))}
                  {game.status === 'in-progress' && game.sets.length < 4 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedGame(game);
                        setCurrentSetNumber(game.sets.length + 1);
                        setShowLineupModal(true);
                      }}
                      className="w-full p-2 text-center text-primary text-sm border border-primary/30 rounded-lg mt-2"
                    >
                      Set {game.sets.length + 1} Lineup
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-secondary-dark transition-colors duration-200">
      <header className="bg-secondary dark:bg-secondary-dark text-white p-4 fixed w-full top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Trophy className="w-8 h-8 text-primary" />
            <h1 className="text-xl font-bold">Spikey</h1>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-sm font-medium">JD</span>
            </div>
          </div>
        </div>
      </header>

      <main className="pt-16 pb-20">
        {activeTab === 'team' && renderTeamContent()}
        {activeTab === 'games' && renderGamesContent()}
      </main>

      <nav className="fixed bottom-0 w-full bg-white dark:bg-secondary border-t dark:border-gray-700">
        <div className="flex justify-around p-2">
          <button 
            onClick={() => setActiveTab('team')}
            className={`flex flex-col items-center ${activeTab === 'team' ? 'text-primary' : 'text-gray-400 dark:text-gray-500'}`}
          >
            <Users className="w-6 h-6" />
            <span className="text-xs mt-1">Team</span>
          </button>
          <button
            onClick={() => setActiveTab('games')}
            className={`flex flex-col items-center ${activeTab === 'games' ? 'text-primary' : 'text-gray-400 dark:text-gray-500'}`}
          >
            <Calendar className="w-6 h-6" />
            <span className="text-xs mt-1">Games</span>
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex flex-col items-center ${activeTab === 'stats' ? 'text-primary' : 'text-gray-400 dark:text-gray-500'}`}
          >
            <BarChart3 className="w-6 h-6" />
            <span className="text-xs mt-1">Stats</span>
          </button>
        </div>
      </nav>

      {showNewTeamModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-secondary rounded-xl p-6 w-[90%] max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold dark:text-white">Create New Team</h3>
              <button 
                onClick={() => setShowNewTeamModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              type="text"
              placeholder="Team Name"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border dark:border-gray-600 dark:bg-secondary-dark dark:text-white mb-4"
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowNewTeamModal(false)}
                className="px-4 py-2 text-gray-500 dark:text-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTeam}
                className="px-4 py-2 bg-primary text-white rounded-lg"
              >
                Create Team
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewPlayerModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-secondary rounded-xl p-6 w-[90%] max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold dark:text-white">Add New Player</h3>
              <button 
                onClick={() => setShowNewPlayerModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Player Name"
                value={newPlayer.name}
                onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border dark:border-gray-600 dark:bg-secondary-dark dark:text-white"
              />
              <input
                type="text"
                placeholder="Jersey Number"
                value={newPlayer.number}
                onChange={(e) => setNewPlayer({ ...newPlayer, number: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border dark:border-gray-600 dark:bg-secondary-dark dark:text-white"
              />
              <select
                value={newPlayer.position}
                onChange={(e) => setNewPlayer({ ...newPlayer, position: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border dark:border-gray-600 dark:bg-secondary-dark dark:text-white"
              >
                {positions.map((position) => (
                  <option key={position} value={position}>{position}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowNewPlayerModal(false)}
                className="px-4 py-2 text-gray-500 dark:text-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleAddPlayer}
                className="px-4 py-2 bg-primary text-white rounded-lg"
              >
                Add Player
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewGameModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-secondary rounded-xl p-6 w-[90%] max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold dark:text-white">Start New Game</h3>
              <button 
                onClick={() => setShowNewGameModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <select
                value={newGame.teamId}
                onChange={(e) => setNewGame({ ...newGame, teamId: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border dark:border-gray-600 dark:bg-secondary-dark dark:text-white"
              >
                <option value="">Select Team</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Opponent Team Name"
                value={newGame.opponent}
                onChange={(e) => setNewGame({ ...newGame, opponent: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border dark:border-gray-600 dark:bg-secondary-dark dark:text-white"
              />
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowNewGameModal(false)}
                className="px-4 py-2 text-gray-500 dark:text-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleAddGame}
                className="px-4 py-2 border border-primary text-primary rounded-lg hover:bg-primary/10 transition-colors"
              >
                Start Game
              </button>
            </div>
          </div>
        </div>
      )}

      {showLineupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-secondary rounded-xl p-6 w-[90%] max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold dark:text-white">Set {currentSetNumber} Starting Lineup</h3>
              <button 
                onClick={() => setShowLineupModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5, 6].map((position) => (
                <div key={position} className="flex items-center space-x-2">
                  <span className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                    {position}
                  </span>
                  <select
                    className="flex-1 px-4 py-2 rounded-lg border dark:border-gray-600 dark:bg-secondary-dark dark:text-white"
                    onChange={(e) => {
                      const selectedPlayer = players[selectedGame?.teamId || ''].find(p => p.number === e.target.value);
                      if (selectedPlayer) {
                        const updatedLineup = [...currentLineup];
                        const existingIndex = updatedLineup.findIndex(p => p.rotationPosition === position);
                        if (existingIndex >= 0) {
                          updatedLineup[existingIndex] = { ...selectedPlayer, rotationPosition: position };
                        } else {
                          updatedLineup.push({ ...selectedPlayer, rotationPosition: position });
                        }
                        setCurrentLineup(updatedLineup);
                      }
                    }}
                  >
                    <option value="">Select Player</option>
                    {selectedGame && players[selectedGame.teamId]?.map((player) => (
                      <option key={player.number} value={player.number}>
                        {player.name} ({player.position})
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowLineupModal(false)}
                className="px-4 py-2 text-gray-500 dark:text-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleSetLineup}
                className="px-4 py-2 bg-primary text-white rounded-lg"
              >
                Set Lineup
              </button>
            </div>
          </div>
        </div>
      )}

      {showSetScoreModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-secondary rounded-xl p-6 w-[90%] max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold dark:text-white">Set {currentSetNumber} Score</h3>
              <button 
                onClick={() => setShowSetScoreModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center space-x-4 mb-6">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Your Team
                </label>
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={setScore.team}
                  onChange={(e) => setSetScore({ ...setScore, team: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 rounded-lg border dark:border-gray-600 dark:bg-secondary-dark dark:text-white"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Opponent
                </label>
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={setScore.opponent}
                  onChange={(e) => setSetScore({ ...setScore, opponent: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 rounded-lg border dark:border-gray-600 dark:bg-secondary-dark dark:text-white"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowSetScoreModal(false)}
                className="px-4 py-2 text-gray-500 dark:text-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleSetScore}
                className="px-4 py-2 bg-primary text-white rounded-lg"
              >
                Save Score
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;