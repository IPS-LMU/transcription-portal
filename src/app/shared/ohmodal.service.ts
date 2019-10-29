import {EventEmitter, Injectable} from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class OHModalService {

  public onFeedBackRequested = new EventEmitter<void>();

  constructor() {

  }

  public openFeedbackModal() {
    this.onFeedBackRequested.emit();
  }
}
