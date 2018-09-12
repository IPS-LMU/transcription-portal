import {
  AfterViewInit,
  Directive,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  Renderer2,
  SimpleChanges
} from '@angular/core';
import {Task, TaskDirectory, TaskState} from '../../../obj/tasks';
import {SubscriptionManager} from '../../../shared/subscription-manager';
import {Observable} from 'rxjs';

@Directive({
  selector: '[appDirProgress]'
})
export class DirProgressDirective implements OnChanges, AfterViewInit, OnDestroy {

  @Input('dir') dir: TaskDirectory;
  @Input('opIndex') opIndex: number;

  private subscrmanager: SubscriptionManager = new SubscriptionManager();

  constructor(private elementRef: ElementRef, private renderer: Renderer2) {
    this.subscrmanager.add(Observable.interval(1000).subscribe(() => {
      this.updateView();
    }));
  }

  ngOnChanges(changes: SimpleChanges) {
    this.updateView();
  }

  ngAfterViewInit() {
    this.updateView();
  }

  updateView() {
    const all_entries = this.dir.entries.length;

    const counters = {
      processing: 0,
      finished: 0,
      failed: 0
    };

    for (let i = 0; i < this.dir.entries.length; i++) {
      const entry = this.dir.entries[i];

      if (entry instanceof Task) {

        const operation = entry.operations[this.opIndex];

        if (operation.state === TaskState.PROCESSING) {
          counters.processing++;
        } else if (operation.state === TaskState.FINISHED) {
          counters.finished++;
        } else if (operation.state === TaskState.ERROR) {
          counters.failed++;
        }
      }
    }

    const sum = counters.finished;
    this.elementRef.nativeElement.innerHTML = sum + '/' + all_entries;

    this.renderer.setStyle(this.elementRef.nativeElement, 'width', `${sum / all_entries * 100}%`);
    this.renderer.setAttribute(this.elementRef.nativeElement, 'aria-valuenow', `${sum / all_entries * 100}`);

    if (counters.failed > 0) {
      this.renderer.setStyle(this.elementRef.nativeElement, 'background-color', `red`);
    } else {
      this.renderer.setStyle(this.elementRef.nativeElement, 'background-color', `#7AB55C`);
    }
  }

  ngOnDestroy() {
    this.subscrmanager.destroy();
  }
}
