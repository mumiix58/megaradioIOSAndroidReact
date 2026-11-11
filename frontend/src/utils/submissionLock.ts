/** Synchronous guard: disabled state alone cannot prevent two taps in one render frame. */
export function createSubmissionLock() {
  let pending = false;
  return {
    tryAcquire() { if (pending) return false; pending = true; return true; },
    release() { pending = false; },
  };
}
