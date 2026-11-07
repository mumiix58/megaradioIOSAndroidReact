import { createRoot } from "react-dom/client";
import { useEffect } from 'react';
import App from "./App";
import "./index.css";
import { TvErrorBoundary } from "./components/TvErrorBoundary";
import { scheduleBundleUpdate } from "./lib/bundleUpdater";
import { normalizeHashQuery } from './lib/normalizeHashQuery';

normalizeHashQuery();
window.addEventListener('hashchange', normalizeHashQuery);


// Auto-fit 1920x1080 canvas to any window size while preserving 16:9 aspect ratio.
// Fixes blank space on >1920 desktops (e.g. Windows fullscreen on 4K/ultrawide monitors).
function applyTvScale() {
  const root = document.getElementById("root");
  if (!root) return;
  const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  const offsetX = Math.max(0, (window.innerWidth - 1920 * scale) / 2);
  const offsetY = Math.max(0, (window.innerHeight - 1080 * scale) / 2);
  root.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
}
window.addEventListener("resize", applyTvScale);
window.addEventListener("orientationchange", applyTvScale);
applyTvScale();

function ReadyApp() {
  useEffect(() => {
    (window as any).__MR_APP_READY__ = true;
    const event = document.createEvent('Event');
    event.initEvent('megaradio-ready', false, false);
    document.dispatchEvent(event);
  }, []);
  return <App />;
}
createRoot(document.getElementById("root")!).render(<TvErrorBoundary><ReadyApp /></TvErrorBoundary>);

// Background OTA for the packaged TV apps (cache-first; no-op on web/Electron).
scheduleBundleUpdate();
