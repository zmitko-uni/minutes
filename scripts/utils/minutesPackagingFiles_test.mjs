// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// Regression guard for the macOS/Windows "node-llama-cpp missing" bug (#77).
//
// electron-builder drops every file that matches a `!` pattern in
// `build.files`, and an object-form `{ from, filter }` entry can NOT re-include
// a file excluded by a `!` pattern. The runtime import chain of node-llama-cpp
// (node-llama-cpp -> ipull -> sleep-promise) therefore needs its `build/` JS to
// survive the packaging exclusions. This test checks the real exclusion list
// from package.json against those paths.

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import micromatch from 'micromatch';

const packageJson = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
);

const excludePatterns = packageJson.build.files
  .filter(entry => typeof entry === 'string' && entry.startsWith('!'))
  .map(entry => entry.slice(1));

function isExcluded(path) {
  return micromatch.isMatch(path, excludePatterns, { dot: true });
}

// JS entry points under `build/` of packages in the node-llama-cpp runtime
// closure. These must NOT be excluded by packaging.
// sleep-promise: "main" = build/cjs.js, "module" = build/esm.mjs (ipull imports it).
const RUNTIME_BUILD_JS = [
  'node_modules/sleep-promise/build/cjs.js',
  'node_modules/sleep-promise/build/esm.mjs',
];

test('runtime JS in build/ of node-llama-cpp dependencies is packaged', () => {
  for (const path of RUNTIME_BUILD_JS) {
    assert.equal(isExcluded(path), false, `${path} must be packaged`);
  }
});

test('native build intermediates stay excluded', () => {
  const excluded = [
    'node_modules/some-native/build/Release/obj.target/addon.o',
    'node_modules/some-native/build/Release/.deps/addon.o.d',
    'node_modules/some-native/build/Makefile',
    'node_modules/some-native/build/binding.Makefile',
    'node_modules/some-native/build/config.gypi',
    'node_modules/some-native/build/rules.mk',
  ];
  for (const path of excluded) {
    assert.equal(isExcluded(path), true, `${path} should stay excluded`);
  }
});

test('prebuilt native modules are not excluded', () => {
  const included = [
    'node_modules/fs-xattr/build/Release/fs-xattr.node',
    'node_modules/@signalapp/ringrtc/build/win32/ringrtc-x64.node',
  ];
  for (const path of included) {
    assert.equal(isExcluded(path), false, `${path} must be packaged`);
  }
});
