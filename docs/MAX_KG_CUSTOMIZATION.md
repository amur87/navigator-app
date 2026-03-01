# Кастомизация Navigator под `max.kg`

Ниже список всех ключевых мест, где меняется бренд приложения (имя, логотип, иконки, splash, идентификаторы).

## 1) Название приложения

- **RN display name**: `app.json`
  - `displayName`: отображаемое имя приложения.
- **Android launcher name**: `android/app/src/main/res/values/strings.xml`
  - `app_name`: подпись под иконкой в Android.
- **iOS display name**: `ios/NavigatorApp/Info.plist`
  - `CFBundleDisplayName` и `FacebookDisplayName` берутся из `$(APP_NAME)`.
  - Значение `APP_NAME` задаётся в `.env`.

Пример для `.env`:

```env
APP_NAME=max.kg
```

## 2) Название в интерфейсе приложения

- `src/navigation/DriverNavigator.tsx`
  - Заголовок в шапке использует `config('APP_NAME', 'max.kg')`.
  - При необходимости можно задать через переменную окружения `APP_NAME`.

## 3) Логотип в интерфейсе (шапка)

- `src/navigation/DriverNavigator.tsx`
  - Сейчас используется: `assets/navigator-icon-transparent.png`.
- Чтобы поставить логотип max.kg:
  1. Подготовьте png (рекомендуемо квадратный, прозрачный фон).
  2. Замените файл `assets/navigator-icon-transparent.png`.

## 4) Иконка приложения (launcher/app icon)

Исходник:
- `assets/app-icon.png`

Генерация платформенных иконок:

```bash
yarn generate:app-icon
```

Команда обновит иконки в:
- Android: `android/app/src/main/res/mipmap-*`
- iOS: `ios/NavigatorApp/Images.xcassets/AppIcon.appiconset`

## 5) Splash / launch screen

Исходник:
- `assets/splash-screen.png`

Перегенерация splash:

```bash
yarn generate:launch-screen
```

Команда обновит splash-ресурсы для iOS/Android (через `react-native-bootsplash`).

## 6) Ссылки, идентификаторы и deep link под бренд

В `.env` проверьте:

```env
APP_IDENTIFIER=kg.max.app
APP_LINK_PREFIX=maxkg
```

Используются в:
- Android `applicationId`: `android/app/build.gradle`
- iOS bundle id/url schemes: `ios/NavigatorApp/Info.plist`

## 7) Тексты локализации с именем бренда

- `translations/en.json`
- `translations/ru.json`

Ключ `common.navigator` можно держать как `max.kg`.

---

Если нужно, следующим шагом могу сделать отдельный `max.kg` логотип в шапке через новый файл (`assets/maxkg-logo.png`) и подключить его вместо текущего.
