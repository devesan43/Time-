import fs from 'fs';
import path from 'path';

const manifestPath = path.resolve('android/app/src/main/AndroidManifest.xml');
const pluginSrcPath = path.resolve('android-src/ChronosUsageStatsPlugin.java');
const targetPluginDir = path.resolve('android/app/src/main/java/com/chronos/screentime');

export function configureAndroidManifest() {
  if (!fs.existsSync(manifestPath)) {
    console.log('AndroidManifest.xml not found yet at:', manifestPath);
    return;
  }

  let content = fs.readFileSync(manifestPath, 'utf8');

  // 1. Ensure xmlns:tools namespace exists so tools:ignore is valid XML
  if (!content.includes('xmlns:tools=')) {
    content = content.replace(
      '<manifest',
      '<manifest xmlns:tools="http://schemas.android.com/tools"'
    );
  }

  // 2. Insert required permissions cleanly before <application>
  if (!content.includes('PACKAGE_USAGE_STATS')) {
    const permissions = `
    <!-- Android Screen Time & Usage Stats Permissions -->
    <uses-permission android:name="android.permission.PACKAGE_USAGE_STATS" tools:ignore="ProtectedPermissions" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />

`;
    content = content.replace(/<application/, `${permissions}    <application`);
  }

  fs.writeFileSync(manifestPath, content, 'utf8');
  console.log('✅ AndroidManifest.xml successfully configured with valid XML namespaces and permissions.');

  // 3. Copy Native Java Plugin into Android project if source exists
  if (fs.existsSync(pluginSrcPath)) {
    if (!fs.existsSync(targetPluginDir)) {
      fs.mkdirSync(targetPluginDir, { recursive: true });
    }
    const targetPluginFile = path.join(targetPluginDir, 'ChronosUsageStatsPlugin.java');
    fs.copyFileSync(pluginSrcPath, targetPluginFile);
    console.log('✅ ChronosUsageStatsPlugin.java successfully copied to:', targetPluginFile);
  }
}

configureAndroidManifest();
