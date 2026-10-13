/**
 * One `jest` run with two projects. `unit` maps `@haskou/pigeon-swarm-crypto`
 * to the deterministic fake in `src/test/valueObjectsMock.ts`. `crypto` runs
 * the specs below against the real library: signatures, KEMs, KDFs and wire
 * vectors that a fake cannot exercise. Each spec belongs to exactly one
 * project.
 */
const REAL_CRYPTO_SPECS = [
  'AttachmentCipher',
  'AttachmentCryptographer',
  'CallEventSigner',
  'CommunityOperationSigner',
  'ConversationOperationSigner',
  'DeviceAuthorizationTransition',
  'DeviceAuthorizationTransition.vectors',
  'DeviceIdentityProtector',
  'DeviceIdentityVault',
  'DevicePairingCompletion',
  'DevicePairingInvitation',
  'DevicePairingRequest',
  'DeviceSealedSecretCipher',
  'DirectMessageAuthorship',
  'DirectMessageHistoryTransfer',
  'DirectMessageMailbox',
  'DirectMessageMailboxAvailability',
  'DirectMessageReaderSet',
  'GroupMailboxKeySchedule',
  'IdentityAdmissionProof',
  'IdentityAdmissionProof.vectors',
  'IdentityMailboxHomeTrust',
  'IdentityMailboxHomeVerifier',
  'IdentitySignaturePayloadFactory',
  'KeychainCipher.vectors',
  'MailboxCapability',
  'MailboxChannel',
  'MailboxCreationProof',
  'MailboxCreationProof.vectors',
  'MailboxEnvelopeCipher',
  'MailboxKeySchedule',
  'MailboxReadToken',
  'MlsCommunityEngine',
  'MlsGroup',
  'PigeonApiGateway',
  'PigeonConversationsApi.readUntilVectors',
  'PigeonDeviceAuthorizationApi',
  'PigeonDeviceSealedSecretApi',
  'PigeonIdentityCommandsApi',
  'RecipientMailboxRouter',
  'RecoveryAuthorityKeyPair',
  'RequestSigner.vectors',
];

const realCryptoSpec = `/(${REAL_CRYPTO_SPECS.join('|').replaceAll('.', '\\.')})\\.spec\\.ts$`;
const assetUrl = { '\\?url$': '<rootDir>/src/test/assetUrlMock.ts' };
const shared = {
  clearMocks: true,
  rootDir: __dirname,
  roots: ['<rootDir>/src'],
  testEnvironment: 'node',
};

module.exports = {
  projects: [
    {
      ...shared,
      displayName: 'unit',
      moduleNameMapper: {
        ...assetUrl,
        '^@haskou/pigeon-swarm-crypto$':
          '<rootDir>/src/test/valueObjectsMock.ts',
      },
      testMatch: ['**/*.spec.ts'],
      testPathIgnorePatterns: ['/node_modules/', realCryptoSpec],
      transform: {
        '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }],
      },
    },
    {
      ...shared,
      displayName: 'crypto',
      moduleNameMapper: assetUrl,
      testRegex: realCryptoSpec,
      transform: {
        '^.+\\.[tj]s$': ['ts-jest', { tsconfig: 'tsconfig.real-crypto.json' }],
      },
      transformIgnorePatterns: [
        '/node_modules/(?!@noble/|ts-mls/|@haskou/pigeon-swarm-crypto/)',
      ],
    },
  ],
  // Jest reads the timeout only at the top level. Real KDFs and signatures
  // need more than the 5 s default when the projects share the workers.
  testTimeout: 30000,
};
