import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Summary } from '../models/summary.model';
import { AuthService } from './auth.service';
import { firstValueFrom } from 'rxjs';

// Transcription options interface
export interface TranscriptionOptions {
  diarize?: boolean;      // Enable speaker diarization
  language?: string;      // Language code (e.g., 'en', 'es', 'fr')
  model?: string;         // Deepgram model
  smart_format?: boolean; // Enable smart formatting
}

// Available languages for the UI
export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'en-US', name: 'English (US)' },
  { code: 'en-GB', name: 'English (UK)' },
  { code: 'es', name: 'Spanish' },
  { code: 'es-419', name: 'Spanish (Latin America)' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)' },
  { code: 'nl', name: 'Dutch' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ru', name: 'Russian' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ar', name: 'Arabic' },
  { code: 'vi', name: 'Vietnamese' },
];

@Injectable({
  providedIn: 'root'
})
export class SummarizerService {
  private apiUrl = 'https://summarizer-dey4-8b8gsucop-alexnhams-projects.vercel.app/api';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  // Create a pending summary with null values
  async createPendingSummary(title: string): Promise<{ id: string; status: string }> {
    const userId = this.authService.getCurrentUserId();
    return await firstValueFrom(
      this.http.post<{ id: string; status: string }>(`${this.apiUrl}/createPendingSummary`, {
        title,
        userId
      })
    );
  }

  // Upload file and get summary (updates existing pending summary)
  async summarizeFile(
    title: string, 
    file: File, 
    summaryId?: string,
    options?: TranscriptionOptions
  ): Promise<Summary> {
    const formData = new FormData();
    formData.append('audio', file);
    formData.append('title', title);

    const userId = this.authService.getCurrentUserId();
    if (userId) {
      formData.append('userId', userId);
    }
    
    if (summaryId) {
      formData.append('summaryId', summaryId);
    }

    // Add transcription options
    if (options?.diarize !== undefined) {
      formData.append('diarize', String(options.diarize));
    }
    if (options?.language) {
      formData.append('language', options.language);
    }

    /*

    if (options?.model) {
      formData.append('model', options.model);
    }
      */

    if (options?.smart_format !== undefined) {
      formData.append('smart_format', String(options.smart_format));
    }
    console.log('formData', formData.get('nova-3'), formData.get('model'));
    return await firstValueFrom(
      this.http.post<Summary>(`${this.apiUrl}/transcribe`, formData)
    );
  }
  
  deleteTranscription(id: string): Promise<void> {
    if (!id) return Promise.resolve();
    return firstValueFrom(this.http.delete<void>(`${this.apiUrl}/deleteTranscription/${id}`));
  }
  
  // Get summary by ID
  getSummary(id: string | undefined): Promise<Summary> {
    if (!id) return Promise.resolve(null as any);
    return firstValueFrom(this.http.get<Summary>(`${this.apiUrl}/getTranscription/${id}`));
  }

  // Get all summaries
  getAllSummaries(userID: string): Promise<Summary[]> {
    return firstValueFrom(this.http.get<Summary[]>(`${this.apiUrl}/getTranscriptions/${userID}`));
  }

  getAllSummariesTitle(userID: string | null): Promise<Summary[]> {
    if(!userID) {
      return Promise.resolve([]);
    }
    return firstValueFrom(this.http.get<Summary[]>(`${this.apiUrl}/getTranscriptionsTitle/${userID}`));
  }
}