import { Component, inject } from '@angular/core';
import { NgbActiveModal, NgbModalOptions } from '@ng-bootstrap/ng-bootstrap';
import { NgClass } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'tportal-yes-no-modal',
  templateUrl: './yes-no-modal.component.html',
  styleUrls: ['./yes-no-modal.component.scss'],
  imports: [NgClass, TranslocoPipe],
})
export class YesNoModalComponent {
  protected activeModal = inject(NgbActiveModal);

  static options: NgbModalOptions = {
    keyboard: false,
    backdrop: 'static',
    size: 'md',
  };

  message = '';
  title = '';
  type: 'info' | 'warning' | 'danger' = 'info';

  constructor() {}

  yes() {
    this.activeModal.close('yes');
  }

  no() {
    this.activeModal.close('no');
  }
}
