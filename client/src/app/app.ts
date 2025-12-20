import { Component, OnInit } from '@angular/core';
import { AuthService } from './services/auth.service';
import { Router, RouterOutlet } from '@angular/router';
import { AsyncPipe, CommonModule } from '@angular/common';
import { User } from '@supabase/supabase-js';
import { Observable } from 'rxjs/internal/Observable';

@Component({
  standalone: true,
  selector: 'app-root',
  templateUrl: './app.html',
  imports: [AsyncPipe, CommonModule, RouterOutlet],

})
export class App implements OnInit {

  currentUser$: Observable<User | null>;

  constructor(private authService: AuthService, private router: Router) {
    this.currentUser$ = this.authService.currentUser$;
  }


  ngOnInit() {
    // Optional: handle OAuth redirect on page load
    this.authService.getSupabaseClient().auth.getSession()
      .then(({ data: { session } }) => {
        if (session) {
          this.authService['currentUserSubject'].next(session.user); // update BehaviorSubject
          this.router.navigate(['/']); // redirect to home
        }
      });
  }

  async loginWithGoogle() {
    const { data, error } = await this.authService.signInWithGoogle();
    if (error) {
      console.error('Login error:', error.message);
    } else {
      console.log('Redirecting to Google for login...');
      // After OAuth, Supabase will redirect to your app
    }
  }



  async logout() {
    const { error } = await this.authService.signOut();
    if (error) {
      console.error('Logout error:', error.message);
    } else {
      console.log('Logged out successfully');
      this.router.navigate(['/login']);
    }
  }
}
