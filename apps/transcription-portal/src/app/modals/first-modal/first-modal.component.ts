import { Component, Output } from '@angular/core';
import { NgbActiveModal, NgbModalOptions } from '@ng-bootstrap/ng-bootstrap';
import { Subject } from 'rxjs';
import { SubscriberComponent } from '@octra/ngx-utilities';

@Component({
  selector: 'tportal-first-modal',
  templateUrl: './first-modal.component.html',
  styleUrls: ['./first-modal.component.scss'],
  standalone: true,
})
export class FirstModalComponent extends SubscriberComponent {
  @Output() understandClick: Subject<void> = new Subject<void>();

  public static options: NgbModalOptions = {
    size: 'md',
    backdrop: 'static',
    keyboard: false,
  };

  constructor(protected activeModal: NgbActiveModal) {
    super();
  }
}
