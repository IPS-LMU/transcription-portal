import {Pipe, PipeTransform} from '@angular/core';

@Pipe({
  name: 'time'
})
export class TimePipe implements PipeTransform {

  transform(value: any, args?: any): any {
    if ((args === null || args === undefined)) {
      // value are miliseconds
      if (!isNaN(Number(value))) {
        const miliseconds = Number(value);

        let seconds = Math.round(miliseconds / 1000);
        let minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        seconds = seconds % 60;
        minutes = minutes % 60;


        let hour_leading_null = '';
        if (hours < 10) {
          hour_leading_null = '0';
        }

        let min_leading_null = '';
        if (minutes < 10) {
          min_leading_null = '0';
        }
        let secs_leading_null = '';
        if (seconds < 10) {
          secs_leading_null = '0';
        }

        if (hours < 1) {
          return `${min_leading_null}${minutes}:${secs_leading_null}${seconds}`;
        }
        return `${hour_leading_null}${hours}:${secs_leading_null}${minutes}:${secs_leading_null}${seconds}`;
      }
    }
    return null;
  }

}
