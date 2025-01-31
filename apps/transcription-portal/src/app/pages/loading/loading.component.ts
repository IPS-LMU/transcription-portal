import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { SubscriberComponent } from '@octra/ngx-utilities';
import { SettingsService } from '../../shared/settings.service';

@Component({
  selector: 'tportal-loading',
  imports: [CommonModule],
  templateUrl: './loading.component.html',
  styleUrl: './loading.component.scss',
})
export class LoadingComponent extends SubscriberComponent {
  error?: string;

  constructor(
    private settingsService: SettingsService,
    private router: Router
  ) {
    super();
    this.subscribe(this.settingsService.settingsload, {
      next: (result) => {
        this.router.navigate(['/']);
      },
      error: (error: Error) => {
        this.error = error.message;
      },
    });
  }
}
