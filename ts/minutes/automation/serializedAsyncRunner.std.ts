// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

async function runAfter(
  predecessor: Promise<void>,
  task: () => Promise<void>
): Promise<void> {
  try {
    await predecessor;
  } catch {
    // A failed predecessor must not prevent later serialized work.
  }
  await task();
}

async function ignoreFailure(operation: Promise<void>): Promise<void> {
  try {
    await operation;
  } catch {
    // Keep the queue usable while the caller still receives the failure.
  }
}

export class SerializedAsyncRunner {
  #tail: Promise<void> = Promise.resolve();
  #closed = false;
  #closePromise: Promise<void> | undefined;

  run(task: () => Promise<void>): Promise<void> {
    if (this.#closed) {
      return Promise.resolve();
    }
    const result = runAfter(this.#tail, task);
    this.#tail = ignoreFailure(result);
    return result;
  }

  close(cleanup: () => Promise<void>): Promise<void> {
    if (this.#closePromise != null) {
      return this.#closePromise;
    }
    this.#closed = true;
    const result = runAfter(this.#tail, cleanup);
    this.#tail = ignoreFailure(result);
    this.#closePromise = result;
    return result;
  }
}
