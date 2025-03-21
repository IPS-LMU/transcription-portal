import {
  NgbModal,
  NgbModalOptions,
  NgbModalRef,
} from '@ng-bootstrap/ng-bootstrap';

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

export function openModal<T>(
  service: NgbModal,
  content: any,
  options?: NgbModalOptions,
  data?: Partial<T>,
): NgbModalWrapper<T> {
  const ref = service.open(content, options);

  if (data) {
    for (const key of Object.keys(data)) {
      ref.componentInstance[key] = (data as any)[key];
    }
  }

  return ref as NgbModalWrapper<T>;
}
