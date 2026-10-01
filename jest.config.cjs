module.exports = {
  moduleNameMapper: {
    '\\?url$': '<rootDir>/src/test/assetUrlMock.ts',
    '^@haskou/pigeon-swarm-crypto$': '<rootDir>/src/test/valueObjectsMock.ts',
  },
  testPathIgnorePatterns: [
    '/Attachment(Cipher|Cryptographer).spec.ts$',
    '/DeviceIdentityProtector.spec.ts$',
    '/DeviceIdentityVault.spec.ts$',
    '/RecoveryAuthorityKeyPair.spec.ts$',
    '/DeviceAuthorizationTransition.spec.ts$',
    '/DevicePairingInvitation.spec.ts$',
    '/DevicePairingRequest.spec.ts$',
    '/DevicePairingCompletion.spec.ts$',
    '/PigeonDeviceAuthorizationApi.spec.ts$',
  ],
  roots: ['<rootDir>/src'],
  testEnvironment: 'node',
  testMatch: ['**/*.spec.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.jest.json',
      },
    ],
  },
};
