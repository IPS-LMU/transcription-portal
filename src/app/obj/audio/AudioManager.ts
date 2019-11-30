import {AudioRessource} from './AudioRessource';
import {EventEmitter} from '@angular/core';
import {AudioTime} from './AudioTime';
import {PlayBackState, SourceType} from './index';
import {AudioSelection} from './AudioSelection';
import {AudioFormat} from './AudioFormats';
import {AudioInfo} from './AudioInfo';
import {SubscriptionManager} from '../../shared/subscription-manager';

declare var window: any;

export class AudioManager {
  public static audiocontext: AudioContext = new (window.AudioContext // Default
    || window.webkitAudioContext // Safari and old versions of Chrome
    || window.mozAudioContext
    || false)();

  private static counter = 0;
  public afterdecoded: EventEmitter<AudioRessource> = new EventEmitter<AudioRessource>();
  public loaded = false;
  public afterloaded: EventEmitter<any> = new EventEmitter<any>();
  public statechange: EventEmitter<PlayBackState> = new EventEmitter<PlayBackState>();
  private readonly _id: number;
  private _startplaying = 0;
  private chunks: AudioChunk[] = [];
  private state = PlayBackState.PREPARE;

  constructor(filename: string) {
    this._id = ++AudioManager.counter;

    if (!(filename === null || filename === undefined)) {
      // Fix up for prefixing
      if (AudioManager.audiocontext) {
        this.state = PlayBackState.PREPARE;
      } else {
        console.error('AudioContext not supported by this browser');
      }
    }
  }

  get audioplaying(): boolean {
    return (this.state === PlayBackState.PLAYING);
  }

  get id(): number {
    return this._id;
  }

  private _ressource: AudioRessource;

  get ressource(): AudioRessource {
    return this._ressource;
  }

  set ressource(value: AudioRessource) {
    this._ressource = value;
  }

  // variables needed for initializing audio
  private _source: AudioBufferSourceNode = null;

  get source(): AudioBufferSourceNode {
    return this._source;
  }

  private _gainNode: any = null;

  get gainNode(): any {
    return this._gainNode;
  }

  private _endplaying = 0;

  get endplaying(): number {
    return this._endplaying;
  }

  // TODO does this has to be enabled?
  set endplaying(value: number) {
    this._endplaying = value;
  }

  private _replay = false;

  get replay(): boolean {
    return this._replay;
  }

  set replay(value: boolean) {
    this._replay = value;
  }

  private _paused = false;

  get paused(): boolean {
    return this._paused;
  }

  set paused(value: boolean) {
    this._paused = value;
  }

  private _stepbackward = false;

  get stepbackward(): boolean {
    return this._stepbackward;
  }

  set stepbackward(value: boolean) {
    this._stepbackward = value;
  }

  private _playonhover = false;

  get playonhover(): boolean {
    return this._playonhover;
  }

  private _mainchunk: AudioChunk;

  get mainchunk(): AudioChunk {
    return this._mainchunk;
  }

  private _playposition: AudioTime;

  get playposition(): number {
    if ((this._playposition === null || this._playposition === undefined)) {
      return 0;
    }
    return this._playposition.samples;
  }

  set playposition(value: number) {
    if ((this._playposition === null || this._playposition === undefined)) {
      this._playposition = new AudioTime(0, this.ressource.info.samplerate);
    }
    this._playposition.samples = value;
  }

  // only the AudioManager may have the channel array
  private _channel: Float32Array;

  get channel(): Float32Array {
    return this._channel;
  }

  private _javascriptNode = null;

  get javascriptNode(): any {
    return this._javascriptNode;
  }

  public static getFileFormat(extension: string, audioformats: AudioFormat[]): AudioFormat {
    for (const audioFormat of audioformats) {
      if (audioFormat.extension === extension) {
        return audioFormat;
      }
    }
    return null;
  }

  public static isValidFileName(filename: string, audioformats: AudioFormat[]): boolean {
    return AudioManager.getFileFormat(filename.substr(filename.lastIndexOf('.')), audioformats) !== null;
  }

