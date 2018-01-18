import {Component, ElementRef, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewChild} from '@angular/core';
import {isNullOrUndefined} from 'util';
import {SubscriptionManager} from '../../shared/subscription-manager';
import {Observable} from 'rxjs/Observable';
import 'rxjs/add/observable/interval';

@Component({
  selector: 'app-popover',
  templateUrl: './popover.component.html',
  styleUrls: ['./popover.component.css']
})
export class PopoverComponent implements OnInit, OnChanges, OnDestroy {

  @ViewChild('canvas') canvas: ElementRef;
  @ViewChild('inner') inner: ElementRef;

  private canvasNative: HTMLCanvasElement;
  private canvasContext: CanvasRenderingContext2D;

  @Input() borderColor: string = '#3a70dd';
  @Input() pointer: 'left' | 'right' = 'left';

  public width = 200;
  public height = 300;
  public margin: {
    left: number,
    top: number,
    right: number,
    bottom: number
  } = {
    left: 10,
    top: 10,
    right: 20,
    bottom: 20
  };
  private lineWidth = 2;
  private subscrmanager: SubscriptionManager = new SubscriptionManager();

  constructor() {
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.hasOwnProperty('borderColor') && !isNullOrUndefined(this.canvasNative) && !changes.borderColor.isFirstChange() && !isNullOrUndefined(changes.borderColor.currentValue)) {
      setTimeout(() => {
        this.drawPopover();
      }, 10);
    }

    if (changes.hasOwnProperty('width') && !changes.width.isFirstChange()) {
      this.drawPopover();
    }
  }

  ngOnInit() {
    this.drawPopover();
    this.subscrmanager.add(Observable.interval(500).subscribe(
      () => {
        this.drawPopover();
      }
    ));
  }

  ngOnDestroy() {
    this.subscrmanager.destroy();
  }

  public drawPopover() {
    if (!isNullOrUndefined(this.canvas)) {
      this.canvasNative = this.canvas.nativeElement;
      this.canvasContext = this.canvasNative.getContext('2d');
      this.width = this.canvas.nativeElement.parentElement.clientWidth;
      this.height = Math.max(200, this.inner.nativeElement.clientHeight);
      this.canvasNative.setAttribute('width', this.width + 'px');
      this.canvasNative.setAttribute('height', this.height + 'px');
      this.canvasContext.fillStyle = 'white';
      this.canvasContext.shadowColor = 'gray';
      this.canvasContext.shadowBlur = 20;
      this.canvasContext.shadowOffsetX = 0;
      this.canvasContext.fillRect(this.margin.left, this.margin.top, this.width - this.margin.right, this.height - this.margin.bottom);
      this.canvasContext.strokeStyle = this.borderColor;
      this.canvasContext.lineWidth = this.lineWidth;
      this.canvasContext.shadowBlur = 0;
      this.canvasContext.strokeRect(this.margin.left + this.lineWidth / 2, this.margin.top + this.lineWidth / 2, this.width - this.margin.right - this.lineWidth, this.height - this.margin.bottom - this.lineWidth);

      // draw triangle

      let x = this.lineWidth / 2;
      let y = 5;

      if (this.pointer === 'right') {
        x = this.width - x;
      }
      this.canvasContext.beginPath();
      this.canvasContext.fillStyle = 'white';
      this.canvasContext.moveTo(x, y);
      if (this.pointer === 'left') {
        this.canvasContext.lineTo(10 + x + 2, y + this.margin.top);
        this.canvasContext.lineTo(10 + x + 2, 35 + this.lineWidth / 2);
        this.canvasContext.lineTo(x, y + this.lineWidth / 2);
      } else if (this.pointer === 'right') {
        this.canvasContext.lineTo(x - 10 - 2, y + this.margin.top);
        this.canvasContext.lineTo(x - 10 - 2, 35 + this.lineWidth / 2);
        this.canvasContext.lineTo(x, y + this.lineWidth / 2);
      }
      this.canvasContext.fill();
      this.canvasContext.closePath();

      this.canvasContext.beginPath();
      if (this.pointer === 'left') {
        this.canvasContext.moveTo(x, y + this.lineWidth / 2);
        this.canvasContext.lineTo(x + 10 + 2, this.margin.top + this.lineWidth / 2);
        this.canvasContext.moveTo(x + 10, this.margin.top + 30 + this.lineWidth / 2);
        this.canvasContext.lineTo(x, y + this.lineWidth / 2);
        this.canvasContext.stroke();
      } else if (this.pointer === 'right') {
        this.canvasContext.moveTo(x, y + this.lineWidth / 2);
        this.canvasContext.lineTo(x - 10 - 2, this.margin.top + this.lineWidth / 2);
        this.canvasContext.moveTo(x - 10, this.margin.top + 30 + this.lineWidth / 2);
        this.canvasContext.lineTo(x, y + this.lineWidth / 2);
        this.canvasContext.stroke();
      }
      this.canvasContext.closePath();
    }
  }
}
