import {timer} from 'rxjs';

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
