import { Injectable } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { FeedbackModalComponent } from '../modals/feedback-modal/feedback-modal.component';

@Injectable({
  providedIn: 'root',
})
export class OHModalService {
  constructor(private ngbModalService: NgbModal) {}

  public openFeedbackModal() {
    const ref = this.ngbModalService.open(
      FeedbackModalComponent,
      FeedbackModalComponent.options
    );
    ref.componentInstance.sendStatus = 'pending';
    ref.componentInstance.screenshots = [];
    ref.componentInstance.update();
  }
}
