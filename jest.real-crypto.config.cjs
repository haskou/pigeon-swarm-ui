const base = require('./jest.config.cjs');

module.exports = {
  ...base,
  moduleNameMapper: { '\\?url$': '<rootDir>/src/test/assetUrlMock.ts' },
  testMatch: ['**/Attachment{Cipher,Cryptographer}.spec.ts'],
  testPathIgnorePatterns: [],
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: 'tsconfig.real-crypto.json' }],
  },
  transformIgnorePatterns: ['/node_modules/(?!@noble/)'],
};
