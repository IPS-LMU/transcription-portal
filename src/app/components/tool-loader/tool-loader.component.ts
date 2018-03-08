import {Component, ElementRef, EventEmitter, HostListener, Input, OnInit, Output, ViewChild} from '@angular/core';
import {DomSanitizer, SafeUrl} from '@angular/platform-browser';
import {Operation} from '../../obj/tasks/operation';

@Component({
  selector: 'app-tool-loader',
  templateUrl: './tool-loader.component.html',
  styleUrls: ['./tool-loader.component.css']
})
export class ToolLoaderComponent implements OnInit {
  @ViewChild('iframe') iframe: ElementRef;

  public selectedtool: {
    url: SafeUrl
  } = {
    url: ''
  };

  @Input()
  public set url(url: string) {
    this.selectedtool.url = this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  @Input() public operation: Operation = null;

  @Output() public datareceived: EventEmitter<any> = new EventEmitter<any>();

  constructor(private sanitizer: DomSanitizer) {
  }

  ngOnInit() {
    this.onIframeLoaded();
  }

  onIframeLoaded() {
  }

  @HostListener('window:message', ['$event'])
  onMessage(e) {
    this.datareceived.emit(e);
  }
}
