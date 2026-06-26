const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Production hardening: tell Terser that browser globals are always available.
// This lets dead_code elimination remove the Node.js `eval('require')` branch
// inside the uuid package's uuidv4() — that branch is unreachable in WebView.
config.transformer = {
  ...config.transformer,
  minifierConfig: {
    ...config.transformer?.minifierConfig,
    compress: {
      ...config.transformer?.minifierConfig?.compress,
      dead_code: true,
      global_defs: {
        // In WebView, typeof crypto === 'object' always → dead branch removed
        'typeof crypto': '"object"',
        'typeof window': '"object"',
      },
    },
    // Disable source-map injection that could introduce eval()-based mappings
    sourceMap: false,
  },
};

module.exports = config;
