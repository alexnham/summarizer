import { Component, signal, output } from "@angular/core";
import { SummarizerService } from "../../services/summarizer.service";
import { Summary } from "../../models/summary.model";
import { AuthService } from "../../services/auth.service";
import { Chunk } from "../../models/chunk.model";


@Component({
    selector: 'summary-creator',
    templateUrl: './summary-creator.html',
    styleUrl: './summary-creator.css'
})

export class SummaryCreator {

    constructor(private summarizerService: SummarizerService, private authService: AuthService) { }

    selectedFile: File | null = null;
    title: string = '';
    output = signal<Summary | null>(null);
    
    // Status for UI feedback
    status = signal<'idle' | 'creating' | 'transcribing' | 'completed' | 'error'>('idle');
    statusMessage = signal<string>('');
    pendingSummaryId = signal<string | null>(null);
    
    // Event to notify parent when a new summary is created
    summaryCreated = output<{ id: string; title: string }>();

    onFileSelected(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            this.selectedFile = input.files[0];
        }
    }

    onTitleChange(event: Event) {
        const input = event.target as HTMLInputElement;
        this.title = input.value;
    }

    async transcribe() {
        if (!this.selectedFile) return;

        try {
            // Step 1: Create pending summary in DB
            this.status.set('creating');
            this.statusMessage.set('Creating summary...');
            
            const pending = await this.summarizerService.createPendingSummary(this.title || 'Untitled');
            this.pendingSummaryId.set(pending.id);
            
            // Notify parent that a new summary was created (so nav can update)
            this.summaryCreated.emit({ id: pending.id, title: this.title || 'Untitled' });
            
            // Step 2: Start transcription
            this.status.set('transcribing');
            this.statusMessage.set('Transcription started... This may take a few minutes.');
            
            const response: any = await this.summarizerService.summarizeFile(
                this.title, 
                this.selectedFile,
                pending.id
            );
            
            console.log('response', response);
            
            // Step 3: Process response
            const tempChunks: Chunk[] = [];
            for (const chunk of response.chunks) {
                tempChunks.push({
                    id: chunk.chunk_index,
                    summary: chunk.summary,
                    action_items: chunk.action_items,
                    key_points: chunk.key_points,
                    notable_quotes: chunk.notable_quotes,
                    startTime: chunk.startTime,
                    endTime: chunk.endTime
                });
            }
            
            const temp: Summary = {
                    id: response.id,
                    userId: response.userId,
                    title: this.title || 'Untitled',
                    content: "test",
                    metadata: null,
                    chunks: tempChunks,
                    final_summary: "test",
                    transcript: response.raw_deepgram_response.results.channels[0].alternatives[0].transcript
            }

            this.output.set(temp);
            this.status.set('completed');
            this.statusMessage.set('Transcription completed!');
            
            // Reset form after short delay
            setTimeout(() => {
                this.resetForm();
            }, 2000);
            
        } catch (error: any) {
            console.error('Transcription error:', error);
            this.status.set('error');
            this.statusMessage.set(`Error: ${error.message || 'Transcription failed'}`);
        }
    }
    
    resetForm() {
        this.selectedFile = null;
        this.title = '';
        this.status.set('idle');
        this.statusMessage.set('');
        this.pendingSummaryId.set(null);
    }

    getSummary(id: string) {
        this.summarizerService.getSummary(id).then(summary => {
            this.output.set(summary);
        });
    }
}
