import {async, ComponentFixture, TestBed} from '@angular/core/testing';

import {ProtocolFooterComponent} from './protocol-footer.component';

describe('ProtocolFooterComponent', () => {
  let component: ProtocolFooterComponent;
  let fixture: ComponentFixture<ProtocolFooterComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ProtocolFooterComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ProtocolFooterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
