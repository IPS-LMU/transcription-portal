import {animate, state, style, transition, trigger} from '@angular/animations';

export const ANIMATIONS = [
  trigger('fadeToggleRow', [
    state('closed', style({
      display: 'none',
      opacity: '0.0'
    })),
    state('opened', style({
      opacity: '1.0'
    })),
    transition('* => opened', [
      style({
        display: 'table-row'
      }),
      animate('200ms ease-in')]),
    transition('opened => *', [
      animate('200ms ease-out')])
  ]),

  trigger('fadeToggle', [
    state('closed', style({
      display: 'none',
      opacity: '0.0'
    })),
    state('opened', style({
      opacity: '1.0'
    })),
    transition('* => opened', [
      animate('200ms ease-in')]),
    transition('opened => *', [
      animate('200ms ease-in')])
  ]),

  trigger('blop', [
    state('blopped', style({
      height: '40px',
      width: '40px',
      transform: 'translate(-5px, -10px)'
    })),
    state('*', style({
      transform: 'translateX(0)'
    })),
    transition('* => blopped', animate('300ms ease-in')),
    transition('blopped => *', animate('300ms ease-in'))
  ]),

  trigger('expandLeft', [
    state('opened', style({
      width: '100%'
    })),
    state('closed', style({
      width: '{{ width }}%'
    }), {params: {width: 30}}),
    state('*', style({
      width: '100%'
    })),
    transition('* => closed', animate('600ms ease-in')),
    transition('opened => closed', animate('600ms ease-in')),
    transition('closed => opened', animate('600ms ease-in'))
  ]),

  trigger('comeIn', [
    state('closed', style({
      'margin-left': '{{ procWidth }}%',
      width: '{{ toolWidth }}%'
    }), {params: {toolWidth: 70, procWidth: 30}}),
    state('opened', style({
      'margin-left': '100%',
      width: '{{ toolWidth }}%'
    }), {params: {toolWidth: 70}}),
    state('*', style({
      'margin-left': '100%',
      width: '{{ toolWidth }}%'
    }), {params: {toolWidth: 70}}),
    transition('* => closed', animate('600ms ease-in')),
    transition('opened => closed', animate('600ms ease-in')),
    transition('closed => opened', animate('600ms ease-in'))
  ])
];
