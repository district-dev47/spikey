import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { TrainingSession, TrainingAttendance } from '../types/training';
import { Player } from '../types/player';
import { Plus, X, Check, ChevronDown } from 'lucide-react';

interface TrainingProps {
    teamId: string;
    userId: string;
    players: Player[];
    teams: { id: string; name: string }[];
    onTeamSelect: (teamId: string) => void;
}

const Training: React.FC<TrainingProps> = ({ teamId, userId, players, teams, onTeamSelect }) => {
    console.log('Training component props:', { teamId, userId, players, teams });

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

    // Consolidate player fetching into a single function
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

    // Add effect to fetch all training sessions when component mounts
    useEffect(() => {
        const fetchAllTrainingSessions = async () => {
            if (!userId) return;

            try {
                const sessionsQuery = query(
                    collection(db, 'training-sessions'),
                    where('userId', '==', userId)
                );
                const sessionsSnapshot = await getDocs(sessionsQuery);
                const sessions: TrainingSession[] = [];
                const attendance: { [key: string]: { [key: string]: boolean } } = {};
                const playerCounts: { [key: string]: number } = {};

                for (const doc of sessionsSnapshot.docs) {
                    const data = doc.data();
                    const session = {
                        id: doc.id,
                        ...data,
                        date: data.date.toDate()
                    } as TrainingSession;
                    sessions.push(session);

                    // Fetch players for this session's team
                    const teamPlayersSnapshot = await getDocs(
                        collection(db, `teams/${session.teamId}/players`)
                    );
                    const teamPlayers = teamPlayersSnapshot.docs.map(playerDoc => ({
                        id: playerDoc.id,
                        ...playerDoc.data()
                    } as Player));

                    playerCounts[doc.id] = teamPlayers.length;

                    // Initialize attendance without default state
                    attendance[doc.id] = {};
                    teamPlayers.forEach(player => {
                        // Don't set any default state
                        attendance[doc.id][player.id] = undefined;
                    });

                    // Then update with actual attendance records
                    const attendanceArray = session.attendance || [];
                    attendanceArray.forEach((record: TrainingAttendance) => {
                        attendance[doc.id][record.playerId] = record.present;
                    });
                }

                setTrainingSessions(sessions);
                setAttendanceMap(attendance);
                setSessionPlayerCounts(playerCounts);
            } catch (error) {
                console.error('Error fetching training sessions:', error);
            }
        };

        fetchAllTrainingSessions();
    }, [userId]); // Only depend on userId

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

    // Remove the separate effect for session selection
    // Instead, update the click handler:
    const handleSessionClick = async (session: TrainingSession) => {
        const newSelectedSession = selectedSession === session.id ? null : session.id;
        setSelectedSession(newSelectedSession);
        if (newSelectedSession) {
            setSelectedTeamForNewSession(session.teamId);
            // Players will be fetched by the main effect when selectedTeamForNewSession changes
        }
    };

    const createTrainingSession = async () => {
        console.log('Creating session with team:', selectedTeamForNewSession);
        console.log('Current teamPlayers:', teamPlayers);
        
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

            console.log('New session data:', newSession);

            const docRef = await addDoc(collection(db, 'training-sessions'), {
                ...newSession,
                date: new Date(selectedDate)
            });

            const newSessionWithId = { ...newSession, id: docRef.id };

            // Initialize attendance without default state
            const initialAttendance: { [key: string]: boolean | undefined } = {};
            teamPlayers.forEach(player => {
                initialAttendance[player.id] = undefined;  // No default state
            });

            setAttendanceMap(prev => ({
                ...prev,
                [docRef.id]: initialAttendance
            }));

            // Store the player count for the new session
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

    return (
        <div className="p-4">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold dark:text-white">Training Sessions</h2>
                <button
                    onClick={() => setShowNewSessionModal(true)}
                    className="flex items-center space-x-1 border border-primary text-primary px-3 py-1.5 rounded-lg hover:bg-primary/10 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    <span>New Session</span>
                </button>
            </div>

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
                                <select
                                    value={selectedTeamForNewSession}
                                    onChange={(e) => setSelectedTeamForNewSession(e.target.value)}
                                    className="w-full px-4 py-2 rounded-lg border dark:border-gray-600 dark:bg-secondary-dark dark:text-white"
                                >
                                    <option value="">Select Team</option>
                                    {teams.map((team) => (
                                        <option key={team.id} value={team.id}>
                                            {team.name}
                                        </option>
                                    ))}
                                </select>
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
                                onClick={createTrainingSession}
                                disabled={!selectedTeamForNewSession || !selectedDate}
                                className="px-4 py-2 bg-primary text-white rounded-lg disabled:opacity-50"
                            >
                                Create Session
                            </button>
                        </div>
                    </div>
                </div>
            )}

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