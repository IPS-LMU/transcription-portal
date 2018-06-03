import {async, ComponentFixture, TestBed} from '@angular/core/testing';

import {OperationArrowComponent} from './operation-arrow.component';

describe('OperationArrowComponent', () => {
  let component: OperationArrowComponent;
  let fixture: ComponentFixture<OperationArrowComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [OperationArrowComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(OperationArrowComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
