// Copyright 2026 uuMinutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

declare module 'fs-xattr' {
  export function set(
    path: string,
    name: string,
    value: Buffer | string
  ): void;

  export function setAttribute(
    path: string,
    name: string,
    value: Buffer | string
  ): Promise<void>;
}
