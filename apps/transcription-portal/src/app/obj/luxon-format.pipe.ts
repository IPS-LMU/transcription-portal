import { Pipe, PipeTransform } from '@angular/core';
import { DateTime } from 'luxon';

@Pipe({
  name: 'luxonFormat',
  standalone: true,
})
export class LuxonFormatPipe implements PipeTransform {
  transform(value: number, option: string): unknown {
    let language = navigator.language || navigator.userAgent || 'en';

    if (window.navigator.languages) {
      language = window.navigator.languages[0];
    } else {
      language =
        (window.navigator as any).userLanguage || window.navigator.language;
    }

    const postfix = this.getPostfix(language);
    return `${DateTime.fromMillis(value).setLocale(language).toLocaleString(this.getOptions(option))}${postfix}`;
  }

  private getOptions(key: string): Intl.DateTimeFormatOptions | undefined {
    switch (key) {
      case 'DATETIME_SHORT':
        return {
          ...DateTime.DATETIME_SHORT,
          minute: '2-digit',
          hour: '2-digit',
          second: '2-digit',
          day: '2-digit',
          month: '2-digit',
          year: '2-digit',
        };
    }
    console.error(`Couldn't find DateTime option with key ${key}`);
    return undefined;
  }

  private getPostfix(locale: string): string {
    switch (locale) {
      case 'de-DE':
        return ' Uhr';
    }
    return '';
  }
}
