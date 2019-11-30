import {Component, Input, OnInit} from '@angular/core';
import {FileInfo} from '../../obj/fileInfo';
import {AudioInfo} from '../../obj/audio';

@Component({
  selector: 'app-file-info-table',
  templateUrl: './file-info-table.component.html',
  styleUrls: ['./file-info-table.component.css']
})
export class FileInfoTableComponent implements OnInit {

  @Input() fileinfo: FileInfo;

  constructor() {
  }

  get audioInfo(): AudioInfo {
    if (this.fileinfo instanceof AudioInfo) {
      return this.fileinfo;
    }
    return null;
  }

  ngOnInit() {
  }

}
