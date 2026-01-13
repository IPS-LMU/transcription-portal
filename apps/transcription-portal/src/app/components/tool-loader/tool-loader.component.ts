import { Component, ElementRef, EventEmitter, HostListener, inject, Input, Output, ViewChild } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { wait } from '@octra/utilities';
import { StoreTaskOperation } from '../../store';

@Component({
  selector: 'tportal-tool-loader',
  templateUrl: './tool-loader.component.html',
  styleUrls: ['./tool-loader.component.scss'],
  standalone: true,
})
export class ToolLoaderComponent {
  private sanitizer = inject(DomSanitizer);

  @ViewChild('iframe', { static: true }) iframe?: ElementRef;

  public selectedtool: {
    url?: SafeUrl;
    name: string;
  } = {
    name: '',
  };

  @Input() set operation(
    operation:
      | {
          operation: StoreTaskOperation<any, StoreTaskOperation<any, any>> | undefined;
          url?: string;
        }
      | undefined
      | null,
  ) {
    if (operation) {
      this.selectedtool = {
        name: operation.operation?.name ?? '',
        url: operation.url ? this.sanitizer.bypassSecurityTrustResourceUrl(operation.url) : undefined,
      };
    } else {
      wait(1).then(() => {
        this.selectedtool = {
          name: '',
          url: undefined,
        };
      });
    }
  }

  @Output() public datareceived: EventEmitter<any> = new EventEmitter<any>();

  public set url(url: string | undefined) {
    if (!(url === null || url === undefined) && url !== '') {
      this.selectedtool.url = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    } else {
      this.selectedtool.url = undefined;
    }
  }

  public set name(name: string) {
    if (name) {
      this.selectedtool.name = name;
    }
  }

  @HostListener('window:message', ['$event'])
  onMessage(e: Event) {
    this.datareceived.emit({ event: e, name: this.selectedtool.name });
  }
}
