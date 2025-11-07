import { Component, OnInit, inject } from '@angular/core';
import { SafeResourceUrl } from '@angular/platform-browser';
import { NgbActiveModal, NgbModalOptions } from '@ng-bootstrap/ng-bootstrap';
import { SubscriberComponent } from '@octra/ngx-utilities';
import { FileInfo } from '@octra/web-media';
import hljs from 'highlight.js';
import { CodeJarContainer, NgxCodeJarComponent } from 'ngx-codejar';
import { TPortalFileInfo } from '../../obj/TPortalFileInfoAttributes';
import { TranslocoPipe } from '@jsverse/transloco';
import { UpperCasePipe } from '@angular/common';

@Component({
  selector: 'tportal-file-preview-modal',
  templateUrl: './file-preview-modal.component.html',
  styleUrls: ['./file-preview-modal.component.scss'],
  imports: [NgxCodeJarComponent, TranslocoPipe, UpperCasePipe],
})
export class FilePreviewModalComponent extends SubscriberComponent implements OnInit {
  protected activeModal = inject(NgbActiveModal);

  public selectedFile?: TPortalFileInfo;
  public fileContent = '';
  public downloadURL?: SafeResourceUrl;

  public static options: NgbModalOptions = {
    size: 'xl',
    fullscreen: 'md',
    scrollable: true,
    backdrop: true,
  };

  get fileName(): string {
    return this.selectedFile?.attributes?.originalFileName ?? this.selectedFile?.fullname ?? 'NO NAME';
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
      TPortalFileInfo.getFileContent(this.selectedFile.file!)
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

  private getCodejarSyntaxType(): 'json' | 'xml' | 'text' {
    if (this.selectedFile?.file?.type.includes('json')) {
      return 'json';
    }
    if (this.selectedFile?.file?.type.includes('xml')) {
      return 'xml';
    }
    return 'text';
  }

  highlightMethod = (editor: CodeJarContainer) => {
    if (editor.textContent !== null && editor.textContent !== undefined) {
      editor.innerHTML = hljs.highlight(editor.textContent, {
        language: this.getCodejarSyntaxType(),
      }).value;
    }
  };
}
