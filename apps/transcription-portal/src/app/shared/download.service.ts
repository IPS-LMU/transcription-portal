import { Injectable } from '@angular/core';
import { OAnnotJSON } from '@octra/annotation';
import { OAudiofile } from '@octra/media';
import { FileInfo } from '@octra/web-media';
import { AppInfo, ConverterData } from '../app.info';
import { TPortalFileInfo } from '../obj/TPortalFileInfoAttributes';
import {
  convertStoreAudioFileToAudioInfo,
  StoreAudioFile,
  StoreFile,
  StoreItemTask,
  StoreTaskOperation,
  StoreTaskOperationProcessingRound,
} from '../store';

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

  public getConversionFiles(
    task: StoreItemTask,
    operation: StoreTaskOperation,
    round: StoreTaskOperationProcessingRound,
    converters: ConverterData[],
  ): Promise<TPortalFileInfo[]> {
    return new Promise<TPortalFileInfo[]>((resolve, reject) => {
      const foundTranscriptResult = round.results.find((a) => !a.type.includes('audio'));

      if (!foundTranscriptResult) {
        reject('operationResult is undefined!');
        return;
      }
      const promises: Promise<{
        converter: ConverterData;
        result: TPortalFileInfo | undefined;
      }>[] = [];

      for (const converter of converters) {
        for (const extension of converter.obj.extensions) {
          if (foundTranscriptResult.name.indexOf(extension) < 0) {
            promises.push(this.getResultConversion(converter, task, operation, foundTranscriptResult));
            break;
          }
        }
      }

      Promise.all(promises)
        .then((values: {
          converter: ConverterData;
          result: TPortalFileInfo | undefined;
        }[]) => {
          values = this.sortConvertedFiles(values);
          resolve(values.filter((a: {
            converter: ConverterData;
            result: TPortalFileInfo | undefined;
          }) => a.result !== undefined).map((a: {
            converter: ConverterData;
            result: TPortalFileInfo | undefined;
          }) => a.result) as TPortalFileInfo[]);
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  private sortConvertedFiles(
    values: {
      converter: ConverterData;
      result: TPortalFileInfo | undefined;
    }[],
  ) {
    const index = values.findIndex((a) => a.converter.obj.name === 'PlainText');
    const removed = values.splice(index, 1);
    values = [...removed, ...values];
    return values;
  }

  public getResultConversion(
    converter: ConverterData,
    task: StoreItemTask,
    operation: StoreTaskOperation,
    opResult: StoreFile,
  ): Promise<{
    converter: ConverterData;
    result: TPortalFileInfo | undefined;
  }> {
    return new Promise<{
      converter: ConverterData;
      result: TPortalFileInfo | undefined;
    }>((resolve, reject) => {
      const audiofile = new OAudiofile();
      if (!task) {
        throw new Error('operation task is undefined');
      }
      const audioStoreFile = task.files.find((a) => a.type.includes('audio'));
      const audioinfo = convertStoreAudioFileToAudioInfo(audioStoreFile as StoreAudioFile);
      audiofile.duration = audioinfo.duration.samples;
      audiofile.name = audioinfo.attributes?.originalFileName ?? audioinfo.fullname;
      audiofile.sampleRate = audioinfo.sampleRate;
      audiofile.size = audioinfo.size;

      let annotJSON;

      const from = AppInfo.converters.find((a) => {
        for (const extension of a.obj.extensions) {
          if (opResult.name.indexOf(extension) > -1) {
            return true;
          }
        }
        return false;
      });

      if (from) {
        const importConverter = from.obj;
        const { extension } = FileInfo.extractFileName(opResult.name);

        if (importConverter.name !== 'AnnotJSON') {
          const importResult = importConverter.import(
            {
              name: audiofile.name ? audiofile.name.replace(/\.[^.]+$/g, '') + extension : opResult.name,
              content: opResult.content!,
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
          annotJSON = OAnnotJSON.deserialize(JSON.parse(opResult.content!));
        }

        if (annotJSON) {
          const levelnum = this.getLevelNumforConverter(converter, annotJSON);
          const conversion = converter.obj.export(annotJSON, audiofile, levelnum);

          if (conversion?.file) {
            const file: File = TPortalFileInfo.getFileFromContent(
              conversion.file.content,
              audiofile.name.replace(/\.[^.]+$/g, '') + converter.obj.extensions[0],
              conversion.file.type,
            );

            const fileInfo = new TPortalFileInfo(file.name, file.type, file.size, file);
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
        console.error(`found no importConverter for ${opResult.name}`);
        resolve({ converter, result: undefined });
      }
    });
  }
}
