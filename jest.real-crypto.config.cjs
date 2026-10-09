const base = require('./jest.config.cjs');

module.exports = {
  ...base,
  moduleNameMapper: { '\\?url$': '<rootDir>/src/test/assetUrlMock.ts' },
  testTimeout: 30000,
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
    '**/CommunityOperationSigner.spec.ts',
    '**/ConversationOperationSigner.spec.ts',
    '**/CallEventSigner.spec.ts',
    '**/MlsGroup.spec.ts',
    '**/MlsCommunityEngine.spec.ts',
  ],
  testPathIgnorePatterns: [],
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: 'tsconfig.real-crypto.json' }],
  },
  transformIgnorePatterns: ['/node_modules/(?!@noble/|ts-mls/|@haskou/pigeon-swarm-crypto/)'],
};
