<!-- Copyright 2026 minutes contributors -->
<!-- SPDX-License-Identifier: AGPL-3.0-only -->

# @minutes/mac-audio-tap

ScreenCaptureKit bindings that capture macOS **system (loopback) audio** and
deliver interleaved Float32 PCM to JavaScript. Used by the Minutes call
recorder as the macOS equivalent of Windows WASAPI loopback (which Electron
exposes via `desktopCapturer`, but only on Windows).

## Requirements

- macOS 13.0+ (`SCStreamConfiguration.capturesAudio`)
- **Screen Recording** permission (TCC). The first capture attempt triggers
  the system prompt; the app must be restarted after granting it.

## API

```js
import { isSupported, start, stop } from '@minutes/mac-audio-tap';

if (isSupported()) {
  start({
    onData(samples, sampleRate, channels) {
      // interleaved Float32 PCM (48 kHz stereo requested)
    },
    onEvent(type, message) {
      // 'started' | 'error'
    },
  });
  // …
  stop();
}
```

Only one tap can be active at a time. `excludesCurrentProcessAudio` is `NO`
on purpose: remote call participants play through this process, and their
audio is exactly what the recording needs.
