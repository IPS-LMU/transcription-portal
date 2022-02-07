import {Component, Input, OnInit} from '@angular/core';
import {FileInfo} from '@octra/utilities';
import {AudioInfo} from '@octra/media';

@Component({
  selector: 'tportal-file-info-table',
  templateUrl: './file-info-table.component.html',
  styleUrls: ['./file-info-table.component.css']
})
export class FileInfoTableComponent implements OnInit {

  @Input() fileinfo?: FileInfo;

  constructor() {
  }

  get audioInfo(): AudioInfo | undefined {
    // TODO change this
    if (this.fileinfo instanceof AudioInfo) {
      return this.fileinfo;
    }
    return undefined;
  }

  ngOnInit() {
  }

}
