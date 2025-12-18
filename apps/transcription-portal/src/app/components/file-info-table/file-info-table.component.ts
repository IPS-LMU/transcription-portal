import { NgClass } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { FilesizePipe } from '../../shared/filesize.pipe';
import { TimePipe } from '../../shared/time.pipe';
import { StoreAudioFile, StoreFile } from '../../store';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'tportal-file-info-table',
  templateUrl: './file-info-table.component.html',
  styleUrls: ['./file-info-table.component.scss'],
  imports: [NgClass, TimePipe, FilesizePipe, TranslocoPipe],
})
export class FileInfoTableComponent implements OnInit {
  @Input() fileinfo?: StoreFile;

  get audioFile(): StoreAudioFile | undefined {
    if (this.fileinfo?.type.includes('audio')) {
      return this.fileinfo as StoreAudioFile;
    }
    return undefined;
  }
  constructor() {}

  isWavFile() {
    return this.fileinfo?.type?.includes('wav') ?? false;
  }

  ngOnInit() {}
}
