import { hasProperty } from '@octra/utilities';
import { BrowserInfo } from './BrowserInfo';

export class ShortcutManager {
  private keyMap = {
    mac: {
      select: 'CMD',
      'select all': 'CMD + A',
      remove: 'CMD + BACKSPACE',
    },
    pc: {
      select: 'CTRL',
      'select all': 'CTRL + A',
      remove: 'CTRL + BACKSPACE',
    },
  };

  private table: any = [
    {
      name: 'CMD',
      keyCode: 91,
    },
    {
      name: 'CMD',
      keyCode: 93,
    },
    {
      name: 'CMD',
      keyCode: 224,
    },
    {
      name: 'ALT',
      keyCode: 18,
    },
    {
      name: 'META',
      keyCode: -1,
    },
    {
      name: 'CTRL',
      keyCode: 17,
    },
    {
      name: 'TAB',
      keyCode: 9,
    },
    {
      name: 'BACKSPACE',
      keyCode: 8,
    },
    {
      name: 'ENTER',
      keyCode: 13,
    },
    {
      name: 'ESC',
      keyCode: 27,
    },
    {
      name: 'SPACE',
      keyCode: 32,
    },
    {
      name: 'SHIFT',
      keyCode: 16,
    },
    {
      name: 'ARROWLEFT',
      keyCode: 37,
    },
    {
      name: 'ARROWUP',
      keyCode: 38,
    },
    {
      name: 'ARROWRIGHT',
      keyCode: 39,
    },
    {
      name: 'ARROWDOWN',
      keyCode: 40,
    },
  ];

  public shortcutsEnabled = true;

  private _pressedKey = {
    code: -1,
    name: '',
  };

  get pressedKey(): { code: number; name: string } {
    return this._pressedKey;
  }

  public checkKeyEvent(event: KeyboardEvent): Promise<{ command: string; platform: string } | undefined> {
    return new Promise<{ command: string; platform: string } | undefined>((resolve) => {
      if (this.shortcutsEnabled) {
        if (event.type === 'keydown') {
          const shortcut = this.getShorcutCombination(event);

          if (this._pressedKey.code < 0) {
            this._pressedKey.code = event.keyCode;
            this._pressedKey.name = this.getNameByCode(event.keyCode);
          }

          const command = this.getCommand(shortcut, BrowserInfo.platform);
          if (!(command === null || command === undefined)) {
            event.preventDefault();
            resolve({
              platform: BrowserInfo.platform,
              command,
            });
          }
        } else if (event.type === 'keyup') {
          if (event.keyCode === this._pressedKey.code) {
            this._pressedKey.code = -1;
            this._pressedKey.name = '';
          }
        }
      } else {
        resolve(undefined);
      }
    });
  }

  private getCommand(shorcut: string, platform: string) {
    for (const command in (this.keyMap as any)[platform]) {
      if (hasProperty((this.keyMap as any)[platform], command)) {
        const entry = (this.keyMap as any)[platform][command];

        if (entry === shorcut) {
          return command;
        }
      }
    }

    return null;
  }

  /**
   *
   * gets the name of a special Key by number
   */
  private getNameByCode(code: number): string {
    for (const elem of this.table) {
      if (elem.keyCode === code) {
        return elem.name;
      }
    }
    return '';
  }

  private getKeyCode(event: KeyboardEvent): string | undefined {
    let key = event.key || event.keyCode || event.which;
    if (!key) {
      return undefined;
    }
    return (typeof key === 'string' ? key : String.fromCharCode(key)).toUpperCase();
  }

  private getShorcutCombination(event: KeyboardEvent) {
    const keycode = event.which || event.keyCode; // which has better browser compatibility
    const alt = event.altKey;
    const ctrl = event.ctrlKey;
    const meta = event.metaKey;
    const shift = event.shiftKey;

    let name = this.getNameByCode(keycode);
    if (name === '' && !(event.which === null || event.which === undefined)) {
      name = String.fromCharCode(event.which).toUpperCase();
    }

    if (!name) {
      name = '';
    }

    if (name === 'CONTROL') {
      name = 'CTRL';
    }

    let isCombination = false;
    let comboKey = '';

    // only one kombination permitted
    if (alt && !(ctrl || shift)) {
      isCombination = true;
    } else if (ctrl && !(alt || shift)) {
      isCombination = true;
    } else if (shift && !(alt || ctrl)) {
      isCombination = true;
    }

    if (this._pressedKey.code > -1) {
      isCombination = true;
    }

    if (isCombination) {
      if (alt) {
        comboKey = 'ALT';
      } else if (ctrl) {
        comboKey = 'CTRL';
      } else if (shift) {
        comboKey = 'SHIFT';
      } else {
        comboKey = this.getNameByCode(this._pressedKey.code);
      }
    }

    // if name == comboKey, only one special Key pressed
    if (name !== comboKey) {
      if (comboKey !== '') {
        comboKey += ' + ';
      }

      if (event.key !== '' && name !== '') {
        if (name.length === 1) {
          // keyName is normal char
          name = String.fromCharCode(keycode);
        }
        comboKey += name;
      }
    }
    return comboKey;
  }
}
