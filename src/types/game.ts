export interface SetScore {
    team: number;
    opponent: number;
}

export interface LineupPlayer {
    id: string;
    name: string;
    number: string;
    position: string;
    rotationPosition: number;
    joinedAt: string;
}

export interface GameSet {
    number: number;
    lineup: LineupPlayer[];
    score?: SetScore;
    substitutions?: {
        outPlayer: LineupPlayer;
        inPlayer: LineupPlayer;
        currentScore: SetScore;
    }[];
}

export interface Game {
    id: string;
    teamId: string;
    opponent: string;
    date: string;
    status: 'win' | 'loss' | 'in-progress';
    sets: GameSet[];
    userId: string;
    score?: {
        team: number;
        opponent: number;
    };
    finalScore?: {
        team: number;
        opponent: number;
    };
} 