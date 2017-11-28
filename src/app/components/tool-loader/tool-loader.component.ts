import { Component, Input, OnInit } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

@Component({
  selector   : 'app-tool-loader',
  templateUrl: './tool-loader.component.html',
  styleUrls  : [ './tool-loader.component.css' ]
})
export class ToolLoaderComponent implements OnInit {

  public selectedtool: {
    url: SafeUrl
  } = {
    url: ''
  };

  @Input() public set url(url: string) {
    console.log(url);
    this.selectedtool.url = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    console.log(this.selectedtool.url);
  }

  constructor(private sanitizer: DomSanitizer) {
  }

  ngOnInit() {
  }

}
