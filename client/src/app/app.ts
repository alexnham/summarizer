import { Component, signal } from '@angular/core';
import { AsyncPipe, CommonModule } from '@angular/common'; // Import AsyncPipe and/or CommonModule
import { RouterOutlet } from '@angular/router';
import { FileInput } from './components/file-input/file-input';
import { LoginComponent } from './components/login/login';
import { AuthService } from './services/auth.service';
// async import


@Component({
  selector: 'app-root',
  imports: [RouterOutlet, FileInput, LoginComponent, AsyncPipe, CommonModule], // Add AsyncPipe and/or CommonModule here
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {

  constructor(public authService: AuthService) {}

  protected readonly title = signal('client');
}
