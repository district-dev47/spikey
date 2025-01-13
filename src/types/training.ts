export interface TrainingSession {
    id?: string;
    date: Date;
    userId: string;
    teamId: string;
    attendance?: TrainingAttendance[];
}

export interface TrainingAttendance {
    playerId: string;
    present: boolean;
    updatedAt?: Date;
} 