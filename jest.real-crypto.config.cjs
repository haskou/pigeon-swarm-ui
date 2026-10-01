const base = require('./jest.config.cjs');

module.exports = {
  ...base,
  moduleNameMapper: { '\\?url$': '<rootDir>/src/test/assetUrlMock.ts' },
  testMatch: [
    '**/Attachment{Cipher,Cryptographer}.spec.ts',
    '**/DeviceIdentityProtector.spec.ts',
    '**/DeviceIdentityVault.spec.ts',
    '**/RecoveryAuthorityKeyPair.spec.ts',
    '**/DeviceAuthorizationTransition.spec.ts',
    '**/DevicePairingInvitation.spec.ts',
    '**/DevicePairingRequest.spec.ts',
    '**/DevicePairingCompletion.spec.ts',
    '**/PigeonDeviceAuthorizationApi.spec.ts',
  ],
  testPathIgnorePatterns: [],
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: 'tsconfig.real-crypto.json' }],
  },
  transformIgnorePatterns: ['/node_modules/(?!@noble/)'],
};