  public static decodeAudio = (filename: string, type: string, buffer: ArrayBuffer,
                               audioformats: AudioFormat[], keepbuffer = false): Promise<AudioManager> => {
    return new Promise<AudioManager>((resolve, reject) => {
      const audioformat: AudioFormat = AudioManager.getFileFormat(filename.substr(filename.lastIndexOf('.')), audioformats);

      if (audioformat.isValid(buffer)) {
        const result = new AudioManager(filename);
        let audioinfo: AudioInfo = null;
        try {
          audioinfo = audioformat.getAudioInfo(filename, type, buffer);
        } catch (err) {
          console.error(err.message);
        }
        AudioManager.decodeAudioFile(buffer, audioinfo.samplerate).then(
          (audiobuffer: AudioBuffer) => {

            result.ressource = new AudioRessource(filename, SourceType.ArrayBuffer,
              audioinfo, new ArrayBuffer(0), null, 0);

            // set duration is very important
            result.ressource.info.duration.samples = audiobuffer.length;

            const selection = new AudioSelection(new AudioTime(0, audioinfo.samplerate),
              new AudioTime(audiobuffer.length, audioinfo.samplerate));
            result._mainchunk = new AudioChunk(selection, result);

            result.state = PlayBackState.INITIALIZED;
            result.afterdecoded.emit(result.ressource);
            audiobuffer = null;
            resolve(result);
          }).catch((error) => {
          reject(error);
        });
      } else {
        reject('no valid audio format!');
      }
    });
  }

