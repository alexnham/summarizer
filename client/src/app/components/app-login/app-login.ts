import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';


@Component({
  selector: 'app-login',
  imports: [],
  templateUrl: './app-login.html',
  styleUrl: './app-login.css',
})
export class LoginComponent {
  constructor(public authService: AuthService, private router: Router) {

    //redirect if already logged in
    this.authService.getSupabaseClient().auth.getSession()
      .then(({ data: { session } }) => {
        if (session && this.router.url === '/login') {
          this.router.navigate(['/dashboard']); // redirect to home
        }
      });
  }

  async signInWithGoogle() {
    await this.authService.signInWithGoogle();
  }

  async signInWithGithub() {
    await this.authService.signInWithGithub();
  }

  async signOut() {
    await this.authService.signOut();
  }
}