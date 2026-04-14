import { Component, ElementRef, EventEmitter, HostListener, inject, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { wait } from '@octra/utilities';
import { StoreTaskOperation } from '../../store';

@Component({
  selector: 'tportal-tool-loader',
  templateUrl: './tool-loader.component.html',
  styleUrls: ['./tool-loader.component.scss'],
  standalone: true,
})
export class ToolLoaderComponent implements OnChanges {
  private sanitizer = inject(DomSanitizer);

  @ViewChild('iframe', { static: true }) iframe?: ElementRef;

  public selectedtool: {
    url?: SafeUrl;
    name: string;
  } = {
    name: '',
  };

  @Input() operation?: {
    operation: StoreTaskOperation<any, StoreTaskOperation<any, any>> | undefined;
    url?: string;
  } | null;

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

  ngOnChanges(changes: SimpleChanges) {
    const operation = changes['operation'];
    if (operation) {
      if (operation.currentValue?.operation) {
        if (operation.currentValue?.url !== operation.previousValue?.url) {
          this.selectedtool = {
            name: operation.currentValue.operation?.name ?? '',
            url: operation.currentValue.url ? this.sanitizer.bypassSecurityTrustResourceUrl(operation.currentValue.url) : undefined,
          };
        }
      } else {
        wait(1).then(() => {
          this.selectedtool = {
            name: '',
            url: undefined,
          };
        });
      }
    }
  }

  @HostListener('window:message', ['$event'])
  onMessage(e: Event) {
    this.datareceived.emit({ event: e, name: this.selectedtool.name });
  }
}