  /**
   * Decode an audio file to an AudioBuffer object.
   *
   * Supported input formats are determined by the browser. The WebAudio API
   * re-samples the signal to the given sample rate. If resampling is
   * undesired, the source sample rate must be known beforehand.
   *
   * @param file An object containing the encoded input file.
   * @param sampleRate The sample rate of the target AudioBuffer object.
   * @returns A promise resolving to the requested AudioBuffer.
   */
  public static decodeAudioFile(file: ArrayBuffer, sampleRate: number): Promise<AudioBuffer> {
    /* adapted function from
       "browser-signal-processing" package (MIT)
       author: Markus Jochim (markusjochim@phonetik.uni-muenchen.de)
    */

    return new Promise<AudioBuffer>((resolve, reject) => {
      const offlineAudioContext = window.OfflineAudioContext // Default
        || window.webkitOfflineAudioContext // Safari and old versions of Chrome
        || window.mozOfflineAudioContext
        || false;

      if (offlineAudioContext === false) {
        console.error(`OfflineAudioContext is not supported!`);
      }

      AudioManager.audiocontext.decodeAudioData(file, (buffer) => {

        let context = new offlineAudioContext(buffer.numberOfChannels, Math.ceil(buffer.duration * sampleRate), sampleRate);
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);
        source.start();
        context.startRendering().then((rendered) => {
          context = null;

          resolve(rendered);
        }).catch((error) => {
          reject(error);
        });
      });
    });
  }

  public stopPlayback(): boolean {
    this._replay = false;
    if (this.audioplaying) {
      this.state = PlayBackState.STOPPED;
      this._source.stop(0);
      return true;
    }
    return false;
  }

  public pausePlayback(): boolean {
    if (this.audioplaying) {
      this._paused = true;
      this.state = PlayBackState.PAUSED;
      this._source.stop(0);
      return true;
    } else {
      this.statechange.error(new Error('cant pause because not playing'));
      return false;
    }
  }

  public startPlayback(begintime: AudioTime, duration: AudioTime = new AudioTime(0, this._ressource.info.samplerate),
                       volume: number, speed: number, drawFunc: () => void, playonhover: boolean = false): boolean {

    if (!this.audioplaying) {
      if ((this._gainNode === null || this._gainNode === undefined)) {
        this.prepareAudioPlayBack();
      }
      this._playonhover = playonhover;
      this.changeState(PlayBackState.STARTED);
      this._stepbackward = false;
      this._source = this.getSource();
      this._source.buffer = this._ressource.audiobuffer;
      this._javascriptNode = AudioManager.audiocontext.createScriptProcessor(2048, 1, 1);

      // connect modules of Web Audio API
      this._gainNode.gain.value = volume;
      this._source.playbackRate.value = speed;
      this._source.connect(this._gainNode);
      this._javascriptNode.connect(AudioManager.audiocontext.destination);
      this._gainNode.connect(AudioManager.audiocontext.destination);
      this._source.onended = this.afterAudioEnded;

      this._startplaying = new Date().getTime();
      this._endplaying = this._startplaying + (duration.unix / speed);
      this._javascriptNode.onaudioprocess = drawFunc;

      this.changeState(PlayBackState.PLAYING);

      if (duration.samples <= 0) {
        // important: source.start needs seconds, not samples!
        this._source.start(0, Math.max(0, begintime.seconds));
      } else {
        // important: source.start needs seconds, not samples!
        this._source.start(0, Math.max(0, begintime.seconds), duration.seconds);
      }

      return true;
    } else {
      this.statechange.error(new Error('Can\'t play audio because it is already playing'));
      return false;
    }
  }

  public rePlayback(): boolean {
    this._replay = !this._replay;
    return this._replay;
  }

  public stepBackward(): boolean {
    this._stepbackward = true;
    if (this.audioplaying) {
      /* const obj: EventListenerOrEventListenerObject = () => {
        this._source.removeEventListener('ended', obj);
        callback();
        this._stepbackward = false;
      };
      this._source.addEventListener('ended', obj);
      */

      this.state = PlayBackState.STOPPED;
      this._source.stop(0);
      return true;
    }
    return false;
  }

  public stepBackwardTime(backSamples: number): boolean {
    this._stepbackward = true;

    if (this.audioplaying) {
      /*
      const obj: EventListenerOrEventListenerObject = () => {
        this._source.removeEventListener('ended', obj);
        callback();
        this._stepbackward = false;
      };

      this._source.addEventListener('ended', obj);
      */

      this.state = PlayBackState.STOPPED;
      this._source.stop(0);
      return true;
    }
    return false;
  }

  public prepareAudioPlayBack() {
    this._gainNode = AudioManager.audiocontext.createGain();
    this._source = this.getSource();

    // get channel data
    if ((this._channel === null || this._channel === undefined) || this._channel.length === 0) {
      this._channel = new Float32Array(this._ressource.audiobuffer.getChannelData(0));
      // clear audiobuffer otherwise this would need to much memory space
    } else {
      console.log('audio manager already has channel data');
    }

    this.loaded = true;
    this.afterloaded.emit({status: 'success', error: ''});
  }

  public destroy(disconnect: boolean = true) {
    if (!(AudioManager.audiocontext === null || AudioManager.audiocontext === undefined)) {
      if (disconnect) {
        AudioManager.audiocontext.close()
          .then(() => {
            console.log('AudioManager successfully destroyed its AudioContext');
          })
          .catch(
            (error) => {
              console.error(error);
            }
          );
      }

      if (!(this._source === null || this._source === undefined)) {
        this._source.disconnect();
      }
    }
  }

  public addChunk(chunk: AudioChunk) {
    if (
      this.chunks.filter(
        (a) => {
          if (a.id === chunk.id) {
            return true;
          }
        }
      ).length === 0) {
      this.chunks.push(chunk);
    }
  }

  private afterAudioEnded = () => {
    if (this.state === PlayBackState.PLAYING) {
      // audio ended normally
      this.state = PlayBackState.ENDED;
    }

    if (this.state === PlayBackState.ENDED || this.state === PlayBackState.PAUSED || this.state === PlayBackState.STOPPED) {
      this.javascriptNode.disconnect();
    }
    /*
    if (this.state === PlayBackState.PLAYING && !this._stepbackward) {
      this.state = PlayBackState.ENDED;
    }
    */
    this.statechange.emit(this.state);
  }

  private getSource(): AudioBufferSourceNode {
    this._source = AudioManager.audiocontext.createBufferSource();
    return this._source;
  }

  private changeState(newstate: PlayBackState) {
    this.state = newstate;
    this.statechange.emit(newstate);
  }
}

interface Interval {
  start: number;
  end: number;
}

export class AudioChunk {

