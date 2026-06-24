const { defineConfig } = require('electron-builder')

module.exports = defineConfig({
  appId: 'com.sgsi.schoolmanager',
  productName: 'SGSI',
  copyright: 'Copyright © 2024 SchoolManager Pro',
  directories: {
    output: 'dist',
    buildResources: 'build',
  },
  files: [
    'out/**/*',
    'node_modules/**/*',
    'package.json',
  ],
  extraResources: [
    {
      from: '../../node_modules/.prisma',
      to: 'prisma',
      filter: ['**/*'],
    },
  ],
  win: {
    target: [
      { target: 'nsis', arch: ['x64'] },
    ],
    artifactName: 'SGSI-Setup-${version}.${ext}',
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    allowElevation: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'SGSI',
    displayLanguageSelector: false,
    language: '1036',
    license: 'build/license.txt',
  },
  publish: null,
})
