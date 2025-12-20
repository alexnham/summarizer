import { Component, OnInit, signal } from '@angular/core';
import { Summary } from '../../models/summary.model';
import { AuthService } from '../../services/auth.service';
import { SummarizerService } from '../../services/summarizer.service';
import { NavBarButton } from '../nav-bar-button/nav-bar-button';
import { Observable } from 'rxjs';
import { User } from '@supabase/supabase-js';
import { Router } from '@angular/router';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'app-summary-nav-bar',
  imports: [NavBarButton, AsyncPipe],
  templateUrl: './summary-nav-bar.html',
  styleUrl: './summary-nav-bar.css',
})
export class SummaryNavBar implements OnInit {

  summaries = signal<Summary[]>([]);
  currentUser$: Observable<User | null>;

  constructor(
    private authService: AuthService,
    private summaryService: SummarizerService,
    private router: Router
  ) {
    this.currentUser$ = this.authService.currentUser$;

  }
      logout() {
        this.authService.signOut();
        this.router.navigate(['/login']);
    }

  async ngOnInit() {
    const userId = this.authService.getCurrentUserId();
    if (!userId) return;

    const allSummaries =
      await this.summaryService.getAllSummariesTitle(userId);

    this.summaries.set(allSummaries);
  }
}
