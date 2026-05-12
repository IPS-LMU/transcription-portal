import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgbActiveModal, NgbModalOptions } from '@ng-bootstrap/ng-bootstrap';
import { SubscriberComponent } from '@octra/ngx-utilities';
import { interval } from 'rxjs';

@Component({
  selector: 'tportal-url-mode-modal',
  templateUrl: './url-mode-modal.component.html',
  styleUrls: ['./url-mode-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [TranslocoPipe],
})
export class UrlModeModalComponent extends SubscriberComponent implements OnInit {
  protected activeModal = inject(NgbActiveModal);
  private cd = inject(ChangeDetectorRef);

  leftTime = 0;
  error?: string;

  get minutes(): string {
    const minutes = Math.floor(this.leftTime / 1000 / 60);
    return minutes.toString().padStart(2, '0');
  }

  get seconds(): string {
    return Math.floor((this.leftTime / 1000) % 60)
      .toString()
      .padStart(2, '0');
  }

  public static options: NgbModalOptions = {
    size: 'md',
    backdrop: 'static',
    keyboard: false,
  };

  constructor() {
    super();
    this.subscribe(interval(1000), {
      next: () => {
        this.cd.markForCheck();
      },
    });
    this.cd.markForCheck();
  }

  ngOnInit() {
    this.cd.markForCheck();
  }
}
