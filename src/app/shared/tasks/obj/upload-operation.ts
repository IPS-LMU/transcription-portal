import { HttpClient } from '@angular/common/http';
import { SecurityContext } from '@angular/core';
import { SafeHtml } from '@angular/platform-browser';
import { isArray } from 'util';
import * as X2JS from 'x2js';
import { TimePipe } from '../../time.pipe';
import { FileInfo } from './fileInfo';
import { Operation } from './operation';
import { TaskState } from './task';

export class UploadOperation extends Operation {

  private progress = 0;

  constructor(name: string, icon?: string, state?: TaskState) {
    super(name, icon, state);
  }

  public updateEstimatedEnd = () => {
    if (this.progress > 0) {
      const time_till_now = Date.now() - this.time.start;
      const time_one_percent = (time_till_now / this.progress);
      const time = Math.round((1 - this.progress) * time_one_percent);
      this.estimated_end = Date.now() + time;
    } else {
      this.estimated_end = 0;
    }
  };

  public start = (files: FileInfo[], operations: Operation[], httpclient: HttpClient) => {
    this.changeState(TaskState.UPLOADING);
    this._time.start = Date.now();
    this._time.end = 0;

    const form: FormData = new FormData();
    const url = 'https://clarin.phonetik.uni-muenchen.de/BASWebServices/services/uploadFileMulti';

    for (let i = 0; i < files.length; i++) {
      form.append('file' + i, files[ i ].file);
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);

    xhr.upload.addEventListener('progress', (e: ProgressEvent) => {
      if (e.lengthComputable) {
        this.progress = e.loaded / e.total;
        this.updateEstimatedEnd();
      }
    }, false);

    xhr.onloadstart = (e) => {
      console.log('start');
    };

    xhr.onerror = (e) => {
      console.error(e);
      // add messages to protocol
      this._protocol = e.message;

      this.changeState(TaskState.ERROR);
    };

    xhr.onloadend = (e) => {
      console.log('loadend');
      this.time.end = Date.now();
      const result = e.currentTarget[ 'responseText' ];
      const x2js = new X2JS();
      let json: any = x2js.xml2js(result);
      json = json.UploadFileMultiResponse;
      console.log(json);

      if (json.success === 'true') {
        // TODO set urls to results only
        if (isArray(json.fileList.entry)) {
          for (let i = 0; i < files.length; i++) {
            files[ i ].url = json.fileList.entry[ i ].value;
            this.results.push(FileInfo.fromURL(files[ i ].url));
          }
        } else {
          // json attribute entry is an object
          files[ 0 ].url = json.fileList.entry[ 'value' ];
          this.results.push(FileInfo.fromURL(json.fileList.entry[ 'value' ]));
        }
        this.changeState(TaskState.FINISHED);
      } else {
        this.changeState(TaskState.ERROR);
        console.error(json[ 'message' ]);
      }
      // add messages to protocol
      if (json.warnings !== '') {
        this._protocol = json.warnings;
      }
    };
    xhr.send(form);
  };
  public getStateIcon = (sanitizer): SafeHtml => {
    let result = '';
    switch (this._state) {
      case(TaskState.PENDING):
        result = '';
        break;
      case(TaskState.UPLOADING):
        if (this.progress > 0) {
          this.updateEstimatedEnd();
          const time = this.estimated_end - Date.now();
          result = '<span style="color:dodgerblue;" class="glyphicon glyphicon-arrow-up"></span> ' +
            '<span>' + new TimePipe().transform(time) + '</span>';
        } else {
          result = '<i class="fa fa-spinner fa-spin fa-fw"></i>\n' +
            '<span class="sr-only">Loading...</span>';
        }
        break;
      case(TaskState.PROCESSING):
        result = '<i class="fa fa-cog fa-spin fa-fw"></i>\n' +
          '<span class="sr-only">Loading...</span>';
        break;
      case(TaskState.FINISHED):
        result = '<span class="glyphicon glyphicon-ok"></span>';
        break;
      case(TaskState.READY):
        result = '<a href="#"><span class="glyphicon glyphicon-edit"></span></a>';
        break;
      case(TaskState.ERROR):
        result = '<span class="glyphicon glyphicon-remove"></span>';
        break;
    }

    return sanitizer.sanitize(SecurityContext.HTML, result);
  };

  public clone(): UploadOperation {
    return new UploadOperation(this.name, this.icon, this.state);
  }
}
