// Async work belongs to the session in which it started.
let version = 0;
const requests = new Set<AbortController>();
export const sessionVersion = () => version;
export const isCurrentSession = (expected: number) => expected === version;
export function beginSessionRequest(signal?: AbortSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  requests.add(controller);
  return {
    signal: controller.signal,
    release() {
      requests.delete(controller);
      signal?.removeEventListener('abort', abort);
    },
  };
}
export function invalidateSession() {
  version += 1;
  for (const controller of requests) controller.abort();
  requests.clear();
}
