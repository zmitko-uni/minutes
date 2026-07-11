// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

#include <cstring>
#include <mutex>
#include <string>
#include <vector>

#import <CoreMedia/CoreMedia.h>
#import <ScreenCaptureKit/ScreenCaptureKit.h>

#include "napi.h"

// Captures macOS system (loopback) audio with ScreenCaptureKit and delivers
// interleaved Float32 PCM to JavaScript. Only one tap can be active at a time.

@class MinutesAudioTapOutput;

namespace {

struct EventData {
  std::string type;
  std::string message;
};

struct TapState {
  std::mutex mutex;
  bool active = false;
  Napi::ThreadSafeFunction on_data;
  Napi::ThreadSafeFunction on_event;
  SCStream* stream API_AVAILABLE(macos(13.0)) = nil;
  MinutesAudioTapOutput* output = nil;
  dispatch_queue_t queue = nil;
};

TapState* GetState() {
  static TapState state;
  return &state;
}

// Must be called with the state mutex held.
void ReleaseCallbacksLocked(TapState* state) {
  if (state->on_data != nullptr) {
    state->on_data.Release();
    state->on_data = nullptr;
  }
  if (state->on_event != nullptr) {
    state->on_event.Release();
    state->on_event = nullptr;
  }
}

void NotifyEvent(const char* type, const char* message) {
  auto* state = GetState();
  std::lock_guard<std::mutex> guard(state->mutex);
  if (!state->active || state->on_event == nullptr) {
    return;
  }
  auto* event = new EventData{type, message == nullptr ? "" : message};
  auto status = state->on_event.NonBlockingCall(
      event, [](Napi::Env env, Napi::Function fn, EventData* data) {
        fn.Call({Napi::String::New(env, data->type),
                 Napi::String::New(env, data->message)});
        delete data;
      });
  if (status != napi_ok) {
    delete event;
  }
}

API_AVAILABLE(macos(13.0))
void StopLocked(TapState* state) {
  state->active = false;
  SCStream* stream = state->stream;
  state->stream = nil;
  state->output = nil;
  state->queue = nil;
  ReleaseCallbacksLocked(state);
  if (stream != nil) {
    [stream stopCaptureWithCompletionHandler:^(NSError*) {
    }];
  }
}

API_AVAILABLE(macos(13.0))
void HandleAudioSampleBuffer(CMSampleBufferRef sampleBuffer) {
  CMItemCount frames = CMSampleBufferGetNumSamples(sampleBuffer);
  if (frames <= 0) {
    return;
  }

  CMFormatDescriptionRef format =
      CMSampleBufferGetFormatDescription(sampleBuffer);
  if (format == nullptr) {
    return;
  }
  const AudioStreamBasicDescription* asbd =
      CMAudioFormatDescriptionGetStreamBasicDescription(format);
  // ScreenCaptureKit delivers Float32 PCM; ignore anything else.
  if (asbd == nullptr || !(asbd->mFormatFlags & kAudioFormatFlagIsFloat) ||
      asbd->mBitsPerChannel != 32) {
    return;
  }

  size_t listSize = 0;
  if (CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer(
          sampleBuffer, &listSize, nullptr, 0, nullptr, nullptr, 0, nullptr) !=
      noErr) {
    return;
  }
  std::vector<uint8_t> listStorage(listSize);
  auto* list = reinterpret_cast<AudioBufferList*>(listStorage.data());
  CMBlockBufferRef blockBuffer = nullptr;
  if (CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer(
          sampleBuffer, nullptr, list, listSize, kCFAllocatorDefault,
          kCFAllocatorDefault,
          kCMSampleBufferFlag_AudioBufferList_Assure16ByteAlignment,
          &blockBuffer) != noErr) {
    return;
  }

  const bool nonInterleaved =
      (asbd->mFormatFlags & kAudioFormatFlagIsNonInterleaved) != 0;
  const uint32_t channels =
      nonInterleaved ? list->mNumberBuffers : asbd->mChannelsPerFrame;
  if (channels == 0 || list->mNumberBuffers == 0) {
    CFRelease(blockBuffer);
    return;
  }

  auto* interleaved =
      new std::vector<float>(static_cast<size_t>(frames) * channels);
  if (nonInterleaved) {
    for (uint32_t ch = 0; ch < channels; ch++) {
      const auto* src = static_cast<const float*>(list->mBuffers[ch].mData);
      for (CMItemCount i = 0; i < frames; i++) {
        (*interleaved)[static_cast<size_t>(i) * channels + ch] = src[i];
      }
    }
  } else {
    memcpy(interleaved->data(), list->mBuffers[0].mData,
           interleaved->size() * sizeof(float));
  }
  const double sampleRate = asbd->mSampleRate;
  CFRelease(blockBuffer);

  auto* state = GetState();
  std::lock_guard<std::mutex> guard(state->mutex);
  if (!state->active || state->on_data == nullptr) {
    delete interleaved;
    return;
  }
  auto status = state->on_data.NonBlockingCall(
      interleaved, [sampleRate, channels](Napi::Env env, Napi::Function fn,
                                          std::vector<float>* data) {
        auto samples = Napi::Float32Array::New(env, data->size());
        memcpy(samples.Data(), data->data(), data->size() * sizeof(float));
        delete data;
        fn.Call({samples, Napi::Number::New(env, sampleRate),
                 Napi::Number::New(env, channels)});
      });
  if (status != napi_ok) {
    delete interleaved;
  }
}

}  // namespace

