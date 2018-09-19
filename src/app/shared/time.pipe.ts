import {Pipe, PipeTransform} from '@angular/core';

@Pipe({
  name: 'time'
})
export class TimePipe implements PipeTransform {

  transform(value: any, args?: any): any {
      // value are miliseconds
      if (!isNaN(Number(value))) {
        const miliseconds = Number(value);

        let showFull = false;

        if (!(args === null || args === undefined) && !(args[0] === null || args[0] === undefined)) {
          showFull = true;
        }

        let seconds = Math.round(miliseconds / 1000);
        let minutes = Math.floor(seconds / 60);
        const hours = Math.floor(seconds / 60 / 60);

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

        if (hours < 1 && !showFull) {
          return `${min_leading_null}${minutes}:${secs_leading_null}${seconds}`;
        }
        return `${hour_leading_null}${hours}:${min_leading_null}${minutes}:${secs_leading_null}${seconds}`;
      }
  }

}
