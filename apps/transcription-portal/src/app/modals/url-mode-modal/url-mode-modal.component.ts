import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
} from '@angular/core';
import { NgbActiveModal, NgbModalOptions } from '@ng-bootstrap/ng-bootstrap';
import { SubscriberComponent } from '@octra/ngx-utilities';
import { interval } from 'rxjs';

@Component({
  selector: 'tportal-url-mode-modal',
  templateUrl: './url-mode-modal.component.html',
  styleUrls: ['./url-mode-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class UrlModeModalComponent
  extends SubscriberComponent
  implements OnInit
{
  leftTime = 0;

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
    size: 'sm',
    backdrop: 'static',
    keyboard: false,
  };

  constructor(
    protected activeModal: NgbActiveModal,
    private cd: ChangeDetectorRef
  ) {
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
