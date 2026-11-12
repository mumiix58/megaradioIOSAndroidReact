// Executed as an ES5 classic script BEFORE public helpers and React.
import 'core-js/stable';
import 'abortcontroller-polyfill/dist/abortcontroller-polyfill-only';
import 'whatwg-fetch';
import 'fast-text-encoding';

if (!Element.prototype.matches) Element.prototype.matches = Element.prototype.webkitMatchesSelector;
if (!Element.prototype.closest) {
  Element.prototype.closest = function (selector) {
    let element = this;
    while (element && element.nodeType === 1) {
      if (element.matches(selector)) return element;
      element = element.parentElement;
    }
    return null;
  };
}
if (typeof window.CustomEvent !== 'function') {
  window.CustomEvent = function (name, options) {
    const event = document.createEvent('CustomEvent');
    event.initCustomEvent(name, !!options?.bubbles, !!options?.cancelable, options?.detail);
    return event;
  };
}
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = function (left, top) {
    if (typeof left === 'object') { this.scrollLeft = left.left === undefined ? this.scrollLeft : left.left; this.scrollTop = left.top === undefined ? this.scrollTop : left.top; }
    else { this.scrollLeft = left; this.scrollTop = top; }
  };
}
if (!Element.prototype.scrollBy) {
  Element.prototype.scrollBy = function (left, top) {
    if (typeof left === 'object') this.scrollTo({ left: this.scrollLeft + (left.left || 0), top: this.scrollTop + (left.top || 0) });
    else this.scrollTo(this.scrollLeft + left, this.scrollTop + top);
  };
}
if (!window.CSS || !window.CSS.supports || !window.CSS.supports('--mr-test', '0') || !window.CSS.supports('color', '#0000')) {
  document.documentElement.className += ' mr-legacy-css';
}
// Grid gap support does not imply flex gap support (for example Chromium53/69).
// Measure an attached flex layout instead; this script runs before <body> exists.
(function markMissingFlexGap() {
  const root = document.documentElement;
  if (!root || typeof document.createElement !== 'function' || typeof root.appendChild !== 'function') return;
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;left:-9999px;top:-9999px;display:flex;flex-direction:column;row-gap:1px;width:1px;padding:0;margin:0;border:0;line-height:0;visibility:hidden;pointer-events:none;';
  for (let i = 0; i < 2; i++) {
    const child = document.createElement('div');
    child.style.cssText = 'height:1px;min-height:1px;width:1px;flex:0 0 1px;padding:0;margin:0;border:0;';
    probe.appendChild(child);
  }
  let supported;
  try {
    root.appendChild(probe);
    supported = probe.scrollHeight === 3;
  } catch (_) {
    return; // Unknown layout capability must not block app startup.
  } finally {
    if (probe.parentNode) probe.parentNode.removeChild(probe);
  }
  if (!supported && (' ' + root.className + ' ').indexOf(' mr-no-flex-gap ') < 0) {
    root.className += ' mr-no-flex-gap';
  }
})();
window.__MR_COMPAT_READY__ = true;