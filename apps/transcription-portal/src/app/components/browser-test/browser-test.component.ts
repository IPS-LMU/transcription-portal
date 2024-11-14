import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CompatibilityService } from '../../shared/compatibility.service';
import { BrowserInfo } from '../../obj/BrowserInfo';
import { OHModalService } from '../../shared/ohmodal.service';
import { NgClass, NgStyle } from '@angular/common';

@Component({
  selector: 'tportal-browser-test',
  templateUrl: './browser-test.component.html',
  styleUrls: ['./browser-test.component.scss'],
  standalone: true,
  imports: [NgClass, NgStyle],
})
export class BrowserTestComponent implements OnInit {
  constructor(
    private router: Router,
    public compatibility: CompatibilityService,
    public modalService: OHModalService
  ) {}

  public get browserName(): string {
    return BrowserInfo.browser;
  }

  ngOnInit() {}

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

  test() {
    window.location.href = 'chrome://settings/content/cookies';
  }

  reload() {
    window.location.reload();
  }
}
