# AlgoNest

AlgoNest is a Manifest V3 Chrome extension that captures accepted LeetCode solutions and commits them to a GitHub repository.

## How it works

1. The content script runs on LeetCode problem pages.
2. After you click **Submit**, it reads the visible source code, selected language, and rendered submission result from the page.
3. It sends the submission to the extension background service worker.
4. The service worker checks the configured GitHub repository and writes the file through the GitHub Contents API.

AlgoNest does not call the LeetCode submissions API or download submission details. It uses the authenticated LeetCode page already open in your browser and reads its rendered DOM.

## Requirements

- Google Chrome or another Chromium browser with Manifest V3 support
- A logged-in LeetCode account
- A GitHub account
- A GitHub repository where the solution files should be stored

## Install locally

1. Clone or download this repository.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the project folder containing `manifest.json`.

After changing extension files, click **Reload** for AlgoNest on `chrome://extensions`. A fresh install initializes already-open LeetCode tabs; after updating extension files, refresh open LeetCode tabs so the latest content script is loaded.

## Configure GitHub authentication

AlgoNest uses GitHub OAuth device flow.

### For users

The extension already includes AlgoNest's public GitHub OAuth client ID. You do not need to create an OAuth App or supply a client ID.

1. Reload AlgoNest from `chrome://extensions` after installing or updating it.
2. Open the extension options page:
   - Go to `chrome://extensions`.
   - Find **AlgoNest** and click **Details**.
   - Click **Extension options**.
   - Alternatively, right-click the AlgoNest toolbar icon and choose **Options**.
3. Click **Sign in with GitHub**.
4. Copy the temporary verification code shown on the options page, then click **Open GitHub** and enter the code there. You can also use **Copy code** to copy it to your clipboard.
5. Approve the requested `repo` scope.
6. Select the destination repository and branch.
6. Confirm that the options page shows `Branch selected: <branch>.` after the branch is saved.

To disconnect GitHub from AlgoNest, open the options page and click **Disconnect GitHub**. This removes the locally stored token and destination settings; it does not sign the user out of GitHub in the browser.

### For maintainers

To distribute a fork under a different GitHub OAuth App, create one OAuth App, enable **Device Flow**, and replace `GITHUB_OAUTH_CLIENT_ID` in `options.js`. The client ID may be included in the extension, but never include or share the OAuth app's client secret.

The selected repository and branch are saved in `chrome.storage.local`. After a branch is saved, the options page confirms the exact selected branch instead of continuing to show the repository setup prompt. The GitHub access token is also stored locally by the extension and is sent only to GitHub API endpoints.

### Authentication scope

The current OAuth flow requests the GitHub `repo` scope. Selecting one repository in the options page controls where AlgoNest writes, but the token scope itself is not restricted to only that repository. Do not use this version if you require a fine-grained single-repository token until the authentication flow is changed to support one.

## Use AlgoNest

1. Sign in to GitHub and select a repository and branch in the options page.
2. Open a LeetCode problem page while logged in.
3. Select the desired language in LeetCode's language picker.
4. Write or review your solution.
5. Click **Submit**.
6. Wait for the result to show, such as `Accepted`.

When **Commit only accepted submissions** is enabled, non-accepted results are skipped. A successful commit produces a Chrome notification and a console message containing the repository, branch, and path.

## Support and project links

The extension popup and options page include links to:

