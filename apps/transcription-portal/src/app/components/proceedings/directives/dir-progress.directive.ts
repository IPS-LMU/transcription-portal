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
import {SubscriptionManager} from '@octra/utilities';
import {interval, Subscription} from 'rxjs';

@Directive({
  selector: '[tportalDirProgress]'
})
export class DirProgressDirective implements OnChanges, AfterViewInit, OnDestroy {

  @Input() dir?: TaskDirectory;
  @Input() opIndex?: number;

  private subscrmanager = new SubscriptionManager<Subscription>();

  constructor(private elementRef: ElementRef, private renderer: Renderer2) {
    this.subscrmanager.add(interval(1000).subscribe(() => {
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
    if (!this.dir) {
      throw new Error("dir is undefined");
    }
    if (!this.opIndex) {
      return;
    }
    const allEntries = this.dir.entries.length;

    const counters = {
      processing: 0,
      finished: 0,
      failed: 0
    };

    for (const entry of this.dir.entries) {
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
    this.elementRef.nativeElement.innerHTML = sum + '/' + allEntries;

    this.renderer.setStyle(this.elementRef.nativeElement, 'width', `${sum / allEntries * 100}%`);
    this.renderer.setAttribute(this.elementRef.nativeElement, 'aria-valuenow', `${sum / allEntries * 100}`);

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
