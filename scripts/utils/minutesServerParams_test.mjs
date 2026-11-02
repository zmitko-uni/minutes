// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const configDirectory = new URL('../../config/', import.meta.url);
const production = JSON.parse(
  readFileSync(new URL('production.json', configDirectory), 'utf8')
);

// Minutes connects to Signal production, even for the separate beta profile.
// These trust parameters must follow the same upstream revision as libsignal.
for (const profile of ['minutes', 'minutes-beta']) {
  const config = JSON.parse(
    readFileSync(new URL(`${profile}.json`, configDirectory), 'utf8')
  );

  for (const key of [
    'serverPublicParams',
    'genericServerPublicParams',
    'backupServerPublicParams',
  ]) {
    void test(`${profile} uses current Signal production ${key}`, () => {
      assert.equal(typeof production[key], 'string');
      assert.ok(production[key].length > 0, `production ${key} is empty`);
      assert.ok(
        config[key] === production[key],
        `${profile}.json: ${key} differs from Signal production.json; synchronize it before building`
      );
    });
  }

  void test(`${profile} trusts the same server roots as Signal production`, () => {
    assert.ok(Array.isArray(production.serverTrustRoots));
    assert.ok(production.serverTrustRoots.length > 0);
    assert.deepEqual(config.serverTrustRoots, production.serverTrustRoots);
  });
}
