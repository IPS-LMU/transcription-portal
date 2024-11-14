import { NgClass } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  SecurityContext,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import {
  NgbActiveModal,
  NgbModal,
  NgbModalOptions,
} from '@ng-bootstrap/ng-bootstrap';
import { AppSettings } from '../../shared/app.settings';
import { BugReportService } from '../../shared/bug-report.service';
import { SubscriptionManager } from '../../shared/subscription-manager';
import { StorageService } from '../../storage.service';

@Component({
  selector: 'tportal-feedback-modal',
  templateUrl: './feedback-modal.component.html',
  styleUrls: ['./feedback-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [FormsModule, NgClass],
})
export class FeedbackModalComponent implements AfterViewInit {
  public bgdescr = '';
  public sendProObj = true;
  public bugsent = false;

  public static options: NgbModalOptions = {
    keyboard: false,
    size: 'xl',
    fullscreen: 'md',
    backdrop: 'static',
  };

  protected data = null;
  private subscrmanager = new SubscriptionManager();

  public sendStatus: 'pending' | 'success' | 'error' | 'sending' = 'pending';

  public screenshots: {
    blob: File;
    previewURL: string;
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

  public protocolText: SafeHtml | null = null;

  public get isvalid(): boolean {
    return this.sendProObj || this.bgdescr !== '';
  }

  constructor(
    private modalService: NgbModal,
    private appStorage: StorageService,
    public bugService: BugReportService,
    protected activeModal: NgbActiveModal,
    private cd: ChangeDetectorRef,
    private sanitizer: DomSanitizer
  ) {}

  public updateProtocolAsText() {
    const str = JSON.stringify(this.bugService.getPackage(), null, 2);
    this.protocolText = this.sanitizer.sanitize(SecurityContext.HTML, str);
  }

  ngAfterViewInit() {
    // TODO check data and set focus
    jQuery('#bgDescr').focus();
  }

  sendBugReport() {
    this.appStorage.userEmail = this.email;

    this.sendStatus = 'sending';
    this.subscrmanager.add(
      this.bugService
        .sendReport(
          this.userName,
          this.email,
          this.bgdescr,
          this.sendProObj,
          {
            auth_token: AppSettings.configuration.plugins.emailSender.authKey,
            url: AppSettings.configuration.plugins.emailSender.url,
          },
          this.screenshots
        )
        .subscribe(
          () => {
            this.sendStatus = 'success';
            this.bugsent = true;
            this.update();
            console.log('Bugreport sent');

            setTimeout(() => {
              this.bgdescr = '';
              this.activeModal.close();
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

  public onFileChange($event: Event) {
    const eventTarget = $event.target as HTMLInputElement;
    if (eventTarget.files && eventTarget.files.length > 0) {
      if (
        eventTarget.files[0].name.indexOf('.jpg') > -1 ||
        eventTarget.files[0].name.indexOf('.jpeg') > -1 ||
        eventTarget.files[0].name.indexOf('.png') > -1 ||
        eventTarget.files[0].name.indexOf('.PNG') > -1 ||
        eventTarget.files[0].name.indexOf('.JPG') > -1 ||
        eventTarget.files[0].name.indexOf('.JPEG') > -1
      ) {
        this.screenshots.push({
          blob: eventTarget.files[0],
          previewURL: '',
        });
        this.update();
        this.createPreviewFromFile(this.screenshots.length - 1)
          .then(() => {
            this.update();
          })
          .catch((error) => {
            console.error(error);
          });
      } else {
        alert(
          'Only files with the extensions ".jpg, jpeg,.png" are supported.'
        );
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
