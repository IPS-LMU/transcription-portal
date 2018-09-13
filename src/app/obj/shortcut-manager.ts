import {BrowserInfo} from './BrowserInfo';

export class ShortcutManager {
  get pressedKey(): { code: number; name: string } {
    return this._pressedKey;
  }

  private _pressedKey = {
    code: -1,
    name: ''
  };

  private keyMap = {
    mac: {
      'select': 'CMD',
      'select all': 'CMD + A',
      'remove': 'CMD + BACKSPACE'
    },
    pc: {
      'select': 'CTRL',
      'select all': 'CTRL + A',
      'remove': 'CTRL + BACKSPACE'
    }
  };

  private table: any = [
    {
      name: 'CMD',
      keyCode: 91
    },
    {
      name: 'CMD',
      keyCode: 93
    },
    {
      name: 'ALT',
      keyCode: 18
    }, {
      name: 'META',
      keyCode: -1
    }, {
      name: 'CTRL',
      keyCode: 17
    }, {
      name: 'TAB',
      keyCode: 9
    },
    {
      name: 'BACKSPACE',
      keyCode: 8
    }, {
      name: 'ENTER',
      keyCode: 13
    }, {
      name: 'ESC',
      keyCode: 27
    }, {
      name: 'SPACE',
      keyCode: 32
    }, {
      name: 'SHIFT',
      keyCode: 16
    }, {
      name: 'ARROWLEFT',
      keyCode: 37
    }, {
      name: 'ARROWUP',
      keyCode: 38
    }, {
      name: 'ARROWRIGHT',
      keyCode: 39
    }, {
      name: 'ARROWDOWN',
      keyCode: 40
    }
  ];

  constructor() {

  }

  public checkKeyEvent(event: KeyboardEvent): Promise<{ command: string, platform: string }> {
    return new Promise<{ command: string, platform: string }>((resolve) => {
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
            command: command
          });
        }
      } else if (event.type === 'keyup') {
        if (event.keyCode === this._pressedKey.code) {
          this._pressedKey.code = -1;
          this._pressedKey.name = '';
        }
      }
    });
  }

  private getCommand(shorcut: string, platform: string) {
    for (const command in this.keyMap[platform]) {
      if (this.keyMap[platform].hasOwnProperty(command)) {
        const entry = this.keyMap[platform][command];

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
   * @param code
   * @returns {string}
   */
  private getNameByCode(code: number): string {
    for (let i = 0; i < this.table.length; i++) {
      if (this.table[i].keyCode === code) {
        return this.table[i].name;
      }
    }
    return '';
  }

  private getShorcutCombination(event: KeyboardEvent) {
    const keycode = event.which; // which has better browser compatibility
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

    let is_combination = false;
    let comboKey = '';

    // only one kombination permitted
    if (alt && !(ctrl || shift)) {
      is_combination = true;
    } else if (ctrl && !(alt || shift)) {
      is_combination = true;
    } else if (shift && !(alt || ctrl)) {
      is_combination = true;
    }

    if (this._pressedKey.code > -1) {
      is_combination = true;
    }

    if (is_combination) {
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
