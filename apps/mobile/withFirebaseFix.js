const { withAppDelegate, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withFirebaseFix = (config) => {
  // 1. Injeta no AppDelegate.swift
  config = withAppDelegate(config, config => {
    if (config.modResults.language === 'swift') {
      let contents = config.modResults.contents;

      if (!contents.includes('import FirebaseCore')) {
        contents = contents.replace(
          /import Expo/g,
          `import Expo\nimport FirebaseCore`
        );
      }

      const configureLine = `FirebaseApp.configure()`;
      if (!contents.includes(configureLine)) {
        contents = contents.replace(
          /(public override func application\(\s*_ application: UIApplication,\s*didFinishLaunchingWithOptions launchOptions: \[UIApplication\.LaunchOptionsKey: Any\]\? = nil\s*\) -> Bool \{)/,
          `$1\n    ${configureLine}`
        );
      }

      config.modResults.contents = contents;
    }
    return config;
  });

  // 2. Garante que o useModularHeaders: true e use_modular_headers! fiquem no Podfile
  // já que o expo-build-properties pode estar falhando
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      
      if (fs.existsSync(podfilePath)) {
        let contents = await fs.promises.readFile(podfilePath, 'utf-8');
        
        if (!contents.includes('use_modular_headers!')) {
          contents = contents.replace(
            /(prepare_react_native_project!)/,
            `$1\n\nuse_modular_headers!\n`
          );
          await fs.promises.writeFile(podfilePath, contents);
        }
      }
      return config;
    },
  ]);

  return config;
};

module.exports = withFirebaseFix;
