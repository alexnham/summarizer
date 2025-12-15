import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service';


@Component({
  selector: 'app-login',
  imports: [],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginComponent {
  constructor(public authService: AuthService) {}

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