  constructor(time: AudioSelection, audioManager: AudioManager, selection?: AudioSelection) {
    if (time && time.start && time.end) {
      this.time = time.clone();
    } else {
      throw new Error('AudioChunk constructor needs two correct AudioTime objects');
    }

    if (!(audioManager === null || audioManager === undefined)) {
      this._audiomanger = audioManager;
      this._playposition = new AudioTime(time.start.samples, this._audiomanger.ressource.info.samplerate);
      this._state = PlayBackState.INITIALIZED;
    } else {
      throw new Error('AudioChunk needs an audiomanger reference');
    }

    if (!(selection === null || selection === undefined)) {
      this._selection = selection.clone();
    } else {
      this._selection = this._time.clone();
    }

    this._id = ++AudioChunk._counter;
  }

  static get counter(): number {
    return this._counter;
  }

  get audiomanager(): AudioManager {
    return this._audiomanger;
  }

  get id() {
    return this._id;
  }

  /**
   * sets the playposition and the audio chunk's selection. Be aware that this methods changes the
   * end position to the last sample every time it's called
   */
  public set startpos(value: AudioTime) {
    if ((this.selection === null || this.selection === undefined)) {
      this.selection = new AudioSelection(value.clone(), this.time.end.clone());
    } else {
      this.selection.start = value.clone();
      this.selection.end = this.time.end.clone();
    }
    this._playposition = this.selection.start.clone();
  }

  public get isPlaybackEnded(): boolean {
    return this._state === PlayBackState.ENDED;
  }

  public get isPlaybackStarted(): boolean {
    return this._state === PlayBackState.STARTED;
  }

  public get isPlaying(): boolean {
    return this._state === PlayBackState.PLAYING;
  }

  public get isPlayBackStopped(): boolean {
    return this._state === PlayBackState.STOPPED;
  }

  get selection(): AudioSelection {
    return this._selection;
  }

  set selection(value: AudioSelection) {
    this._selection = value;
  }

  get time(): AudioSelection {
    return this._time;
  }

  set time(value: AudioSelection) {
    this._time = value;
  }

  get state(): PlayBackState {
    return this._state;
  }

  get volume(): number {
    return this._volume;
  }

  set volume(value: number) {
    this._volume = value;
    this._audiomanger.gainNode.gain.value = value;
  }

  get speed(): number {
    return this._speed;
  }

  set speed(value: number) {
    if (value > 0) {
      this._speed = value;
      this._audiomanger.source.playbackRate.value = value;
      this._audiomanger.endplaying = this._audiomanger.endplaying * this._speed;
    }
  }

  get playposition(): AudioTime {
    return this._playposition;
  }

  set playposition(value: AudioTime) {
    this._playposition = value;
  }

  get lastplayedpos(): AudioTime {
    return this._lastplayedpos;
  }

  private static _counter = 0;

  public statechange: EventEmitter<PlayBackState> = new EventEmitter<PlayBackState>();
  private readonly _id;
  private readonly _audiomanger: AudioManager;
  private subscrmanager: SubscriptionManager = new SubscriptionManager();

  private _selection: AudioSelection = null;

  private _time: AudioSelection = null;

  private _state: PlayBackState = PlayBackState.PREPARE;

  private _volume = 1;

  private _speed = 1;

  private _playposition: AudioTime;

  private _lastplayedpos: AudioTime;

  public getChannelBuffer(selection: AudioSelection): Float32Array {
    if (!(selection === null || selection === undefined)) {
      return this.audiomanager.channel.subarray(selection.start.samples, selection.end.samples);
    }

    return null;
  }

