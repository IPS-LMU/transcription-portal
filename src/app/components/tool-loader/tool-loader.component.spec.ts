import {async, ComponentFixture, TestBed} from '@angular/core/testing';

import {ToolLoaderComponent} from './tool-loader.component';

describe('ToolLoaderComponent', () => {
  let component: ToolLoaderComponent;
  let fixture: ComponentFixture<ToolLoaderComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ToolLoaderComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ToolLoaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
