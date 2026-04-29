<h1 style="text-align: center">TranscriptionPortal v2.x</h1>
<p>
  The TranscriptionPortal is a web-application for processing audio files using automatic and manual tools combined in one workflow ("transcription chain"). Users can select the desired mode: "Annotation" or "Translation & Summarization" for specific workflows. In Annotation mode they are able to process their audio files using ASR, Manual Transcription (Octra), Word Alignment and Phonetic Detail (Emu WebApp). If users prefer to automatically summarize and translate transcripts using AI they are able to use the "Summarization an Translation" mode.
</p>
<p style="text-align: center;">
  <img style="border:1px solid gray;" src="https://github.com/IPS-LMU/transcription-portal/raw/master/screenshots/tportal_01.png" alt="TranscriptionPortal Annotation Mode">
  <img style="border:1px solid gray;" src="https://github.com/IPS-LMU/transcription-portal/raw/master/screenshots/tportal_02.png" alt="TranscriptionPortal OCTRA">
  <img style="border:1px solid gray;" src="https://github.com/IPS-LMU/transcription-portal/raw/master/screenshots/tportal_03.png" alt="TranscriptionPortal EMU-webApp">
  <img style="border:1px solid gray;" src="https://github.com/IPS-LMU/transcription-portal/raw/master/screenshots/tportal_04.png" alt="TranscriptionPortal Summarization & Translation Mode">
</p>

### Website

You can use TranscriptionPortal without installation here: https://clarin.phonetik.uni-muenchen.de/TranscriptionPortal/

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
