import React, { useState, useEffect } from 'react';
import { Trophy, Users, Calendar, BarChart3, Sun, Moon, ChevronRight, X, Plus, Edit, UserPlus, ArrowLeftRight, Minus, LogOut, Check, CircleDot, XCircle, Dumbbell } from 'lucide-react';
import { createTeam, getAllTeams, addPlayerToTeam, getTeamPlayers, deleteTeam, deletePlayer, syncTeamPlayerCount, createGame, updateGameSet, getAllGames, deleteGame } from './firebase/FirestoreExample';
import { db, auth, logOut } from './firebase/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import StatsPage from './components/StatsPage';
import Login from './components/Login';
import Training from './components/Training';
import { Tab } from '@headlessui/react';
import { collection, query, getDocs, orderBy, where } from 'firebase/firestore';

interface Player {
  id: string;
  name: string;
  number: string;
  position: string;
}

interface Team {
  id: string;
  name: string;
  playerCount: number;
}

interface LineupPlayer extends Player {
  rotationPosition: number;
}

interface Set {
  number: number;
  lineup: LineupPlayer[];
  score?: {
    team: number;
    opponent: number;
  };
  substitutions?: {
    outPlayer: LineupPlayer;
    inPlayer: LineupPlayer;
    currentScore: {
      team: number;
      opponent: number;
    };
  }[];
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
  finalScore?: {
    team: number;
    opponent: number;
  };
}

