const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();

const updateFile = (filePath, transform) => {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const current = fs.readFileSync(filePath, 'utf8');
  const next = transform(current);
  if (next === current) {
    return false;
  }

  fs.writeFileSync(filePath, next, 'utf8');
  return true;
};

const ensureFile = (filePath, content) => {
  if (fs.existsSync(filePath)) {
    const current = fs.readFileSync(filePath, 'utf8');
    if (current === content) {
      return false;
    }
  }

  fs.writeFileSync(filePath, content, 'utf8');
  return true;
};

const patchUniffiPackage = () => {
  const packageJsonPath = path.join(rootDir, 'node_modules', 'uniffi-bindgen-react-native', 'package.json');
  updateFile(packageJsonPath, (source) => source.replace('"main": "./typescript/src/index.ts"', '"main": "./index.js"'));

  const indexJsPath = path.join(rootDir, 'node_modules', 'uniffi-bindgen-react-native', 'index.js');
  ensureFile(
    indexJsPath,
    'export * from "./typescript/src/index.ts";\n'
  );
};

const patchUnomedAndroidGradle = () => {
  const gradlePath = path.join(rootDir, 'node_modules', '@unomed', 'react-native-matrix-sdk', 'android', 'build.gradle');
  updateFile(gradlePath, (source) => {
    let next = source;
    const brokenBlock = `  sourceSets {\n    main {\n      if (isNewArchitectureEnabled()) {\n        java.srcDirs += [\n          "generated/java",\n          "generated/jni"\n        ]\n      }\n    }\n  }\n`;
    const fixedBlock = `  sourceSets {\n    main {\n      java.srcDirs += [\n        "generated/java"\n      ]\n\n      if (isNewArchitectureEnabled()) {\n        java.srcDirs += [\n          "generated/jni"\n        ]\n      }\n    }\n  }\n`;

    if (next.includes(brokenBlock)) {
      next = next.replace(brokenBlock, fixedBlock);
    }

    next = next.replace(
      '    ndk {\n      abiFilters "arm64-v8a", "armeabi-v7a"\n    }\n',
      '    ndk {\n      abiFilters "arm64-v8a", "armeabi-v7a", "x86_64", "x86"\n    }\n'
    );

    return next;
  });
};

const patchUnomedCMake = () => {
  const cmakePath = path.join(rootDir, 'node_modules', '@unomed', 'react-native-matrix-sdk', 'android', 'CMakeLists.txt');
  updateFile(cmakePath, (source) => {
    let next = source;

    if (!next.includes('set(CMAKE_OBJECT_PATH_MAX 128)')) {
      next = next.replace(
        'set (CMAKE_VERBOSE_MAKEFILE ON)\nset (CMAKE_CXX_STANDARD 17)\n',
        'set (CMAKE_VERBOSE_MAKEFILE ON)\nset (CMAKE_CXX_STANDARD 17)\nset(CMAKE_OBJECT_PATH_MAX 128)\n'
      );
    }

    next = next.replace(
      /execute_process\([\s\S]*?get_filename_component\(UNIFFI_BINDGEN_PATH "\$\{UNIFFI_BINDGEN_PATH\}" DIRECTORY\)\n/m,
      'set(UNIFFI_BINDGEN_PATH "C:/ubrn")\nset(MATRIX_SDK_ROOT "C:/mxsdk")\n'
    );

    next = next.replace(
      '    ../cpp\n    ../cpp/generated\n\n    ${UNIFFI_BINDGEN_PATH}/cpp/includes\n',
      '    ${MATRIX_SDK_ROOT}/cpp\n    ${MATRIX_SDK_ROOT}/cpp/generated\n\n    ${UNIFFI_BINDGEN_PATH}/cpp/includes\n'
    );

    next = next.replace(
      /add_library\(unomed-react-native-matrix-sdk\s+SHARED[\s\S]*?cpp-adapter\.cpp\n\)/m,
      `add_library(unomed-react-native-matrix-sdk            SHARED
    \${MATRIX_SDK_ROOT}/cpp/unomed-react-native-matrix-sdk.cpp
    \${MATRIX_SDK_ROOT}/cpp/generated/matrix_sdk.cpp
    \${MATRIX_SDK_ROOT}/cpp/generated/matrix_sdk_base.cpp
    \${MATRIX_SDK_ROOT}/cpp/generated/matrix_sdk_common.cpp
    \${MATRIX_SDK_ROOT}/cpp/generated/matrix_sdk_crypto.cpp
    \${MATRIX_SDK_ROOT}/cpp/generated/matrix_sdk_ffi.cpp
    \${MATRIX_SDK_ROOT}/cpp/generated/matrix_sdk_ui.cpp
    cpp-adapter.cpp
)`
    );

    return next;
  });
};

const patchNitroSoundAndroid = () => {
  const kotlinPath = path.join(
    rootDir,
    'node_modules',
    'react-native-nitro-sound',
    'nitrogen',
    'generated',
    'android',
    'kotlin',
    'com',
    'margelo',
    'nitro',
    'sound',
    'HybridSoundSpec.kt'
  );

  updateFile(kotlinPath, (source) => {
    let next = source;

    next = next.replace(
      `\n  init {\n    super.updateNative(mHybridData)\n  }\n\n  override fun updateNative(hybridData: HybridData) {\n    mHybridData = hybridData\n    super.updateNative(hybridData)\n  }\n`,
      '\n'
    );

    return next;
  });
};

patchUniffiPackage();
patchUnomedAndroidGradle();
patchUnomedCMake();
patchNitroSoundAndroid();
