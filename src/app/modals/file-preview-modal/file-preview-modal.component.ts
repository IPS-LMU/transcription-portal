import {Component, OnInit, ViewChild} from '@angular/core';
import {NgbModal, NgbModalRef} from '@ng-bootstrap/ng-bootstrap';
import {DomSanitizer, SafeResourceUrl} from '@angular/platform-browser';
import {FileInfo} from '../../obj/fileInfo';
import {isNullOrUndefined} from 'util';

@Component({
  selector: 'app-file-preview-modal',
  templateUrl: './file-preview-modal.component.html',
  styleUrls: ['./file-preview-modal.component.css']
})
export class FilePreviewModalComponent implements OnInit {
  @ViewChild('content') content: NgbModal;
  private modalRef: NgbModalRef;

  public selectedFile: FileInfo;
  public fileContent = '';
  private downloadURL: SafeResourceUrl;

  constructor(private modalService: NgbModal, private sanitizer: DomSanitizer) {
  }

  ngOnInit() {
  }

  public open(file: FileInfo, beforeDismiss?: () => boolean, onDismiss: () => void = () => {
  }) {
    this.selectedFile = file;
    this.downloadURL = this.sanitizer.bypassSecurityTrustResourceUrl(URL.createObjectURL(file.file));
    this.loadFileContent();
    this.onDismiss = onDismiss;
    this.modalRef = this.modalService.open(this.content, {
      beforeDismiss: beforeDismiss,
      size: 'lg'
    });
  }

  private loadFileContent() {
    if (!isNullOrUndefined(this.selectedFile)) {
      FileInfo.getFileContent(this.selectedFile.file).then((text) => {
        this.fileContent = text;
      }).catch((error) => {
        console.error(error);
      });
    } else {
      console.error(`selectedFile is null!`);
    }
  }

  onClose() {

  }

  onDismiss() {
  }

  cancelEvent($event) {
    $event.stopPropagation();
    $event.preventDefault();
  }
}
