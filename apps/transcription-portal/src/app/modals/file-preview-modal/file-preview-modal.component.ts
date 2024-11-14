import { Component, OnDestroy, OnInit } from '@angular/core';
import { SafeResourceUrl } from '@angular/platform-browser';
import {
  NgbActiveModal,
  NgbModal,
  NgbModalOptions,
} from '@ng-bootstrap/ng-bootstrap';
import { FileInfo } from '@octra/web-media';
import { SubscriptionManager } from '../../shared/subscription-manager';

@Component({
  selector: 'tportal-file-preview-modal',
  templateUrl: './file-preview-modal.component.html',
  styleUrls: ['./file-preview-modal.component.scss'],
  standalone: true,
  imports: [],
})
export class FilePreviewModalComponent implements OnDestroy, OnInit {
  public selectedFile?: FileInfo;
  public fileContent = '';
  public downloadURL?: SafeResourceUrl;

  private subscrmanager = new SubscriptionManager();

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

  constructor(
    private modalService: NgbModal,
    protected activeModal: NgbActiveModal
  ) {}

  ngOnDestroy(): void {
    this.subscrmanager.destroy();
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
