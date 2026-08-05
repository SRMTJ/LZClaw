# LZClaw Persistent Web Views

## Purpose

LZClaw hosts the welcome-page login and Business Center as Electron
`WebContentsView` instances. Both use the main-process-only
`@fudanda/electron-persistent-view` package and one dedicated Chromium session:

```text
persist:lzclaw-web
```

The package owns generic Session and view lifecycle behavior. LZClaw owns all
authentication, IPC, allowed-origin, deep-link, external-navigation, and UI
state decisions.

## Session And Authentication

- Desktop login still uses the local callback server and exchanges a one-time
  authorization code for native access and refresh tokens.
- If the login service completes its browser-mode flow and navigates the
  embedded view to `/users` without invoking the desktop callback, the main
  process reads the HttpOnly web-session cookie and exchanges it through the
  refresh endpoint. On success it stores the native tokens, closes the login
  view, and tells the renderer to restore authenticated state. On failure the
  view returns to the desktop login URL instead of exposing Business Center.
- After exchange, the refresh token is stored as the HttpOnly
  `lzclaw_web_session` cookie in the dedicated web Session.
- The cookie is restored from the native token store during startup before
  either web view can open.
- Browser login remains independent. The browser receives its own cookie from
  `lzclaw-login-v1`; Electron does not copy cookies into an external browser.
- Native logout closes both views and clears the entire dedicated Session.
- A Business Center navigation to `http://localhost:3100/login` means its web
  session was revoked or expired. Main clears native auth and notifies the
  renderer, which returns to the blocking welcome page.
- Logout and token refresh do not restart the OpenClaw gateway.

## View Lifecycle

The embedded login view is created for a login attempt and closed after the
attempt finishes. The Business Center view is created on first use, hidden
when another menu or renderer overlay is active, and shown again without a
reload. It is closed only on logout or window shutdown.

Both controllers inspect the package's `open()` result. A current request is
reported as successful only when the package returns `opened`; a closed login
attempt is cancelled, and a closed Business Center attempt remains retryable.
An older Business Center request may settle after a newer open or close, so its
result is checked against the controller operation ID before updating IPC
state.

The renderer owns the placeholder rectangle and reports bounds through typed
IPC. The native view is hidden while settings, update, permission, or welcome
overlays are active because an Electron child view otherwise renders above
renderer content.

## Navigation And Security

- Every view disables Node integration in the main frame, workers, and
  subframes; enables sandboxing, context isolation, and web security; and
  disables insecure mixed content, WebView tags, experimental features, and
  host-provided Blink feature flags.
- Business Center navigation stays in-app only for
  `http://localhost:3100`.
- External HTTP and HTTPS links open in the system browser.
- Unsupported protocols and popup windows are blocked.
- The dedicated `persist:lzclaw-web` Session denies permission checks and
  permission requests by default. Any future camera, microphone, notification,
  geolocation, or device permission must be added as an explicit,
  origin-scoped product decision.
- The login controller keeps its existing `lobsterai://` callback and local
  HTTP callback behavior.
- Web-session recovery is accepted only for a completed main-frame navigation
  to the configured portal origin's `/users` route. Cookie and token access
  remain in the main process.

## Dependency And Local Development

LZClaw uses the public package with an exact version:

```json
"@fudanda/electron-persistent-view": "0.5.0"
```

Install dependencies before compiling or launching LZClaw:

```powershell
cd D:\AI-AI\LZClaw
npm install
npm run compile:electron
npm run electron:dev
```

Package development continues in `D:\AI-AI\electron-persistent-view`, but
LZClaw should only switch back to a local `file:` dependency for an explicitly
requested package integration test. Restore the exact published version before
committing LZClaw changes.

The login service must be available at `http://localhost:3100`. Business
Center load failures are reported in the renderer with a reload action.
