# Changelog

This file was generated using [@jscutlery/semver](https://github.com/jscutlery/semver).

# [2.0.0](https://github.com/IPS-LMU/transcription-portal/compare/transcription-portal-1.1.0...transcription-portal-2.0.0) (2026-04-29)


### Bug Fixes

* **tportal:** downloading columns not working ([92ee2fc](https://github.com/IPS-LMU/transcription-portal/commit/92ee2fcf5038386d02bc9d9b34283da578810ee6))
* **tportal:** file preview shows text output in one line ([18d7607](https://github.com/IPS-LMU/transcription-portal/commit/18d7607b0740ca659b1ac40f008d06344e5488ad))
* **tportal:** items on navbar not properly positioned on small displays ([56cf052](https://github.com/IPS-LMU/transcription-portal/commit/56cf052492ed5301801165d447a756e8c0678316))
* **tportal:** on smaller displays column names overlaps ([46f5007](https://github.com/IPS-LMU/transcription-portal/commit/46f50079a1073c20f89021c3e2d1d12bafdc8848))
* **transcription-portal:** access code for ASR not working ([1b527f4](https://github.com/IPS-LMU/transcription-portal/commit/1b527f4dac3b0dd8bff1ee7942ab384799f2f81a))
* **transcription-portal:** add fix for operations with empty rounds ([4c2a171](https://github.com/IPS-LMU/transcription-portal/commit/4c2a17177530bfca7780f475d22b0f3414ccf895))
* **transcription-portal:** adding a combination of audio file and transcript doesn't work as intended ([a36b8dd](https://github.com/IPS-LMU/transcription-portal/commit/a36b8ddb50fb29416e2524d004538577db4cac8c))
* **transcription-portal:** asr LST doesn't work if diarization disabled ([f02c117](https://github.com/IPS-LMU/transcription-portal/commit/f02c1177835a2f04874fad42fe79ba3bce4480e1))
* **transcription-portal:** asr provider set with summarization provider ([9a4bd39](https://github.com/IPS-LMU/transcription-portal/commit/9a4bd39693390eb64a77c53bb7f4704993e4a0a9))
* **transcription-portal:** can't re-add same file via button ([2f793c4](https://github.com/IPS-LMU/transcription-portal/commit/2f793c4e89c78d6d93b7b62b2d8aed896d26bc6a)), closes [#90](https://github.com/IPS-LMU/transcription-portal/issues/90)
* **transcription-portal:** clicking on the failed operation circled arrow works only on the second try ([734cee8](https://github.com/IPS-LMU/transcription-portal/commit/734cee8fb34a3fd0183353fa92502efca8e8b327))
* **transcription-portal:** cmd + a not working properly ([d98d51a](https://github.com/IPS-LMU/transcription-portal/commit/d98d51aa2ac586ef2168710b12a42badf0dfba53))
* **transcription-portal:** compatibility check not working on reloading test page ([91f5804](https://github.com/IPS-LMU/transcription-portal/commit/91f5804c99decf0b49fbbb9fd7f112440e1899a4))
* **transcription-portal:** console not logged on dev mode ([4b6b352](https://github.com/IPS-LMU/transcription-portal/commit/4b6b352b12e547091a0e81e0316170ef054d3711))
* **transcription-portal:** downloading results per line or column not workiing ([7990249](https://github.com/IPS-LMU/transcription-portal/commit/7990249d3c1ef5cc5f37e62ba4afa6bb3d2ab597))
* **transcription-portal:** dragndrop overwrites status of queued tasks ([70dde9a](https://github.com/IPS-LMU/transcription-portal/commit/70dde9a30421323e4a130eb220be557a783b958c))
* **transcription-portal:** duplicates on browser compatibility page ([21a961e](https://github.com/IPS-LMU/transcription-portal/commit/21a961e8395a72148011cee17b145ed56f5e3545))
* **transcription-portal:** emu web app uses wrong transcript url on second edit ([c8bb631](https://github.com/IPS-LMU/transcription-portal/commit/c8bb6313ffbd97715ce870b7806d4b72770bdb51))
* **transcription-portal:** file blob of a transcript file is undefined in upload operation ([46efab6](https://github.com/IPS-LMU/transcription-portal/commit/46efab69a97c54d4fe3a13e211fbf4daa2ce8f8b))
* **transcription-portal:** going back from Octra to table view starts next task unintentionally ([9855fdf](https://github.com/IPS-LMU/transcription-portal/commit/9855fdfa094a4818fa01c51f78f409f9f5b03cf7))
* **transcription-portal:** GoogleASR doesn't return valid result on diarization false ([3ad1c9b](https://github.com/IPS-LMU/transcription-portal/commit/3ad1c9b3a275bc3145d1818bee6166a57e3df881))
* **transcription-portal:** invalid information retrieved for summarization service ([bfb6d6b](https://github.com/IPS-LMU/transcription-portal/commit/bfb6d6b080293ae952e556e6eaaacf3b49c18e4b))
* **transcription-portal:** make "disabled" a separate attribute to prevent resetting status after enabling tasks ([5d73a2c](https://github.com/IPS-LMU/transcription-portal/commit/5d73a2c9cd3a904c45cb9a55d96561fc48fe7acf))
* **transcription-portal:** migration to new indexed DB version fails if directories exist ([dd7e7fd](https://github.com/IPS-LMU/transcription-portal/commit/dd7e7fd660e1d96ee23cfc386b201230ee4110c5))
* **transcription-portal:** octra closed on any change ([8818361](https://github.com/IPS-LMU/transcription-portal/commit/88183611eb0a7eb834c4ca8feefe9d9f452a4f74))
* **transcription-portal:** opening tool with unavailable transcript url doesn't work ([9e8896f](https://github.com/IPS-LMU/transcription-portal/commit/9e8896f570e331c2a8d069d59b6a4abf157e7140))
* **transcription-portal:** operation popover shows wrong revision number ([7dd2474](https://github.com/IPS-LMU/transcription-portal/commit/7dd2474ee9de71e7bfc11a82c021aa631b00fbb8))
* **transcription-portal:** operations not started because lastRound is undefined ([c9a4253](https://github.com/IPS-LMU/transcription-portal/commit/c9a425348f976bd40646f2949cf50b02885d936d))
* **transcription-portal:** orange file name in queue modal on dropped file ([0031b25](https://github.com/IPS-LMU/transcription-portal/commit/0031b2575d6f3cdf46aa778e23d7cf758df2b2ec))
* **transcription-portal:** processing with ASR and Summarization fails on production ([b9e6e16](https://github.com/IPS-LMU/transcription-portal/commit/b9e6e16887e55971236ad71949f02f8ac174c9e3))
* **transcription-portal:** pwa configuration doesn't work ([b1caac2](https://github.com/IPS-LMU/transcription-portal/commit/b1caac2eeec2ce441b1f39f3156c50b305c4d924))
* **transcription-portal:** re-adding split files doesn't work ([1683220](https://github.com/IPS-LMU/transcription-portal/commit/168322062b39240f7ddfd14450f06e3fd2aef854)), closes [#92](https://github.com/IPS-LMU/transcription-portal/issues/92)
* **transcription-portal:** reset operation not working ([5da9714](https://github.com/IPS-LMU/transcription-portal/commit/5da9714e563e8bbcc60b1ead084ac1ca376aa516))
* **transcription-portal:** results popover doesn't show protocol for errors warnings ([64021c7](https://github.com/IPS-LMU/transcription-portal/commit/64021c78e6f26a6a4c416d0fa7debd0f6a1049a1))
* **transcription-portal:** set ngsw-bypass header only on production ([8a2ef3f](https://github.com/IPS-LMU/transcription-portal/commit/8a2ef3f372a51b0ceb6da283f2f187956546aebe))
* **transcription-portal:** statistics not loading ([32c5b9b](https://github.com/IPS-LMU/transcription-portal/commit/32c5b9bc2ffc182acdedb7c6e711f53f62e51f3a))
* **transcription-portal:** stopping process doesn't work ([4b28328](https://github.com/IPS-LMU/transcription-portal/commit/4b28328d5a9418b6467946cbec14983efd448a16))
* **transcription-portal:** task IDs are not calculated properly ([15fc616](https://github.com/IPS-LMU/transcription-portal/commit/15fc616f25a82cafdf428016d35db06693fa6a31))
* **transcription-portal:** tasks not marked as finished on last op complete ([c88f761](https://github.com/IPS-LMU/transcription-portal/commit/c88f7614031579a292cd2e9782f73c0a83f7f130))
* **transcription-portal:** tasks with status processing or uploading are not going to be reset on reload ([7b2a763](https://github.com/IPS-LMU/transcription-portal/commit/7b2a763ae5820ea3ddeb985e5a12b36e3787b92c))
* **transcription-portal:** time recordings not saved to IDB ([773a833](https://github.com/IPS-LMU/transcription-portal/commit/773a833b1516ee26dbdc05e1f6056ef69915846b))
* **transcription-portal:** Tool reloaded on other operation change ([a9505b3](https://github.com/IPS-LMU/transcription-portal/commit/a9505b3b71e2bf74950db240ae49681782c792b2))
* **transcription-portal:** Tportal can't load i18n file on production ([eb3853f](https://github.com/IPS-LMU/transcription-portal/commit/eb3853fa53d2e5023b0db4999af4b1314f9016d6))
* **transcription-portal:** TPortal does process more than 3 tasks at once ([a9f6321](https://github.com/IPS-LMU/transcription-portal/commit/a9f63210daf369d8276806bd239f0f8acc097239))
* **transcription-portal:** tportal shows no ETA on upload ([8cd448e](https://github.com/IPS-LMU/transcription-portal/commit/8cd448e107cfe8d9b425a8560e2d81ca8c0e8497))
* **transcription-portal:** tportal tries to upload non-existing files ([5e8ca88](https://github.com/IPS-LMU/transcription-portal/commit/5e8ca885168fa08b692206193bdd288c50698d7b))
* **transcription-portal:** TranscriptionPortal-Dev uses wrong IndexedDB database ([ec331d8](https://github.com/IPS-LMU/transcription-portal/commit/ec331d83697f5487a71d2d0b9b162f124102ae76))
* **transcription-portal:** translation operation doesn't use correct language ([10e9b57](https://github.com/IPS-LMU/transcription-portal/commit/10e9b5746ae9b9f7cba03fcf7a3c67f527a91a32))
* **transcription-portal:** translation operation is not labeled as failed on error ([24f589c](https://github.com/IPS-LMU/transcription-portal/commit/24f589c9edc076589ea1690deee44aed56405c4d))
* **transcription-portal:** translation operation not working if transcript needed from task inputs ([1a114ba](https://github.com/IPS-LMU/transcription-portal/commit/1a114ba60f02c762e9ee75434732384578b92e8c))
* **transcription-portal:** translation operation uses "en" if summarization enabled ([3f7e2b5](https://github.com/IPS-LMU/transcription-portal/commit/3f7e2b50e12258c2d2e733837c56387830603deb))


### Features

* **tportal:** new mode: summarization and translation ([18b9695](https://github.com/IPS-LMU/transcription-portal/commit/18b96955ed2c14391ce9f4bb4d17ef9cf7a3a2b6))
* **tportal:** support for installation as Chrome PWA app ([f82e541](https://github.com/IPS-LMU/transcription-portal/commit/f82e541bbc7a770830db3e2a296ecaaa7d670cd3))
* **tportal:** use custom snackbar to prevent verbose outputs ([8fbfc88](https://github.com/IPS-LMU/transcription-portal/commit/8fbfc883fed6fe18cd8127215e384c27693cf5ed))
* **transcription-portal:** access modes via url ([bf06fe4](https://github.com/IPS-LMU/transcription-portal/commit/bf06fe4c0fc56427f3752ef6ee45079f5440b075))
* **transcription-portal:** add about modal ([ca15c31](https://github.com/IPS-LMU/transcription-portal/commit/ca15c312e3b9269ed316f0001adfc13103a3f046))
* **transcription-portal:** add modal for hotkeys ([377f559](https://github.com/IPS-LMU/transcription-portal/commit/377f559b32d079900ba3c1098f1d7ff9b32b0e22))
* **transcription-portal:** add translation to the list of services in config.json, add info to options ([a3f8cdd](https://github.com/IPS-LMU/transcription-portal/commit/a3f8cdd50d56c9c149fa9a7926c2ea8dffa4320a))
* **transcription-portal:** ask for confirmation before clearing data ([ffa2866](https://github.com/IPS-LMU/transcription-portal/commit/ffa2866d06fd6f2e06139533ada7161218799caf))
* **transcription-portal:** backup & restore indexedDB database ([e130b95](https://github.com/IPS-LMU/transcription-portal/commit/e130b953846a8cfd8d73e9169db47d5432dfd5d4))
* **transcription-portal:** big refactoring to ngrx ([56921f0](https://github.com/IPS-LMU/transcription-portal/commit/56921f0593050b54fe0a17a29d82edc843d45bf7))
* **transcription-portal:** check settings dialogue now with button for options reset ([c0ba281](https://github.com/IPS-LMU/transcription-portal/commit/c0ba281641374657194bc316ebf6b941facd8253))
* **transcription-portal:** descriptive labels for each feature on navbar ([e04ad18](https://github.com/IPS-LMU/transcription-portal/commit/e04ad187d237d639d7be4f7c8c30b878e1f4056c))
* **transcription-portal:** disable tasks using the context menu to prevent/stop processing ([485ed57](https://github.com/IPS-LMU/transcription-portal/commit/485ed573ae4cb763bfa89502dc81946dd94c97bd))
* **transcription-portal:** hovering over red cross allows user to repeat failed operation ([b7365ce](https://github.com/IPS-LMU/transcription-portal/commit/b7365ce9efed7a2485f6107d8410c4e9a39f1443))
* **transcription-portal:** improved audio player for file preview ([5d8c79c](https://github.com/IPS-LMU/transcription-portal/commit/5d8c79c729b47615ab7eb47a704e2165e1efbd2f))
* **transcription-portal:** improved feedback modal ([d5a2814](https://github.com/IPS-LMU/transcription-portal/commit/d5a281439d9e5065b7b4d2f23920ba210ef9147c))
* **transcription-portal:** improved options validation ([275905f](https://github.com/IPS-LMU/transcription-portal/commit/275905f342c1bdf27bd51b4aa642eb67b46750d5))
* **transcription-portal:** improved popover with better UI ([8bc1bdb](https://github.com/IPS-LMU/transcription-portal/commit/8bc1bdbdd0c944c48f252aff26a908db790d1ac3))
* **transcription-portal:** in-place update notification for users ([aba5482](https://github.com/IPS-LMU/transcription-portal/commit/aba5482e4377fc9c5080556d70d31f26a6f84f56))
* **transcription-portal:** increase standard font size ([7bd9397](https://github.com/IPS-LMU/transcription-portal/commit/7bd939716fd9757f606d5803d37bbd4361c31908))
* **transcription-portal:** list of supported languages are filtered by provider automatically ([9047f8e](https://github.com/IPS-LMU/transcription-portal/commit/9047f8e53e9ca707d421782abe7474338de9828b))
* **transcription-portal:** on disabled desktop notifications show alerts instead ([c9bec6e](https://github.com/IPS-LMU/transcription-portal/commit/c9bec6edb03074b24edbab3782c6b04cb5fc7833))
* **transcription-portal:** pastell colors for each mode ([f5e58fd](https://github.com/IPS-LMU/transcription-portal/commit/f5e58fd8365c479c7eb91366f204da4b29f35939))
* **transcription-portal:** ProceedingRounds for better results management for each run ([#91](https://github.com/IPS-LMU/transcription-portal/issues/91)) ([038861c](https://github.com/IPS-LMU/transcription-portal/commit/038861c0d6dd9017f8f8cf0edbb2321353d111c3)), closes [#86](https://github.com/IPS-LMU/transcription-portal/issues/86)
* **transcription-portal:** replace user guide for v1.0.0 with v2.0.0 ([dbe4f7f](https://github.com/IPS-LMU/transcription-portal/commit/dbe4f7f9a07a32474296e0d3aee0784a41f30d7f))
* **transcription-portal:** show warning when files were ignored on add ([09455df](https://github.com/IPS-LMU/transcription-portal/commit/09455dfbaeb7dab1debcef50f4d1277da891ec69))
* **transcription-portal:** support for diarization in annotation mode ([8768a9c](https://github.com/IPS-LMU/transcription-portal/commit/8768a9c253b6abc8999d2822a159884ed8f03f53))
* **transcription-portal:** support for i18n GUI translations ([9ffc865](https://github.com/IPS-LMU/transcription-portal/commit/9ffc8656c8992d51a89e14f60a6d8ad29d384a4f))
* **transcription-portal:** support for LST ASR Service (WhisperX) ([6f4c964](https://github.com/IPS-LMU/transcription-portal/commit/6f4c964ce706cac89ad3a2a4c16ffc10107d3a6a))
* **transcription-portal:** support for more audio files: flac, ogg, mp3, m4a ([79068bb](https://github.com/IPS-LMU/transcription-portal/commit/79068bb1ed57a37d67697ed1f1d1ef7f8248dbc4))
* **transcription-portal:** support for new emu-webapp application ([b3550bc](https://github.com/IPS-LMU/transcription-portal/commit/b3550bc9674decb14ee4009809c8308f09e6a61f))
* **transcription-portal:** support for summarization word limit ([63a4cd3](https://github.com/IPS-LMU/transcription-portal/commit/63a4cd387d61c3390bfe07a3584860ac16981a75))
* **transcription-portal:** switch order summarization <-> translation ([34280cc](https://github.com/IPS-LMU/transcription-portal/commit/34280cc88f8593284826611803abe90cfa7a0fee))
* **transcription-portal:** use hotkeys-js for handling hotkeys ([8bc7a72](https://github.com/IPS-LMU/transcription-portal/commit/8bc7a722a13a14bc9a1d79115100681147bcb4be))


### Performance Improvements

* **transcription-portal:** remove jQuery ([f7fff9d](https://github.com/IPS-LMU/transcription-portal/commit/f7fff9d521421d64ddaeaccb5b8cce5688334c4d))



# [1.1.0](https://github.com/IPS-LMU/transcription-portal/compare/transcription-portal-1.0.9...transcription-portal-1.1.0) (2025-02-12)

### Bug Fixes

- **tportal:** adding transcripts to the table not working ([14eb2af](https://github.com/IPS-LMU/transcription-portal/commit/14eb2af68a75be6419dcf34c92dcc02a8e7dda77))
- **tportal:** can't add folders ([487d10c](https://github.com/IPS-LMU/transcription-portal/commit/487d10c6d149cc77724de7e1bbfb8e0dfd21a46e))
- **tportal:** can't read file name from URL params if no extension exists ([b245a14](https://github.com/IPS-LMU/transcription-portal/commit/b245a140348ac7634e0183ccf3eee75e0050e2c6))
- **tportal:** downloading task chain not working ([d79615c](https://github.com/IPS-LMU/transcription-portal/commit/d79615cdf04c1506aec415fca7ab3d98da576a80)), closes [#42](https://github.com/IPS-LMU/transcription-portal/issues/42)
- **tportal:** fix isue with idb and queue modal ([1252542](https://github.com/IPS-LMU/transcription-portal/commit/125254203487b33bfbf7ce3c6d044e15feb0583a))
- **tportal:** hotkeys for table triggered on feedback and statistics modals ([c6f9acc](https://github.com/IPS-LMU/transcription-portal/commit/c6f9accbeca415a6bcf807017a147f0bc0db6c50))
- **tportal:** only one channel extracted on splitting audio files ([ec7bc68](https://github.com/IPS-LMU/transcription-portal/commit/ec7bc686cddb631099dc25bc6fb15fd97f9cb691))
- **tportal:** query parameters are not preserved ([1f01be6](https://github.com/IPS-LMU/transcription-portal/commit/1f01be61ca9b3e7221fef0a7e8b3870c08215d11))
- **tportal:** results table immediately closes on version click ([f87ad2a](https://github.com/IPS-LMU/transcription-portal/commit/f87ad2a4fe35388eee0fe7444609f4a955ac1bf5))
- **tportal:** rows are not highlighted on selection ([8aea11c](https://github.com/IPS-LMU/transcription-portal/commit/8aea11cfe022a1b537f35f340e63aef7017c9571))
- **tportal:** statistics pie chart not working ([1b7a234](https://github.com/IPS-LMU/transcription-portal/commit/1b7a2344038e94ebb1b450b6bf05315569eb589b))
- **tportal:** wrong naming for downloaded files ([c4e295f](https://github.com/IPS-LMU/transcription-portal/commit/c4e295f7203fa3b7ba7b1d7486fe6c9933bd279f))

### Features

- **tportal:** all languages from BAS webservices are available ([e252c22](https://github.com/IPS-LMU/transcription-portal/commit/e252c22dadc96482ee3545c55f23ccdc74b32def))
- **tportal:** import audio and transcript file from url params ([2fb8133](https://github.com/IPS-LMU/transcription-portal/commit/2fb81337c9406787dd08574c746324481b84ca9e))
- **tportal:** improved UX for results view in popover ([c25b835](https://github.com/IPS-LMU/transcription-portal/commit/c25b8350742d55dc13a701030a4d0c2e5f968835))
- **tportal:** include feedback modal from octra/ngx-components ([74093fb](https://github.com/IPS-LMU/transcription-portal/commit/74093fbcff5722c4d7819cc715770e6b8d64a39c))
- **tportal:** preview audio file using html audio player ([8225127](https://github.com/IPS-LMU/transcription-portal/commit/822512769eb9c2a8eb6690b2da56d4aeab52d25b))
- **tportal:** read additional URL query parameters ([793759e](https://github.com/IPS-LMU/transcription-portal/commit/793759e55ee7c789cc8615e49a4555fc8583efe7))
- **tportal:** replace old idb code with dexie.js ([2232fcf](https://github.com/IPS-LMU/transcription-portal/commit/2232fcf330345d5c4cdfe868a43ef02d9ac00c23))
- **tportal:** show loading spinner while loading settings ([9c6c0b8](https://github.com/IPS-LMU/transcription-portal/commit/9c6c0b87c0e11dce220ee4c786b0a161fa879eda))
- **tportal:** upgrade octra to v2 ([a6ec3be](https://github.com/IPS-LMU/transcription-portal/commit/a6ec3bef2ca93daf9d6d706c45a6150953b00fb8))
- **tportal:** use code editor for file previews ([8761127](https://github.com/IPS-LMU/transcription-portal/commit/8761127ff1a7982a80f3d613a9a06daeebb0a9e8))

### Performance Improvements

- **tportal:** revoke object url if not needed ([29cd04a](https://github.com/IPS-LMU/transcription-portal/commit/29cd04ac38ec0f43e0508e0ee8873fdfc0e9984d)), closes [#42](https://github.com/IPS-LMU/transcription-portal/issues/42)

## [1.0.9](https://github.com/IPS-LMU/transcription-portal/compare/v1.0.8...v1.0.9) (2024-06-14)

### Bug Fixes

- **download-modal:** fixed incorrect base names in zip archive ([c651ca8](https://github.com/IPS-LMU/transcription-portal/commit/c651ca86d4364366db932b822c733b614416b5e3))
- **table:** cogs appear on pending operations ([1aaf7dd](https://github.com/IPS-LMU/transcription-portal/commit/1aaf7dd116ec4b5d933d2025eb29c9575668185e))
- **table:** context menu does not appear correctly ([6de7a0b](https://github.com/IPS-LMU/transcription-portal/commit/6de7a0ba7a2900eb31e2ee848eeea5e627653081))
- **tools:** audio playback does not stop when leaving tool ([a97b990](https://github.com/IPS-LMU/transcription-portal/commit/a97b99015c3be2df6bcd26bfad6131ea77ffa31c))
- **tools:** EMUWebApp doesn't read TextGrid file ([e8c4ff6](https://github.com/IPS-LMU/transcription-portal/commit/e8c4ff6ba8c36974a1f60bfac47f11bdfd3ba67d))
- **tportal:** fix several issues from migration ([8028f41](https://github.com/IPS-LMU/transcription-portal/commit/8028f410fefc33f2b976e818444e481a2d15d2ac))

### Features

- **download-modal:** show remove lines button only if something downloaded ([ca37004](https://github.com/IPS-LMU/transcription-portal/commit/ca37004d4ae428434ae6963df0105e02e8e9c5fb))
- **table:** file names are truncated ([20cf3e3](https://github.com/IPS-LMU/transcription-portal/commit/20cf3e3c8befe32072ab5658a8cde714a4e35147))
- **tportal:** add WhisperX to the list of supported ASR providers ([3c09908](https://github.com/IPS-LMU/transcription-portal/commit/3c09908e2b31a8929b0b596fb12092d4030544c3))

## [1.0.8](https://github.com/IPS-LMU/transcription-portal/compare/v1.0.7...v1.0.8) (2022-12-08)

### Bug Fixes

- **asr:** fixed quota progress bars ([b7b67bf](https://github.com/IPS-LMU/transcription-portal/commit/b7b67bf46775ca1fbebb5aa5a66df8037211469f))
- **preprocessing:** pairs of audio and transcript are not combined to tasks correctly ([5bd6825](https://github.com/IPS-LMU/transcription-portal/commit/5bd68253f7ec66f46ef1ffc5ce7f4b8e6094d227))
- **preprocessing:** splitting audio files into channels doesn't work correctly ([38cef0a](https://github.com/IPS-LMU/transcription-portal/commit/38cef0a8825236a48a2953a1c4e60261323e5b67))
- **proceedings:** missing audio information in file info popover ([5113d2b](https://github.com/IPS-LMU/transcription-portal/commit/5113d2b96f601fb00377d6a34517a69c6aa5237f))
- **processing:** several wrong naming issues ([cf9306d](https://github.com/IPS-LMU/transcription-portal/commit/cf9306dcedec70d00190ef4d3f844dada8e1fbef))

## [1.0.7](https://github.com/IPS-LMU/transcription-portal/compare/v1.0.6...v1.0.7) (2022-02-09)

### Bug Fixes

- **results:** fixed problem with retrieving results ([f41b430](https://github.com/IPS-LMU/transcription-portal/commit/f41b43077f7bbc5b66e89eb63508aadfb498bc24))

### Features

- **proceedings:** format timestamps to local ones ([4152f10](https://github.com/IPS-LMU/transcription-portal/commit/4152f10e288c1dc55563a714df90eb32090a1960)), closes [#55](https://github.com/IPS-LMU/transcription-portal/issues/55)
- **queue-modal:** added information about remaining quota ([9862529](https://github.com/IPS-LMU/transcription-portal/commit/9862529673839d5d3a89693b56ca7a6d8299bc80))

## [1.0.6](https://github.com/IPS-LMU/transcription-portal/compare/v1.0.5...v1.0.6) (2021-03-16)

### Bug Fixes

- **verify:** verify button disabled after restart with queued files ([9b252f6](https://github.com/IPS-LMU/transcription-portal/commit/9b252f67db8b2e139f8a203e7038b84545a94375))

### Features

- **general:** hide access code in logs and in settings ([d6130a8](https://github.com/IPS-LMU/transcription-portal/commit/d6130a8902a4a2d48ce961b4cada0f55b6808ab4)), closes [#58](https://github.com/IPS-LMU/transcription-portal/issues/58)
- **general:** renamed OH-Portal to TranscriptionPortal ([3c65fce](https://github.com/IPS-LMU/transcription-portal/commit/3c65fce837989438b7c414daad5836b0bff8db5e))
- **verify-step:** portal checks audio file if it fits the ASR provider's requirements automatically ([9bed9a1](https://github.com/IPS-LMU/transcription-portal/commit/9bed9a1e3b417f01dfda2b05c83d5e7a9e144eba)), closes [#46](https://github.com/IPS-LMU/transcription-portal/issues/46)

## [1.0.5](https://github.com/IPS-LMU/oh-portal/compare/v1.0.4...v1.0.5) (2021-02-15)

### Bug Fixes

- **downloads:** fixed download by line bug and improved generation of downloads ([39c9a1d](https://github.com/IPS-LMU/oh-portal/commit/39c9a1d85144506c979236a6888fa9f2671ad4a7)), closes [#56](https://github.com/IPS-LMU/oh-portal/issues/56)
- **emu-webApp:** fixed issue that transcript is not loaded in EMU webApp, fixed retrieving its result ([d038f38](https://github.com/IPS-LMU/oh-portal/commit/d038f38e73486ef4a9f20155eea15b2c903ba8b6))
- **operations:** fixed status behaviour of operations ([5a73bf0](https://github.com/IPS-LMU/oh-portal/commit/5a73bf0a2d80bb94fa4e9c8ed4b438d3fba62e6e))
- **preprocessing:** fixed issue that audio split into channels is not working ([a015e0b](https://github.com/IPS-LMU/oh-portal/commit/a015e0b7a667ccbefb164e4f4640424b36e50a0e))

### Features

- **download-modal:** close modal after selected lines were removed ([ebc6e85](https://github.com/IPS-LMU/oh-portal/commit/ebc6e85a0bfef98ffb540b394332ac264dd02e3d))
- **maintenance:** added maintenance snackbar ([8cbab8e](https://github.com/IPS-LMU/oh-portal/commit/8cbab8e3eb6a3408f1aaad90febd14e4957d36ee))

## [1.0.4](https://github.com/IPS-LMU/oh-portal/compare/v1.0.2...v1.0.4) (2020-11-09)

### Bug Fixes

- **results-table:** fixed duplicated rows ([3a54235](https://github.com/IPS-LMU/oh-portal/commit/3a54235cc7108db61ce035562df7f3c738bd5a1f))

### Features

- **access code:** added option to set an access code to increase quota ([68b9084](https://github.com/IPS-LMU/oh-portal/commit/68b9084dfadfee726523da25d0badb640b3dad41))
- **columns:** added export column ([94c2d7e](https://github.com/IPS-LMU/oh-portal/commit/94c2d7ec288b2037fa46faabea6c3e937357a4b7))
- **compatibility:** added background compatibility check ([6399259](https://github.com/IPS-LMU/oh-portal/commit/6399259da1f156bbc4add7ca97cd0d8dfc98ea97)), closes [#43](https://github.com/IPS-LMU/oh-portal/issues/43)
- **EMU-webApp:** results are now retrieved by the EMU-webApp ([b8726c8](https://github.com/IPS-LMU/oh-portal/commit/b8726c877f831f9c7ef5ed931edf16b293958a0b))
- **export:** changed folder names for each step ([ad02426](https://github.com/IPS-LMU/oh-portal/commit/ad024267d4ee3fe1dbb49bd2454dab8444b6cc21))
- **feedback:** improved feedback modal the same way as OCTRA ([e439332](https://github.com/IPS-LMU/oh-portal/commit/e439332dec2912e55caa57eb9f859e0f3b78951a))
- **operations:** show information of service provider while processing ASR. ([2d00107](https://github.com/IPS-LMU/oh-portal/commit/2d00107a872311199bef1d385040a6d48cb6254d))
- **popover:** simplified and beautified error messages and warnings ([7ac41bc](https://github.com/IPS-LMU/oh-portal/commit/7ac41bcbd98a646f32aab20efc3041cf3f8ca385)), closes [#44](https://github.com/IPS-LMU/oh-portal/issues/44)
- **queue:** show further information about the service providers ([e185a63](https://github.com/IPS-LMU/oh-portal/commit/e185a63f8030defbe7ee5892092a1cbdf32a6a06))
- **results:** added conversions to WebVTT and SRT ([36eede9](https://github.com/IPS-LMU/oh-portal/commit/36eede945510e11318a11cfa973b9a43f06a2357))
- **tracking:** added option for tracking via Matomo ([d8566be](https://github.com/IPS-LMU/oh-portal/commit/d8566be4348dbef93f7bcf0b934f089092d56066))

## [1.0.2](https://github.com/IPS-LMU/oh-portal/compare/v1.0.1...v1.0.2) (2019-06-22)

### Features

- **Popover:** option to paste the error message to the clipboard

### Bug Fixes

- **ASR:** fixed failing ASR
- **Popover:** counter didn't stop on error

## [1.0.1](https://github.com/IPS-LMU/oh-portal/compare/v1.0.0...v1.0.1) (2019-01-25)

### Bug Fixes

- **http-requests:** fixed problem with http-caching ([3f1b050](https://github.com/IPS-LMU/oh-portal/commit/3f1b050))
- **popovers:** fixed problems with positioning and fadein/fadeout ([c34bd08](https://github.com/IPS-LMU/oh-portal/commit/c34bd08))

<a name="1.0.0"></a>

# 1.0.0 (2018-09-21)

### Features

- **download:** download archives from results and conversions ([4ff2295](https://github.com/IPS-LMU/oh-portal/commit/4ff2295)), closes [#5](https://github.com/IPS-LMU/oh-portal/issues/5) [#30](https://github.com/IPS-LMU/oh-portal/issues/30)
- show offline icons ([f5e83ff](https://github.com/IPS-LMU/oh-portal/commit/f5e83ff))
- **context-menu:** remove selected appendings ([dfe77b3](https://github.com/IPS-LMU/oh-portal/commit/dfe77b3)), closes [#1](https://github.com/IPS-LMU/oh-portal/issues/1)
- **file-collection:** transcript files can be added four processing ([a4d7d96](https://github.com/IPS-LMU/oh-portal/commit/a4d7d96))
- **files:** file preview for transcripts ([6d271d1](https://github.com/IPS-LMU/oh-portal/commit/6d271d1)), closes [#16](https://github.com/IPS-LMU/oh-portal/issues/16)
- **folders:** open/close folders ([da72f94](https://github.com/IPS-LMU/oh-portal/commit/da72f94)), closes [#22](https://github.com/IPS-LMU/oh-portal/issues/22)
- **settings:** option to remove all data ([16fa888](https://github.com/IPS-LMU/oh-portal/commit/16fa888))
- **shortcuts:** added shortcuts for pc and mac ([4c45b38](https://github.com/IPS-LMU/oh-portal/commit/4c45b38)), closes [#33](https://github.com/IPS-LMU/oh-portal/issues/33)
- **sidebar:** default sidebar width can be changed by the user ([a38c241](https://github.com/IPS-LMU/oh-portal/commit/a38c241)), closes [#32](https://github.com/IPS-LMU/oh-portal/issues/32)
- **sidebar:** resizeable sidebar ([1e300be](https://github.com/IPS-LMU/oh-portal/commit/1e300be)), closes [#11](https://github.com/IPS-LMU/oh-portal/issues/11) [#9](https://github.com/IPS-LMU/oh-portal/issues/9)
- **transcripts:** Save transcripts to Browser's storage (IndexedDB) ([08cdadc](https://github.com/IPS-LMU/oh-portal/commit/08cdadc)), closes [#6](https://github.com/IPS-LMU/oh-portal/issues/6)
- **workflow:** MAUS and EMU-webApp can be skipped ([dca41ef](https://github.com/IPS-LMU/oh-portal/commit/dca41ef)), closes [#4](https://github.com/IPS-LMU/oh-portal/issues/4)
- **workflow:** new workflow: Add -> Verfiy -> Start/Stop ([939ce46](https://github.com/IPS-LMU/oh-portal/commit/939ce46)), closes [#38](https://github.com/IPS-LMU/oh-portal/issues/38)
