import { Component, input } from '@angular/core';

@Component({
  selector: 'app-file-input',
  imports: [],
  templateUrl: './file-input.html',
  styleUrl: './file-input.css',
})
export class FileInput {
  message = input<string>('');
}
