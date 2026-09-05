import { Component, Input, OnInit, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'tportal-hotkey',
  templateUrl: './hotkey.component.html',
  styleUrls: ['./hotkey.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [],
})
export class HotkeyComponent implements OnInit {
  @Input() key!: string;

  constructor() {}

  ngOnInit() {}
}
