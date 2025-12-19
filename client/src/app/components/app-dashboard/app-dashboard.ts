import { Component } from "@angular/core";
import { AuthService } from "../../services/auth.service";
import { Observable } from "rxjs";
import { User } from "@supabase/supabase-js";
import { AsyncPipe } from "@angular/common";
import { SummaryDisplay } from "../summary-display/summary-display";
@Component({
  selector: 'app-dashboard',
  templateUrl: './app-dashboard.html',
  styleUrl: './app-dashboard.css',
  imports: [AsyncPipe, SummaryDisplay],
})
export class AppDashboard {
    currentUser$: Observable<User | null>;
    constructor(private authService: AuthService) {
        this.currentUser$ = this.authService.currentUser$;
    }
}
