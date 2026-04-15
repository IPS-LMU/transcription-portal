import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, EventEmitter, HostListener, inject, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { wait } from '@octra/utilities';
import { OctraWindowMessageEventData, ParsedOpenedTool, ToolOperationFactory } from '../../store';

@Component({
  selector: 'tportal-tool-loader',
  templateUrl: './tool-loader.component.html',
  styleUrls: ['./tool-loader.component.scss'],
  standalone: true,
})
export class ToolLoaderComponent implements OnChanges {
  private sanitizer = inject(DomSanitizer);
  private httpClient = inject(HttpClient);

  @ViewChild('iframe', { static: false }) iframe?: ElementRef;

  public selectedTool: {
    url?: SafeUrl;
    name: string;
  } = {
    name: '',
  };

  error?: string;

  @Input() openedTool?: ParsedOpenedTool | null;

  @Output() public dataReceived: EventEmitter<OctraWindowMessageEventData> = new EventEmitter<OctraWindowMessageEventData>();

  public set name(name: string) {
    if (name) {
      this.selectedTool.name = name;
    }
  }

  async ngOnChanges(changes: SimpleChanges) {
    const operation = changes['openedTool'];
    if (operation) {
      const openedTool = operation.currentValue as ParsedOpenedTool | undefined | null;
      const previousOpenedTool = operation.previousValue as ParsedOpenedTool | undefined | null;
      const changedToolOrOP =
        openedTool?.audioFile.url !== previousOpenedTool?.audioFile.url ||
        openedTool?.transcript?.url !== previousOpenedTool?.transcript?.url ||
        openedTool?.operation?.id !== previousOpenedTool?.operation?.id;

      try {
        if (openedTool?.operation) {
          if (changedToolOrOP) {
            const factory = openedTool.factory as ToolOperationFactory;
            this.selectedTool.name = operation.currentValue.operation?.name ?? '';
            const url = await factory.getToolURL(openedTool.audioFile, openedTool.transcript, this.httpClient);

            this.error = undefined;
            this.selectedTool.url = url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : undefined;
          }
        } else {
          this.error = undefined;
          wait(1).then(() => {
            this.selectedTool = {
              name: '',
              url: undefined,
            };
          });
        }
      } catch (e: any) {
        console.error(e);
        this.error = `Can't load tool "${openedTool?.operation?.name}:" ${e.message}`;
        this.selectedTool.url = undefined;
      }
    }
  }

  @HostListener('window:message', ['$event'])
  async onMessage(e: MessageEvent) {
    console.log(e);
    if (this.iframe && this.openedTool) {
      const parsed = await this.openedTool.factory.parseMessageEvent(
        e,
        this.iframe.nativeElement,
        this.openedTool.audioFile,
        this.openedTool.transcript,
      );
      if (parsed) {
        this.dataReceived.emit(parsed);
      }
    }
  }

  async onIframeLoaded($event: Event) {}
}
