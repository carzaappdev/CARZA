'use client';

import { useSyncExternalStore } from 'react';

const KEY = 'carza:age-block';
const listeners = new Set<() => void>();

function read() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** Remembers on this device that the age screen turned someone away, so they can't just try again. */
export function blockAge() {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    // Storage blocked: the server still refuses under-13 sign-ups.
  }
  listeners.forEach((cb) => cb());
}

export function useAgeBlocked() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => false,
  );
}
