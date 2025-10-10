import { NgClass, NgStyle } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { BrowserInfo } from '../../obj/BrowserInfo';
import { RoutingService } from '../../routing.service';
import { AppSettings } from '../../shared/app.settings';
import { CompatibilityService } from '../../shared/compatibility.service';
import { OHModalService } from '../../shared/ohmodal.service';

@Component({
  selector: 'tportal-browser-test',
  templateUrl: './browser-test.component.html',
  styleUrls: ['./browser-test.component.scss'],
  imports: [NgClass, NgStyle],
})
export class BrowserTestComponent implements OnInit {
  private routingService = inject(RoutingService);
  compatibility = inject(CompatibilityService);
  modalService = inject(OHModalService);

  public get browserName(): string {
    return BrowserInfo.browser;
  }

  async ngOnInit() {
    await new Promise<void>((resolve2, reject2) => {
      if (AppSettings.configuration) {
        resolve2();
      } else {
        this.routingService.navigate('config not loaded', ['/loading']);
        reject2();
      }
    });
    const isValid = await this.compatibility.testCompability();
    if (isValid) {
      this.routingService.navigate('back to root after check ok', ['/']);
    }
  }

  getStateIcon(rule: any): 'spinner' | 'times' | 'check' {
    switch (rule.state) {
      case 'processing':
        return 'spinner';
      case 'failed':
        return 'times';
      case 'ok':
        return 'check';
    }
    return 'spinner';
  }

  getStateColor(rule: any): string {
    switch (rule.state) {
      case 'processing':
        return 'cornflowerblue';
      case 'failed':
        return 'red';
      case 'ok':
        return 'forestgreen';
    }
    return 'cornflowerblue';
  }

  reload() {
    window.location.reload();
  }
}
