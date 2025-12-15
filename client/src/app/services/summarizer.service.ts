import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Summary } from '../models/summary.model';
import { AuthService } from './auth.service';

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
  summarizeFile(file: File): Observable<Summary> {
    const formData = new FormData();
    formData.append('audioURL', file);
    
    const userId = this.authService.getCurrentUserId();
    if (userId) {
      formData.append('userId', userId);
    }
    
    return this.http.post<Summary>(`${this.apiUrl}/summarize`, formData);
  }

  // Get summary by ID
  getSummary(id: string): Observable<Summary> {
    return this.http.get<Summary>(`${this.apiUrl}/summaries/${id}`);
  }

  // Get all summaries
  getAllSummaries(): Observable<Summary[]> {
    return this.http.get<Summary[]>(`${this.apiUrl}/summaries`);
  }

  // Delete summary
  deleteSummary(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/summaries/${id}`);
  }
}