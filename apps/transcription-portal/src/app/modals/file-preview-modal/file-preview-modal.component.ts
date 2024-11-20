import { Component, OnInit } from '@angular/core';
import { SafeResourceUrl } from '@angular/platform-browser';
import { NgbActiveModal, NgbModalOptions } from '@ng-bootstrap/ng-bootstrap';
import { SubscriberComponent } from '@octra/ngx-utilities';
import { FileInfo } from '@octra/web-media';

@Component({
  selector: 'tportal-file-preview-modal',
  templateUrl: './file-preview-modal.component.html',
  styleUrls: ['./file-preview-modal.component.scss'],
  standalone: true,
  imports: [],
})
export class FilePreviewModalComponent
  extends SubscriberComponent
  implements OnInit
{
  public selectedFile?: FileInfo;
  public fileContent = '';
  public downloadURL?: SafeResourceUrl;

  public static options: NgbModalOptions = {
    size: 'xl',
    fullscreen: 'md',
    backdrop: true,
  };

  get fileName(): string {
    return (
      this.selectedFile?.attributes.originalFileName ??
      this.selectedFile?.fullname
    );
  }

  constructor(protected activeModal: NgbActiveModal) {
    super();
  }

  ngOnInit() {
    this.loadFileContent();
  }

  onDismiss() {}

  cancelEvent($event: DragEvent) {
    $event.stopPropagation();
    $event.preventDefault();
  }

  private loadFileContent() {
    if (!(this.selectedFile === null || this.selectedFile === undefined)) {
      FileInfo.getFileContent(this.selectedFile.file!)
        .then((text) => {
          this.fileContent = text;
        })
        .catch((error: any) => {
          console.error(error);
        });
    } else {
      console.error(`selectedFile is null!`);
    }
  }
}
