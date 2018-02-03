import {Component, Input, OnInit} from '@angular/core';
import {AudioInfo} from '../../obj/audio';
import {FileInfo} from '../../obj/fileInfo';

@Component({
  selector: 'app-file-info-table',
  templateUrl: './file-info-table.component.html',
  styleUrls: ['./file-info-table.component.css']
})
export class FileInfoTableComponent implements OnInit {

  @Input() fileinfo: FileInfo;

  constructor() {
    let test: AudioInfo;
  }

  ngOnInit() {
  }

}
