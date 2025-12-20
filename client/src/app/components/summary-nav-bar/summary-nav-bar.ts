import { Component, OnInit, signal } from '@angular/core';
import { Summary } from '../../models/summary.model';
import { AuthService } from '../../services/auth.service';
import { SummarizerService } from '../../services/summarizer.service';
import { NavBarButton } from '../nav-bar-button/nav-bar-button';

@Component({
  selector: 'app-summary-nav-bar',
  imports: [NavBarButton],
  templateUrl: './summary-nav-bar.html',
  styleUrl: './summary-nav-bar.css',
})
export class SummaryNavBar implements OnInit {

  summaries = signal<Summary[]>([]);

  constructor(
    private authService: AuthService,
    private summaryService: SummarizerService
  ) {}

  async ngOnInit() {
    const userId = this.authService.getCurrentUserId();
    if (!userId) return;

    const allSummaries =
      await this.summaryService.getAllSummariesTitle(userId);

    this.summaries.set(allSummaries);
  }
}
