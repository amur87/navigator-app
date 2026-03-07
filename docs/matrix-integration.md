# Matrix Chat Integration

## Required env keys
- `MATRIX_ENABLED=true`
- `MATRIX_HOMESERVER_URL=https://matrix.max.kg`
- `MATRIX_AUTH_MODE=delegated_token`
- `MATRIX_DELEGATED_AUTH_URL=...`
- `MATRIX_DELEGATED_AUTH_API_KEY=...`
- `MATRIX_SUPPORT_SPACE_ID=...`
- `MATRIX_SUPPORT_ROOM_ID=...`
- `MATRIX_SUPPORT_CALL_PHONE=...`

## Supported auth modes
- `delegated_token`: preferred for production. Driver authenticates on Fleetbase side, backend returns Matrix token.
- `access_token`: direct token injection for controlled internal builds.
- `password`: reserved for operational/debug usage only.

## Security notes
- Matrix session is stored in Keychain first, MMKV only as fallback.
- Do not hardcode access tokens or room ids in source.
- Keep delegated auth behind a server endpoint that validates Fleetbase driver identity.
- Use short-lived access tokens and rotate them server-side when possible.
- E2EE is config-driven and must be enabled only after server/device bootstrap is ready.

## E2EE architecture
- E2EE is handled by a separate native backend in [src/services/matrix/e2ee.ts](c:\VScode\delivery_navigator\navigator-app\src\services\matrix\e2ee.ts).
- The old HTTP Matrix layer remains responsible for plain room discovery, non-encrypted fallback flows and delegated auth bootstrap.
- `ChatContext` acts as a router:
  - plain Matrix rooms -> HTTP layer
  - encrypted Matrix rooms -> native E2EE backend
- This avoids mixing olm/megolm state into the legacy REST-only service layer.

## Native stack
- RN SDK: `@unomed/react-native-matrix-sdk`
- Session storage:
  - access token/session -> Keychain/MMKV
  - recovery key -> Keychain
- Native bootstrap currently performs:
  - client restore
  - sync startup
  - cross-signing auto-enable
  - backup auto-enable / recovery bootstrap
  - encrypted room timeline subscription
  - encrypted send/read actions

## Production requirements
- Provide delegated auth endpoint instead of shipping long-lived access tokens in `.env`.
- Invite or provision driver devices into encrypted rooms server-side.
- Define room mapping separately for:
  - support
  - dispatcher
  - customer
- Add device verification/recovery UX before enabling broad production rollout.

## Current client capabilities
- Chat list and dialog screens are Matrix-ready.
- Text, image, location and sticker flows are wired.
- File and voice actions are exposed in UI and reserved for final media policy + native module rollout.
- Space hierarchy is supported: use `MATRIX_SUPPORT_SPACE_ID` for a Matrix space and `MATRIX_SUPPORT_ROOM_ID` for a direct room id when needed.

