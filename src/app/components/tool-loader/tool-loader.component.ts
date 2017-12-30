import {Component, ElementRef, HostListener, Input, OnInit, ViewChild} from '@angular/core';
import {DomSanitizer, SafeUrl} from '@angular/platform-browser';

@Component({
  selector   : 'app-tool-loader',
  templateUrl: './tool-loader.component.html',
  styleUrls  : [ './tool-loader.component.css' ]
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

  constructor(private sanitizer: DomSanitizer) {
  }

  ngOnInit() {
    this.onIframeLoaded();
  }

  onIframeLoaded() {
    const win = this.iframe.nativeElement.contentWindow || this.iframe.nativeElement;
    console.log(this.iframe);
    console.log(win);
  }

  @HostListener('window:message', ['$event'])
  onMessage(e) {
    console.log('DATA RECEIVED!!!');
    console.log(e);
  }
}
