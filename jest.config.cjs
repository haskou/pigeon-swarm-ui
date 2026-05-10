module.exports = {
  moduleNameMapper: {
    '^@haskou/value-objects$': '<rootDir>/src/test/valueObjectsMock.ts',
  },
  roots: ['<rootDir>/src'],
  testEnvironment: 'node',
  testMatch: ['**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.jest.json',
      },
    ],
  },
};
