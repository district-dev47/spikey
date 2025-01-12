export interface TrainingSession {
    id?: string;
    date: Date;
    userId: string;
    teamId: string;
}

export interface TrainingAttendance {
    playerId: string;
    present: boolean;
} 