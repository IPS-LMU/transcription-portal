import { NgStyle, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Renderer2,
  SimpleChanges,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SubscriberComponent } from '@octra/ngx-utilities';
import { interval } from 'rxjs';
import ScrollEvent = JQuery.ScrollEvent;

@Component({
  selector: 'tportal-popover',
  templateUrl: './popover.component.html',
  styleUrls: ['./popover.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgStyle, ReactiveFormsModule, FormsModule, NgTemplateOutlet],
})
export class PopoverComponent extends SubscriberComponent implements OnChanges, OnDestroy, OnInit {
  private cd = inject(ChangeDetectorRef);
  private el = inject(ElementRef);
  private renderer = inject(Renderer2);

  @Input() pointer: 'left' | 'right' | 'bottom-left' | 'bottom-right' = 'left';
  @Input() public width = 200;
  @Input() public height = 300;
  @Input() type: 'info' | 'warning' | 'success' | 'danger' | 'neutral' = 'neutral';

  @Input() title?: TemplateRef<any> | null;
  @Input() content?: TemplateRef<any> | null;
  @Input() position: {
    x: number;
    y: number;
  } = { x: 0, y: 0 };

  @ViewChild('inner') inner?: ElementRef;

  public margin: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  } = {
    left: 5,
    top: 5,
    right: 10,
    bottom: 20,
  };

  private leftTopPolygon = {
    koord1: {
      x: 0,
      y: 0,
    },
    koord2: {
      x: 20,
      y: this.margin.top,
    },
    koord3: {
      x: this.margin.left,
      y: 20,
    },
  };

  public polygon = this.leftTopPolygon;
  private leftBottomPolygon?: any;
  private rightTopPolygon?: any;
  private rightBottomPolygon?: any;

  public getPolygonString(): string {
    const p = this.polygon;
    return `${p.koord1.x},${p.koord1.y} ${p.koord2.x},${p.koord2.y} ${p.koord3.x},${p.koord3.y} `;
  }

  ngOnChanges(changes: SimpleChanges) {
    const pointer = changes['pointer']?.currentValue;
    if (pointer) {
      this.updatePolygons();

      if (changes['pointer'].currentValue === 'left') {
        this.polygon = this.leftTopPolygon;
      } else if (changes['pointer'].currentValue === 'bottom-left') {
        this.polygon = this.leftBottomPolygon;
      } else if (changes['pointer'].currentValue === 'right') {
        this.polygon = this.rightTopPolygon;
      } else if (changes['pointer'].currentValue === 'bottom-right') {
        this.polygon = this.rightBottomPolygon;
      }
    }

    const position = changes['position']?.currentValue;
    if (position) {
      this.renderer.setStyle(this.el.nativeElement, 'margin-left', `${position.x}px`);
      this.renderer.setStyle(this.el.nativeElement, 'margin-top', `${position.y}px`);
    }
    this.cd.markForCheck();
  }

  updatePolygons() {
    this.leftTopPolygon = {
      koord1: {
        x: 0,
        y: 0,
      },
      koord2: {
        x: 20,
        y: this.margin.top,
      },
      koord3: {
        x: this.margin.left,
        y: 20,
      },
    };

    this.rightTopPolygon = {
      koord1: {
        x: this.width,
        y: 0,
      },
      koord2: {
        x: this.width - 20,
        y: this.margin.top,
      },
      koord3: {
        x: this.width - this.margin.right,
        y: 20,
      },
    };

    this.leftBottomPolygon = {
      koord1: {
        x: 0,
        y: this.height - 5,
      },
      koord2: {
        x: this.margin.left + 20,
        y: this.height - this.margin.bottom - 1,
      },
      koord3: {
        x: this.margin.left,
        y: this.height - this.margin.bottom - 10,
      },
    };

    this.rightBottomPolygon = {
      koord1: {
        x: this.width,
        y: this.height - 10,
      },
      koord2: {
        x: this.width - this.margin.right - 20,
        y: this.height - this.margin.bottom - 1,
      },
      koord3: {
        x: this.width - this.margin.right,
        y: this.height - this.margin.bottom - 10,
      },
    };
  }

  ngOnInit() {
    this.subscribe(interval(1000), {
      next: () => this.cd.markForCheck(),
    });
  }

  get primaryColor() {
    switch (this.type) {
      case 'info':
        return '#3a70dd';
      case 'warning':
        return '#ffc107';
      case 'success':
        return '#4caf50';
      case 'danger':
        return '#f44336';
      case 'neutral':
        return '#aeadad';
    }
  }
}
