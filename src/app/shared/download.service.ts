import {Injectable} from '@angular/core';
import {AppInfo, ConverterData} from '../app.info';
import {OAnnotJSON, OAudiofile} from '@octra/annotation';
import {FileInfo, isUnset} from '@octra/utilities';
import {Operation} from '../obj/operations/operation';
import {AudioInfo} from '@octra/media';

@Injectable({
  providedIn: 'root'
})
export class DownloadService {

  constructor() {
  }

  public getLevelNumforConverter(converterData: ConverterData, annotJSON: OAnnotJSON) {
    if (!isUnset(converterData.tierNameMatches)) {
      for (const tierNameMatch of converterData.tierNameMatches) {
        const regex = new RegExp(tierNameMatch, 'g');

        for (let i = 0; i < annotJSON.levels.length; i++) {
          const level = annotJSON.levels[i];
          if (regex.exec(level.name) !== null) {
            return i;
          }
        }
      }
      return -1;
    } else {
      return 0;
    }
  }

  public getConversionFiles(operation: Operation, operationResult: FileInfo, converters: ConverterData[]): Promise<FileInfo[]> {
    return new Promise<FileInfo[]>((resolve, reject) => {

      const promises: Promise<FileInfo>[] = [];

      for (const converter of converters) {
        if (operationResult.fullname.indexOf(converter.obj.extension) < 0) {
          promises.push(this.getResultConversion(converter, operation, operationResult));
        }
      }

      Promise.all(promises).then((values) => {
        resolve(values);
      }).catch((error) => {
        reject(error);
      });
    });
  }

  public getResultConversion(exportConverter: ConverterData, operation: Operation, opResult: FileInfo): Promise<FileInfo> {
    return new Promise<FileInfo>((resolve, reject) => {
      FileInfo.getFileContent(opResult.file).then((content) => {
        const audiofile = new OAudiofile();
        audiofile.duration = (operation.task.files[0] as AudioInfo).duration.samples;
        audiofile.name = (operation.task.files[0] as AudioInfo).fullname;
        audiofile.sampleRate = (operation.task.files[0] as AudioInfo).sampleRate;
        audiofile.size = (operation.task.files[0] as AudioInfo).size;


        let annotJSON;

        const from = AppInfo.converters.find((a) => {
          return opResult.fullname.indexOf(a.obj.extension) > -1;
        });

        if (!(from === null || from === undefined)) {
          const importConverter = from.obj;

          if (importConverter.name !== 'AnnotJSON') {
            const importResult = importConverter.import({
              name: opResult.fullname,
              content,
              encoding: 'utf-8',
              type: 'text/plain'
            }, audiofile);
            if (!isUnset(importResult)) {
              if (importResult.error === '') {
                annotJSON = importResult.annotjson;
              } else {
                console.error(`importResult Error from ${importConverter.name}: ${importResult.error}`);
              }
            } else {
              console.error(`importResult for import ${importConverter.name} is undefined!`);
            }
          } else {
            annotJSON = JSON.parse(content);
          }

          if (!(annotJSON === null || annotJSON === undefined)) {
            const levelnum = this.getLevelNumforConverter(exportConverter, annotJSON);

            const conversion = exportConverter.obj.export(annotJSON, audiofile, levelnum);

            if (!(conversion === null || conversion === undefined)) {
              const file: File = FileInfo.getFileFromContent(conversion.file.content,
                operation.task.files[0].name + exportConverter.obj.extension, conversion.file.type);

              const fileInfo = new FileInfo(file.name, file.type, file.size, file);
              resolve(fileInfo);
            } else {
              // ignore
              resolve(null);
            }
          } else {
            console.log(`import is null of ${from.obj.name}`);
            // ignore
            resolve(null);
          }

        } else {
          console.error(`found no importConverter for ${opResult.fullname}`);
          resolve(null);
        }
      }).catch((error) => {
        reject(error);
      });
    });
  }
}
