# Implementation details

## Architecture

AlgoNest has two connected flows:

```text
LeetCode page → content script → background service worker → GitHub Contents API
Options page → GitHub device authorization → local extension storage
```

## File responsibilities

| File | What it does |
| --- | --- |
| `manifest.json` | Declares the Manifest V3 extension, permissions, host access, icon, options page, background service worker, and the scripts injected into LeetCode. |
| `options.html` | Contains the GitHub sign-in, temporary verification-code display, repository selector, branch selector, and accepted-only setting. |
| `options.css` | Styles the options page. |
| `options.js` | Runs GitHub OAuth device authorization, displays the temporary user code, stores the access token locally, loads repositories and branches, and saves the selected destination. |
| `scripts/language-config.js` | Defines the shared language-alias-to-file-extension mapping. |
| `scripts/site-adapters.js` | Confirms that the active page is LeetCode and exposes general site-adapter helpers. Its `parseSubmission()` helper is reserved for a future API/message-based flow and is not used by the current DOM-capture flow. |
| `scripts/content.js` | Runs on LeetCode, detects Submit, reads the rendered code/result/title/language, derives the problem slug from the URL, prevents duplicates, and sends the submission to the background service worker. |
| `scripts/background.js` | Checks settings and accepted status, creates the folder README when missing, writes the code file to GitHub, and shows notifications. |
| `privacy.html` | Public privacy-policy page intended for GitHub Pages and the Chrome Web Store Privacy practices URL. |
| `images/icon.png` | Used for the extension, options page, and notifications. |

## Authentication and repository selection

1. The user clicks **Sign in with GitHub** in the options page.
2. `options.js` requests a GitHub device code using the extension's public OAuth client ID and the `repo` scope.
3. GitHub returns a verification URL, a temporary user code, a temporary device code, and a polling interval. The extension opens the verification URL and displays the user code in the options page.
4. The user signs in directly on GitHub and enters the displayed code. AlgoNest never receives the user's GitHub password.
5. The extension polls GitHub until authorization succeeds, then stores the returned access token in `chrome.storage.local`.
6. It uses that token to fetch repositories and branches. Selecting a repository stores its owner, name, and selected branch locally.

The token belongs to the GitHub account that approved the device code. The selected repository may be owned by the user or by an organization the user can access. The requested `repo` scope is broader than the one repository selected in AlgoNest; the extension itself writes only to the selected repository.

## Submission capture and sync

1. `content.js` detects a Submit click and waits for LeetCode to render the result.
2. It reads code from a textarea, Monaco editor, CodeMirror editor, or a fallback `<pre>` element.
3. It reads the submission status, gets the slug from `/problems/<slug>/`, gets the title from Open Graph metadata or the page title, and identifies the selected language.
4. It generates a local submission ID with `Date.now()` and sends the payload to `background.js`.
5. If **Commit only accepted submissions** is enabled, `background.js` skips every status other than an accepted status.
6. It writes the code at `YYYY-MM-DD/problem-slug/submission-id.extension` using the GitHub Contents API.
7. It creates `README.md` in that same problem folder only when it is missing. The README contains the problem title, direct LeetCode link, slug, and first saved language.
8. It sends a local notification showing whether the submission was synced, skipped, or failed.
