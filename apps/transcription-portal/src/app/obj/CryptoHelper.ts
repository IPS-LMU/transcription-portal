import {readFileAsArray} from './functions';

export function cryptoSupported() {
  const subtle = (crypto?.subtle ?? ((crypto as any)?.webkit as Crypto)?.subtle);
  return (subtle !== undefined && subtle !== null);
}

export async function calcSHA256FromFile(file: File) {
  const subtle = (crypto.subtle ?? ((crypto as any).webkit as Crypto).subtle);
  const buffer = await readFileAsArray(file);
  const hashBuffer = await subtle.digest('SHA-256', buffer);
  return convertDigestToHexString(hashBuffer);
}

export function convertDigestToHexString(hashBuffer: ArrayBuffer): string {
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
