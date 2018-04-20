import {HttpClient} from '@angular/common/http';
import {DomSanitizer, SafeHtml} from '@angular/platform-browser';
import {isArray, isNullOrUndefined} from 'util';
import {TimePipe} from '../../shared/time.pipe';
import {FileInfo} from '../fileInfo';
import {Operation} from './operation';
import {Task, TaskState} from './task';
import * as X2JS from 'x2js';
import {AppInfo} from '../../app.info';
import {Subject} from 'rxjs/Subject';

export class UploadOperation extends Operation {
  public resultType = '.wav';

  private progress = 0;

  public constructor(name: string, icon?: string, task?: Task, state?: TaskState, id?: number) {
    super(name, icon, task, state, id);
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

  public get wavFile(): FileInfo {
    return this.results.find(
      (file) => {
        return file.extension.indexOf('wav') > -1 && file.online;
      }
    );
  }

  public start = (files: FileInfo[], operations: Operation[], httpclient: HttpClient) => {
    this._results = [];
    this._protocol = '';
    this.changeState(TaskState.UPLOADING);
    this._time.start = Date.now();

    const langObj = AppInfo.getLanguageByCode(this.task.language);
    const url = `${langObj.host}uploadFileMulti`;
    const subj = UploadOperation.upload(files, url, httpclient);

    subj.subscribe((obj) => {
      if (obj.type === 'progress') {
        this.progress = <number> obj.result;
        this.updateEstimatedEnd();
      } else if (obj.type === 'loadend') {

        this.time.duration = Date.now() - this.time.start;
        const result = <string> obj.result;
        const x2js = new X2JS();
        let json: any = x2js.xml2js(result);
        json = json.UploadFileMultiResponse;

        // add messages to protocol
        if (json.warnings !== '') {
          this._protocol = json.warnings;
        }

        if (json.success === 'true') {
          // TODO set urls to results only
          if (isArray(json.fileList.entry)) {
            for (let i = 0; i < files.length; i++) {
              files[i].url = json.fileList.entry[i].value;
              const type = (files[i].extension.indexOf('wav') > 0) ? 'audio/wav' : 'text/plain';
              this.results.push(FileInfo.fromURL(files[i].url, files[i].fullname, type));
            }
          } else {
            // json attribute entry is an object
            files[0].url = json.fileList.entry['value'];
            this.results.push(FileInfo.fromURL(json.fileList.entry['value'], null, 'audio/wav'));
          }
          this.changeState(TaskState.FINISHED);
        } else {
          this._protocol = json['message'];
          this.changeState(TaskState.ERROR);
        }
      }
    }, (e) => {
      console.error(e);
      // add messages to protocol
      this._protocol = e.message;
      this.changeState(TaskState.ERROR);
    }, () => {
    });
  };

  public getStateIcon = (sanitizer: DomSanitizer): SafeHtml => {
    let result = '';
    switch (this._state) {
      case(TaskState.PENDING):
        result = '';
        break;
      case(TaskState.UPLOADING):
        if (this.progress > 0) {
          this.updateEstimatedEnd();
          const time = this.estimated_end - Date.now();
          result = '<i class="fa fa-arrow-up" aria-hidden="true" style="color: cornflowerblue"></i> ' +
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
        result = '<i class="fa fa-check" aria-hidden="true"></i>';
        break;
      case(TaskState.READY):
        result = '<a href="#"><i class="fa fa-pencil-square-o" aria-hidden="true"></i></a>';
        break;
      case(TaskState.ERROR):
        result = '<i class="fa fa-times" aria-hidden="true"></i>';
        break;
    }

    return sanitizer.bypassSecurityTrustHtml(result);
  };

  public fromAny(operationObj: any, task: Task): UploadOperation {
    const result = new UploadOperation(operationObj.name, this.icon, task, operationObj.state, operationObj.id);
    for (let k = 0; k < operationObj.results.length; k++) {
      const resultObj = operationObj.results[k];
      const resultClass = new FileInfo(resultObj.fullname, resultObj.type, resultObj.size);
      resultClass.url = resultObj.url;
      result.results.push(resultClass);
    }
    result._time = operationObj.time;
    result._protocol = operationObj.protocol;
    result.enabled = operationObj.enabled;
    return result;
  }

  public clone(task?: Task): UploadOperation {
    const selected_task = (isNullOrUndefined(task)) ? this.task : task;
    return new UploadOperation(this.name, this.icon, selected_task, this.state);
  }

  public static upload(files: FileInfo[], url: string, httpclient: HttpClient): Subject<{
    type: 'progress' | 'loadend',
    result?: any
  }> {

    const subj = new Subject<{
      type: 'progress' | 'loadend',
      result?: any
    }>();

    const form: FormData = new FormData();

    for (let i = 0; i < files.length; i++) {
      form.append('file' + i, files[i].file);
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);

    xhr.upload.addEventListener('progress', (e: ProgressEvent) => {
      let progress = -1;
      if (e.lengthComputable) {
        progress = e.loaded / e.total;
      }
      subj.next({
        type: 'progress',
        result: <any> progress
      })
    }, false);

    xhr.onerror = (e) => {
      subj.error(e);
    };

    xhr.onloadend = (e) => {
      subj.next({
        type: 'loadend',
        result: <any> e.currentTarget['responseText']
      });
      subj.complete();
    };
    xhr.send(form);

    return subj;
  }
}
