import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FileInput } from './file-input/file-input';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, FileInput],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('client');
}
