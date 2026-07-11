{
  "conditions": [
    ["OS=='mac'", {
      "targets": [{
        "target_name": "mac-audio-tap",
        "dependencies": [
          "<!(node -p \"require('node-addon-api').targets\"):node_addon_api",
        ],
        "sources": [
          "addon.mm",
        ],
        "libraries": [
          "-framework CoreMedia",
        ],
        "cflags+": ["-fvisibility=hidden"],
        "xcode_settings": {
          "CLANG_ENABLE_OBJC_ARC": "YES",
          "GCC_SYMBOLS_PRIVATE_EXTERN": "YES", # -fvisibility=hidden
          "LLVM_LTO": "YES",
          # ScreenCaptureKit only exists on macOS 12.3+; weak-link so the
          # addon still loads on older systems (guarded by @available).
          "OTHER_LDFLAGS": ["-weak_framework", "ScreenCaptureKit"],
        }
      }],
    }, {
      "targets": [{
        "target_name": "noop",
        "type": "none",
      }],
    }],
  ],
}
