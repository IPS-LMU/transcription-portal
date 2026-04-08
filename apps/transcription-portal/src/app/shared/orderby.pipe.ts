import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'orderBy',
  pure: true,
})
export class OrderByPipe implements PipeTransform {
  private static sortOrderLocale(a: any, b: any, propertyName: string = ''): number {
    const lang = document.documentElement.lang;
    if (propertyName) {
      return a[propertyName].localeCompare(b[propertyName], lang, { ignorePunctuation: true });
    } else {
      return a.localeCompare(b, lang, { ignorePunctuation: true });
    }
  }

  transform(value: any[], order = '', propertyName?: string): any[] {
    if (!value || order === '' || !order) {
      return value;
    } // no array or object
    if (propertyName) {
      // object sort
      if (order === 'asc') {
        return value.sort((a: any, b: any) => OrderByPipe.sortOrderLocale(a, b, propertyName));
      } else {
        return value.sort((a: any, b: any) => OrderByPipe.sortOrderLocale(b, a, propertyName));
      }
    } else {
      // array sort
      if (order === 'asc') {
        return value.sort((a: any, b: any) => OrderByPipe.sortOrderLocale(a, b));
      } else {
        return value.sort((a: any, b: any) => OrderByPipe.sortOrderLocale(b, a));
      }
    }
  }
}
