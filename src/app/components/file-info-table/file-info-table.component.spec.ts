import {async, ComponentFixture, TestBed} from '@angular/core/testing';

import {FileInfoTableComponent} from './file-info-table.component';

describe('FileInfoTableComponent', () => {
  let component: FileInfoTableComponent;
  let fixture: ComponentFixture<FileInfoTableComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [FileInfoTableComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(FileInfoTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
