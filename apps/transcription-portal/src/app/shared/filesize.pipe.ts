import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'filesize',
  standalone: true,
})
export class FilesizePipe implements PipeTransform {
  transform(value: any, args?: any): any {
    if (args === null || args === undefined) {
      // value are miliseconds
      if (!isNaN(Number(value))) {
        const bytes = Number(value);

        let kilobytes = bytes / 1000;
        let megabytes = kilobytes / 1000;
        let gigabytes = megabytes / 1000;

        if (gigabytes > 1) {
          gigabytes = Math.round(gigabytes * 10) / 10;
          return `${gigabytes} GB`;
        }

        if (megabytes > 1) {
          megabytes = Math.round(megabytes * 10) / 10;
          return `${megabytes} MB`;
        }

        if (kilobytes > 1) {
          kilobytes = Math.round(kilobytes * 10) / 10;
          return `${kilobytes} KB`;
        }

        return `${bytes} B`;
      }
    }
    return null;
  }
}
