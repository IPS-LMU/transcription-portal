import { AfterViewInit, Directive, ElementRef, inject, Input, OnChanges, OnDestroy, Renderer2, SimpleChanges } from '@angular/core';
import { SubscriptionManager } from '@octra/utilities';
import { interval, Subscription } from 'rxjs';
import { Task, TaskStatus } from '../../../obj/tasks';
import { StoreTaskDirectory } from '../../../store';

@Directive({
  selector: '[tportalDirProgress]',
  standalone: true,
})
export class DirProgressDirective implements OnChanges, AfterViewInit, OnDestroy {
  private elementRef = inject(ElementRef);
  private renderer = inject(Renderer2);

  @Input() dir?: StoreTaskDirectory;
  @Input() opIndex?: number;

  private subscrmanager = new SubscriptionManager<Subscription>();

  constructor() {
    this.subscrmanager.add(
      interval(1000).subscribe(() => {
        this.updateView();
      }),
    );
  }

  ngOnChanges(changes: SimpleChanges) {
    this.updateView();
  }

  ngAfterViewInit() {
    this.updateView();
  }

  updateView() {
    if (!this.dir) {
      throw new Error('dir is undefined');
    }
    if (this.opIndex == undefined) {
      return;
    }
    const entries = this.dir?.entries.ids.map(id => this.dir!.entries.entities[id]) ?? [];
    const allEntries = this.dir.entries.ids.length;

    const counters = {
      processing: 0,
      finished: 0,
      failed: 0,
    };

    for (const entry of entries) {
      if (entry instanceof Task) {
        const operation = entry.operations[this.opIndex];

        if (operation.state === TaskStatus.PROCESSING) {
          counters.processing++;
        } else if (operation.state === TaskStatus.FINISHED) {
          counters.finished++;
        } else if (operation.state === TaskStatus.ERROR) {
          counters.failed++;
        }
      }
    }

    const sum = counters.finished;
    this.elementRef.nativeElement.innerHTML = sum + '/' + allEntries;

    this.renderer.setStyle(this.elementRef.nativeElement, 'width', `${(sum / allEntries) * 100}%`);
    this.renderer.setAttribute(this.elementRef.nativeElement, 'aria-valuenow', `${(sum / allEntries) * 100}`);

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
