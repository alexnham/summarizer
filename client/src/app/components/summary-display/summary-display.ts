import { Component, signal } from "@angular/core";
import { SummarizerService } from "../../services/summarizer.service";
import { Summary } from "../../models/summary.model";
import { AuthService } from "../../services/auth.service";
import { AsyncPipe } from "@angular/common";
import { Chunk } from "../../models/chunk.model";
import { Metadata } from "../../models/metadata.model";


@Component({
    selector: 'summary-display',
    templateUrl: './summary-display.html',
    styleUrl: './summary-display.css',
    imports: [AsyncPipe]
})

export class SummaryDisplay {

    constructor(private summarizerService: SummarizerService, private authService: AuthService) { }

    selectedFile: File | null = null;
    output = signal<Summary | null>(null);

    onFileSelected(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            this.selectedFile = input.files[0];
        }
    }

    async transcribe() {
        if (!this.selectedFile) return;

        const response: any = await this.summarizerService.summarizeFile(this.selectedFile)
        console.log('response', response);
        
        const tempChunks: Chunk[] = [];
        for (const chunk of response.chunks) {
            tempChunks.push({
                id: 1,
                summary: chunk.summary,
                action_items: chunk.action_items,
                key_points: chunk.key_points,
                notable_quotes: chunk.notable_quotes,
                startTime: chunk.startTime,
                endTime: chunk.endTime
            });
        }
        
        const temp: Summary = {
                id: 1,
                userId: 1,
                title: "test",
                content: "test",
                metadata: null,
                chunks: tempChunks,
                final_summary: "test",
                transcript: response.raw_deepgram_response.results.channels[0].alternatives[0].transcript
        }

        this.output.set(temp);
    }
}
