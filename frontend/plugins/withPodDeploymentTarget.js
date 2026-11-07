const { withPodfile } = require('@expo/config-plugins');

const marker = '# MegaRadio: align legacy iOS pod targets with the app minimum';
const adjustment = `
    ${marker}
    minimum_ios = Gem::Version.new(podfile_properties['ios.deploymentTarget'] || '15.1')
    installer.pods_project.targets.each do |pod_target|
      pod_target.build_configurations.each do |build_config|
        current_ios = build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'].to_s
        if !current_ios.empty? && Gem::Version.correct?(current_ios) && Gem::Version.new(current_ios) < minimum_ios
          build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = minimum_ios.to_s
        end
      end
    end`;

module.exports = function withPodDeploymentTarget(config) {
  return withPodfile(config, cfg => {
    const source = cfg.modResults.contents;
    if (source.includes(marker)) return cfg;
    const anchor = /react_native_post_install\([\s\S]*?\n\s*\)/;
    if (!anchor.test(source)) throw new Error('React Native post-install hook missing');
    cfg.modResults.contents = source.replace(anchor, match => match + '\n' + adjustment);
    return cfg;
  });
};
