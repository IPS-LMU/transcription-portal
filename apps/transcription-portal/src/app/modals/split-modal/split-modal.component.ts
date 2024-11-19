import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import {
  NgbActiveModal,
  NgbModal,
  NgbModalOptions,
} from '@ng-bootstrap/ng-bootstrap';
import { SubscriptionManager } from '../../shared/subscription-manager';

@Component({
  selector: 'tportal-split-modal',
  templateUrl: './split-modal.component.html',
  styleUrls: ['./split-modal.component.scss'],
  standalone: true,
  imports: [],
})
export class SplitModalComponent implements OnInit {
  @Output() dissmissedChange: EventEmitter<boolean> =
    new EventEmitter<boolean>();
  public static options: NgbModalOptions = {
    size: 'lg',
    backdrop: 'static',
    keyboard: false,
    fullscreen: 'mm',
  };
  private subscrManager = new SubscriptionManager();

  constructor(
    private ngbModalService: NgbModal,
    protected activeModal: NgbActiveModal
  ) {}

  private _splitModalDismissedProperly = false;

  get splitModalDismissedProperly(): boolean {
    return this._splitModalDismissedProperly;
  }

  @Input() set splitModalDismissedProperly(value: boolean) {
    this._splitModalDismissedProperly = value;
    this.dissmissedChange.emit(this._splitModalDismissedProperly);
  }

  ngOnInit() {}

  onHidden() {
    this.subscrManager.destroy();
  }

  dismiss(reason: string) {
    this.activeModal.close(reason);
  }
}
