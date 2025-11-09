import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { NgbActiveModal, NgbModalOptions } from '@ng-bootstrap/ng-bootstrap';
import { SubscriberComponent } from '@octra/ngx-utilities';

@Component({
  selector: 'tportal-split-modal',
  templateUrl: './split-modal.component.html',
  styleUrls: ['./split-modal.component.scss'],
  imports: [],
})
export class SplitModalComponent extends SubscriberComponent {
  protected activeModal = inject(NgbActiveModal);

  public static options: NgbModalOptions = {
    size: 'lg',
    backdrop: 'static',
    keyboard: false,
    fullscreen: 'sm',
  };

  dismiss(reason: string) {
    this.activeModal.close(reason);
  }
}
