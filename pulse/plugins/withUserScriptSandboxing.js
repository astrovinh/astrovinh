const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withUserScriptSandboxing(config) {
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

module.exports = withUserScriptSandboxing;
