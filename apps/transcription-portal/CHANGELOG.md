# Changelog

This file was generated using [@jscutlery/semver](https://github.com/jscutlery/semver).

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
