import {Component, ViewChild} from '@angular/core';
import {DomSanitizer, SafeResourceUrl} from '@angular/platform-browser';
import {FileInfo} from '@octra/utilities';
import {SubscriptionManager} from '../../shared/subscription-manager';
import {BsModalService, ModalDirective} from 'ngx-bootstrap/modal';


@Component({
  selector: 'tportal-file-preview-modal',
  templateUrl: './file-preview-modal.component.html',
  styleUrls: ['./file-preview-modal.component.css']
})
export class FilePreviewModalComponent {
  @ViewChild('previewModal', {static: true}) previewModal?: ModalDirective;
  public selectedFile?: FileInfo;
  public fileContent = '';
  public downloadURL?: SafeResourceUrl;
  private subscrmanager = new SubscriptionManager();

  constructor(private modalService: BsModalService, private sanitizer: DomSanitizer) {
  }

  public open(file: FileInfo, beforeDismiss?: () => boolean, onDismiss: () => void = () => {
  }) {
    if (this.previewModal) {
      this.selectedFile = file;
      this.downloadURL = this.sanitizer.bypassSecurityTrustResourceUrl(URL.createObjectURL(file.file!));
      this.loadFileContent();
      this.onDismiss = onDismiss;

      const id = this.subscrmanager.add(this.previewModal.onHidden.subscribe(() => {
        this.subscrmanager.remove(id);
        this.onDismiss();
      }));
      this.previewModal.show();
    }
  }

  onDismiss() {
  }

  cancelEvent($event: DragEvent) {
    $event.stopPropagation();
    $event.preventDefault();
  }

  private loadFileContent() {
    if (!(this.selectedFile === null || this.selectedFile === undefined)) {
      FileInfo.getFileContent(this.selectedFile.file!).then((text) => {
        this.fileContent = text;
      }).catch((error) => {
        console.error(error);
      });
    } else {
      console.error(`selectedFile is null!`);
    }
  }
}
