import {AfterViewInit, Component, Input, OnInit, ViewChild} from '@angular/core';

@Component({
  selector: 'app-operation-arrow',
  templateUrl: './operation-arrow.component.html',
  styleUrls: ['./operation-arrow.component.css']
})
export class OperationArrowComponent implements OnInit, AfterViewInit {

  public size = {
    width: 50,
    height: 20
  };

  public settings = {
    color: 'cornflowerblue'
  };

  @ViewChild('outer') outer;
  @Input('type') type: 'arrow' | 'circle' = 'arrow';
  @Input('first') first = false;

  constructor() {
  }

  ngOnInit() {
    this.size.width = this.outer.nativeElement.offsetWidth;
    setInterval(() => {
      this.size.width = this.outer.nativeElement.offsetWidth;
    }, 300);
  }

  ngAfterViewInit() {
    this.size.width = this.outer.nativeElement.offsetWidth;
  }

  public getTriangle() {
    return `${this.size.width - 10},0 ${this.size.width},5 ${this.size.width - 10},10`;
  }

  onResize($event) {
    this.size.width = this.outer.nativeElement.offsetWidth;
  }
}
