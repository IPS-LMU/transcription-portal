import { HttpClient } from '@angular/common/http';
import { NgbModal, NgbModalOptions, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { AppInfo, SUPPORTED_LANGUAGES } from '../app.info';

export async function readFileAsArray(file: File) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      resolve(reader.result as ArrayBuffer);
    });
    reader.addEventListener('error', (error) => {
      reject(error);
    });
    reader.readAsArrayBuffer(file);
  });
}

export class NgbModalWrapper<T> extends NgbModalRef {
  override get componentInstance(): T {
    return super.componentInstance;
  }
}

export function openModal<T>(service: NgbModal, content: any, options?: NgbModalOptions, data?: Partial<T>): NgbModalWrapper<T> {
  const ref = service.open(content, options);

  if (data) {
    for (const key of Object.keys(data)) {
      ref.componentInstance[key] = (data as any)[key];
    }
  }

  return ref as NgbModalWrapper<T>;
}

export function convertISO639Language(lang: string) {
  if (lang.indexOf('-') > -1) {
    const key = lang.replace(/([a-z]+)-([A-Z]+).*/g, '$1').toLowerCase();
    return (SUPPORTED_LANGUAGES as any)[key];
  }
  return lang;
}

export function isSupportedLanguage(language: string) {
  const regex = new RegExp(
    Object.keys(SUPPORTED_LANGUAGES)
      .map((a) => `(^${a}-)`)
      .join('|'),
    'g',
  );
  return regex.exec(language) !== null;
}

export function validTranscript(extension: string): boolean {
  let result = false;

  for (const converter of AppInfo.converters) {
    for (const extension1 of converter.obj.extensions) {
      result = result || extension1.includes(extension);
    }
  }

  return result;
}

export function existsFile(url: string | undefined, httpClient: HttpClient): Promise<boolean> {
  return new Promise<boolean>((resolve, reject) => {
    if (url) {
      httpClient.head(url).subscribe({
        next: () => {
          resolve(true);
        },
        error: () => {
          resolve(false);
        },
      });
    } else {
      resolve(false);
    }
  });
}
