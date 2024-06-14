import {Injectable} from '@angular/core';
import {AppInfo, ConverterData} from '../app.info';
import {OAnnotJSON} from '@octra/annotation';
import {Operation} from '../obj/operations/operation';
import {AudioInfo, FileInfo} from '@octra/web-media';
import {OAudiofile} from '@octra/media';

@Injectable({
  providedIn: 'root'
})
export class DownloadService {
  public getLevelNumforConverter(converterData: ConverterData, annotJSON: OAnnotJSON) {
    if (converterData.tierNameMatches) {
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

  public getConversionFiles(operation: Operation, operationResult: FileInfo | undefined, converters: ConverterData[]): Promise<FileInfo[]> {
    return new Promise<FileInfo[]>((resolve, reject) => {
      if (!operationResult) {
        reject('operationResult is undefined!');
        return;
      }
      const promises: Promise<FileInfo | undefined>[] = [];

      for (const converter of converters) {
        if (operationResult.fullname.indexOf(converter.obj.extension) < 0) {
          promises.push(this.getResultConversion(converter, operation, operationResult));
        }
      }

      Promise.all(promises).then((values) => {
        resolve(values.filter(a => a !== undefined) as FileInfo[]);
      }).catch((error) => {
        reject(error);
      });
    });
  }

  public getResultConversion(exportConverter: ConverterData, operation: Operation, opResult: FileInfo): Promise<FileInfo | undefined> {
    return new Promise<FileInfo | undefined>((resolve, reject) => {
      FileInfo.getFileContent(opResult.file!).then((content) => {
        const audiofile = new OAudiofile();
        if (!operation.task) {
          throw new Error('operation task is undefined');
        }
        const audioinfo = (operation.task.files[0] as AudioInfo);

        audiofile.duration = audioinfo.duration.samples;
        audiofile.name = audioinfo.attributes?.originalFileName ?? audioinfo.fullname;
        audiofile.sampleRate = audioinfo.sampleRate;
        audiofile.size = audioinfo.size;


        let annotJSON;

        const from = AppInfo.converters.find((a) => {
          return opResult.fullname.indexOf(a.obj.extension) > -1;
        });

        if (!(from === null || from === undefined)) {
          const importConverter = from.obj;

          console.log(`AudioFileName: ${audiofile.name ? audiofile.name + opResult.extension : opResult.fullname}`);
          if (importConverter.name !== 'AnnotJSON') {
            const importResult = importConverter.import({
              name: audiofile.name ? audiofile.name.replace(/\.[^.]+$/g, "") + opResult.extension : opResult.fullname,
              content,
              encoding: 'utf-8',
              type: 'text/plain'
            }, audiofile);
            if (importResult) {
              if (importResult.error === '') {
                annotJSON = importResult.annotjson;
              } else {
                console.error(`importResult Error from ${importConverter.name}: ${importResult.error}`);
              }
            } else {
              console.error(`importResult for import ${importConverter.name} is undefined!`);
            }
          } else {
            annotJSON = OAnnotJSON.deserialize(JSON.parse(content));
          }

          if (annotJSON) {
            const levelnum = this.getLevelNumforConverter(exportConverter, annotJSON);
            const conversion = exportConverter.obj.export(annotJSON, audiofile, levelnum);

            if (conversion?.file) {
              const file: File = FileInfo.getFileFromContent(conversion.file.content,
                audiofile.name.replace(/\.[^.]+$/g, "") + exportConverter.obj.extension, conversion.file.type);

              const fileInfo = new FileInfo(file.name, file.type, file.size, file);
              resolve(fileInfo);
            } else {
              // ignore
              resolve(undefined);
            }
          } else {
            console.log(`import is null of ${from.obj.name}`);
            // ignore
            resolve(undefined);
          }

        } else {
          console.error(`found no importConverter for ${opResult.fullname}`);
          resolve(undefined);
        }
      }).catch((error: any) => {
        reject(error);
      });
    });
  }
}
