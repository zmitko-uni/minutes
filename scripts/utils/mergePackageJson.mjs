// Copyright 2026 Minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';

const MINUTES_OWNED_ROOT_KEYS = new Set([
  'name',
  'productName',
  'description',
  'desktopName',
  'repository',
]);

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function valueKey(value) {
  return JSON.stringify(value);
}

function mergeArrays(base, ours, theirs) {
  const baseKeys = new Set(base.map(valueKey));
  const oursKeys = new Set(ours.map(valueKey));
  const theirsKeys = new Set(theirs.map(valueKey));
  const result = [];
  const resultKeys = new Set();

  function add(value) {
    const key = valueKey(value);
    if (!resultKeys.has(key)) {
      resultKeys.add(key);
      result.push(value);
    }
  }

  for (const value of theirs) {
    const key = valueKey(value);
    if (!baseKeys.has(key) || oursKeys.has(key)) {
      add(value);
    }
  }
  for (const value of ours) {
    const key = valueKey(value);
    if (!baseKeys.has(key) || theirsKeys.has(key)) {
      add(value);
    }
  }

  return result;
}

function mergeValue(base, ours, theirs, path) {
  if (isDeepStrictEqual(ours, theirs)) {
    return ours;
  }
  if (isDeepStrictEqual(ours, base)) {
    return theirs;
  }
  if (isDeepStrictEqual(theirs, base)) {
    return ours;
  }

  if (path.length === 1 && MINUTES_OWNED_ROOT_KEYS.has(path[0])) {
    return ours;
  }
  if (path.length === 1 && path[0] === 'version') {
    return ours;
  }

  if (Array.isArray(base) && Array.isArray(ours) && Array.isArray(theirs)) {
    return mergeArrays(base, ours, theirs);
  }

  if (isObject(ours) && isObject(theirs)) {
    const baseObject = isObject(base) ? base : {};
    const result = {};
    const keys = new Set([
      ...Object.keys(theirs),
      ...Object.keys(ours),
      ...Object.keys(baseObject),
    ]);

    for (const key of keys) {
      const hasBase = Object.hasOwn(baseObject, key);
      const hasOurs = Object.hasOwn(ours, key);
      const hasTheirs = Object.hasOwn(theirs, key);

      if (!hasOurs && !hasTheirs) {
        continue;
      }
      if (!hasBase) {
        if (!hasOurs) {
          result[key] = theirs[key];
        } else if (!hasTheirs) {
          result[key] = ours[key];
        } else {
          result[key] = mergeValue(undefined, ours[key], theirs[key], [
            ...path,
            key,
          ]);
        }
        continue;
      }
      if (!hasOurs) {
        if (isDeepStrictEqual(theirs[key], baseObject[key])) {
          continue;
        }
        throw new Error(
          `Unsupported package.json conflict at ${[...path, key].join('.')}: Minutes removed the value while Signal changed it`
        );
      }
      if (!hasTheirs) {
        if (isDeepStrictEqual(ours[key], baseObject[key])) {
          continue;
        }
        throw new Error(
          `Unsupported package.json conflict at ${[...path, key].join('.')}: Signal removed the value while Minutes changed it`
        );
      }

      result[key] = mergeValue(baseObject[key], ours[key], theirs[key], [
        ...path,
        key,
      ]);
    }
    return result;
  }

  throw new Error(
    `Unsupported package.json conflict at ${path.join('.') || '<root>'}`
  );
}

export function minutesVersionForSignal(signalVersion, minutesVersion) {
  const signalMatch = /^(\d+\.\d+\.\d+)/.exec(signalVersion);
  const minutesMatch = /^\d+\.\d+\.\d+(-m.+)$/.exec(minutesVersion);
  assert(signalMatch, `Unsupported Signal version: ${signalVersion}`);
  assert(minutesMatch, `Unsupported Minutes version: ${minutesVersion}`);
  return `${signalMatch[1]}${minutesMatch[1]}`;
}

export function mergePackageJson(base, ours, theirs) {
  const result = mergeValue(base, ours, theirs, []);
  result.version = minutesVersionForSignal(theirs.version, ours.version);
  return result;
}
