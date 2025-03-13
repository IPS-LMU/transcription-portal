import { NgClass } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { AudioInfo } from '@octra/web-media';
import { FilesizePipe } from '../../shared/filesize.pipe';
import { TimePipe } from '../../shared/time.pipe';

@Component({
  selector: 'tportal-file-info-table',
  templateUrl: './file-info-table.component.html',
  styleUrls: ['./file-info-table.component.scss'],
  imports: [NgClass, TimePipe, FilesizePipe],
})
export class FileInfoTableComponent implements OnInit {
  @Input() fileinfo?: AudioInfo;

  constructor() {}

  isWavFile() {
    return this.fileinfo?.type?.includes('wav') ?? false;
  }

  ngOnInit() {}
}
