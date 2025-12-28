const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch all files in the monorepo
config.watchFolders = [monorepoRoot];

// Force resolving from monorepo root first to ensure single copies
config.resolver.nodeModulesPaths = [
  path.resolve(monorepoRoot, 'node_modules'),
  path.resolve(projectRoot, 'node_modules'),
];

// Ensure only one copy of react is used - resolve from root
config.resolver.extraNodeModules = new Proxy(
  {
    react: path.resolve(monorepoRoot, 'node_modules/react'),
    'react-dom': path.resolve(monorepoRoot, 'node_modules/react-dom'),
    'react-native': path.resolve(monorepoRoot, 'node_modules/react-native'),
  },
  {
    get: (target, name) => {
      if (target.hasOwnProperty(name)) {
        return target[name];
      }
      // Fall back to monorepo node_modules for everything else
      return path.resolve(monorepoRoot, 'node_modules', name);
    },
  }
);

module.exports = config;
