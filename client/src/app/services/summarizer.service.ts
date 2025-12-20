import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Summary } from '../models/summary.model';
import { AuthService } from './auth.service';
import { firstValueFrom } from 'rxjs';


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

  // Upload file and get summary (updates existing pending summary)
  async summarizeFile(title: string, file: File, summaryId?: string): Promise<Summary> {
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

  // Delete summary

}