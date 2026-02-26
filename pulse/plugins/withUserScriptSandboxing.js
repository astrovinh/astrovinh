const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withUserScriptSandboxing(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const iosDir = config.modRequest.platformProjectRoot;

      // 1. Patch main project pbxproj — direct text replacement
      //    (withXcodeProject silently drops new keys; bypassing it entirely)
      const xcodeprojs = fs.readdirSync(iosDir).filter(f => f.endsWith('.xcodeproj'));
      for (const xcp of xcodeprojs) {
        const pbxprojPath = path.join(iosDir, xcp, 'project.pbxproj');
        if (fs.existsSync(pbxprojPath)) {
          let pbxproj = fs.readFileSync(pbxprojPath, 'utf8');
          if (!pbxproj.includes('ENABLE_USER_SCRIPT_SANDBOXING')) {
            pbxproj = pbxproj.replace(
              /([ \t]*)buildSettings = \{/g,
              '$1buildSettings = {\n$1\tENABLE_USER_SCRIPT_SANDBOXING = NO;'
            );
            fs.writeFileSync(pbxprojPath, pbxproj);
          }
        }
      }

      // 2. Patch Podfile — post_install hook for Pods project
      const podfilePath = path.join(iosDir, 'Podfile');
      if (fs.existsSync(podfilePath)) {
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
      }

      return config;
    },
  ]);
}

module.exports = withUserScriptSandboxing;
