import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'tportal-hotkey',
  templateUrl: './hotkey.component.html',
  styleUrls: ['./hotkey.component.scss'],
  imports: [],
})
export class HotkeyComponent implements OnInit {
  @Input() key!: string;

  constructor() {}

  ngOnInit() {}
}
