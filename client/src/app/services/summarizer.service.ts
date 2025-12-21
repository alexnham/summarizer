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

// Blob upload response
export interface BlobUploadResponse {
  url: string;
  pathname: string;
  contentType: string;
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
  private apiUrl = 'http://localhost:3000/api';

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

  // Upload file directly to Vercel Blob from the client
  async uploadToBlob(file: File): Promise<BlobUploadResponse> {
    console.log('Uploading file to Vercel Blob:', file.name, file.size, 'bytes');

    // Get the blob token from our API
    const tokenResponse = await fetch(`${this.apiUrl}/upload`);
    if (!tokenResponse.ok) {
      throw new Error('Failed to get upload token');
    }
    const { token } = await tokenResponse.json();

    // Upload directly to Vercel Blob
    const { put } = await import('@vercel/blob');
    
    const blob = await put(`audio/${Date.now()}-${file.name}`, file, {
      access: 'public',
      token: token,
    });

    console.log('Upload completed:', blob.url);

    return {
      url: blob.url,
      pathname: blob.pathname,
      contentType: blob.contentType || file.type,
    };
  }


  // Delete blob after transcription is complete
  async deleteBlob(blobUrl: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${this.apiUrl}/deleteBlob`, { url: blobUrl })
      );
    } catch (err) {
      console.warn('Failed to delete blob:', err);
      // Don't throw - blob cleanup is not critical
    }
  }

  // Upload file and get summary using Vercel Blob (new flow)
  async summarizeFile(
    title: string, 
    file: File, 
    summaryId?: string,
    options?: TranscriptionOptions
  ): Promise<Summary> {
    // Step 1: Upload file to Vercel Blob
    console.log('Uploading file to Vercel Blob...');
    const blob = await this.uploadToBlob(file);
    console.log('File uploaded to blob:', blob.url);

    try {
      // Step 2: Call transcribe API with blob URL
      const userId = this.authService.getCurrentUserId();
      
      const body: any = {
        audioUrl: blob.url,
        title,
        userId,
        summaryId,
      };

      // Add transcription options
      if (options?.diarize !== undefined) {
        body.diarize = options.diarize;
      }
      if (options?.language) {
        body.language = options.language;
      }
      if (options?.model) {
        body.model = options.model;
      }
      if (options?.smart_format !== undefined) {
        body.smart_format = options.smart_format;
      }

      console.log('Starting transcription with options:', body);
      
      const result = await firstValueFrom(
        this.http.post<Summary>(`${this.apiUrl}/transcribe`, body)
      );

      // Step 3: Clean up blob after successful transcription
      await this.deleteBlob(blob.url);

      return result;
    } catch (err) {
      // Try to clean up blob even on error
      await this.deleteBlob(blob.url);
      throw err;
    }
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