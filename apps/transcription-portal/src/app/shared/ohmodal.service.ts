import { inject, Injectable, OnDestroy } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { BugreportModalComponent, BugReportService } from '@octra/ngx-components';
import { removeEmptyProperties, SubscriptionManager } from '@octra/utilities';
import { AppInfo } from '../app.info';
import { openModal } from '../obj/functions';
import { AppStoreService } from '../store';

@Injectable({
  providedIn: 'root',
})
export class OHModalService implements OnDestroy {
  private ngbModalService = inject(NgbModal);
  private bugreportService = inject(BugReportService);
  private appStoreService = inject(AppStoreService);

  private subscrManager = new SubscriptionManager();
  private userProfile: {
    name: string;
    email: string;
  } = {
    name: '',
    email: '',
  };

  constructor() {
    this.subscrManager.add(
      this.appStoreService.userProfile$.subscribe({
        next: (userProfile) => {
          this.userProfile = userProfile;
        },
      }),
    );
  }

  public async openFeedbackModal() {
    const tool = {
      version: AppInfo.BUILD.version,
      url: window.location.href,
      customAttributes: {
        'Last Updated': AppInfo.BUILD.timestamp,
        Language: 'en',
        "rtzsafdzta": "asudiahd"
      },
    };
    let pkg = this.bugreportService.getPackage(tool);

    pkg = removeEmptyProperties(JSON.parse(JSON.stringify(pkg)));

    const ref = openModal<BugreportModalComponent>(this.ngbModalService, BugreportModalComponent, BugreportModalComponent.options, {
      pkg,
      showSenderFields: true,
      _profile: this.userProfile,
    } as any);

    ref.componentInstance.i18n = {
      ...ref.componentInstance.i18n,
      introduction: 'Please tell us what you think about the TranscriptionPortal. What can we do better? Did you find any bugs?',
      sending: 'Please wait while sending your feedback...',
    };

    this.subscrManager.add(
      ref.componentInstance.send.subscribe({
        next: ({ name, email, message, sendProtocol, screenshots }: any) => {
          this.appStoreService.changeUserProfile(name, email);
          ref.componentInstance.sendStatus = 'sending';
          ref.componentInstance.waitForSendResponse(
            this.bugreportService.sendReport(name, email, message, sendProtocol, screenshots, tool),
          );
        },
      }),
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
