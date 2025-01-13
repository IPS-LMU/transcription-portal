import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
  selector: 'tportal-operation-arrow',
  templateUrl: './operation-arrow.component.html',
  styleUrls: ['./operation-arrow.component.scss'],
  imports: [NgClass],
})
export class OperationArrowComponent implements OnInit {
  @ViewChild('outer', { static: true }) outer?: any;
  @Input() type: 'arrow' | 'circle' = 'arrow';
  @Input() first = false;

  constructor() {}

  ngOnInit() {}
}
