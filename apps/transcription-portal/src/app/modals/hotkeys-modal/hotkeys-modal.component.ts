import { Component, Output, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgbActiveModal, NgbModalOptions } from '@ng-bootstrap/ng-bootstrap';
import { SubscriberComponent } from '@octra/ngx-utilities';
import { BrowserInfo } from '@octra/web-media';
import { Subject } from 'rxjs';
import { ShortcutService } from '../../shared/shortcut.service';
import { HotkeyComponent } from './hotkey/hotkey.component';

@Component({
  selector: 'tportal-hotkeys-modal',
  templateUrl: './hotkeys-modal.component.html',
  styleUrls: ['./hotkeys-modal.component.scss'],
  standalone: true,
  imports: [TranslocoPipe, HotkeyComponent],
})
export class HotkeysModalComponent extends SubscriberComponent {
  protected activeModal = inject(NgbActiveModal);
  protected shortcutService = inject(ShortcutService);
  protected platform: 'mac' | 'pc' = 'pc';

  @Output() understandClick: Subject<void> = new Subject<void>();

  public static options: NgbModalOptions = {
    size: 'lg',
    backdrop: 'static',
    keyboard: false,
  };

  constructor() {
    super();
    this.platform = BrowserInfo.platform;
  }
}