  public startPlayback(drawFunc: () => void, playonhover: boolean = false): boolean {
    if ((this._selection === null || this._selection === undefined)) {
      this.selection = new AudioSelection(this.time.start.clone(), this.time.end.clone());
    }

    if (this._selection.start.samples === this._selection.end.samples) {
      this.startpos = this._selection.start.clone();
    }

    if (!this._audiomanger.audioplaying) {
      this._state = PlayBackState.STARTED;

      this._lastplayedpos = this.playposition.clone();
      this.audiomanager.playposition = this._lastplayedpos.samples;

      this.setState(PlayBackState.PLAYING);

      // console.log(`play from ${this.selection.start.seconds} to ${this.selection.start.seconds + this.selection.duration.seconds}`);
      const id = this.subscrmanager.add(this.audiomanager.statechange.subscribe(
        (state: PlayBackState) => {
          this.checkState(state);
          this.setState(state);

          if (state === PlayBackState.STOPPED || state === PlayBackState.PAUSED || state === PlayBackState.ENDED) {
            this.subscrmanager.remove(id);
          }
        },
        (error) => {
          console.error(error);
        }
      ));

      return this._audiomanger.startPlayback(
        this.selection.start, this.selection.duration, this._volume, this._speed, drawFunc, playonhover
      );
    }
    return false;
  }

  public stopPlayback(): boolean {
    const stopped = this._audiomanger.stopPlayback();
    this.startpos = this.time.start.clone();

    if (!stopped) {
      // audio was not playing
      this.setState(PlayBackState.STOPPED);
    }

    return true;
  }

  public pausePlayback(): boolean {
    return this.audiomanager.pausePlayback();
  }

  public rePlayback(): boolean {
    return this._audiomanger.rePlayback();
  }

  public stepBackward() {
    if (!(this.lastplayedpos === null || this.lastplayedpos === undefined)) {
      this.startpos = this.lastplayedpos.clone();
      const result = this.audiomanager.stepBackward();

      if (!result) {
        // audio was not playing
        this.audiomanager.stepbackward = true;
        this.setState(PlayBackState.STOPPED);
      }

      return result;
    } else {
      console.error('lastplayedpos is null');
    }

    return false;
  }

  public stepBackwardTime(backSeconds: number) {
    const backSamples = Math.max(0, (this.playposition.samples
      - (Math.round(backSeconds * this.audiomanager.ressource.info.samplerate))));
    this.startpos = new AudioTime(backSamples, this.audiomanager.ressource.info.samplerate);

    const result = this.audiomanager.stepBackwardTime(backSamples);

    if (!result) {
      // audio was not playing
      this.audiomanager.stepbackward = true;
      this.setState(PlayBackState.STOPPED);
    }
    return result;
  }

  /**
   * calculate current position of the current audio playback.
   * TODO when does this method must be called? Animation of playcursor or at another time else?
   */
  public updatePlayPosition = () => {
    if (!(this.selection === null || this.selection === undefined)) {
      const timestamp = new Date().getTime();

      if ((this._playposition === null || this._playposition === undefined)) {
        this._playposition = this.time.start.clone();
      }

      if (this.isPlaying) {
        const playduration = (this._audiomanger.endplaying - timestamp) * this.speed;
        this._playposition.unix = this.selection.start.unix + this.selection.duration.unix - playduration;

      } else if (this.state === PlayBackState.ENDED) {
        this._playposition = this.selection.start.clone();
      } else if (this.state === PlayBackState.PAUSED) {
      }

      this.audiomanager.playposition = this._playposition.samples;
    }
  }

  public clone() {
    return new AudioChunk(this.time.clone(), this.audiomanager, this.selection);
  }

  public destroy() {
    this.subscrmanager.destroy();
  }

  private setState(state: PlayBackState) {
    if (this._state !== state || state === PlayBackState.STOPPED) {
      this._state = state;
      this.statechange.emit(state);
    }
  }

  private afterPlaybackStopped() {
    this.startpos = this.time.start.clone();
    this.audiomanager.replay = false;
  }

  private afterPlaybackPaused() {
    this.startpos = this.playposition.clone();
  }

  private afterPlaybackEnded() {
    if (this.selection.end.samples === this.time.end.samples) {
      this.startpos = this.time.start.clone();
    }
  }

  private checkState(newstate: PlayBackState) {
    switch (newstate) {
      case(PlayBackState.STOPPED):
        if (!this.audiomanager.stepbackward) {
          this.afterPlaybackStopped();
        }
        break;
      case (PlayBackState.PAUSED):
        this.afterPlaybackPaused();
        break;
      case (PlayBackState.ENDED):
        this.afterPlaybackEnded();
        break;
      default:
        break;
    }
  }
}

