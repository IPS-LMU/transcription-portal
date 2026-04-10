import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { SubscriberComponent } from '@octra/ngx-utilities';
import { interval } from 'rxjs';

@Component({
  selector: 'tportal-text-carousel',
  templateUrl: './text-carousel.component.html',
  styleUrls: ['./text-carousel.component.scss'],
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextCarouselComponent extends SubscriberComponent implements OnInit, OnChanges {
  @Input() messages: string[] = ['hallo', 'das', 'ist', 'ein', 'test'];
  @Input() interval: number = 10;

  private cd = inject(ChangeDetectorRef);
  protected invertedMessages: string[] = [];

  protected index = 0;

  ngOnChanges(changes: SimpleChanges<TextCarouselComponent>) {
    const messages = changes['messages'];
    if (messages && messages.currentValue) {
      this.invertedMessages = messages.currentValue;
      this.invertedMessages.reverse();
      this.cd.markForCheck();
    }
  }

  ngOnInit() {
    this.subscribe(interval(this.interval * 1000), {
      next: () => {
        this.index = (this.index + 1) % this.messages.length;
        this.cd.markForCheck();
      },
    });
  }
}
