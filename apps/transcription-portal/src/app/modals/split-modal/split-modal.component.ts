import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgbActiveModal, NgbModalOptions } from '@ng-bootstrap/ng-bootstrap';
import { SubscriberComponent } from '@octra/ngx-utilities';

@Component({
  selector: 'tportal-split-modal',
  templateUrl: './split-modal.component.html',
  styleUrls: ['./split-modal.component.scss'],
  imports: [],
})
export class SplitModalComponent extends SubscriberComponent {
  @Output() dissmissedChange: EventEmitter<boolean> =
    new EventEmitter<boolean>();
  public static options: NgbModalOptions = {
    size: 'lg',
    backdrop: 'static',
    keyboard: false,
    fullscreen: 'mm',
  };

  constructor(protected activeModal: NgbActiveModal) {
    super();
  }

  private _splitModalDismissedProperly = false;

  get splitModalDismissedProperly(): boolean {
    return this._splitModalDismissedProperly;
  }

  @Input() set splitModalDismissedProperly(value: boolean) {
    this._splitModalDismissedProperly = value;
    this.dissmissedChange.emit(this._splitModalDismissedProperly);
  }

  dismiss(reason: string) {
    this.activeModal.close(reason);
  }
}
