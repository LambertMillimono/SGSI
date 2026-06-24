module.exports = {
  appId:           'com.sgsi.gestionscolaire',
  productName:     'SGSI Gestion Scolaire Pro',
  copyright:       'Copyright © 2024-2026 Lambert Millimono',
  electronVersion: '31.7.7',

  directories: {
    output:         'dist',
    buildResources: 'build',
  },

  files: [
    'out/**/*',
    'node_modules/**/*',
    'package.json',
    {
      from:   '../../node_modules/.prisma',
      to:     'node_modules/.prisma',
      filter: ['**/*'],
    },
  ],

  asarUnpack: [
    'node_modules/.prisma/client/query_engine*',
    'node_modules/.prisma/client/libquery_engine*',
    'node_modules/@prisma/engines/**/*',
  ],

  win: {
    icon: 'build/icon.ico',
    target: [
      { target: 'nsis', arch: ['x64'] },
    ],
    artifactName: 'SGSI-GestionScolaire-Setup-${version}.${ext}',
    requestedExecutionLevel: 'requireAdministrator',
  },

  nsis: {
    oneClick:                           false,
    allowToChangeInstallationDirectory: true,
    allowElevation:                     true,
    createDesktopShortcut:              true,
    createStartMenuShortcut:            true,
    shortcutName:                       'SGSI Gestion Scolaire',
    displayLanguageSelector:            false,
    language:                           '1036',
    license:                            'build/license.txt',
  },

  publish: null,
}
