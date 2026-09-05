import { NgClass } from '@angular/common';
import { Component, Input, OnInit, ViewChild, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'tportal-operation-arrow',
  templateUrl: './operation-arrow.component.html',
  styleUrls: ['./operation-arrow.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [NgClass],
})
export class OperationArrowComponent implements OnInit {
  @ViewChild('outer', { static: true }) outer?: any;
  @Input() type: 'arrow' | 'circle' = 'arrow';
  @Input() first = false;

  constructor() {}

  ngOnInit() {}
}
