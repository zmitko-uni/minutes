// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  extractUuOidcErrorCodes,
  throwIfUnsupportedCredentials,
  UubtInteractiveLoginRequiredError,
} from '../../minutes/uubtAuthErrors.std.ts';

describe('uubtAuthErrors', () => {
  it('extracts uuAppErrorMap keys', () => {
    const codes = extractUuOidcErrorCodes(
      JSON.stringify({
        uuAppErrorMap: {
          'uu-oidc-main/grantToken/unsupportedCredentials ': {
            message: 'acr',
          },
        },
      })
    );
    assert.include(codes[0], 'unsupportedCredentials');
  });

  it('throws interactive login for unsupportedCredentials', () => {
    assert.throws(() => {
      throwIfUnsupportedCredentials(
        500,
        JSON.stringify({
          uuAppErrorMap: {
            'uu-oidc-main/grantToken/unsupportedCredentials': {},
          },
        })
      );
    }, UubtInteractiveLoginRequiredError);
  });
});
