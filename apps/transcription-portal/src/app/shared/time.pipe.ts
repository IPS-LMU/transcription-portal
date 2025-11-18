import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'time',
  standalone: true,
})
export class TimePipe implements PipeTransform {
  transform(value: any, args?: any): any {
    // value is in miliseconds
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

      let hourLeadingNull = '';
      if (hours < 10) {
        hourLeadingNull = '0';
      }

      let minLeadingNull = '';
      if (minutes < 10) {
        minLeadingNull = '0';
      }
      let secsLeadingNull = '';
      if (seconds < 10) {
        secsLeadingNull = '0';
      }

      if (hours < 1 && !showFull) {
        return `${minLeadingNull}${minutes}:${secsLeadingNull}${seconds}`;
      }
      return `${hourLeadingNull}${hours}:${minLeadingNull}${minutes}:${secsLeadingNull}${seconds}`;
    }
  }
}
