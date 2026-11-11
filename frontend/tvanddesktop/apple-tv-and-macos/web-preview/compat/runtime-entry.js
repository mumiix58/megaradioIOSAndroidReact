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
window.__MR_COMPAT_READY__ = true;