- [Install AlgoNest from the Chrome Web Store](https://chromewebstore.google.com/detail/kgiiibillccicheeeplpoijdlifpijep?utm_source=item-share-cb)
- [Report a bug](https://github.com/ankitverma10203/AlgoNest/issues/new) by opening a pre-addressed GitHub issue form.
- [AlgoNest on GitHub](https://github.com/ankitverma10203/AlgoNest) for the source repository.
- [Ankit Verma's GitHub profile](https://github.com/ankitverma10203) for the project author credit.

## GitHub file layout

Files are written using this layout:

```text
YYYY-MM-DD/problem-slug/submission-id.extension
YYYY-MM-DD/problem-slug/README.md
```

For example:

```text
2026-09-14/two-sum/1789386838661.java
```

The folder is the problem slug from the LeetCode URL, such as `/problems/two-sum/`. If the language cannot be detected, the file is created without an extension.

`README.md` is created once per problem folder. It includes the title, direct LeetCode link, slug, and language of the first saved solution. GitHub renders it automatically when you open that folder.

## Supported languages

Language aliases and extensions are configured in `scripts/language-config.js`:

| LeetCode language | Extension |
| --- | --- |
| C++ | `.cpp` |
| Java | `.java` |
| Python3 | `.py` |
| Python | `.py` |
| JavaScript | `.js` |
| TypeScript | `.ts` |
| C# | `.cs` |
| C | `.c` |
| Go | `.go` |
| Kotlin | `.kt` |
| Swift | `.swift` |
| Rust | `.rs` |
| Ruby | `.rb` |
| PHP | `.php` |
| Dart | `.dart` |
| Scala | `.scala` |
| Elixir | `.ex` |
| Erlang | `.erl` |
| Racket | `.rkt` |

To add another language, add an entry to the shared configuration:

```js
{ aliases: ['dart'], extension: 'dart' }
```

The same configuration is loaded by both the LeetCode content script and the GitHub commit worker, so detection and file naming stay consistent.

## Debugging

All diagnostic messages use the `AlgoNest:` prefix.

### LeetCode page logs

1. Reload the extension and refresh the LeetCode tab.
2. Open browser DevTools with `F12`.
3. Check the **Console** tab.

Useful messages include:

```text
AlgoNest: content script loaded.
AlgoNest: clicked button labeled: submit
AlgoNest: checking submission result.
AlgoNest: language detected.
AlgoNest: sending submission to background.
```

### Background worker logs

1. Open `chrome://extensions`.
2. Find AlgoNest.
3. Click **Service worker**.
4. Inspect the worker console.

Useful messages include the stored repository settings, GitHub lookup status, GitHub write status, and the final commit location.

### Common issues

- **No content-script logs:** Reload the extension and refresh the LeetCode tab. Confirm the URL is a LeetCode problem page.
- **Code found but status is missing:** Keep the DevTools console open and wait for the result to render. AlgoNest retries result detection for several seconds after Submit.
- **Language is unknown:** Confirm the selected language is visible in LeetCode's language picker, then reload the extension and refresh the tab.
- **Background message failed:** Open the service worker console and check whether the worker was reloaded while the page was still using an older content script.
- **GitHub lookup or write failed:** Verify the selected repository, branch, OAuth approval, and token permissions.
- **Notification icon error:** Reload the extension from `chrome://extensions` so the current service worker and packaged icon are used.

## Project structure

```text
manifest.json                  Extension metadata and permissions
options.html / options.js      GitHub authentication and destination settings
options.css                    Options page styling
popup.html / popup.js          Compact extension popup and settings launcher
popup.css                      Popup styling
privacy.html                   GitHub Pages-ready privacy policy
scripts/language-config.js     Shared language aliases and extensions
scripts/site-adapters.js       LeetCode adapter and data normalization
scripts/content.js             DOM capture and message handoff
scripts/background.js          GitHub commit pipeline and notifications
images/icon.png                Extension and notification icon
```

For architecture, authentication, submission-sync behavior, and file-level responsibilities, see [Implementation details](docs/implementation.md).

## Privacy and security notes

- Source code is read from the active LeetCode page and sent to the configured GitHub repository.
- The extension does not make a LeetCode submissions API request.
- The GitHub token is stored in Chrome local extension storage.
- The requested OAuth `repo` scope can provide access beyond the selected destination repository. Use a separate GitHub account or update the authentication flow if narrower access is required.
