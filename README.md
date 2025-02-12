<h1 align="center">TranscriptionPortal</h1>
<p>
  A portal that offers a transcription chain for multi upload and processing of audio files using ASR and tools like OCTRA (orthographic transcription), MAUS (word alignment) and EMU-webApp (phonetic details). 
</p>
<p align="center">
  <img style="border:1px solid gray;" src="https://github.com/IPS-LMU/transcription-portal/raw/master/screenshots/transcription-portal01.png">
  <img style="border:1px solid gray;" src="https://github.com/IPS-LMU/transcription-portal/raw/master/screenshots/transcription-portal02.png" alt="TranscriptionPortal OCTRA">
  <img style="border:1px solid gray;" src="https://github.com/IPS-LMU/transcription-portal/raw/master/screenshots/transcription-portal03.png" alt="TranscriptionPortal EMU-webApp">
</p>
<p align="center">
Implementation of a transcription chain that supports ASR, OCTRA, MAUS and EMU-webApp.
</p>

### Website

You can use TranscriptionPortal without installation here: https://clarin.phonetik.uni-muenchen.de/apps/TranscriptionPortal/
(protected by shibboleth)

### Installation

You can install TranscriptionPortal on your own web server. Just download the repository and copy the contents from the `dist` folder to your web server.

## Development

### Installation

Clone this repository and install all dependencies using `npm install`. It is recommended to use WebStorm or PHPStorm IDE and the tslint settings from `tslint.json` in order to check the code style automatically.

### Contribution

For this project <a href="https://github.com/commitizen/cz-cli">commitizen</a> is used. If you want to contribute to this project you should make use of this tool to create commit messages important for the changelog (other commit messages will be ignored otherwise). For WebStorm or PHPStorm there is a <a href="https://plugins.jetbrains.com/plugin/9861-git-commit-template">Commit Template Plugin</a> to create these templates.

For creating changelog automatically, <a href="https://github.com/conventional-changelog/conventional-changelog/tree/master/packages/conventional-changelog-cli">conventional-changelog-cli</a> is used. To create changelogs you need to install conventional-changelog-cli globally as described on its github page. After installation you just need to run `npm run changelog` to create the changelog automatically.

### Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The app will automatically reload if you change any of the source files.

### Build

Run `sh ./build.sh` to build the project. The build artifacts will be stored in the `dist/transcription-portal` directory. Adapt the configuration in the build.sh script as you need.
