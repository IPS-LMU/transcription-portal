import {Observable} from 'rxjs';
import {HttpClient} from '@angular/common/http';

export interface FileSize {
  size: number;
  label: string;
}

export function scrollTo(y: number, target?: string) {
  setTimeout(() => {
    if ((target === null || target === undefined)) {
      jQuery('html, body').scrollTop(y);
    } else {
      jQuery(target).scrollTop(y);
    }
  }, 200);
}

export function isNumber(str: string): boolean {
  const res = parseInt(str, 10);
  return isNaN(res);
}

export function equalProperties(elem: any, elem2: any) {
  let result = false;

  for (const el in elem) {
    if (elem.hasOwnProperty(el)) {
      const propStr = '' + el + '';
      result = true;
      if (!(propStr in elem2)) {
        return false;
      }
    }
  }

  return result;
}

export function contains(haystack: string, needle: string): boolean {
  return haystack.indexOf(needle) !== -1;
}

export function placeAtEnd(element: HTMLElement) {
  try {
    element.focus();
    const bodyInput: any = document.body as any;
    if (jQuery(element).text() !== '') {
      if (typeof window.getSelection !== 'undefined'
        && typeof document.createRange !== 'undefined'
      ) {
        // get range
        const txtRange = document.createRange();
        txtRange.selectNodeContents(element);
        // set range to end
        txtRange.collapse(false);

        // get selection of the element
        const selection = window.getSelection();
        selection.removeAllRanges();
        // set previous created range to the element
        selection.addRange(txtRange);
      } else if (bodyInput.createTextRange !== 'undefined') {
        // fix for IE and older Opera Browsers

        // create range from body
        const txtRange = bodyInput.createTextRange();
        txtRange.moveToElementText(element);
        // set selection to end
        txtRange.collapse(false);
        txtRange.select();
      }
    }
  } catch (ex) {
    console.error(ex);
    // ignore
  }
}

export function escapeRegex(regexStr: string) {
  // escape special chars in regex
  return regexStr.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

export function getFileSize(bytes: number): FileSize {
  const result: FileSize = {
    size: 0,
    label: ''
  };

  if ((bytes / 1000) < 1) {
    // take bytes
    result.size = bytes;
    result.label = 'B';
  } else if (bytes / (1000 * 1000) < 1) {
    // take kilobytes
    result.size = bytes / 1000;
    result.label = 'KB';
  } else if (bytes / (1000 * 1000 * 1000) < 1) {
    // take megabyte
    result.size = bytes / 1000 / 1000;
    result.label = 'MB';
  } else if (bytes / (1000 * 1000 * 1000 * 1000) < 1) {
    // take gigabytes

    result.size = bytes / 1000 / 1000 / 1000;
    result.label = 'GB';
  }

  result.size = Math.round(result.size * 1000) / 1000;

  return result;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function unEscapeHtml(text: string): string {
  return text
    .replace('&amp;', '&')
    .replace('&lt;', '<')
    .replace('&gt;', '>')
    .replace('&quot;', '"')
    .replace('&#039;', '\'');
}

export function insertString(input: string, pos: number, insertion: string): string {
  let result = input;

  if (pos <= input.length) {
    result = result.substring(0, pos) + insertion + result.substring(pos);
  } else {
    throw new Error('String cannot be inserted at position ' + pos);
  }

  return result;
}

export function uniqueHTTPRequest(http: HttpClient, post: boolean = false, requestoptions: any,
                                  url: string, body: any): Observable<any> {
  if (!post) {
    const options = (!(requestoptions === null || requestoptions === undefined)) ? requestoptions : {};

    if (!options.hasOwnProperty('params')) {
      options.params = {};
    }

    const d = Date.now();
    options.params.v = d.toString();
    return http.get(url, options);
  } else {
    return http.post(url, body, requestoptions);
  }
}

export function setCursor(node, pos) {

  node = (typeof node === 'string' || node instanceof String) ? document.getElementById('' + node + '') : node;

  if (!node) {
    return false;
  } else if (node.createTextRange) {
    const textRange = node.createTextRange();
    textRange.collapse(true);
    textRange.moveEnd(pos);
    textRange.moveStart(pos);
    textRange.select();
    return true;
  } else if (node.setSelectionRange) {
    node.setSelectionRange(pos, pos);
    return true;
  }

  return false;
}

export function base64ToArrayBuffer(base64): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return (bytes.buffer as ArrayBuffer);
}

export function isNullOrUndefined(elem: any) {
  return (elem === null || elem === undefined);
}

export function isset(elem: any) {
  return !isNullOrUndefined(elem) && elem !== '';
}

