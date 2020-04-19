import {Component, OnInit, Output, TemplateRef, ViewChild} from '@angular/core';
import {Subject} from 'rxjs';
import {SubscriptionManager} from '../../shared/subscription-manager';
import {BsModalRef, BsModalService} from 'ngx-bootstrap/modal';

@Component({
  selector: 'app-first-modal',
  templateUrl: './first-modal.component.html',
  styleUrls: ['./first-modal.component.css']
})
export class FirstModalComponent implements OnInit {


  @ViewChild('content', {static: true}) content: TemplateRef<any>;
  @Output() understandClick: Subject<void> = new Subject<void>();

  bsModalRef: BsModalRef;
  private subscrmanager = new SubscriptionManager();

  constructor(private modalService: BsModalService) {
  }

  ngOnInit() {
  }

  public open(beforeDismiss: () => boolean, onDismiss?: () => void) {
    this.subscrmanager.add(this.modalService.onHide.subscribe(() => {
      beforeDismiss();
    }));

    this.subscrmanager.add(this.modalService.onHidden.subscribe(() => {
      onDismiss();
      this.onHidden();
    }));

    this.bsModalRef = this.modalService.show(this.content);
  }

  onHidden() {
    this.subscrmanager.destroy();
  }
}
