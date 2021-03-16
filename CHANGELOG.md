## [1.0.6](https://github.com/IPS-LMU/transcription-portal/compare/v1.0.5...v1.0.6) (2021-03-16)


### Bug Fixes

* **verify:** verify button disabled after restart with queued files ([9b252f6](https://github.com/IPS-LMU/transcription-portal/commit/9b252f67db8b2e139f8a203e7038b84545a94375))


### Features

* **general:** hide access code in logs and in settings ([d6130a8](https://github.com/IPS-LMU/transcription-portal/commit/d6130a8902a4a2d48ce961b4cada0f55b6808ab4)), closes [#58](https://github.com/IPS-LMU/transcription-portal/issues/58)
* **general:** renamed OH-Portal to TranscriptionPortal ([3c65fce](https://github.com/IPS-LMU/transcription-portal/commit/3c65fce837989438b7c414daad5836b0bff8db5e))
* **verify-step:** portal checks audio file if it fits the ASR provider's requirements automatically ([9bed9a1](https://github.com/IPS-LMU/transcription-portal/commit/9bed9a1e3b417f01dfda2b05c83d5e7a9e144eba)), closes [#46](https://github.com/IPS-LMU/transcription-portal/issues/46)



## [1.0.5](https://github.com/IPS-LMU/oh-portal/compare/v1.0.4...v1.0.5) (2021-02-15)


### Bug Fixes

* **downloads:** fixed download by line bug and improved generation of downloads ([39c9a1d](https://github.com/IPS-LMU/oh-portal/commit/39c9a1d85144506c979236a6888fa9f2671ad4a7)), closes [#56](https://github.com/IPS-LMU/oh-portal/issues/56)
* **emu-webApp:** fixed issue that transcript is not loaded in EMU webApp, fixed retrieving its result ([d038f38](https://github.com/IPS-LMU/oh-portal/commit/d038f38e73486ef4a9f20155eea15b2c903ba8b6))
* **operations:** fixed status behaviour of operations ([5a73bf0](https://github.com/IPS-LMU/oh-portal/commit/5a73bf0a2d80bb94fa4e9c8ed4b438d3fba62e6e))
* **preprocessing:** fixed issue that audio split into channels is not working ([a015e0b](https://github.com/IPS-LMU/oh-portal/commit/a015e0b7a667ccbefb164e4f4640424b36e50a0e))


### Features

* **download-modal:** close modal after selected lines were removed ([ebc6e85](https://github.com/IPS-LMU/oh-portal/commit/ebc6e85a0bfef98ffb540b394332ac264dd02e3d))
* **maintenance:** added maintenance snackbar ([8cbab8e](https://github.com/IPS-LMU/oh-portal/commit/8cbab8e3eb6a3408f1aaad90febd14e4957d36ee))



## [1.0.4](https://github.com/IPS-LMU/oh-portal/compare/v1.0.2...v1.0.4) (2020-11-09)


### Bug Fixes

* **results-table:** fixed duplicated rows ([3a54235](https://github.com/IPS-LMU/oh-portal/commit/3a54235cc7108db61ce035562df7f3c738bd5a1f))


### Features

* **access code:** added option to set an access code to increase quota ([68b9084](https://github.com/IPS-LMU/oh-portal/commit/68b9084dfadfee726523da25d0badb640b3dad41))
* **columns:** added export column ([94c2d7e](https://github.com/IPS-LMU/oh-portal/commit/94c2d7ec288b2037fa46faabea6c3e937357a4b7))
* **compatibility:** added background compatibility check ([6399259](https://github.com/IPS-LMU/oh-portal/commit/6399259da1f156bbc4add7ca97cd0d8dfc98ea97)), closes [#43](https://github.com/IPS-LMU/oh-portal/issues/43)
* **EMU-webApp:** results are now retrieved by the EMU-webApp ([b8726c8](https://github.com/IPS-LMU/oh-portal/commit/b8726c877f831f9c7ef5ed931edf16b293958a0b))
* **export:** changed folder names for each step ([ad02426](https://github.com/IPS-LMU/oh-portal/commit/ad024267d4ee3fe1dbb49bd2454dab8444b6cc21))
* **feedback:** improved feedback modal the same way as OCTRA ([e439332](https://github.com/IPS-LMU/oh-portal/commit/e439332dec2912e55caa57eb9f859e0f3b78951a))
* **operations:** show information of service provider while processing ASR. ([2d00107](https://github.com/IPS-LMU/oh-portal/commit/2d00107a872311199bef1d385040a6d48cb6254d))
* **popover:** simplified and beautified error messages and warnings ([7ac41bc](https://github.com/IPS-LMU/oh-portal/commit/7ac41bcbd98a646f32aab20efc3041cf3f8ca385)), closes [#44](https://github.com/IPS-LMU/oh-portal/issues/44)
* **queue:** show further information about the service providers ([e185a63](https://github.com/IPS-LMU/oh-portal/commit/e185a63f8030defbe7ee5892092a1cbdf32a6a06))
* **results:** added conversions to WebVTT and SRT ([36eede9](https://github.com/IPS-LMU/oh-portal/commit/36eede945510e11318a11cfa973b9a43f06a2357))
* **tracking:** added option for tracking via Matomo ([d8566be](https://github.com/IPS-LMU/oh-portal/commit/d8566be4348dbef93f7bcf0b934f089092d56066))

## [1.0.2](https://github.com/IPS-LMU/oh-portal/compare/v1.0.1...v1.0.2) (2019-06-22)

### Features

* **Popover:** option to paste the error message to the clipboard


### Bug Fixes

* **ASR:** fixed failing ASR
* **Popover:** counter didn't stop on error

## [1.0.1](https://github.com/IPS-LMU/oh-portal/compare/v1.0.0...v1.0.1) (2019-01-25)


### Bug Fixes

* **http-requests:** fixed problem with http-caching ([3f1b050](https://github.com/IPS-LMU/oh-portal/commit/3f1b050))
* **popovers:** fixed problems with positioning and fadein/fadeout ([c34bd08](https://github.com/IPS-LMU/oh-portal/commit/c34bd08))



<a name="1.0.0"></a>
# 1.0.0 (2018-09-21)


### Features

* **download:** download archives from results and conversions ([4ff2295](https://github.com/IPS-LMU/oh-portal/commit/4ff2295)), closes [#5](https://github.com/IPS-LMU/oh-portal/issues/5) [#30](https://github.com/IPS-LMU/oh-portal/issues/30)
* show offline icons ([f5e83ff](https://github.com/IPS-LMU/oh-portal/commit/f5e83ff))
* **context-menu:** remove selected appendings ([dfe77b3](https://github.com/IPS-LMU/oh-portal/commit/dfe77b3)), closes [#1](https://github.com/IPS-LMU/oh-portal/issues/1)
* **file-collection:** transcript files can be added four processing ([a4d7d96](https://github.com/IPS-LMU/oh-portal/commit/a4d7d96))
* **files:** file preview for transcripts ([6d271d1](https://github.com/IPS-LMU/oh-portal/commit/6d271d1)), closes [#16](https://github.com/IPS-LMU/oh-portal/issues/16)
* **folders:** open/close folders ([da72f94](https://github.com/IPS-LMU/oh-portal/commit/da72f94)), closes [#22](https://github.com/IPS-LMU/oh-portal/issues/22)
* **settings:** option to remove all data ([16fa888](https://github.com/IPS-LMU/oh-portal/commit/16fa888))
* **shortcuts:** added shortcuts for pc and mac ([4c45b38](https://github.com/IPS-LMU/oh-portal/commit/4c45b38)), closes [#33](https://github.com/IPS-LMU/oh-portal/issues/33)
* **sidebar:** default sidebar width can be changed by the user ([a38c241](https://github.com/IPS-LMU/oh-portal/commit/a38c241)), closes [#32](https://github.com/IPS-LMU/oh-portal/issues/32)
* **sidebar:** resizeable sidebar ([1e300be](https://github.com/IPS-LMU/oh-portal/commit/1e300be)), closes [#11](https://github.com/IPS-LMU/oh-portal/issues/11) [#9](https://github.com/IPS-LMU/oh-portal/issues/9)
* **transcripts:** Save transcripts to Browser's storage (IndexedDB) ([08cdadc](https://github.com/IPS-LMU/oh-portal/commit/08cdadc)), closes [#6](https://github.com/IPS-LMU/oh-portal/issues/6)
* **workflow:** MAUS and EMU-webApp can be skipped ([dca41ef](https://github.com/IPS-LMU/oh-portal/commit/dca41ef)), closes [#4](https://github.com/IPS-LMU/oh-portal/issues/4)
* **workflow:** new workflow: Add -> Verfiy -> Start/Stop ([939ce46](https://github.com/IPS-LMU/oh-portal/commit/939ce46)), closes [#38](https://github.com/IPS-LMU/oh-portal/issues/38)
