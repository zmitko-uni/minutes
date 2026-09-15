// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  UUBT_DEFAULT_AUTHORIZATION_CODE_INFO_URI,
  UUBT_DEV_AUTHORIZATION_CODE_INFO_URI,
  resolveAuthorizationCodeInfoPageUri,
} from '../../minutes/uubt.std.ts';
import {
  buildAuthorizationCodeInfoPageUrl,
  buildAuthorizationUrl,
  isLoopbackRemoteAddress,
  parseOidcCallbackRequest,
  UUBT_AUTHORIZATION_CODE_ACCEPTED_MESSAGE,
} from '../../minutes/uubtOidcCallback.std.ts';

describe('uubtOidcCallback', () => {
  it('parses valid callback with matching state', () => {
    const result = parseOidcCallbackRequest(
      '/cb?code=abc&state=xyz',
      '/cb',
      'xyz'
    );
    assert.deepEqual(result, { ok: true, code: 'abc' });
  });

  it('rejects mismatched state', () => {
    const result = parseOidcCallbackRequest(
      '/cb?code=abc&state=bad',
      '/cb',
      'xyz'
    );
    assert.strictEqual(result.ok, false);
  });

  it('builds authorization URL with PKCE S256', () => {
    const url = buildAuthorizationUrl('https://id.example/oidc/auth', {
      redirectUri: 'http://127.0.0.1:1234/cb',
      clientId: 'client',
      scope: 'openid offline_access',
      state: 'st',
      nonce: 'no',
      codeChallenge: 'ch',
    });
    const parsed = new URL(url);
    assert.strictEqual(parsed.searchParams.get('code_challenge_method'), 'S256');
    assert.strictEqual(parsed.searchParams.get('response_type'), 'code');
  });

  it('accepts loopback remote addresses', () => {
    assert.isTrue(isLoopbackRemoteAddress('127.0.0.1'));
    assert.isTrue(isLoopbackRemoteAddress('::1'));
    assert.isFalse(isLoopbackRemoteAddress('192.168.0.1'));
  });

  it('builds showAuthorizationCode redirect like uu_appg01_oidc OAuthCode', () => {
    const url = buildAuthorizationCodeInfoPageUrl(
      UUBT_DEFAULT_AUTHORIZATION_CODE_INFO_URI,
      { code: 'secret-code' }
    );
    const parsed = new URL(url);
    assert.strictEqual(parsed.pathname, '/uu-identitymanagement-maing01/a9b105aff2744771be4daa8361954677/showAuthorizationCode');
    assert.strictEqual(parsed.searchParams.get('code'), 'secret-code');
    assert.strictEqual(parsed.searchParams.get('clientId'), 'Minutes');
    assert.strictEqual(
      parsed.searchParams.get('message'),
      UUBT_AUTHORIZATION_CODE_ACCEPTED_MESSAGE
    );
    assert.strictEqual(parsed.searchParams.get('close_page'), 'now');
  });

  it('resolves dev showAuthorizationCode page from dev OIDC base', () => {
    assert.strictEqual(
      resolveAuthorizationCodeInfoPageUri(
        'https://uuapp-dev.plus4u.net/uu-oidc-maing02/example/oidc'
      ),
      UUBT_DEV_AUTHORIZATION_CODE_INFO_URI
    );
  });
});
