export interface Chunk {
    id: number;
    summary: string;
    action_items: string[];
    key_points: string[];
    notable_quotes: string[];
    startTime: number; // in seconds
    endTime: number;   // in seconds
}