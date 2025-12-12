import { Chunk } from "./chunk.model";
import { Metadata } from "./metadata.model";

export interface Summary {
    id: number;
    userId: number;
    title: string;
    content: string;
    metadata: Metadata;
    chunks : Chunk[];
    final_summary: string;
    transcript: string;
}