export type AbsenceReason = 'Sick/Injured' | 'School' | 'Party/Holiday' | 'Work' | 'Family' | 'Unknown';

export interface TrainingAttendance {
    playerId: string;
    present: boolean;
    absenceReason?: AbsenceReason;
    updatedAt: Date;
}

export interface TrainingSession {
    id?: string;
    teamId: string;
    userId: string;
    date: Date;
    attendance?: TrainingAttendance[];
} 