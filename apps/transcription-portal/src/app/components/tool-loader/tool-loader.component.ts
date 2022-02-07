import {Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, OnInit, Output, SimpleChanges, ViewChild} from '@angular/core';
import {DomSanitizer, SafeUrl} from '@angular/platform-browser';
import {Operation} from '../../obj/operations/operation';


@Component({
  selector: 'tportal-tool-loader',
  templateUrl: './tool-loader.component.html',
  styleUrls: ['./tool-loader.component.css']
})
export class ToolLoaderComponent {
  @ViewChild('iframe', {static: true}) iframe?: ElementRef;

  public selectedtool: {
    url?: SafeUrl,
    name: string
  } = {
    name: ''
  };
  @Input() public operation?: Operation;
  @Output() public datareceived: EventEmitter<any> = new EventEmitter<any>();

  constructor(private sanitizer: DomSanitizer) {
  }

  public set url(url: string) {
    if (!(url === null || url === undefined) && url !== '') {
      this.selectedtool.url = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    }
  }

  public set name(name: string) {
    if (name) {
      this.selectedtool.name = name;
    }
  }

  @HostListener('window:message', ['$event'])
  onMessage(e: Event) {
    this.datareceived.emit({event: e, name: this.selectedtool.name});
  }
}
