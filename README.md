<h1 align="center">OH-Portal</h1>
<p align="center">
  <img width="600" height="550" src="https://github.com/IPS-LMU/oh-portal/raw/master/screenshots/oh-portal01.png" alt="OH-Portal">
</p>
<p align="center">
Implementation of a transcription chain that supports ASR, OCTRA, MAUS and EMU-webApp.
</p>

### Website

You can use OH-Portal without installation here: https://www.phonetik.uni-muenchen.de/apps/oh-portal/

### Installation

You can install OH-Portal on your own web server. Just download the repository and copy the contents from the `dist` folder to your web server.

## Development

### Installation

Clone this repository and install all dependencies using `npm install`. It is recommended to use WebStorm or PHPStorm IDE and the tslint settings from `tslint.json` in order to check the code style automatically.

For this project <a href="https://github.com/commitizen/cz-cli">commitizen</a> is used. If you want to contribute to this project you should make use of this tool to create commit messages important for the changelog (other commit messages will be ignored otherwise). For WebStorm or PHPStorm there is a <a href="https://plugins.jetbrains.com/plugin/9861-git-commit-template">Commit Template Plugin</a> to create this templates.

### Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The app will automatically reload if you change any of the source files.

### Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory. Use the `-prod` flag for a production build.
