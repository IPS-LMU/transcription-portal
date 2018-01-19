import {Component, Input, OnInit} from '@angular/core';
import {FileInfo} from '../../shared/tasks';
import {AudioInfo} from '../../shared/audio';

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
