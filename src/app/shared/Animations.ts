import { animate, state, style, transition, trigger } from '@angular/animations';

export const ANIMATIONS = [
  trigger('fadeToggle', [
    state('closed', style({
      display: 'none',
      opacity: '0.0'
    })),
    state('opened', style({
      display: 'inherit',
      opacity: '1.0'
    })),
    state('*', style({
      display: 'none',
      opacity: '0.0'
    })),
    transition('* => opened', animate('300ms ease-in')),
    transition('opened => closed', animate('300ms ease-in'))
  ]),

  trigger('expandToggle', [
    state('closed', style({
      height: '35px'
    })),
    state('opened', style({
      height: '200px'
    })),
    state('*', style({
      height: '35px'
    })),
    transition('* => opened', animate('300ms ease-in')),
    transition('opened => closed', animate('300ms ease-in'))
  ]),

  trigger('blop', [
    state('blopped', style({
      height   : '40px',
      width    : '40px',
      transform: 'translate(-5px, -10px)'
    })),
    state('*', style({
      transform: 'translateX(0)'
    })),
    transition('* => blopped', animate('300ms ease-in')),
    transition('blopped => *', animate('300ms ease-in'))
  ])
];
