import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnChanges,
  OnDestroy,
  OnInit,
  SecurityContext,
  ViewChild
} from '@angular/core';
import {ModalDismissReasons, NgbModal, NgbModalRef} from '@ng-bootstrap/ng-bootstrap';
import {DomSanitizer, SafeHtml} from '@angular/platform-browser';
import {SubscriptionManager} from '../../shared/subscription-manager';
import {BugReportService} from '../../shared/bug-report.service';
import {AppSettings} from '../../shared/app.settings';

@Component({
  selector: 'app-feedback',
  templateUrl: './feedback-modal.component.html',
  styleUrls: ['./feedback-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FeedbackModalComponent implements OnInit, OnDestroy, OnChanges {

  @ViewChild('content', {static: true}) content: NgbModal;

  public showThankYou = false;
  private _subscrmanager: SubscriptionManager = new SubscriptionManager();
  private modalRef: NgbModalRef;

  public formData = {
    email: '',
    messsage: '',
    protocol: {
      append: true,
      protocol: ''
    }
  };

  public protocolText: SafeHtml = '';

  ngOnDestroy() {
    this._subscrmanager.destroy();
  }

  public get allFilled(): boolean {
    return ((this.formData.email !== '' && this.formData.messsage.length > 10)
      || this.formData.messsage.length > 10 || this.formData.protocol.append === true);
  }

  public updateProtocolAsText() {
    const str = JSON.stringify(this.bugService.getPackage(), null, 2);
    this.protocolText = this.sanitizer.sanitize(SecurityContext.HTML, str);
  }

  constructor(private modalService: NgbModal, private sanitizer: DomSanitizer, private bugService: BugReportService,
              private cd: ChangeDetectorRef) {
  }

  ngOnInit() {
    this.updateProtocolAsText();
  }

  ngOnChanges() {
    this.updateProtocolAsText();
    this.cd.markForCheck();
    this.cd.detectChanges();
  }

  public open() {
    this.modalRef = this.modalService.open(this.content, {
      size: 'lg'
    });
    this.updateProtocolAsText();
    this.cd.markForCheck();
    this.cd.detectChanges();
  }

  onClose() {
    this.updateProtocolAsText();
    this.cd.markForCheck();
    this.cd.detectChanges();
  }

  onDismiss() {
    this.updateProtocolAsText();
    this.cd.markForCheck();
    this.cd.detectChanges();
  }

  onSubmit() {
    this._subscrmanager.add(
      this.bugService.sendReport(this.formData.email, this.formData.messsage, this.formData.protocol.append, {
        auth_token: AppSettings.configuration.plugins.emailSender.authKey,
        url: AppSettings.configuration.plugins.emailSender.url
      }).subscribe(
        (result) => {
          this.showThankYou = true;
          setTimeout(() => {
            this.showThankYou = false;
            this.formData.messsage = '';
            this.modalRef.dismiss();
          }, 3000);
        }, (err) => {
          console.error('could not send feedback!');
        }
      )
    );
  }

  private getDismissReason(reason: any): string {
    if (reason === ModalDismissReasons.ESC) {
      return 'by pressing ESC';
    } else if (reason === ModalDismissReasons.BACKDROP_CLICK) {
      return 'by clicking on a backdrop';
    } else {
      return `with: ${reason}`;
    }
  }
}