API_AVAILABLE(macos(13.0))
@interface MinutesAudioTapOutput : NSObject <SCStreamOutput, SCStreamDelegate>
@end

@implementation MinutesAudioTapOutput

- (void)stream:(SCStream*)stream
    didOutputSampleBuffer:(CMSampleBufferRef)sampleBuffer
                   ofType:(SCStreamOutputType)type {
  if (type != SCStreamOutputTypeAudio) {
    return;
  }
  HandleAudioSampleBuffer(sampleBuffer);
}

- (void)stream:(SCStream*)stream didStopWithError:(NSError*)error {
  NotifyEvent("error", error.localizedDescription.UTF8String);
  auto* state = GetState();
  std::lock_guard<std::mutex> guard(state->mutex);
  if (state->active) {
    StopLocked(state);
  }
}

@end

namespace {

API_AVAILABLE(macos(13.0))
void StartCapture() {
  [SCShareableContent
      getShareableContentExcludingDesktopWindows:YES
                             onScreenWindowsOnly:YES
                               completionHandler:^(
                                   SCShareableContent* content,
                                   NSError* error) {
                                 if (error != nil) {
                                   NotifyEvent(
                                       "error",
                                       error.localizedDescription.UTF8String);
                                   return;
                                 }
                                 if (content.displays.count == 0) {
                                   NotifyEvent("error", "no displays found");
                                   return;
                                 }

                                 SCContentFilter* filter = [[SCContentFilter
                                     alloc]
                                      initWithDisplay:content.displays
                                                          .firstObject
                                     excludingWindows:@[]];

                                 SCStreamConfiguration* config =
                                     [[SCStreamConfiguration alloc] init];
                                 config.capturesAudio = YES;
                                 config.excludesCurrentProcessAudio = NO;
                                 config.sampleRate = 48000;
                                 config.channelCount = 2;
                                 // Video output is required by the stream but
                                 // never consumed; keep it as cheap as
                                 // possible.
                                 config.width = 2;
                                 config.height = 2;
                                 config.minimumFrameInterval = CMTimeMake(1, 1);

                                 auto* state = GetState();
                                 std::lock_guard<std::mutex> guard(
                                     state->mutex);
                                 if (!state->active) {
                                   return;  // stopped while enumerating
                                 }

                                 SCStream* stream = [[SCStream alloc]
                                     initWithFilter:filter
                                      configuration:config
                                           delegate:state->output];
                                 NSError* addError = nil;
                                 if (![stream addStreamOutput:state->output
                                                         type:
                                                             SCStreamOutputTypeAudio
                                           sampleHandlerQueue:state->queue
                                                        error:&addError]) {
                                   StopLocked(state);
                                   return;
                                 }
                                 state->stream = stream;

                                 [stream startCaptureWithCompletionHandler:^(
                                             NSError* startError) {
                                   if (startError != nil) {
                                     NotifyEvent("error",
                                                 startError.localizedDescription
                                                     .UTF8String);
                                     auto* innerState = GetState();
                                     std::lock_guard<std::mutex> innerGuard(
                                         innerState->mutex);
                                     if (innerState->active) {
                                       StopLocked(innerState);
                                     }
                                   } else {
                                     NotifyEvent("started", "");
                                   }
                                 }];
                               }];
}

API_AVAILABLE(macos(13.0))
void Start(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  if (info.Length() < 1 || !info[0].IsObject()) {
    Napi::TypeError::New(env, "expected options object")
        .ThrowAsJavaScriptException();
    return;
  }
  auto options = info[0].As<Napi::Object>();
  auto onData = options.Get("onData");
  auto onEvent = options.Get("onEvent");
  if (!onData.IsFunction() || !onEvent.IsFunction()) {
    Napi::TypeError::New(env, "expected onData and onEvent functions")
        .ThrowAsJavaScriptException();
    return;
  }

  auto* state = GetState();
  std::lock_guard<std::mutex> guard(state->mutex);
  if (state->active) {
    Napi::Error::New(env, "audio tap already active")
        .ThrowAsJavaScriptException();
    return;
  }

  state->active = true;
  state->on_data = Napi::ThreadSafeFunction::New(
      env, onData.As<Napi::Function>(), "mac-audio-tap.onData", 32, 1);
  state->on_data.Unref(env);
  state->on_event = Napi::ThreadSafeFunction::New(
      env, onEvent.As<Napi::Function>(), "mac-audio-tap.onEvent", 8, 1);
  state->on_event.Unref(env);
  state->output = [[MinutesAudioTapOutput alloc] init];
  state->queue =
      dispatch_queue_create("minutes.mac-audio-tap", DISPATCH_QUEUE_SERIAL);

  StartCapture();
}

API_AVAILABLE(macos(13.0))
void Stop(const Napi::CallbackInfo& info) {
  auto* state = GetState();
  std::lock_guard<std::mutex> guard(state->mutex);
  if (!state->active) {
    return;
  }
  StopLocked(state);
}

}  // namespace

static Napi::Object Init(Napi::Env env, Napi::Object exports) {
  bool supported = false;
  if (@available(macos 13.0, *)) {
    supported = true;
    exports["start"] = Napi::Function::New(env, &Start);
    exports["stop"] = Napi::Function::New(env, &Stop);
  }
  exports["isSupported"] = Napi::Boolean::New(env, supported);
  return exports;
}

NODE_API_MODULE(mac_audio_tap, Init)
