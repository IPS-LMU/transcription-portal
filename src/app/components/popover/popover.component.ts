import {Component, ElementRef, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewChild} from '@angular/core';
import {SubscriptionManager} from '../../shared/subscription-manager';

@Component({
  selector: 'app-popover',
  templateUrl: './popover.component.html',
  styleUrls: ['./popover.component.css']
})
export class PopoverComponent implements OnInit, OnChanges, OnDestroy {

  @ViewChild('svg', {static: true}) svg: ElementRef;
  @ViewChild('inner', {static: true}) inner: ElementRef;

  @Input() borderColor = '#3a70dd';
  @Input() pointer: 'left' | 'right' | 'bottom-left' = 'left';

  @Input() public width = 200;
  @Input() public height = 300;

  public margin: {
    left: number,
    top: number,
    right: number,
    bottom: number
  } = {
    left: 5,
    top: 5,
    right: 10,
    bottom: 20
  };


  private leftTopPolygon;
  public polygon = this.leftTopPolygon;
  private leftBottomPolygon;
  private rightTopPolygon;
  private rightBottomPolygon;
  private arrowWidth = 20;
  private lineWidth = 2;
  private subscrmanager: SubscriptionManager = new SubscriptionManager();

  constructor() {
  }

  public getPolygonString(): string {
    const p = this.polygon;
    return `${p.koord1.x},${p.koord1.y} ${p.koord2.x},${p.koord2.y} ${p.koord3.x},${p.koord3.y} `;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.hasOwnProperty('pointer')) {
      this.updatePolygins();

      if (changes.pointer.currentValue === 'left') {
        this.polygon = this.leftTopPolygon;
      } else if (changes.pointer.currentValue === 'bottom-left') {
        this.polygon = this.leftBottomPolygon;
      } else if (changes.pointer.currentValue === 'right') {
        this.polygon = this.rightTopPolygon;
      } else if (changes.pointer.currentValue === 'bottom-right') {
        this.polygon = this.rightBottomPolygon;
      }
    }
  }

  ngOnInit() {
  }

  updatePolygins() {

    this.leftTopPolygon = {
      koord1: {
        x: 0,
        y: 0
      },
      koord2: {
        x: 20,
        y: this.margin.top
      },
      koord3: {
        x: this.margin.left,
        y: 20
      }
    };

    this.rightTopPolygon = {
      koord1: {
        x: this.width,
        y: 0
      },
      koord2: {
        x: this.width - 20,
        y: this.margin.top
      },
      koord3: {
        x: this.width - this.margin.right,
        y: 20
      }
    };

    this.leftBottomPolygon = {
      koord1: {
        x: 0,
        y: this.height - 5
      },
      koord2: {
        x: this.margin.left + 20,
        y: this.height - this.margin.bottom - 1
      },
      koord3: {
        x: this.margin.left,
        y: this.height - this.margin.bottom - 10
      }
    };

    this.rightBottomPolygon = {
      koord1: {
        x: this.width,
        y: this.height - 10
      },
      koord2: {
        x: this.width - this.margin.right - 20,
        y: this.height - this.margin.bottom - 1
      },
      koord3: {
        x: this.width - this.margin.right,
        y: this.height - this.margin.bottom - 10
      }
    };
  }

  ngOnDestroy() {
    this.subscrmanager.destroy();
  }
}
