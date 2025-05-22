module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/index.ts'
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }]
  },
  // Add transformIgnorePatterns to handle ESM modules
  transformIgnorePatterns: [
    '/node_modules/(?!(get-windows)/)'
  ],
  // Add mocks for ESM modules
  moduleNameMapper: {
    '^get-windows$': '<rootDir>/tests/mocks/get-windows-mock.js'
  }
};
