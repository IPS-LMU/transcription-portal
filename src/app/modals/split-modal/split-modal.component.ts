import {Component, EventEmitter, Input, OnInit, Output, ViewChild} from '@angular/core';
import {DomSanitizer} from '@angular/platform-browser';
import {BsModalService, ModalDirective} from 'ngx-bootstrap';
import {SubscriptionManager} from '../../shared/subscription-manager';

@Component({
  selector: 'app-split-modal',
  templateUrl: './split-modal.component.html',
  styleUrls: ['./split-modal.component.css']
})
export class SplitModalComponent implements OnInit {
  @ViewChild('splitModal', {static: true}) splitModal: ModalDirective;
  @Output() dissmissedChange: EventEmitter<boolean> = new EventEmitter<boolean>();
  private reason = '';
  private subscrManager = new SubscriptionManager();

  constructor(private modalService: BsModalService, private sanitizer: DomSanitizer) {
  }

  private _splitModalDismissedProperly = false;

  get splitModalDismissedProperly(): boolean {
    return this._splitModalDismissedProperly;
  }

  @Input() set splitModalDismissedProperly(value: boolean) {
    this._splitModalDismissedProperly = value;
    this.dissmissedChange.emit(this._splitModalDismissedProperly);
  }

  ngOnInit() {
  }

  public open(onDismiss?: (reason: string) => void) {
    this.subscrManager.add(this.splitModal.onHide.subscribe((e) => {
      onDismiss(this.reason);
      return this.splitModalDismissedProperly;
    }));

    this.subscrManager.add(this.splitModal.onHidden.subscribe((e) => {
      this.onHidden();
    }));

    this.splitModal.config.backdrop = 'static';
    this.splitModal.show();
  }

  onHidden() {
    this.subscrManager.destroy();
  }

  dismiss(reason: string) {
    this.reason = reason;
    this.splitModal.hide();
  }
}
