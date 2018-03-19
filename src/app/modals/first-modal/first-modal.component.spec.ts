import {async, ComponentFixture, TestBed} from '@angular/core/testing';

import {FirstModalComponent} from './first-modal.component';

describe('FirstModalComponent', () => {
  let component: FirstModalComponent;
  let fixture: ComponentFixture<FirstModalComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [FirstModalComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(FirstModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
