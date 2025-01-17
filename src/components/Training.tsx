import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, deleteDoc, orderBy } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { TrainingSession, TrainingAttendance, AbsenceReason } from '../types/training';
import { Player } from '../types/player';
import { Plus, X, Check, ChevronDown, BarChart2, TrendingUp, TrendingDown, Users, MoreHorizontal, Stethoscope, School, Music, Briefcase, Users2, HelpCircle } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import { chartOptions } from '../utils/chartConfig';
import PlayerStats from './PlayerStats';

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

// Add a helper function to get the reason icon
const getReasonIcon = (reason?: AbsenceReason) => {
    switch (reason) {
        case 'Sick/Injured':
            return <Stethoscope className="w-4 h-4 text-red-500" />;
        case 'School':
            return <School className="w-4 h-4 text-blue-500" />;
        case 'Party/Holiday':
            return <Music className="w-4 h-4 text-purple-500" />;
        case 'Work':
            return <Briefcase className="w-4 h-4 text-orange-500" />;
        case 'Family':
            return <Users2 className="w-4 h-4 text-green-500" />;
        case 'Unknown':
            return <HelpCircle className="w-4 h-4 text-gray-500" />;
        default:
            return null;
    }
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
    const [showStats, setShowStats] = useState(false);
    const [showPlayerStats, setShowPlayerStats] = useState(false);
    const [showAbsenceReasonModal, setShowAbsenceReasonModal] = useState(false);
    const [selectedPlayerForReason, setSelectedPlayerForReason] = useState<{
        sessionId: string;
        playerId: string;
        playerName: string;
    } | null>(null);

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
        try {
            const newSession: TrainingSession = {
                date: new Date(selectedDate),
                userId,
                teamId: teamId,
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
            setShowNewSessionModal(false);
        } catch (error) {
            console.error('Error in createTrainingSession:', error);
        }
    };

    const updateAttendance = async (
        sessionId: string, 
        playerId: string, 
        present: boolean,
        absenceReason?: AbsenceReason
    ) => {
        if (!sessionId || !playerId) {
            console.error('Missing sessionId or playerId');
            return;
        }

        try {
            const session = trainingSessions.find(s => s.id === sessionId);
            if (!session) return;

            const currentAttendance = session.attendance || [];
            const updatedAttendance = currentAttendance.filter(a => a.playerId !== playerId);
            
            // Create new attendance record
            const newAttendanceRecord: TrainingAttendance = {
                playerId,
                present,
                updatedAt: new Date()
            };

            // Only add absenceReason if the player is absent
            if (!present && absenceReason) {
                newAttendanceRecord.absenceReason = absenceReason;
            }

            updatedAttendance.push(newAttendanceRecord);

            const sessionRef = doc(db, 'training-sessions', sessionId);
            await updateDoc(sessionRef, {
                attendance: updatedAttendance
            });
            
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
            
            const attendanceRate = (playerAttendance / validSessions.length) * 100;
            
            // Compare with team average to determine trend
            let trend: 'up' | 'down' = 'up';
            if (attendanceRate < teamAttendanceRate) {
                trend = 'down';
            }
            
            return {
                ...player,
                attendanceRate,
                trend
            };
        });

        // Add absence by reason statistics
        const absencesByReason = validPlayers.map(player => {
            const absences = validSessions.reduce((acc, session) => {
                const attendance = session.attendance?.find(a => a.playerId === player.id);
                if (attendance && !attendance.present && attendance.absenceReason) {
                    acc[attendance.absenceReason] = (acc[attendance.absenceReason] || 0) + 1;
                }
                return acc;
            }, {} as { [key in AbsenceReason]?: number });

            return {
                player,
                absences
            };
        });

        return {
            teamRate: teamAttendanceRate,
            recentSessions,
            playerStats,
            absencesByReason
        };
    };

    // Add the absence reason modal component
    const AbsenceReasonModal = () => {
        const reasons: { value: AbsenceReason; icon: JSX.Element }[] = [
            { value: 'Sick/Injured', icon: <Stethoscope className="w-5 h-5" /> },
            { value: 'School', icon: <School className="w-5 h-5" /> },
            { value: 'Party/Holiday', icon: <Music className="w-5 h-5" /> },
            { value: 'Work', icon: <Briefcase className="w-5 h-5" /> },
            { value: 'Family', icon: <Users2 className="w-5 h-5" /> },
            { value: 'Unknown', icon: <HelpCircle className="w-5 h-5" /> }
        ];
        
        if (!selectedPlayerForReason) return null;

        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white dark:bg-secondary rounded-xl p-6 w-[90%] max-w-md shadow-xl">
                    <h3 className="text-lg font-semibold dark:text-white mb-2">
                        Absence Reason for {selectedPlayerForReason.playerName}
                    </h3>
                    <div className="grid grid-cols-2 gap-3 mt-4">
                        {reasons.map(({ value, icon }) => (
                            <button
                                key={value}
                                onClick={() => {
                                    updateAttendance(
                                        selectedPlayerForReason.sessionId,
                                        selectedPlayerForReason.playerId,
                                        false,
                                        value
                                    );
                                    setShowAbsenceReasonModal(false);
                                    setSelectedPlayerForReason(null);
                                }}
                                className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2 text-gray-800 dark:text-gray-200"
                            >
                                {icon}
                                <span>{value}</span>
                            </button>
                        ))}
                    </div>
                    <div className="flex justify-end mt-6">
                        <button
                            onClick={() => {
                                setShowAbsenceReasonModal(false);
                                setSelectedPlayerForReason(null);
                            }}
                            className="px-4 py-2 text-gray-500 dark:text-gray-400"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // Add this component for the absence stats section
    const AbsenceStatsByReason = ({ stats }: { stats: ReturnType<typeof calculateAttendanceStats> }) => {
        const [selectedReason, setSelectedReason] = useState<AbsenceReason>('Sick/Injured');
        const reasons: { value: AbsenceReason; icon: JSX.Element }[] = [
            { value: 'Sick/Injured', icon: <Stethoscope className="w-5 h-5" /> },
            { value: 'School', icon: <School className="w-5 h-5" /> },
            { value: 'Party/Holiday', icon: <Music className="w-5 h-5" /> },
            { value: 'Work', icon: <Briefcase className="w-5 h-5" /> },
            { value: 'Family', icon: <Users2 className="w-5 h-5" /> },
            { value: 'Unknown', icon: <HelpCircle className="w-5 h-5" /> }
        ];

        // Sort players by number of absences for selected reason
        const sortedPlayers = stats.absencesByReason
            .filter(({ absences }) => absences[selectedReason] && absences[selectedReason]! > 0)
            .sort((a, b) => (b.absences[selectedReason] || 0) - (a.absences[selectedReason] || 0));

        return (
            <div className="bg-white dark:bg-secondary/50 rounded-xl p-4 shadow-sm">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Absences by Reason
                </h4>
                
                {/* Reason selector */}
                <div className="flex flex-wrap gap-2 mb-4">
                    {reasons.map(({ value, icon }) => (
                        <button
                            key={value}
                            onClick={() => setSelectedReason(value)}
                            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border transition-colors ${
                                selectedReason === value
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                        >
                            {icon}
                            <span className="text-sm">{value}</span>
                        </button>
                    ))}
                </div>

                {/* Player list */}
                <div className="space-y-3">
                    {sortedPlayers.length === 0 ? (
                        <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                            No absences recorded for this reason
                        </p>
                    ) : (
                        sortedPlayers.map(({ player, absences }) => (
                            <div key={player.id} className="flex items-center justify-between">
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
                                    <span className="text-lg font-semibold text-primary">
                                        {absences[selectedReason]}
                                    </span>
                                    {getReasonIcon(selectedReason)}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        );
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
                    <div className="flex flex-col space-y-4">
                        <div className="flex justify-end space-x-2">
                            <button
                                onClick={() => {
                                    setShowStats(!showStats);
                                    setShowPlayerStats(false);
                                }}
                                className={`flex items-center space-x-1 border px-3 py-1.5 rounded-lg transition-colors ${
                                    showStats 
                                        ? 'bg-primary text-white border-primary' 
                                        : 'border-primary text-primary hover:bg-primary/10'
                                }`}
                            >
                                <BarChart2 className="w-4 h-4" />
                                <span>Team Stats</span>
                            </button>
                            <button
                                onClick={() => {
                                    setShowPlayerStats(!showPlayerStats);
                                    setShowStats(false);
                                }}
                                className={`flex items-center space-x-1 border px-3 py-1.5 rounded-lg transition-colors ${
                                    showPlayerStats 
                                        ? 'bg-primary text-white border-primary' 
                                        : 'border-primary text-primary hover:bg-primary/10'
                                }`}
                            >
                                <Users className="w-4 h-4" />
                                <span>Player Stats</span>
                            </button>
                            <button
                                onClick={() => {
                                    setSelectedTeamForNewSession(teamId);
                                    setShowNewSessionModal(true);
                                }}
                                className="flex items-center space-x-1 border border-primary text-primary px-3 py-1.5 rounded-lg hover:bg-primary/10 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                <span>New Session</span>
                            </button>
                        </div>

                        {/* Stats Section - Now conditionally rendered based on showStats */}
                        {teamId && showStats && (() => {
                            const stats = calculateAttendanceStats();
                            if (!stats) return null;

                            return (
                                <div className="space-y-6 mt-6">
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

                                    {/* Add the new absence stats component */}
                                    <AbsenceStatsByReason stats={stats} />
                                </div>
                            );
                        })()}

                        {/* Add the Player Stats section */}
                        {teamId && showPlayerStats && (() => {
                            const stats = calculateAttendanceStats();
                            if (!stats) return null;

                            return (
                                <div className="space-y-4 mt-6">
                                    {teamPlayers
                                        .filter(hasPlayerId)
                                        .map(player => {
                                            const playerStat = stats.playerStats.find(p => p.id === player.id);
                                            if (!playerStat) return null;
                                            
                                            return (
                                                <PlayerStats
                                                    key={player.id}
                                                    player={player}
                                                    sessions={trainingSessions}
                                                    attendanceMap={attendanceMap}
                                                    teamAverageRate={stats.teamRate}
                                                    trend={playerStat.trend}
                                                />
                                            );
                                        })}
                                </div>
                            );
                        })()}
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
                                                            setSelectedPlayerForReason({
                                                                sessionId: session.id!,
                                                                playerId: player.id,
                                                                playerName: player.name
                                                            });
                                                            setShowAbsenceReasonModal(true);
                                                        }}
                                                        className={`p-2 rounded-full ${
                                                            attendanceMap[session.id]?.[player.id] === false
                                                                ? 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                                                                : 'hover:bg-gray-100 text-gray-400 dark:hover:bg-gray-700'
                                                        }`}
                                                    >
                                                        <X className="w-5 h-5" />
                                                    </button>
                                                    {attendanceMap[session.id]?.[player.id] === false && (
                                                        <>
                                                            {session.attendance?.find(a => a.playerId === player.id)?.absenceReason && (
                                                                <div className="p-2">
                                                                    {getReasonIcon(session.attendance?.find(a => a.playerId === player.id)?.absenceReason)}
                                                                </div>
                                                            )}
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedPlayerForReason({
                                                                        sessionId: session.id!,
                                                                        playerId: player.id,
                                                                        playerName: player.name
                                                                    });
                                                                    setShowAbsenceReasonModal(true);
                                                                }}
                                                                className="p-2 rounded-full hover:bg-gray-100 text-gray-400 dark:hover:bg-gray-700"
                                                            >
                                                                <MoreHorizontal className="w-5 h-5" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
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
                                onClick={createTrainingSession}
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

            {/* Add the modal to the main render */}
            {showAbsenceReasonModal && <AbsenceReasonModal />}
        </div>
    );
};

export default Training; 