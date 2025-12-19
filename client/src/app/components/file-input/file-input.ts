import { Component, input } from '@angular/core';
import { AuthService } from '../../services/auth.service';
@Component({
  selector: 'app-file-input',
  imports: [],
  templateUrl: './file-input.html',
  styleUrl: './file-input.css',
})
export class FileInput {
  message = input<string>('');
  constructor(private authService: AuthService) {}

  test = () => {
    return this.authService.getCurrentUserId();
  }

}
