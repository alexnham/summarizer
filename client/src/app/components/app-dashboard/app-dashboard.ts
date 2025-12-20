import { Component } from "@angular/core";
import { AuthService } from "../../services/auth.service";
import { Observable } from "rxjs";
import { User } from "@supabase/supabase-js";
import { AsyncPipe } from "@angular/common";
import { Router } from "@angular/router";
import { SummaryNavBar } from "../summary-nav-bar/summary-nav-bar";
@Component({
  selector: 'app-dashboard',
  templateUrl: './app-dashboard.html',
  styleUrl: './app-dashboard.css',
  imports: [AsyncPipe, SummaryNavBar],
})
export class AppDashboard {
    currentUser$: Observable<User | null>;
    constructor(private authService: AuthService, private router: Router ) {
        this.currentUser$ = this.authService.currentUser$;
    }
    logout() {
        this.authService.signOut();
        this.router.navigate(['/login']);
    }
}
