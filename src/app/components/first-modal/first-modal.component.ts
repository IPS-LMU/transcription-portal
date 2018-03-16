import {Component, OnInit, ViewChild} from '@angular/core';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {DomSanitizer} from '@angular/platform-browser';

@Component({
  selector: 'app-first-modal',
  templateUrl: './first-modal.component.html',
  styleUrls: ['./first-modal.component.css']
})
export class FirstModalComponent implements OnInit {


  @ViewChild('content') content: NgbModal;

  constructor(private modalService: NgbModal, private sanitizer: DomSanitizer) {
  }

  ngOnInit() {
  }

  public open(beforeDismiss: () => boolean, onDismiss?: () => void) {
    this.modalService.open(this.content, {
      beforeDismiss: beforeDismiss
    }).result.then((result) => {
      this.onClose();
    }, (reason) => {
      this.onDismiss();
      onDismiss();
    });
  }

  onClose() {

  }

  onDismiss() {

  }
}
