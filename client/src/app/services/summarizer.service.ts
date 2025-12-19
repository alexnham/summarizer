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

  // Upload file and get summary

async summarizeFile(file: File): Promise<Summary> {
  const formData = new FormData();
  formData.append('audio', file);

  const userId = this.authService.getCurrentUserId();
  if (userId) {
    formData.append('userId', userId);
  }

  return await firstValueFrom(
    this.http.post<Summary>(`${this.apiUrl}/transcribe`, formData)
  );
}

  // Get summary by ID
  getSummary(id: string): Observable<Summary> {
    return this.http.get<Summary>(`${this.apiUrl}/getTranscription/${id}`);
  }

  // Get all summaries
  getAllSummaries(userID: string): Observable<Summary[]> {
    return this.http.get<Summary[]>(`${this.apiUrl}/getTranscriptions/${userID}`);
  }

  // Delete summary
  deleteSummary(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/summaries/${id}`);
  }
}