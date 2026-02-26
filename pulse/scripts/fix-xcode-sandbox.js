#!/usr/bin/env node
/**
 * Patches ENABLE_USER_SCRIPT_SANDBOXING = NO into all buildSettings blocks
 * in the main Xcode project. Run after `expo prebuild`.
 *
 * Xcode 15+ enables sandboxing by default, which blocks CocoaPods scripts
 * (like [CP] Copy Pods Resources) from writing temporary files during build.
 */
const fs = require('fs');
const path = require('path');

const iosDir = path.join(__dirname, '..', 'ios');

if (!fs.existsSync(iosDir)) {
  console.log('ios/ directory not found — run expo prebuild first.');
  process.exit(1);
}

const xcodeprojs = fs.readdirSync(iosDir).filter(f => f.endsWith('.xcodeproj'));

let patched = 0;
for (const xcp of xcodeprojs) {
  const pbxprojPath = path.join(iosDir, xcp, 'project.pbxproj');
  if (!fs.existsSync(pbxprojPath)) continue;

  let content = fs.readFileSync(pbxprojPath, 'utf8');
  if (content.includes('ENABLE_USER_SCRIPT_SANDBOXING')) {
    console.log(`${xcp}: ENABLE_USER_SCRIPT_SANDBOXING already present, skipping.`);
    continue;
  }

  content = content.replace(
    /([ \t]*)buildSettings = \{/g,
    '$1buildSettings = {\n$1\tENABLE_USER_SCRIPT_SANDBOXING = NO;'
  );
  fs.writeFileSync(pbxprojPath, content);
  patched++;
  console.log(`${xcp}: patched ENABLE_USER_SCRIPT_SANDBOXING = NO`);
}

if (patched === 0 && xcodeprojs.length > 0) {
  console.log('Nothing to patch (already set).');
} else if (patched > 0) {
  console.log('Done. You can now build with: npx expo run:ios');
}
