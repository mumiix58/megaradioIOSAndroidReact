const { withAppBuildGradle } = require('@expo/config-plugins');

// Keep generated Android builds subject to the same upload-key guard as this checkout.
module.exports = config => withAppBuildGradle(config, c => {
  const script = "apply from: new File(rootProject.projectDir, '../scripts/android-release-signing.gradle')";
  c.modResults.contents = c.modResults.contents.replace(
    /(release\s*\{[\s\S]*?)\n\s*signingConfig signingConfigs\.debug\b/,
    '$1\n            // Release signing is supplied by EAS or the external Play upload credentials.'
  );
  if (!c.modResults.contents.includes(script)) c.modResults.contents += `\n${script}\n`;
  return c;
});
