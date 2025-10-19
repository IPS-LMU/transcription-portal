import { Injectable } from '@angular/core';
import { OAnnotJSON } from '@octra/annotation';
import { OAudiofile } from '@octra/media';
import { AudioInfo, FileInfo } from '@octra/web-media';
import { AppInfo, ConverterData } from '../app.info';
import { Operation } from '../obj/operations/operation';

@Injectable({
  providedIn: 'root',
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
      const promises: Promise<{
        converter: ConverterData;
        result: FileInfo | undefined;
      }>[] = [];

      for (const converter of converters) {
        for (const extension of converter.obj.extensions) {
          if (operationResult.fullname.indexOf(extension) < 0) {
            promises.push(this.getResultConversion(converter, operation, operationResult));
            break;
          }
        }
      }

      Promise.all(promises)
        .then((values: any) => {
          values = this.sortConvertedFiles(values);
          resolve(values.filter((a: any) => a.result !== undefined).map((a: any) => a.result) as FileInfo[]);
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  private sortConvertedFiles(
    values: {
      converter: ConverterData;
      result: FileInfo | undefined;
    }[],
  ) {
    let index = values.findIndex((a) => a.converter.obj.name === 'PlainText');
    let removed = values.splice(index, 1);
    values = [...removed, ...values];
    return values;
  }

  public getResultConversion(
    converter: ConverterData,
    operation: Operation,
    opResult: FileInfo,
  ): Promise<{
    converter: ConverterData;
    result: FileInfo | undefined;
  }> {
    return new Promise<{
      converter: ConverterData;
      result: FileInfo | undefined;
    }>((resolve, reject) => {
      FileInfo.getFileContent(opResult.file!)
        .then((content) => {
          const audiofile = new OAudiofile();
          if (!operation.task) {
            throw new Error('operation task is undefined');
          }
          const audioinfo = operation.task.files[0] as AudioInfo;

          audiofile.duration = audioinfo.duration.samples;
          audiofile.name = audioinfo.attributes?.originalFileName ?? audioinfo.fullname;
          audiofile.sampleRate = audioinfo.sampleRate;
          audiofile.size = audioinfo.size;

          let annotJSON;

          const from = AppInfo.converters.find((a) => {
            for (const extension of a.obj.extensions) {
              if (opResult.fullname.indexOf(extension) > -1) {
                return true;
              }
            }
            return false;
          });

          if (!(from === null || from === undefined)) {
            const importConverter = from.obj;

            if (importConverter.name !== 'AnnotJSON') {
              const importResult = importConverter.import(
                {
                  name: audiofile.name ? audiofile.name.replace(/\.[^.]+$/g, '') + opResult.extension : opResult.fullname,
                  content,
                  encoding: 'utf-8',
                  type: 'text/plain',
                },
                audiofile,
              );
              if (importResult) {
                if (!importResult.error) {
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
              const levelnum = this.getLevelNumforConverter(converter, annotJSON);
              const conversion = converter.obj.export(annotJSON, audiofile, levelnum);

              if (conversion?.file) {
                const file: File = FileInfo.getFileFromContent(
                  conversion.file.content,
                  audiofile.name.replace(/\.[^.]+$/g, '') + converter.obj.extensions[0],
                  conversion.file.type,
                );

                const fileInfo = new FileInfo(file.name, file.type, file.size, file);
                resolve({
                  converter,
                  result: fileInfo,
                });
              } else {
                // ignore
                resolve({ converter, result: undefined });
              }
            } else {
              console.log(`import is null of ${from.obj.name}`);
              // ignore
              resolve({ converter, result: undefined });
            }
          } else {
            console.error(`found no importConverter for ${opResult.fullname}`);
            resolve({ converter, result: undefined });
          }
        })
        .catch((error: any) => {
          reject(error);
        });
    });
  }
}
