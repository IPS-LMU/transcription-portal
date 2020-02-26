import {ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, SecurityContext, ViewChild} from '@angular/core';
import {BsModalRef, BsModalService, ModalOptions} from 'ngx-bootstrap';
import {Subject} from 'rxjs';
import {SubscriptionManager} from '../../shared/subscription-manager';
import {BugReportService} from '../../shared/bug-report.service';
import {SettingsService} from '../../shared/settings.service';
import {StorageService} from '../../storage.service';
import {AppSettings} from '../../shared/app.settings';
import {DomSanitizer, SafeHtml} from '@angular/platform-browser';

@Component({
  selector: 'app-feedback-modal',
  templateUrl: './feedback-modal.component.html',
  styleUrls: ['./feedback-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FeedbackModalComponent implements OnInit {
  modalRef: BsModalRef;
  public visible = false;
  public bgdescr = '';
  public sendProObj = true;
  public bugsent = false;
  config: ModalOptions = {
    keyboard: false,
    backdrop: false,
    ignoreBackdropClick: false
  };
  @ViewChild('modal', {static: true}) modal: any;

  protected data = null;
  private actionperformed: Subject<void> = new Subject<void>();
  private subscrmanager = new SubscriptionManager();

  public sendStatus: 'pending' | 'success' | 'error' | 'sending' = 'pending';

  public screenshots: {
    blob: File,
    previewURL: string
  }[] = [];

  public get email(): string {
    return this.appStorage.userEmail;
  }

  public set email(value: string) {
    this.appStorage.userEmail = value;
  }

  public get userName(): string {
    return this.appStorage.userName;
  }

  public set userName(value: string) {
    this.appStorage.userName = value;
  }

  public protocolText: SafeHtml = '';

  public get isvalid(): boolean {
    return this.sendProObj || this.bgdescr !== '';
  }

  constructor(private modalService: BsModalService, private appStorage: StorageService,
              public bugService: BugReportService, private settService: SettingsService,
              private cd: ChangeDetectorRef, private sanitizer: DomSanitizer) {
  }

  public updateProtocolAsText() {
    const str = JSON.stringify(this.bugService.getPackage(), null, 2);
    this.protocolText = this.sanitizer.sanitize(SecurityContext.HTML, str);
  }

  ngOnInit() {
  }

  public open(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.modal.show(this.modal, this.config);
      this.sendStatus = 'pending';
      this.visible = true;
      this.screenshots = [];
      this.update();

      const subscr = this.modal.onHide.subscribe(() => {
        subscr.unsubscribe();
        resolve();
      });
    });
  }

  public close() {
    this.modal.hide();
  }

  public hide() {
    this.actionperformed.next();
  }

  onShown() {
    // TODO check data and set focus
    jQuery('#bgDescr').focus();
  }

  onHidden() {
    this.visible = false;
    this.bugsent = false;
    this.sendStatus = 'pending';
    this.update();
  }

  sendBugReport() {
    this.appStorage.userEmail = this.email;

    this.sendStatus = 'sending';
    this.subscrmanager.add(
      this.bugService.sendReport(this.userName, this.email, this.bgdescr, this.sendProObj, {
        auth_token: AppSettings.configuration.plugins.emailSender.authKey,
        url: AppSettings.configuration.plugins.emailSender.url
      }, this.screenshots).subscribe(
        () => {
          this.sendStatus = 'success';
          this.bugsent = true;
          this.update();
          console.log('Bugreport sent');

          setTimeout(() => {
            this.bgdescr = '';
            this.modal.hide();
          }, 2000);
        },
        (error) => {
          console.error(error);
          this.sendStatus = 'error';
          this.update();
        }
      )
    );
  }

  public selectFileForUpload(input: HTMLInputElement) {
    input.click();
  }

  public onFileChange($event) {
    if ($event.target.files.length > 0) {
      if ($event.target.files[0].name.indexOf('.jpg') > -1 || $event.target.files[0].name.indexOf('.jpeg') > -1
        || $event.target.files[0].name.indexOf('.png') > -1 || $event.target.files[0].name.indexOf('.PNG') > -1
        || $event.target.files[0].name.indexOf('.JPG') > -1 || $event.target.files[0].name.indexOf('.JPEG') > -1
      ) {
        this.screenshots.push({
          blob: $event.target.files[0],
          previewURL: ''
        });
        this.update();
        this.createPreviewFromFile(this.screenshots.length - 1).then(() => {
          this.update();
        }).catch((error) => {
          console.error(error);
        });
      } else {
        alert('Only files with the extensions ".jpg, jpeg,.png" are supported.');
      }
    }
  }

  public createPreviewFromFile(index: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();

      reader.onloadend = () => {
        this.screenshots[index].previewURL = reader.result as string;
        resolve();
      };

      reader.onerror = reject;

      reader.readAsDataURL(this.screenshots[index].blob);
    });
  }

  public removeScreenshot(index: number) {
    this.screenshots.splice(index, 1);
    this.update();
  }

  update() {
    this.updateProtocolAsText();
    this.cd.markForCheck();
    this.cd.detectChanges();
  }
}
