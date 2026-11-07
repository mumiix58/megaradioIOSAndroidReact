// Radix publishes esbuild keepNames helpers that assume configurable Function#name.
// Chromium 38 has non-configurable names. Naming is diagnostic metadata: retain the
// original function when it cannot be renamed, without changing Object.defineProperty.
function compatibleDependencyFunctionNames(code, id) {
  if (!/[\\/]node_modules[\\/]@radix-ui[\\/]/.test(id)) return null;
  const helper = /var __name = \(target, value\) => __defProp\(target, "name", \{ value, configurable: true \}\);/g;
  let changed = false;
  const output = code.replace(helper, () => {
    changed = true;
    return `var __name = (target, value) => {
      var descriptor = typeof target === "function" && Object.getOwnPropertyDescriptor(target, "name");
      return descriptor && descriptor.configurable === false
        ? target
        : __defProp(target, "name", { value, configurable: true });
    };`;
  });
  return changed ? output : null;
}
module.exports = { compatibleDependencyFunctionNames };
