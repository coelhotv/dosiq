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

  // Removido o bloco que injeta use_modular_headers! pois conflita com Hermes e RN 0.76+

  return config;
};

module.exports = withFirebaseFix;
