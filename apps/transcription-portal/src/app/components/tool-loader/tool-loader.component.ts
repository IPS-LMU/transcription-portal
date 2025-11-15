import { Component, ElementRef, EventEmitter, HostListener, Input, Output, ViewChild, inject } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
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
  @Input() public operation?: StoreTaskOperation | null;
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