function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [showNewTeamModal, setShowNewTeamModal] = useState(false);
  const [showNewPlayerModal, setShowNewPlayerModal] = useState(false);
  const [showNewGameModal, setShowNewGameModal] = useState(false);
  const [showLineupModal, setShowLineupModal] = useState(false);
  const [showSetScoreModal, setShowSetScoreModal] = useState(false);
  const [showSubstitutionModal, setShowSubstitutionModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'team' | 'games' | 'stats' | 'training'>('team');
  const [newTeamName, setNewTeamName] = useState('');
  const [newPlayer, setNewPlayer] = useState<Player>({
    id: '',
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
  const [selectedSet, setSelectedSet] = useState<Set | null>(null);
  const [substitution, setSubstitution] = useState<{
    outPlayer: LineupPlayer | null;
    inPlayer: LineupPlayer | null;
    currentScore: {
      team: number;
      opponent: number;
    };
  }>({
    outPlayer: null,
    inPlayer: null,
    currentScore: { team: 0, opponent: 0 }
  });

  const [teams, setTeams] = useState<Team[]>([]);

  const [games, setGames] = useState<Game[]>([]);

  const [players, setPlayers] = useState<Record<string, Player[]>>({});

  const positions = [
    'Setter',
    'Outside Hitter',
    'Middle Blocker',
    'Opposite Hitter',
    'Libero',
    'Defensive Specialist'
  ];

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [trainingSessions, setTrainingSessions] = useState<any[]>([]);

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
      if (!user) return; // Don't fetch if no user is logged in
      
      try {
        const fetchedTeams = await getAllTeams(user.uid);
        
        // Sync player counts for all teams
        for (const team of fetchedTeams) {
          await syncTeamPlayerCount(team.id);
        }
        
        // Fetch teams again to get updated counts
        const updatedTeams = await getAllTeams(user.uid);
        setTeams(updatedTeams);
        
        // Fetch players for each team
        const playersObj: Record<string, Player[]> = {};
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
  }, [user]); // Add user as dependency

  useEffect(() => {
    const fetchGames = async () => {
      if (!user) return; // Don't fetch if no user is logged in
      
      try {
        const fetchedGames = await getAllGames(user.uid);
        setGames(fetchedGames);
      } catch (error) {
        console.error("Error fetching games:", error);
        alert("Failed to load games. Please refresh the page.");
      }
    };

    fetchGames();
  }, [user]); // Add user as dependency

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchTrainingSessions = async () => {
      if (!selectedTeam || !user) return;

      try {
        console.log('Fetching training sessions for team:', selectedTeam);
        
        const sessionsRef = collection(db, 'training-sessions');
        const q = query(
          sessionsRef,
          where('teamId', '==', selectedTeam),
          where('userId', '==', user.uid),
          orderBy('date', 'desc')
        );

        const querySnapshot = await getDocs(q);
        console.log('Found sessions:', querySnapshot.size);

        const sessions = await Promise.all(
          querySnapshot.docs.map(async (doc) => {
            const sessionData = doc.data();
            
            // Get attendance subcollection
            const attendanceRef = collection(doc.ref, 'attendance');
            const attendanceSnapshot = await getDocs(attendanceRef);
            
            // Map attendance data and ensure proper structure
            const attendance = attendanceSnapshot.docs.map(attendanceDoc => {
              const data = attendanceDoc.data();
              return {
                id: attendanceDoc.id,
                playerId: data.playerId,
                present: data.present === true, // Ensure boolean
                updatedAt: data.updatedAt
              };
            });

            console.log(`Session ${doc.id} attendance:`, attendance);

            return {
              id: doc.id,
              ...sessionData,
              date: sessionData.date,
              attendance: attendance // Use the properly structured attendance data
            };
          })
        );

        console.log('Final processed sessions:', sessions);
        setTrainingSessions(sessions);
      } catch (error) {
        console.error('Error fetching training sessions:', error);
      }
    };

    fetchTrainingSessions();
  }, [selectedTeam, user]);

  const handleLogout = async () => {
    try {
      await logOut();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleAddTeam = async () => {
    if (newTeamName.trim() && user) {
      try {
        const docRef = await createTeam({
          name: newTeamName.trim(),
          playerCount: 0,
          createdAt: new Date(),
          userId: user.uid
        });

        const newTeam = {
          id: docRef.id,
          name: newTeamName.trim(),
          playerCount: 0,
          userId: user.uid
        };
        
        setTeams([...teams, newTeam]);
        setPlayers({ ...players, [newTeam.id]: [] });
        setNewTeamName('');
        setShowNewTeamModal(false);
        
        console.log("Team created successfully with ID:", docRef.id);
      } catch (error) {
        console.error("Error creating team:", error);
        alert("Failed to create team. Please try again.");
      }
    }
  };

  const handleAddPlayer = async () => {
    if (selectedTeam && newPlayer.name && newPlayer.number && user) {
      try {
        await addPlayerToTeam(selectedTeam, newPlayer);
        
        // Update local state
        const updatedPlayers = {
          ...players,
          [selectedTeam]: [...players[selectedTeam], newPlayer]
        };
        setPlayers(updatedPlayers);
        
        // Fetch updated team data to get new player count
        const fetchedTeams = await getAllTeams(user.uid);
        setTeams(fetchedTeams);
        
        setNewPlayer({ id: '', name: '', number: '', position: 'Setter' });
        setShowNewPlayerModal(false);
      } catch (error) {
        console.error("Error adding player:", error);
        alert("Failed to add player. Please try again.");
      }
    }
  };

  const handleAddGame = async () => {
    if (newGame.teamId && newGame.opponent && user) {
      try {
        // Create initial game data
        const newGameData = {
          teamId: newGame.teamId,
          opponent: newGame.opponent,
          date: new Date().toISOString().split('T')[0],
          status: 'in-progress' as const,
          sets: [] as Set[],
          userId: user.uid,
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
        
        const updatedGame: Game = {
          ...selectedGame,
          sets: result.sets,
          status: result.status,
          finalScore: result.finalScore || undefined
        };

        setGames(prevGames => 
          prevGames.map(game => game.id === selectedGame.id ? updatedGame : game)
        );
        
        setSelectedGame(updatedGame);
        setShowLineupModal(false);
        setCurrentLineup([]);
        setActiveTab('games');
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

        // Regular set validation (sets 1-4)
        if (currentSetNumber <= 4) {
          if (setScore.team < 25 && setScore.opponent < 25) {
            alert("Sets must reach at least 25 points");
            return;
          }
          if (Math.abs(setScore.team - setScore.opponent) < 2) {
            alert("One team must win by 2 points");
            return;
          }
        } else {
          // Fifth set validation (if needed)
          if (setScore.team < 15 && setScore.opponent < 15) {
            alert("Fifth set must reach at least 15 points");
            return;
          }
          if (Math.abs(setScore.team - setScore.opponent) < 2) {
            alert("One team must win by 2 points");
            return;
          }
        }

        const newSet: Set = {
          number: currentSetNumber,
          lineup: currentLineup,
          score: setScore
        };

        const result = await updateGameSet(selectedGame.id, newSet);

        // Count sets won by each team
        const setsWon = result.sets.reduce(
          (acc, set) => {
            if (set.score) {
              if (set.score.team > set.score.opponent) acc.team++;
              else if (set.score.opponent > set.score.team) acc.opponent++;
            }
            return acc;
          },
          { team: 0, opponent: 0 }
        );

        // Determine if game is complete or needs a fifth set
        let gameStatus: 'win' | 'loss' | 'in-progress' = 'in-progress';
        let finalScore = undefined;

        // Game status logic
        if (currentSetNumber === 4) {
          if (setsWon.team === 2 && setsWon.opponent === 2) {
            // Tied after 4 sets, need fifth set
            gameStatus = 'in-progress';
          } else {
            // One team has already won 3 sets, but we still played the 4th set
            gameStatus = setsWon.team > setsWon.opponent ? 'win' : 'loss';
            finalScore = setsWon;
          }
        } else if (currentSetNumber === 5) {
          // Fifth set is decisive
          gameStatus = setScore.team > setScore.opponent ? 'win' : 'loss';
          finalScore = {
            team: setsWon.team + (setScore.team > setScore.opponent ? 1 : 0),
            opponent: setsWon.opponent + (setScore.opponent > setScore.team ? 1 : 0)
          };
        }

        const updatedGame: Game = {
          ...selectedGame,
          sets: result.sets,
          status: gameStatus,
          finalScore: finalScore
        };

        // Update both the games state and selected game
        setGames(prevGames => 
          prevGames.map(game => 
            game.id === selectedGame.id ? updatedGame : game
          )
        );
        setSelectedGame(updatedGame);

        setShowSetScoreModal(false);
        setSetScore({ team: 0, opponent: 0 });

        if (gameStatus === 'in-progress') {
          if (currentSetNumber === 4 && setsWon.team === 2 && setsWon.opponent === 2) {
            // If it's 2-2 after 4 sets, proceed to fifth set
            setCurrentSetNumber(5);
            setActiveTab('games');
          } else if (currentSetNumber < 4) {
            // Always proceed to next set until 4 sets are played
            setCurrentSetNumber(prev => prev + 1);
            setActiveTab('games');
          }
        } else {
          const winningTeam = gameStatus === 'win' ? 'Your team' : 'Opponent';
          alert(`Game Complete! ${winningTeam} won! Final sets: ${finalScore?.team}-${finalScore?.opponent}`);
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
    
    if (isConfirmed && user) {
      try {
        await deletePlayer(teamId, playerId);
        
        // Update local state
        const updatedPlayers = {
          ...players,
          [teamId]: players[teamId].filter(p => p.id !== playerId)
        };
        setPlayers(updatedPlayers);
        
        // Fetch updated team data to get new player count
        const fetchedTeams = await getAllTeams(user.uid);
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
    
    if (isConfirmed && user) {
      try {
        console.log('Starting team deletion in handleDeleteTeam');
        await deleteTeam(teamId);
        
        console.log('Team deleted successfully, updating UI');
        // Update local state
        setTeams(prevTeams => prevTeams.filter(t => t.id !== teamId));
        setPlayers(prevPlayers => {
          const updatedPlayers = { ...prevPlayers };
          delete updatedPlayers[teamId];
          return updatedPlayers;
        });
        
        // If the deleted team was selected, clear selection
        if (selectedTeam === teamId) {
          setSelectedTeam(null);
        }

        // Fetch updated teams list
        try {
          const fetchedTeams = await getAllTeams(user.uid);
          setTeams(fetchedTeams);
          console.log('Teams list updated successfully');
        } catch (fetchError) {
          console.error('Error fetching updated teams:', fetchError);
          // Don't throw here, as the deletion was successful
        }
      } catch (error) {
        console.error("Error deleting team:", error);
        if (error instanceof Error) {
          alert(`Failed to delete team: ${error.message}`);
        } else {
          alert("Failed to delete team. Please try again.");
        }
      }
    }
  };

  const handleDeleteGame = async (gameId: string, opponent: string) => {
    const isConfirmed = window.confirm(
      `Are you sure you want to delete the game against ${opponent}?`
    );
    
    if (isConfirmed && user) {
      try {
        await deleteGame(gameId);
        const fetchedGames = await getAllGames(user.uid);
        setGames(fetchedGames);
        if (selectedGame?.id === gameId) {
          setSelectedGame(null);
        }
      } catch (error) {
        console.error("Error deleting game:", error);
        alert("Failed to delete game. Please try again.");
      }
    }
  };

  const handleSubstitution = async () => {
    if (!selectedGame || !selectedSet || !substitution.outPlayer || !substitution.inPlayer) return;

    try {
      // Create a new substitution record
      const newSubstitution = {
        outPlayer: substitution.outPlayer,
        inPlayer: substitution.inPlayer,
        currentScore: substitution.currentScore
      };

      // Update the set with the new substitution
      const updatedSet = {
        ...selectedSet,
        lineup: selectedSet.lineup.map(player => 
          player.number === substitution.outPlayer?.number 
            ? { ...substitution.inPlayer!, rotationPosition: player.rotationPosition }
            : player
        ),
        substitutions: [...(selectedSet.substitutions || []), newSubstitution]
      };

      // Update the game in Firebase
      const result = await updateGameSet(selectedGame.id, updatedSet);

      // Update local state with proper type handling
      setGames(prevGames => 
        prevGames.map(game => 
          game.id === selectedGame.id 
            ? {
                ...game,
                sets: result.sets,
                status: result.status,
                finalScore: result.finalScore || undefined
              }
            : game
        )
      );

      setShowSubstitutionModal(false);
      setSubstitution({
        outPlayer: null,
        inPlayer: null,
        currentScore: { team: 0, opponent: 0 }
      });
    } catch (error) {
      console.error("Error making substitution:", error);
      alert("Failed to make substitution. Please try again.");
    }
  };

  const renderTeamContent = () => (
    <>
      <div className="p-4 grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-secondary/50 rounded-xl p-4 shadow-lg">
          <h3 className="text-sm text-gray-600 dark:text-gray-400">Active Players</h3>
          <p className="text-2xl font-bold text-primary">{teams.reduce((sum, team) => sum + team.playerCount, 0)}</p>
        </div>
        <div className="bg-white dark:bg-secondary/50 rounded-xl p-4 shadow-lg">
          <h3 className="text-sm text-gray-600 dark:text-gray-400">Active Teams</h3>
          <p className="text-2xl font-bold text-primary">{teams.length}</p>
        </div>
      </div>

      <section className="p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white">My Teams</h2>
          <button 
            onClick={() => setShowNewTeamModal(true)}
            className="text-primary text-sm font-medium hover:text-primary/80 transition-colors"
          >
            + New Team
          </button>
        </div>
        <div className="space-y-3">
          {teams.map((team) => (
            <div
              key={team.id || `team-${team.name}`}
              className={`w-full bg-white dark:bg-secondary/50 rounded-xl p-4 shadow-lg hover:shadow-xl transition-all 
                ${selectedTeam === team.id ? 'ring-2 ring-primary dark:ring-primary' : ''}`}
            >
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setSelectedTeam(team.id === selectedTeam ? null : team.id)}
                  className="flex-1 text-left group"
                >
                  <h3 className={`font-medium text-gray-800 dark:text-white 
                    ${selectedTeam === team.id ? 'text-primary dark:text-primary' : ''}`}>
                    {team.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
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
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Team Roster</h2>
            <button 
              onClick={() => setShowNewPlayerModal(true)}
              className="text-primary text-sm font-medium hover:text-primary/80 transition-colors"
            >
              + Add Player
            </button>
          </div>
          <div className="bg-white dark:bg-secondary/50 rounded-xl p-4 shadow-lg">
            <div className="space-y-4">
              {players[selectedTeam]?.map((player) => (
                <div key={player.id || `player-${player.name}-${player.number}`} className="flex items-center justify-between border-b dark:border-gray-700 pb-2">
                  <div>
                    <p className="font-medium text-gray-800 dark:text-white">{player.name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{player.position}</p>
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
              className="bg-white dark:bg-secondary/50 rounded-xl p-4 shadow-md hover:shadow-lg transition-shadow cursor-pointer"
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
                      {game.status === 'win' ? (
                        <Check className="w-5 h-5 text-green-500 dark:text-green-400" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500 dark:text-red-400" />
                      )}
                      {game.finalScore && (
                        <span className="mt-1 text-sm font-medium dark:text-white">
                          {game.finalScore.team} - {game.finalScore.opponent}
                        </span>
                      )}
                    </div>
                  ) : (
                    <CircleDot className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />
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
                      <span className="text-sm font-medium dark:text-white">
                        Set {set.number}{set.number === 5 ? ' (Tie Break)' : ''}
                      </span>
                      <div className="flex items-center space-x-3">
                        {set.score ? (
                          <span className={`font-semibold ${
                            set.score.team > set.score.opponent 
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            {set.score.team} - {set.score.opponent}
                          </span>
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
                        <div className="flex items-center space-x-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {(set.substitutions?.length || 0)}/6
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedGame(game);
                              setSelectedSet(set);
                              setShowSubstitutionModal(true);
                            }}
                            className="p-1.5 text-primary hover:bg-primary/10 rounded-full"
                            title="Make Substitution"
                            disabled={(set.substitutions?.length || 0) >= 6}
                          >
                            <ArrowLeftRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {game.status === 'in-progress' && (
                    (game.sets.length < 4 || (game.sets.length === 4 && 
                      game.sets.reduce((acc, set) => 
                        set.score?.team !== undefined && set.score?.opponent !== undefined && 
                        set.score.team > set.score.opponent ? acc + 1 : acc, 0) === 2 && 
                        game.sets.reduce((acc, set) => 
                          set.score?.team !== undefined && set.score?.opponent !== undefined && 
                          set.score.opponent > set.score.team ? acc + 1 : acc, 0) === 2)) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedGame(game);
                            setCurrentSetNumber(game.sets.length + 1);
                            setShowLineupModal(true);
                          }}
                          className="w-full p-2 text-center text-primary text-sm border border-primary/30 rounded-lg mt-2"
                        >
                          {game.sets.length === 4 ? 'Set 5 (Tie Break) Lineup' : `Set ${game.sets.length + 1} Lineup`}
                        </button>
                      )
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderStatsContent = () => (
    <StatsPage 
      selectedTeam={selectedTeam} 
      players={players} 
      teams={teams}
      onTeamSelect={setSelectedTeam}
      games={games}
      userId={user?.uid}
      trainingSessions={trainingSessions}
      darkMode={darkMode}
    />
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-200 dark:bg-secondary-dark flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={() => setUser(auth.currentUser)} />;
  }

  return (
    <div className="min-h-screen bg-gray-200 dark:bg-secondary-dark transition-colors duration-200">
      <header className="bg-white dark:bg-secondary text-gray-800 dark:text-white p-4 fixed w-full top-0 z-10 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Trophy className="w-8 h-8 text-primary" />
            <h1 className="text-xl font-bold">Spikey</h1>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              onClick={handleLogout}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-sm font-medium">
                {user.email?.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="pt-16 pb-20">
        {activeTab === 'team' && renderTeamContent()}
        {activeTab === 'games' && renderGamesContent()}
        {activeTab === 'stats' && renderStatsContent()}
        {activeTab === 'training' && (
          <Training 
            teamId={selectedTeam || ''} 
            userId={user?.uid || ''} 
            players={players[selectedTeam || ''] || []}
            teams={teams}
            onTeamSelect={async (teamId) => {
              setSelectedTeam(teamId);
              if (teamId && !players[teamId]) {
                try {
                  const teamPlayers = await getTeamPlayers(teamId);
                  setPlayers(prev => ({
                    ...prev,
                    [teamId]: teamPlayers
                  }));
                } catch (error) {
                  console.error('Error fetching players:', error);
                }
              }
            }}
          />
        )}
      </main>

      <nav className="fixed bottom-0 w-full bg-white dark:bg-secondary border-t dark:border-gray-700 shadow-lg">
        <div className="flex justify-around p-2">
          <button 
            onClick={() => setActiveTab('team')}
            className={`flex flex-col items-center ${activeTab === 'team' ? 'text-primary' : 'text-gray-500 dark:text-gray-500'}`}
          >
            <Users className="w-6 h-6" />
            <span className="text-xs mt-1">Team</span>
          </button>
          <button
            onClick={() => setActiveTab('games')}
            className={`flex flex-col items-center ${activeTab === 'games' ? 'text-primary' : 'text-gray-500 dark:text-gray-500'}`}
          >
            <Calendar className="w-6 h-6" />
            <span className="text-xs mt-1">Games</span>
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex flex-col items-center ${activeTab === 'stats' ? 'text-primary' : 'text-gray-500 dark:text-gray-500'}`}
          >
            <BarChart3 className="w-6 h-6" />
            <span className="text-xs mt-1">Stats</span>
          </button>
          <button
            onClick={() => setActiveTab('training')}
            className={`flex flex-col items-center ${activeTab === 'training' ? 'text-primary' : 'text-gray-500 dark:text-gray-500'}`}
          >
            <Dumbbell className="w-6 h-6" />
            <span className="text-xs mt-1">Training</span>
          </button>
        </div>
      </nav>

      {showNewTeamModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-secondary rounded-xl p-6 w-[90%] max-w-md shadow-xl">
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
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setSetScore(prev => ({ ...prev, team: Math.max(0, prev.team - 1) }))}
                    className="w-10 h-10 rounded-full bg-pink-50 dark:bg-pink-900/20 flex items-center justify-center hover:bg-pink-100 dark:hover:bg-pink-900/30 transition-colors border-2 border-pink-200 dark:border-pink-200"
                  >
                    <Minus className="w-5 h-5 text-pink-600 dark:text-pink-400" />
                  </button>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={setScore.team}
                    onChange={(e) => setSetScore({ ...setScore, team: parseInt(e.target.value) || 0 })}
                    className="w-16 px-2 py-2 rounded-lg border dark:border-gray-600 dark:bg-secondary-dark dark:text-white text-center text-lg font-medium"
                  />
                  <button
                    onClick={() => setSetScore(prev => ({ ...prev, team: prev.team + 1 }))}
                    className="w-10 h-10 rounded-full bg-pink-50 dark:bg-pink-900/20 flex items-center justify-center hover:bg-pink-100 dark:hover:bg-pink-900/30 transition-colors border-2 border-pink-200 dark:border-pink-200"
                  >
                    <Plus className="w-5 h-5 text-pink-600 dark:text-pink-400" />
                  </button>
                </div>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Opponent
                </label>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setSetScore(prev => ({ ...prev, opponent: Math.max(0, prev.opponent - 1) }))}
                    className="w-10 h-10 rounded-full bg-pink-50 dark:bg-pink-900/20 flex items-center justify-center hover:bg-pink-100 dark:hover:bg-pink-900/30 transition-colors border-2 border-pink-200 dark:border-pink-200"
                  >
                    <Minus className="w-5 h-5 text-pink-600 dark:text-pink-400" />
                  </button>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={setScore.opponent}
                    onChange={(e) => setSetScore({ ...setScore, opponent: parseInt(e.target.value) || 0 })}
                    className="w-16 px-2 py-2 rounded-lg border dark:border-gray-600 dark:bg-secondary-dark dark:text-white text-center text-lg font-medium"
                  />
                  <button
                    onClick={() => setSetScore(prev => ({ ...prev, opponent: prev.opponent + 1 }))}
                    className="w-10 h-10 rounded-full bg-pink-50 dark:bg-pink-900/20 flex items-center justify-center hover:bg-pink-100 dark:hover:bg-pink-900/30 transition-colors border-2 border-pink-200 dark:border-pink-200"
                  >
                    <Plus className="w-5 h-5 text-pink-600 dark:text-pink-400" />
                  </button>
                </div>
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

      {showSubstitutionModal && selectedSet && selectedGame && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-secondary rounded-xl p-6 w-[90%] max-w-md">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-semibold dark:text-white">Player Substitution - Set {selectedSet.number}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Substitutions used: {selectedSet.substitutions?.length || 0}/6
                </p>
              </div>
              <button 
                onClick={() => setShowSubstitutionModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {(selectedSet.substitutions?.length || 0) >= 6 ? (
              <div className="text-center py-4">
                <p className="text-red-500 dark:text-red-400">Maximum substitutions (6) reached for this set.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Current Score */}
                <div className="flex items-center space-x-4 mb-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Current Team Score
                    </label>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setSubstitution(prev => ({
                          ...prev,
                          currentScore: { ...prev.currentScore, team: Math.max(0, prev.currentScore.team - 1) }
                        }))}
                        className="w-10 h-10 rounded-full bg-pink-50 dark:bg-pink-900/20 flex items-center justify-center hover:bg-pink-100 dark:hover:bg-pink-900/30 transition-colors border-2 border-pink-200 dark:border-pink-200"
                      >
                        <Minus className="w-5 h-5 text-pink-600 dark:text-pink-400" />
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={substitution.currentScore.team}
                        onChange={(e) => setSubstitution({
                          ...substitution,
                          currentScore: { ...substitution.currentScore, team: parseInt(e.target.value) || 0 }
                        })}
                        className="w-16 px-2 py-2 rounded-lg border dark:border-gray-600 dark:bg-secondary-dark dark:text-white text-center text-lg font-medium"
                      />
                      <button
                        onClick={() => setSubstitution(prev => ({
                          ...prev,
                          currentScore: { ...prev.currentScore, team: prev.currentScore.team + 1 }
                        }))}
                        className="w-10 h-10 rounded-full bg-pink-50 dark:bg-pink-900/20 flex items-center justify-center hover:bg-pink-100 dark:hover:bg-pink-900/30 transition-colors border-2 border-pink-200 dark:border-pink-200"
                      >
                        <Plus className="w-5 h-5 text-pink-600 dark:text-pink-400" />
                      </button>
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Current Opponent Score
                    </label>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setSubstitution(prev => ({
                          ...prev,
                          currentScore: { ...prev.currentScore, opponent: Math.max(0, prev.currentScore.opponent - 1) }
                        }))}
                        className="w-10 h-10 rounded-full bg-pink-50 dark:bg-pink-900/20 flex items-center justify-center hover:bg-pink-100 dark:hover:bg-pink-900/30 transition-colors border-2 border-pink-200 dark:border-pink-200"
                      >
                        <Minus className="w-5 h-5 text-pink-600 dark:text-pink-400" />
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={substitution.currentScore.opponent}
                        onChange={(e) => setSubstitution({
                          ...substitution,
                          currentScore: { ...substitution.currentScore, opponent: parseInt(e.target.value) || 0 }
                        })}
                        className="w-16 px-2 py-2 rounded-lg border dark:border-gray-600 dark:bg-secondary-dark dark:text-white text-center text-lg font-medium"
                      />
                      <button
                        onClick={() => setSubstitution(prev => ({
                          ...prev,
                          currentScore: { ...prev.currentScore, opponent: prev.currentScore.opponent + 1 }
                        }))}
                        className="w-10 h-10 rounded-full bg-pink-50 dark:bg-pink-900/20 flex items-center justify-center hover:bg-pink-100 dark:hover:bg-pink-900/30 transition-colors border-2 border-pink-200 dark:border-pink-200"
                      >
                        <Plus className="w-5 h-5 text-pink-600 dark:text-pink-400" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Player Out Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Player Out
                  </label>
                  <select
                    className="w-full px-4 py-2 rounded-lg border border-pink-200 dark:border-pink-200 dark:bg-secondary-dark dark:text-white focus:ring-2 focus:ring-pink-200 focus:border-pink-200 transition-colors"
                    value={substitution.outPlayer?.number || ''}
                    onChange={(e) => {
                      const player = selectedSet.lineup.find(p => p.number === e.target.value);
                      setSubstitution({ ...substitution, outPlayer: player || null });
                    }}
                  >
                    <option value="">Select Player</option>
                    {selectedSet.lineup.map((player) => (
                      <option key={player.number} value={player.number}>
                        {player.name} (Position {player.rotationPosition})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Player In Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Player In
                  </label>
                  <select
                    className="w-full px-4 py-2 rounded-lg border border-pink-200 dark:border-pink-200 dark:bg-secondary-dark dark:text-white focus:ring-2 focus:ring-pink-200 focus:border-pink-200 transition-colors"
                    value={substitution.inPlayer?.number || ''}
                    onChange={(e) => {
                      const player = players[selectedGame.teamId].find(p => p.number === e.target.value);
                      if (player) {
                        setSubstitution({
                          ...substitution,
                          inPlayer: { ...player, rotationPosition: substitution.outPlayer?.rotationPosition || 0 }
                        });
                      }
                    }}
                  >
                    <option value="">Select Player</option>
                    {players[selectedGame.teamId]
                      .filter(player => !selectedSet.lineup.some(p => p.number === player.number))
                      .map((player) => (
                        <option key={player.number} value={player.number}>
                          {player.name} ({player.position})
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowSubstitutionModal(false)}
                className="px-4 py-2 text-gray-500 dark:text-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleSubstitution}
                disabled={!substitution.outPlayer || !substitution.inPlayer}
                className="px-4 py-2 bg-primary text-white rounded-lg disabled:opacity-50"
              >
                Make Substitution
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;