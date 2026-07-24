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

The renderer owns the placeholder rectangle and reports bounds through typed
IPC. The native view is hidden while settings, update, permission, or welcome
overlays are active because an Electron child view otherwise renders above
renderer content.

## Navigation And Security

- Every view enforces sandboxing, context isolation, web security, and disabled
  Node integration.
- Business Center navigation stays in-app only for
  `http://localhost:3100`.
- External HTTP and HTTPS links open in the system browser.
- Unsupported protocols and popup windows are blocked.
- The login controller keeps its existing `lobsterai://` callback and local
  HTTP callback behavior.

## Local Development

The package is connected as:

```json
"@fudanda/electron-persistent-view": "file:../electron-persistent-view"
```

Build the package before compiling or launching LZClaw:

```powershell
cd D:\AI-AI\electron-persistent-view
npm install
npm run build

cd D:\AI-AI\LZClaw
npm install
npm run compile:electron
npm run electron:dev
```

The login service must be available at `http://localhost:3100`. Business
Center load failures are reported in the renderer with a reload action.
