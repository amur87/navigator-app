module.exports = {
    preset: 'react-native',
    modulePathIgnorePatterns: ['<rootDir>/legacy/'],
    moduleNameMapper: {
        '^react-native-config$': '<rootDir>/__mocks__/react-native-config.js',
        '^react-native-gesture-handler$': '<rootDir>/__mocks__/react-native-gesture-handler.js',
    },
};
