/** A separate muted decoder proves media actually advances; never touches the live player. */
export function probeRadioStream(url: string, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false);
  return new Promise(resolve => {
    const audio = new Audio();
    let done = false, start: number | null = null;
    const finish = (valid: boolean) => {
      if (done) return; done = true;
      clearTimeout(timeout); clearInterval(poll);
      signal.removeEventListener('abort', abort);
      audio.onplaying = audio.onerror = null;
      audio.pause(); audio.removeAttribute('src'); audio.load(); resolve(valid);
    };
    const abort = () => finish(false);
    const poll = setInterval(() => {
      if (audio.paused || audio.readyState < 2) return;
      if (start === null) start = audio.currentTime;
      else if (audio.currentTime - start >= 0.15) finish(true);
    }, 100);
    const timeout = setTimeout(() => finish(false), 5500);
    signal.addEventListener('abort', abort, { once: true });
    audio.muted = true; audio.volume = 0; audio.preload = 'auto';
    audio.onerror = () => finish(false);
    audio.src = url;
    void audio.play().catch(() => finish(false));
  });
}
