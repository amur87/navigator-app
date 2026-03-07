// index.native.tsx
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import 'react-native-get-random-values';
import 'react-native-gesture-handler';

console.log('[bootstrap] index.native.tsx loaded', { appName });

AppRegistry.registerComponent(appName, () => App);
