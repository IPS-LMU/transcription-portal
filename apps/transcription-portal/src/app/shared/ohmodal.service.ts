import { Injectable, OnDestroy } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { BugreportModalComponent } from '@octra/ngx-components';
import { SubscriptionManager } from '@octra/utilities';
import { BrowserInfo } from '@octra/web-media';
import { AppInfo } from '../app.info';
import { openModal } from '../obj/functions';
import { BugReportService } from './bug-report.service';

@Injectable({
  providedIn: 'root',
})
export class OHModalService implements OnDestroy {
  private subscrManager = new SubscriptionManager();

  constructor(
    private ngbModalService: NgbModal,
    private bugreportService: BugReportService
  ) {}

  public openFeedbackModal() {
    const pkgText = JSON.stringify(
      {
        type: 'bug',
        technicalInformation: {
          os: {
            name: BrowserInfo.os.family,
            version: BrowserInfo.os.version,
          },
          browser: {
            name: BrowserInfo.browser,
            version: BrowserInfo.version,
          },
        },
        protocol: {
          tool: {
            version: AppInfo.version,
            language: 'en',
            signed_in: true,
            url: window.location.href,
          },
          entries: this.bugreportService.console,
        },
      },
      null,
      2
    );

    const ref = openModal<BugreportModalComponent>(
      this.ngbModalService,
      BugreportModalComponent,
      BugreportModalComponent.options,
      {
        pkgText,
        showSenderFields: true,
        _profile: {
          name: '',
          email: '',
        },
      } as any
    );

    ref.componentInstance.i18n = {
      ...ref.componentInstance.i18n,
      introduction:
        'Please tell us what you think about the TranscriptionPortal. What can we do better? Did you find any bugs?',
      sending: 'Please wait while sending your feedback...',
    };

    console.log(ref.componentInstance.i18n);

    this.subscrManager.add(
      ref.componentInstance.send.subscribe({
        next: ({ name, email, message, sendProtocol, screenshots }: any) => {
          ref.componentInstance.sendStatus = 'sending';
          ref.componentInstance.waitForSendResponse(
            this.bugreportService.sendBugReport(
              name,
              email,
              message,
              sendProtocol,
              screenshots
            ) as any
          );
        },
      })
    );

    return ref.result
      .then(() => {
        this.subscrManager.removeByTag('update-bugreport-profile');
      })
      .catch(() => {
        this.subscrManager.removeByTag('update-bugreport-profile');
      });
  }

  ngOnDestroy() {
    this.subscrManager.destroy();
  }
}
