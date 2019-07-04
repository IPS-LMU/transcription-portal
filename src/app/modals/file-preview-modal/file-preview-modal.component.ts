import {Component, OnInit, TemplateRef, ViewChild} from '@angular/core';
import {DomSanitizer, SafeResourceUrl} from '@angular/platform-browser';
import {FileInfo} from '../../obj/fileInfo';
import {BsModalRef, BsModalService, ModalDirective} from 'ngx-bootstrap';
import {SubscriptionManager} from '../../shared/subscription-manager';

@Component({
  selector: 'app-file-preview-modal',
  templateUrl: './file-preview-modal.component.html',
  styleUrls: ['./file-preview-modal.component.css']
})
export class FilePreviewModalComponent implements OnInit {
  @ViewChild('previewModal', {static: true}) previewModal: ModalDirective;
  private modalRef: BsModalRef;

  public selectedFile: FileInfo;
  public fileContent = '';
  public downloadURL: SafeResourceUrl;
  private subscrmanager = new SubscriptionManager();

  constructor(private modalService: BsModalService, private sanitizer: DomSanitizer) {
  }

  ngOnInit() {
  }

  public open(file: FileInfo, beforeDismiss?: () => boolean, onDismiss: () => void = () => {
  }) {
    this.selectedFile = file;
    this.downloadURL = this.sanitizer.bypassSecurityTrustResourceUrl(URL.createObjectURL(file.file));
    this.loadFileContent();
    this.onDismiss = onDismiss;

    const id = this.subscrmanager.add(this.previewModal.onHidden.subscribe(() => {
      this.subscrmanager.remove(id);
      this.onDismiss();
    }));
    this.previewModal.show();
  }

  private loadFileContent() {
    if (!(this.selectedFile === null || this.selectedFile === undefined)) {
      FileInfo.getFileContent(this.selectedFile.file).then((text) => {
        this.fileContent = text;
      }).catch((error) => {
        console.error(error);
      });
    } else {
      console.error(`selectedFile is null!`);
    }
  }

  onDismiss() {
  }

  cancelEvent($event) {
    $event.stopPropagation();
    $event.preventDefault();
  }
}
