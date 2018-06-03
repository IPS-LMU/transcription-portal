import {AfterViewInit, Component, OnInit, ViewChild} from '@angular/core';

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

  constructor() {
  }

  ngOnInit() {
    setInterval(() => {
      console.log(`${this.outer.nativeElement.offsetWidth}, ${this.outer.nativeElement.offsetWidth}`);
      console.log(this.outer.nativeElement.getBoundingClientRect());
      this.size.width = this.outer.nativeElement.offsetWidth;
    }, 300);
  }

  ngAfterViewInit() {
  }

  public getTriangle() {
    return `${this.size.width - 10},0 ${this.size.width},5 ${this.size.width - 10},10`;
  }

  onResize($event) {
    console.log(`RESIZE!`);
    this.size.width = this.outer.nativeElement.offsetWidth;
  }
}
