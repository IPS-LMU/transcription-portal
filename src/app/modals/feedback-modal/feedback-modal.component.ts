import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnChanges,
  OnDestroy,
  OnInit,
  SecurityContext,
  TemplateRef,
  ViewChild
} from '@angular/core';
import {DomSanitizer, SafeHtml} from '@angular/platform-browser';
import {SubscriptionManager} from '../../shared/subscription-manager';
import {BugReportService} from '../../shared/bug-report.service';
import {AppSettings} from '../../shared/app.settings';
import {BsModalRef, BsModalService, ModalDirective, PopoverDirective} from 'ngx-bootstrap';

@Component({
  selector: 'app-feedback',
  templateUrl: './feedback-modal.component.html',
  styleUrls: ['./feedback-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FeedbackModalComponent implements OnInit, OnDestroy, OnChanges {

  @ViewChild('content', {static: true}) content: TemplateRef<any>;

  public showThankYou = false;
  private _subscrmanager: SubscriptionManager = new SubscriptionManager();
  @ViewChild('feedbackModal', { static: false }) feedbackModal: ModalDirective;

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

  constructor(private modalService: BsModalService, private sanitizer: DomSanitizer, private bugService: BugReportService,
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
    const id = this._subscrmanager.add(this.modalService.onHidden.subscribe((e) => {
      this._subscrmanager.remove(id);
      this.onClose(e);
    }));

    this.feedbackModal.show();
    this.updateProtocolAsText();
    this.cd.markForCheck();
    this.cd.detectChanges();
  }

  onClose(e) {
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
            this.feedbackModal.hide();
          }, 3000);
        }, (err) => {
          console.error('could not send feedback!');
        }
      )
    );
  }
}
