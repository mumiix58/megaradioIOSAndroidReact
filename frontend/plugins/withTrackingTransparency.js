const { withXcodeProject, IOSConfig } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withTrackingTransparency(config) {
  return withXcodeProject(config, c => {
    const name = c.modRequest.projectName;
    const file = `${name}/ATTModule.m`;
    fs.copyFileSync(path.join(__dirname, 'ios/ATTModule.m'), path.join(c.modRequest.platformProjectRoot, file));
    if (!c.modResults.hasFile(file)) IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
      filepath: file, groupName: name, project: c.modResults,
    });
    IOSConfig.XcodeUtils.addFramework({ project: c.modResults, projectName: name, framework: 'AppTrackingTransparency.framework' });
    return c;
  });
};
