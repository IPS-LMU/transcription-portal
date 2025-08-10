import { Component, Output, inject } from '@angular/core';
import { NgbActiveModal, NgbModalOptions } from '@ng-bootstrap/ng-bootstrap';
import { SubscriberComponent } from '@octra/ngx-utilities';
import { Subject } from 'rxjs';

@Component({
  selector: 'tportal-first-modal',
  templateUrl: './first-modal.component.html',
  styleUrls: ['./first-modal.component.scss'],
  standalone: true,
})
export class FirstModalComponent extends SubscriberComponent {
  protected activeModal = inject(NgbActiveModal);

  @Output() understandClick: Subject<void> = new Subject<void>();

  public static options: NgbModalOptions = {
    size: 'md',
    backdrop: 'static',
    keyboard: false,
  };
}
