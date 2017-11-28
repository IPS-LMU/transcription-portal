import { animate, state, style, transition, trigger } from '@angular/animations';

export const ANIMATIONS = [
  trigger('fadeToggle', [
    state('closed', style({
      display: 'none',
      opacity: '0.0'
    })),
    state('opened', style({
      opacity: '1.0'
    })),
    state('*', style({
      display: 'none',
      opacity: '0.0'
    })),
    transition('* => opened', animate('300ms ease-in')),
    transition('opened => closed', animate('300ms ease-in'))
  ])
];
