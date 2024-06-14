import {Component, Input, OnInit} from '@angular/core';
import {AudioInfo} from '@octra/web-media';

@Component({
  selector: 'tportal-file-info-table',
  templateUrl: './file-info-table.component.html',
  styleUrls: ['./file-info-table.component.css']
})
export class FileInfoTableComponent implements OnInit {

  @Input() fileinfo?: AudioInfo;

  constructor() {
  }

  isWavFile() {
    return this.fileinfo?.type?.includes('wav') ?? false;
  }

  ngOnInit() {
  }

}
