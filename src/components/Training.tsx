import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, deleteDoc, orderBy } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { TrainingSession, TrainingAttendance } from '../types/training';
import { Player } from '../types/player';
import { Plus, X, Check, ChevronDown, BarChart2, TrendingUp, TrendingDown } from 'lucide-react';

interface TrainingProps {
    teamId: string;
    userId: string;
    players: Player[];
    teams: { id: string; name: string }[];
    onTeamSelect: (teamId: string) => void;
}

// Helper function to check if a session has an ID
const hasSessionId = (session: TrainingSession): session is TrainingSession & { id: string } => {
    return typeof session.id === 'string';
};

// Helper function to check if a player has an ID
const hasPlayerId = (player: Player): player is Player & { id: string } => {
    return typeof player.id === 'string';
};

const Training: React.FC<TrainingProps> = ({ teamId, userId, players, teams, onTeamSelect }) => {
    console.log('Training component mounted/updated:', { teamId, userId, players, teams });

    const [trainingSessions, setTrainingSessions] = useState<TrainingSession[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>(
        new Date().toISOString().split('T')[0]
    );
    const [attendanceMap, setAttendanceMap] = useState<{ [key: string]: { [key: string]: boolean } }>({});
    const [selectedSession, setSelectedSession] = useState<string | null>(null);
    const [showNewSessionModal, setShowNewSessionModal] = useState(false);
    const [selectedTeamForNewSession, setSelectedTeamForNewSession] = useState<string>('');
    const [teamPlayers, setTeamPlayers] = useState<Player[]>([]);
    const [sessionPlayerCounts, setSessionPlayerCounts] = useState<{ [key: string]: number }>({});
    const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
    const [sessionToDelete, setSessionToDelete] = useState<TrainingSession | null>(null);
    const [showStatsModal, setShowStatsModal] = useState(false);
    const [isLoadingStats, setIsLoadingStats] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Add effect to fetch all training sessions when component mounts or teamId changes
    useEffect(() => {
        const fetchTrainingData = async () => {
            if (!userId || !teamId) {
                console.log('Missing userId or teamId:', { userId, teamId });
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            try {
                console.log('Fetching training data for team:', teamId);
                
                // Fetch players first
                const playersSnapshot = await getDocs(collection(db, `teams/${teamId}/players`));
                const fetchedPlayers = playersSnapshot.docs.map(doc => ({
                    id: doc.id,
                    name: doc.data().name,
                    number: doc.data().number,
                    position: doc.data().position,
                    joinedAt: doc.data().joinedAt
                } as Player));
                console.log('Fetched players:', fetchedPlayers);

                // Then fetch sessions
                const sessionsQuery = query(
                    collection(db, 'training-sessions'),
                    where('teamId', '==', teamId),
                    where('userId', '==', userId),
                    orderBy('date', 'desc')
                );
                const sessionsSnapshot = await getDocs(sessionsQuery);
                const sessions = sessionsSnapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        teamId: data.teamId,
                        userId: data.userId,
                        date: data.date.toDate(),
                        attendance: data.attendance || []
                    } as TrainingSession;
                });
                console.log('Fetched sessions:', sessions);

                // Initialize attendance map
                const attendance: { [key: string]: { [key: string]: boolean } } = {};
                const validPlayers = fetchedPlayers.filter(hasPlayerId);
                const validSessions = sessions.filter(hasSessionId);

                validSessions.forEach(session => {
                    attendance[session.id] = {};
                    validPlayers.forEach(player => {
                        attendance[session.id][player.id] = false;
                    });
                    // Update with actual attendance
                    session.attendance?.forEach(record => {
                        if (record.playerId) {
                            attendance[session.id][record.playerId] = record.present;
                        }
                    });
                });

                console.log('Setting data:', {
                    sessions: sessions.length,
                    players: fetchedPlayers.length,
                    attendance: Object.keys(attendance).length,
                    playerCounts: validSessions.length,
                    validPlayers: validPlayers.length,
                    validSessions: validSessions.length
                });

                setTeamPlayers(fetchedPlayers);
                setTrainingSessions(sessions);
                setAttendanceMap(attendance);
                setSessionPlayerCounts(
                    Object.fromEntries(
                        validSessions.map(s => [s.id, validPlayers.length])
                    )
                );
            } catch (error) {
                console.error('Error fetching training data:', error);
            } finally {
                console.log('Finished loading data');
                setIsLoading(false);
            }
        };

        fetchTrainingData();
    }, [userId, teamId]); // Only depend on userId and teamId

    // Remove the team selection effect since we handle it in the main effect

    // Modify the team selection effect to only fetch players
    useEffect(() => {
        const fetchTeamPlayers = async () => {
            if (!selectedTeamForNewSession) {
                setTeamPlayers([]);
                return;
            }

            try {
                await fetchPlayersForTeam(selectedTeamForNewSession);
            } catch (error) {
                console.error('Error fetching team players:', error);
            }
        };

        fetchTeamPlayers();
    }, [selectedTeamForNewSession]);

    // Keep fetchPlayersForTeam for the new session modal
    const fetchPlayersForTeam = async (teamId: string) => {
        try {
            const playersSnapshot = await getDocs(collection(db, `teams/${teamId}/players`));
            const fetchedPlayers = playersSnapshot.docs.map(doc => ({
                id: doc.id,
                name: doc.data().name,
                number: doc.data().number,
                position: doc.data().position,
                joinedAt: doc.data().joinedAt
            } as Player));
            setTeamPlayers(fetchedPlayers);
            return fetchedPlayers;
        } catch (error) {
            console.error('Error fetching players:', error);
            return [];
        }
    };

    // Modify handleSessionClick to handle undefined id
    const handleSessionClick = async (session: TrainingSession) => {
        if (!session.id) return;
        const newSelectedSession = selectedSession === session.id ? null : session.id;
        setSelectedSession(newSelectedSession);
        if (newSelectedSession) {
            setSelectedTeamForNewSession(session.teamId);
        }
    };

    const createTrainingSession = async () => {
        if (!selectedTeamForNewSession) {
            alert('Please select a team first');
            return;
        }

        try {
            const newSession: TrainingSession = {
                date: new Date(selectedDate),
                userId,
                teamId: selectedTeamForNewSession,
                attendance: []
            };

            const docRef = await addDoc(collection(db, 'training-sessions'), newSession);
            const newSessionWithId = { ...newSession, id: docRef.id };

            // Initialize attendance map for the new session
            const initialAttendance: { [key: string]: boolean } = {};
            const validPlayers = teamPlayers.filter(hasPlayerId);
            validPlayers.forEach(player => {
                initialAttendance[player.id] = false;
            });

            setAttendanceMap(prev => ({
                ...prev,
                [docRef.id]: initialAttendance
            }));

            setSessionPlayerCounts(prev => ({
                ...prev,
                [docRef.id]: teamPlayers.length
            }));

            setTrainingSessions(prev => [...prev, newSessionWithId]);
            setSelectedSession(docRef.id);
            onTeamSelect(selectedTeamForNewSession);
            setShowNewSessionModal(false);
        } catch (error) {
            console.error('Error in createTrainingSession:', error);
        }
    };

    const updateAttendance = async (sessionId: string, playerId: string, present: boolean) => {
        if (!sessionId || !playerId) {
            console.error('Missing sessionId or playerId');
            return;
        }

        try {
            const session = trainingSessions.find(s => s.id === sessionId);
            if (!session) return;

            const currentAttendance = session.attendance || [];
            const updatedAttendance = currentAttendance.filter(a => a.playerId !== playerId);
            
            // Always add an attendance record with explicit present/absent state
            updatedAttendance.push({
                playerId,
                present,
                updatedAt: new Date()
            });

            const sessionRef = doc(db, 'training-sessions', sessionId);
            await updateDoc(sessionRef, {
                attendance: updatedAttendance
            });
            
            // Update local state with explicit state
            setAttendanceMap(prev => ({
                ...prev,
                [sessionId]: {
                    ...prev[sessionId],
                    [playerId]: present
                }
            }));

            setTrainingSessions(prev => 
                prev.map(s => 
                    s.id === sessionId 
                        ? { ...s, attendance: updatedAttendance }
                        : s
                )
            );
        } catch (error) {
            console.error('Error updating attendance:', error);
        }
    };

    // Modify the validPlayers calculation
    const validPlayers = teamPlayers.filter(player => 
        player && player.name && player.number && player.position
    );

    // Add debug logging for player filtering
    console.log('Player filtering:', {
        teamPlayers,
        playerObjects: teamPlayers.map(p => typeof p),
        hasIds: teamPlayers.map(p => 'id' in p),
        validPlayerCount: validPlayers.length
    });

    // Add this to check what's being rendered
    console.log('Current state:', {
        trainingSessions,
        attendanceMap,
        selectedSession,
        teamPlayers,
        validPlayers
    });

    // Add a helper function to get team name
    const getTeamName = (teamId: string): string => {
        const team = teams.find(t => t.id === teamId);
        return team ? team.name : '';
    };

    // Add delete function
    const deleteTrainingSession = async (session: TrainingSession) => {
        try {
            await deleteDoc(doc(db, 'training-sessions', session.id!));
            setTrainingSessions(prev => prev.filter(s => s.id !== session.id));
            setShowDeleteConfirmModal(false);
            setSessionToDelete(null);
        } catch (error) {
            console.error('Error deleting training session:', error);
        }
    };

    // Calculate attendance statistics
    const calculateAttendanceStats = () => {
        console.log('Calculating stats with:', {
            teamPlayersLength: teamPlayers.length,
            trainingSessionsLength: trainingSessions.length,
            teamPlayers,
            trainingSessions,
            attendanceMap
        });

        if (!teamPlayers.length || !trainingSessions.length) {
            console.log('Returning null because:', {
                noTeamPlayers: !teamPlayers.length,
                noTrainingSessions: !trainingSessions.length
            });
            return null;
        }

        // Filter sessions with IDs
        const validSessions = trainingSessions.filter(hasSessionId);
        const validPlayers = teamPlayers.filter(hasPlayerId);
        console.log('Valid data:', {
            validSessions: validSessions.length,
            validPlayers: validPlayers.length
        });

        // Calculate team attendance rate
        let totalAttendance = 0;
        validSessions.forEach(session => {
            const presentCount = Object.values(attendanceMap[session.id] || {})
                .filter(present => present === true).length;
            const sessionRate = presentCount / validPlayers.length;
            totalAttendance += sessionRate;
            console.log('Session attendance:', {
                sessionId: session.id,
                presentCount,
                totalPlayers: validPlayers.length,
                sessionRate,
                attendance: attendanceMap[session.id]
            });
        });

        const teamAttendanceRate = (totalAttendance / validSessions.length) * 100;

        // Get recent sessions (last 5)
        const recentSessions = validSessions
            .sort((a, b) => b.date.getTime() - a.date.getTime())
            .slice(0, 5)
            .map(session => ({
                date: session.date,
                presentCount: Object.values(attendanceMap[session.id] || {})
                    .filter(present => present === true).length,
                totalCount: teamPlayers.length,
                rate: (Object.values(attendanceMap[session.id] || {})
                    .filter(present => present === true).length / teamPlayers.length) * 100,
                sessionId: session.id
            }));

        // Calculate individual player attendance rates
        const playerStats = validPlayers.map(player => {
            const playerAttendance = validSessions.reduce((acc, session) => {
                return attendanceMap[session.id]?.[player.id] === true ? acc + 1 : acc;
            }, 0);
            
            return {
                ...player,
                attendanceRate: (playerAttendance / validSessions.length) * 100,
                trend: 'up'
            };
        });

        return {
            teamRate: teamAttendanceRate,
            recentSessions,
            playerStats
        };
    };

    return (
        <div className="p-4">
            <div className="flex flex-col space-y-4 mb-6">
                {/* Team Selector */}
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold dark:text-white">Training Sessions</h2>
                    <select
                        value={teamId}
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

                {/* Action Buttons - only show when a team is selected */}
                {teamId && (
                    <div className="flex justify-end space-x-2">
                        <button
                            onClick={() => setShowStatsModal(true)}
                            className="flex items-center space-x-1 border border-primary text-primary px-3 py-1.5 rounded-lg hover:bg-primary/10 transition-colors"
                        >
                            <BarChart2 className="w-4 h-4" />
                            <span>Stats</span>
                        </button>
                        <button
                            onClick={() => setShowNewSessionModal(true)}
                            className="flex items-center space-x-1 border border-primary text-primary px-3 py-1.5 rounded-lg hover:bg-primary/10 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            <span>New Session</span>
                        </button>
                    </div>
                )}
            </div>

            {!teamId ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                    Please select a team to view training sessions.
                </p>
            ) : isLoading ? (
                <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                </div>
            ) : trainingSessions.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                    No training sessions found. Create one to get started.
                </p>
            ) : (
                <div className="space-y-4">
                    {trainingSessions
                        .sort((a, b) => b.date.getTime() - a.date.getTime())
                        .map((session) => (
                            <div 
                                key={session.id}
                                className={`bg-white dark:bg-secondary/50 rounded-xl p-4 shadow-md hover:shadow-lg transition-shadow cursor-pointer
                                    ${selectedSession === session.id ? 'ring-2 ring-primary' : ''}`}
                                onClick={() => handleSessionClick(session)}
                            >
                                <div className="flex justify-between items-center mb-3">
                                    <div>
                                        <h3 className="font-medium dark:text-white flex items-center">
                                            {new Date(session.date).toLocaleDateString(undefined, {
                                                weekday: 'long',
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric'
                                            })}
                                            <span className="mx-2 text-gray-400">•</span>
                                            <span className="text-gray-500 dark:text-gray-400">
                                                {getTeamName(session.teamId)}
                                            </span>
                                        </h3>
                                    </div>
                                    <div className="flex items-center space-x-4">
                                        <span className="text-sm text-gray-500 dark:text-gray-400">
                                            {Object.values(attendanceMap[session.id] || {}).filter(present => present).length} / {sessionPlayerCounts[session.id] || 0} present
                                        </span>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSessionToDelete(session);
                                                setShowDeleteConfirmModal(true);
                                            }}
                                            className="p-2 rounded-full hover:bg-red-50 text-red-500 dark:hover:bg-red-900/20"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {selectedSession === session.id && validPlayers.length > 0 && (
                                    <div className="mt-4 space-y-2">
                                        <div className="h-px bg-gray-200 dark:bg-gray-700 my-3"></div>
                                        {validPlayers.map((player) => (
                                            <div 
                                                key={`${session.id}-${player.id}`}
                                                className="flex items-center justify-between p-2 bg-gray-50 dark:bg-secondary-dark rounded-lg"
                                            >
                                                <div className="flex items-center space-x-3">
                                                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                                                        <span className="text-primary font-medium">{player.number}</span>
                                                    </div>
                                                    <div>
                                                        <p className="font-medium dark:text-white">{player.name}</p>
                                                        <p className="text-sm text-gray-500 dark:text-gray-400">{player.position}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            updateAttendance(session.id!, player.id, true);
                                                        }}
                                                        className={`p-2 rounded-full ${
                                                            attendanceMap[session.id]?.[player.id] === true
                                                                ? 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                                                                : 'hover:bg-gray-100 text-gray-400 dark:hover:bg-gray-700'
                                                        }`}
                                                    >
                                                        <Check className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            updateAttendance(session.id!, player.id, false);
                                                        }}
                                                        className={`p-2 rounded-full ${
                                                            attendanceMap[session.id]?.[player.id] === false
                                                                ? 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                                                                : 'hover:bg-gray-100 text-gray-400 dark:hover:bg-gray-700'
                                                        }`}
                                                    >
                                                        <X className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                </div>
            )}

            {/* Stats Modal */}
            {showStatsModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-secondary rounded-xl p-6 w-[90%] max-w-4xl shadow-xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold dark:text-white">Training Statistics</h3>
                            <button 
                                onClick={() => setShowStatsModal(false)}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        {/* Stats Content */}
                        {isLoadingStats ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                            </div>
                        ) : (() => {
                            const stats = calculateAttendanceStats();
                            if (!stats) return (
                                <p className="text-gray-500 dark:text-gray-400">No statistics available yet.</p>
                            );

                            return (
                                <div className="space-y-6">
                                    {/* Team Attendance Overview */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-white dark:bg-secondary/50 rounded-xl p-4 shadow-sm">
                                            <h4 className="text-sm text-gray-500 dark:text-gray-400">Team Attendance Rate</h4>
                                            <p className="text-2xl font-bold text-primary">
                                                {stats.teamRate.toFixed(1)}%
                                            </p>
                                            <TrendingUp className="w-5 h-5 text-green-500 mt-1" />
                                        </div>
                                        <div className="bg-white dark:bg-secondary/50 rounded-xl p-4 shadow-sm">
                                            <h4 className="text-sm text-gray-500 dark:text-gray-400">Last Session</h4>
                                            <p className="text-2xl font-bold text-primary">
                                                {stats.recentSessions[0]?.rate.toFixed(1)}%
                                            </p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                                {stats.recentSessions[0]?.presentCount}/{stats.recentSessions[0]?.totalCount} players
                                            </p>
                                        </div>
                                    </div>

                                    {/* Recent Sessions */}
                                    <div className="bg-white dark:bg-secondary/50 rounded-xl p-4 shadow-sm">
                                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                            Last 5 Sessions
                                        </h4>
                                        <div className="space-y-3">
                                            {stats.recentSessions.map((session) => (
                                                <div key={session.sessionId} className="flex justify-between items-center">
                                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                                        {session.date.toLocaleDateString()}
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
                                            {stats.playerStats
                                                .sort((a, b) => b.attendanceRate - a.attendanceRate)
                                                .map((player) => (
                                                    <div key={player.id} className="flex justify-between items-center">
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
                                                            <TrendingUp className="w-4 h-4 text-green-500" />
                                                        </div>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}

            {showNewSessionModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-secondary rounded-xl p-6 w-[90%] max-w-md shadow-xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold dark:text-white">New Training Session</h3>
                            <button 
                                onClick={() => setShowNewSessionModal(false)}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Date
                                </label>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="w-full px-4 py-2 rounded-lg border dark:border-gray-600 dark:bg-secondary-dark dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Team
                                </label>
                                <p className="text-gray-600 dark:text-gray-400">
                                    {getTeamName(teamId)}
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-end space-x-3 mt-6">
                            <button
                                onClick={() => setShowNewSessionModal(false)}
                                className="px-4 py-2 text-gray-500 dark:text-gray-400"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    setSelectedTeamForNewSession(teamId);
                                    createTrainingSession();
                                }}
                                disabled={!selectedDate}
                                className="px-4 py-2 bg-primary text-white rounded-lg disabled:opacity-50"
                            >
                                Create Session
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add confirmation modal */}
            {showDeleteConfirmModal && sessionToDelete && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-secondary rounded-xl p-6 w-[90%] max-w-md shadow-xl">
                        <h3 className="text-lg font-semibold dark:text-white mb-2">Delete Training Session</h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                            Are you sure you want to delete the training session on{' '}
                            {new Date(sessionToDelete.date).toLocaleDateString(undefined, {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            })}
                            {' '}for team {getTeamName(sessionToDelete.teamId)}?
                        </p>
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => {
                                    setShowDeleteConfirmModal(false);
                                    setSessionToDelete(null);
                                }}
                                className="px-4 py-2 text-gray-500 dark:text-gray-400"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => deleteTrainingSession(sessionToDelete)}
                                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Training; 