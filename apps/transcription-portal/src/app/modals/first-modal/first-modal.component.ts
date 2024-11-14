import { Component, OnDestroy, Output } from '@angular/core';
import {
  NgbActiveModal,
  NgbModalOptions,
  NgbModalRef,
} from '@ng-bootstrap/ng-bootstrap';
import { Subject } from 'rxjs';
import { SubscriptionManager } from '../../shared/subscription-manager';

@Component({
  selector: 'tportal-first-modal',
  templateUrl: './first-modal.component.html',
  styleUrls: ['./first-modal.component.scss'],
  standalone: true,
})
export class FirstModalComponent implements OnDestroy {
  @Output() understandClick: Subject<void> = new Subject<void>();

  public static options: NgbModalOptions = {
    size: 'sn',
    backdrop: 'static',
    keyboard: false,
  };

  bsModalRef?: NgbModalRef;
  private subscrmanager = new SubscriptionManager();

  constructor(protected activeModal: NgbActiveModal) {}

  ngOnDestroy() {
    this.subscrmanager.destroy();
  }
}
