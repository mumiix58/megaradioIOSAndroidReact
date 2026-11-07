const postcss = require('postcss');
const valueParser = require('postcss-value-parser');

// Hex alpha colors arrived after Chromium38. One unsupported color invalidates
// an entire shadow list, including Tailwind focus rings.
function legacyAlphaColors(value) {
  const parsed = valueParser(value);
  parsed.walk(node => {
    if (node.type !== 'word' || !/^#(?:[0-9a-f]{4}|[0-9a-f]{8})$/i.test(node.value)) return;
    let hex = node.value.slice(1);
    if (hex.length === 4) hex = hex.split('').map(c => c + c).join('');
    const channels = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
    const alpha = parseInt(hex.slice(6), 16) / 255;
    node.value = `rgba(${channels.join(', ')}, ${alpha})`;
  });
  return parsed.toString();
}

function resolvedValue(value, variables, visited = []) {
  let valid = true;
  const parsed = valueParser(value);
  parsed.walk(node => {
    if (node.type !== 'function' || node.value !== 'var') return;
    const comma = node.nodes.findIndex(part => part.type === 'div' && part.value === ',');
    const name = valueParser.stringify(comma < 0 ? node.nodes : node.nodes.slice(0, comma)).trim();
    const fallback = comma < 0 ? undefined : valueParser.stringify(node.nodes.slice(comma + 1));
    let replacement = visited.includes(name) ? undefined : variables[name];
    if (replacement === undefined) replacement = fallback;
    if (replacement === undefined) { valid = false; return false; }
    const result = resolvedValue(replacement, variables, visited.concat(name));
    if (result === null) { valid = false; return false; }
    node.type = 'word'; node.value = result; delete node.nodes;
    return false;
  });
  return valid ? parsed.toString() : null;
}

// Chromium38 cannot read CSS variables. Add scoped static utility fallbacks;
// modern CSS remains untouched. Semantic root tokens + each rule's own opacity
// variables are resolved; custom properties are NOT emulated dynamically.
function legacyCss(css) {
  const source = postcss.parse(css);
  const globals = Object.create(null);
  source.walkRules(rule => {
    if (rule.selectors.some(selector => selector === ':root' || selector === '*' || selector === '::before')) {
      rule.walkDecls(/^--/, declaration => { globals[declaration.prop] = declaration.value; });
    }
  });
  const result = postcss.root();
  source.walkRules(rule => {
    if (rule.parent.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return;
    const variables = { ...globals };
    rule.walkDecls(/^--/, declaration => { variables[declaration.prop] = declaration.value; });
    const fallback = postcss.rule({ selector: rule.selectors.map(selector =>
      /^(html|:root)(?=\b|[\s.#:[>]|$)/.test(selector)
        ? selector.replace(/^(html|:root)/, 'html.mr-legacy-css') : `html.mr-legacy-css ${selector}`).join(',') });
    rule.walkDecls(declaration => {
      if (declaration.prop.startsWith('--')) return;
      if (declaration.prop === 'inset') {
        const values = postcss.list.space(declaration.value);
        const sides = [values[0], values[1] || values[0], values[2] || values[0], values[3] || values[1] || values[0]];
        ['top', 'right', 'bottom', 'left'].forEach((prop, i) => fallback.append(declaration.clone({ prop, value: sides[i] })));
      } else if (declaration.value.includes('var(')) {
        const value = resolvedValue(declaration.value, variables);
        if (value !== null) fallback.append(declaration.clone({ value: legacyAlphaColors(value) }));
      } else {
        const value = legacyAlphaColors(declaration.value);
        if (value !== declaration.value) fallback.append(declaration.clone({ value }));
      }
    });
    if (!fallback.nodes.length) return;
    let wrapped = fallback;
    let parent = rule.parent;
    while (parent.type === 'atrule') {
      const outer = parent.clone({ nodes: [] }); outer.append(wrapped); wrapped = outer; parent = parent.parent;
    }
    result.append(wrapped);
  });
  return result.toString();
}
module.exports = { legacyCss, resolvedValue, legacyAlphaColors };