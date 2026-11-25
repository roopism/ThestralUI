module.exports = {
  preset: '@react-native/jest-preset',
  roots: ['<rootDir>/tests'],
  testMatch: ['<rootDir>/tests/native/**/*.test.cjs', '<rootDir>/tests/*/native.test.cjs'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@ui-lazy-dev)/)',
  ],
};
