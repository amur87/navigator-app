const webpack = require('webpack');
const path = require('path');

module.exports = {
    entry: './index.web.tsx',
    resolve: {
        extensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.js', '.jsx', '.mjs'],
        alias: {
            'react-native$': 'react-native-web',
            'react-native-config$': path.resolve(__dirname, 'src/shims/react-native-config.web.js'),
            '@react-native-community/blur$': path.resolve(__dirname, 'src/shims/react-native-blur.web.js'),
            '@invertase/react-native-apple-authentication$': path.resolve(__dirname, 'src/shims/react-native-apple-authentication.web.js'),
            '@shopify/react-native-skia': false,
            'react-native-worklets-core': false,
        },
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'bundle.js',
    },
    module: {
        rules: [
            {
                test: /\.m?js$/,
                resolve: {
                    fullySpecified: false,
                },
            },
            {
                test: /\.(js|ts|tsx)$/,
                exclude: /node_modules[\\/](?!(@gorhom[\\/]bottom-sheet|react-native-reanimated|react-native-signature-canvas|react-native-super-grid|react-native-linear-gradient|react-native-maps-directions|react-native-maps))/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env', '@babel/preset-react'],
                        plugins: [],
                    },
                },
            },
        ],
    },
    devServer: {
        static: {
            directory: path.resolve(__dirname, 'dist'),
        },
        compress: true,
        port: 8080,
        hot: true,
    },
    plugins: [
        new webpack.DefinePlugin({
            __DEV__: JSON.stringify(true),
        }),
    ],
};
