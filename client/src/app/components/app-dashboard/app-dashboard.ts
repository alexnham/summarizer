import { Component, signal, OnInit } from "@angular/core";
import { AuthService } from "../../services/auth.service";
import { SummarizerService } from "../../services/summarizer.service";
import { Router } from "@angular/router";
import { SummaryNavBar } from "../summary-nav-bar/summary-nav-bar";

@Component({
  selector: 'app-dashboard',
  templateUrl: './app-dashboard.html',
  styleUrl: './app-dashboard.css',
  imports: [SummaryNavBar],
})
export class AppDashboard implements OnInit {
    summaryCount = signal<number>(0);
    
    constructor(
        private authService: AuthService, 
        private router: Router,
        private summarizerService: SummarizerService
    ) {}
    
    async ngOnInit() {
        const userId = this.authService.getCurrentUserId();
        if (userId) {
            const summaries = await this.summarizerService.getAllSummariesTitle(userId);
            this.summaryCount.set(summaries?.length || 0);
        }
    }
    
    logout() {
        this.authService.signOut();
        this.router.navigate(['/login']);
    }
}
