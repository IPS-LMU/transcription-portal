import {Component, EventEmitter, Input, OnInit, Output, ViewChild} from '@angular/core';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {DomSanitizer} from '@angular/platform-browser';

@Component({
  selector: 'app-split-modal',
  templateUrl: './split-modal.component.html',
  styleUrls: ['./split-modal.component.css']
})
export class SplitModalComponent implements OnInit {
  @Input() get splitModalDismissedProperly(): boolean {
    return this._splitModalDismissedProperly;
  }

  set splitModalDismissedProperly(value: boolean) {
    this._splitModalDismissedProperly = value;
    this.dissmissedChange.emit(this._splitModalDismissedProperly);
  }

  @ViewChild('content', { static: true }) content: NgbModal;
  private _splitModalDismissedProperly = false;
  @Output() dissmissedChange: EventEmitter<boolean> = new EventEmitter<boolean>();

  constructor(private modalService: NgbModal, private sanitizer: DomSanitizer) {
  }

  ngOnInit() {
  }

  public open(onDismiss?: (reason: string) => void) {
    this.modalService.open(this.content, {
      beforeDismiss: () => {
        return this.splitModalDismissedProperly;
      }
    }).result.then((result) => {
      this.onClose();
    }, (reason) => {
      this.onDismiss();
      onDismiss(reason);
    });
  }

  onClose() {

  }

  onDismiss() {

  }
}
