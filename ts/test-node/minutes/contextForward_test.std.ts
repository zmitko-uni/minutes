// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  addContextToForwardDraft,
  formatMessageContextHeader,
  formatMessagesWithContextForClipboard,
} from '../../minutes/contextForward.std.ts';
import { BodyRange } from '../../types/BodyRange.std.ts';

describe('Minutes context forwarding', () => {
  const context = {
    author: 'Alice',
    timestamp: Date.UTC(2026, 7, 21, 8, 42),
  };

  it('formats a stable author and timestamp header', () => {
    assert.strictEqual(
      formatMessageContextHeader(context, 'en-GB', 'UTC'),
      'Alice · 21/08/2026, 08:42'
    );
  });

  it('prefixes a forward draft and shifts its body ranges', () => {
    const result = addContextToForwardDraft(
      {
        bodyRanges: [{ start: 0, length: 5, style: BodyRange.Style.ITALIC }],
        hasContact: false,
        isSticker: false,
        messageBody: 'Hello',
        originalMessageId: 'message-1',
        previews: [],
      },
      context,
      'en-GB',
      'UTC'
    );

    const header = 'Alice · 21/08/2026, 08:42';
    assert.strictEqual(result.messageBody, `${header}\nHello`);
    assert.deepEqual(result.bodyRanges, [
      { start: 0, length: header.length, style: BodyRange.Style.BOLD },
      {
        start: header.length + 1,
        length: 5,
        style: BodyRange.Style.ITALIC,
      },
    ]);
  });

  it('joins clipboard messages without losing their individual context', () => {
    assert.strictEqual(
      formatMessagesWithContextForClipboard(
        [
          { context, body: 'First' },
          {
            context: { ...context, author: 'Bob' },
            body: 'Second',
          },
        ],
        'en-GB',
        'UTC'
      ),
      [
        'Alice · 21/08/2026, 08:42',
        'First',
        '',
        'Bob · 21/08/2026, 08:42',
        'Second',
      ].join('\n')
    );
  });
});
