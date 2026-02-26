const { withDangerousMod, withXcodeProject } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Patch main app project (pulse.xcodeproj/project.pbxproj)
function withMainProjectSandboxFix(config) {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const buildConfigs = project.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(buildConfigs)) {
      const bc = buildConfigs[key];
      if (bc && typeof bc === 'object' && bc.buildSettings) {
        bc.buildSettings.ENABLE_USER_SCRIPT_SANDBOXING = 'NO';
      }
    }
    return config;
  });
}

// Patch Pods project via Podfile post_install hook
function withPodsSandboxFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf8');
      if (!podfile.includes('ENABLE_USER_SCRIPT_SANDBOXING')) {
        podfile +=
          '\npost_install do |installer|\n' +
          '  installer.pods_project.targets.each do |target|\n' +
          '    target.build_configurations.each do |config|\n' +
          "      config.build_settings['ENABLE_USER_SCRIPT_SANDBOXING'] = 'NO'\n" +
          '    end\n' +
          '  end\n' +
          'end\n';
        fs.writeFileSync(podfilePath, podfile);
      }
      return config;
    },
  ]);
}

function withUserScriptSandboxing(config) {
  config = withMainProjectSandboxFix(config);
  config = withPodsSandboxFix(config);
  return config;
}

module.exports = withUserScriptSandboxing;
