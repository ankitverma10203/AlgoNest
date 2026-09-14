# AlgoNest

A Manifest V3 Chrome extension that watches LeetCode submissions and commits their source code to GitHub.

## Install locally

1. Open `chrome://extensions` and enable **Developer mode**.
2. Choose **Load unpacked** and select this folder.
3. Configure the registered GitHub OAuth App client ID in the `GITHUB_OAUTH_CLIENT_ID` constant in `options.js`.
4. Open the extension options and choose **Sign in with GitHub**.
5. Approve the `repo` permission on GitHub, then select a repository and branch. Settings are saved automatically.

Accepted Java, C++, and Go submissions are written as:

```text
YYYY-MM-DD/problem-number-problem-slug/submission-id.java
YYYY-MM-DD/problem-number-problem-slug/submission-id.cpp
YYYY-MM-DD/problem-number-problem-slug/submission-id.go
```

The site-specific behavior lives in `scripts/site-adapters.js`. To support another coding site, add an adapter with `matches`, `parseSubmission`, and `parseDetail`; the GitHub commit pipeline does not need to change.

## Notes

The extension uses LeetCode's authenticated session in the active tab to read the submitted source. It does not commit until the submission detail is available, and it skips non-accepted submissions when that status is supplied by LeetCode.# AlgoNest
