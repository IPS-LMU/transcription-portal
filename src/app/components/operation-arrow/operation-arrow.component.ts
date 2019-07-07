import {Component, Input, OnInit, ViewChild} from '@angular/core';

@Component({
  selector: 'app-operation-arrow',
  templateUrl: './operation-arrow.component.html',
  styleUrls: ['./operation-arrow.component.css']
})
export class OperationArrowComponent implements OnInit {
  @ViewChild('outer', {static: true}) outer;
  @Input() type: 'arrow' | 'circle' = 'arrow';
  @Input() first = false;

  constructor() {
  }

  ngOnInit() {
  }
}
