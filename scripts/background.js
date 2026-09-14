importScripts('language-config.js');

(function () {
  'use strict';

  var defaults = {
    githubOwner: '',
    githubRepo: '',
    githubToken: '',
    githubBranch: 'main',
    commitOnlyAccepted: true
  };

  function getSettings() {
    return chrome.storage.local.get(defaults);
  }

  function encodeContent(value) {
    return btoa(unescape(encodeURIComponent(value)));
  }

  function cleanSegment(value, fallback) {
    var segment = String(value || fallback || 'unknown')
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return segment || fallback || 'unknown';
  }

  function extensionFor(language) {
    var value = String(language || '').toLowerCase();
    var languages = globalThis.AlgoNestLanguageConfig || [];
    for (var i = 0; i < languages.length; i += 1) {
      if (languages[i].aliases.some(function (alias) {
        return value === alias || value.indexOf(alias + ' ') === 0;
      })) return languages[i].extension;
    }
    return '';
  }

  function buildPath(submission) {
    var date = new Date().toISOString().slice(0, 10);
    var problemFolder = cleanSegment(submission.problemSlug, 'untitled-problem');
    var id = cleanSegment(submission.submissionId, 'submission');
    var extension = extensionFor(submission.language);
    return [date, problemFolder, id + (extension ? '.' + extension : '')].join('/');
  }

  function buildProblemFile(path) {
    return path.slice(0, path.lastIndexOf('/') + 1) + 'README.md';
  }

  function buildProblemReadme(submission) {
    var title = String(submission.problemTitle || submission.problemSlug || 'LeetCode Problem').trim();
    var slug = String(submission.problemSlug || 'unknown').trim();
    var url = submission.problemUrl || 'https://leetcode.com/problems/' + encodeURIComponent(slug) + '/';
    var language = String(submission.language || 'Unknown').trim();

    return [
      '# ' + title,
      '',
      '- **LeetCode:** [' + title + '](' + url + ')',
      '- **Slug:** `' + slug + '`',
      '- **First saved solution language:** ' + language,
      ''
    ].join('\n');
  }

  function writeFile(endpoint, headers, body) {
    return fetch(endpoint, {
      method: 'PUT',
      headers: headers,
      body: JSON.stringify(body)
    }).then(function (response) {
      if (response.ok) return;
      return response.json().catch(function () { return {}; }).then(function (error) {
        throw new Error((error.message || 'GitHub commit failed') + ' (' + response.status + ').');
      });
    });
  }

  function notify(title, message) {
    console.log('AlgoNest: notification:', title, message);
    var notification = chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('images/icon.png'),
      title: title,
      message: message
    });
    if (notification && typeof notification.catch === 'function') {
      notification.catch(function (error) {
        console.warn('AlgoNest: notification could not be displayed.', error);
      });
    }
  }

  function commitSubmission(submission) {
    console.log('AlgoNest: commit requested.', {
      submissionId: submission && submission.submissionId,
      problemSlug: submission && submission.problemSlug,
      status: submission && submission.status,
      codeLength: submission && submission.code ? submission.code.length : 0
    });
    return getSettings().then(function (settings) {
      var branch = settings.githubBranch || 'main';
      console.log('AlgoNest: GitHub settings loaded.', {
        owner: settings.githubOwner || '(missing)',
        repo: settings.githubRepo || '(missing)',
        branch: branch,
        hasToken: Boolean(settings.githubToken)
      });
      if (!settings.githubOwner || !settings.githubRepo || !settings.githubToken) {
        throw new Error('Configure the GitHub destination and sign in with GitHub in the extension settings.');
      }

      if (settings.commitOnlyAccepted && submission.status) {
        var normalizedStatus = String(submission.status || '').trim().toLowerCase();
        var acceptedStatus = ['accepted', 'ac', 'accepted-without-optimization', 'accepted-like'];
        if (acceptedStatus.indexOf(normalizedStatus) === -1) {
          console.log('AlgoNest: submission skipped because it was not accepted.', submission.status);
          return { skipped: true, reason: 'Submission was not accepted: ' + submission.status };
        }
      }

      var path = buildPath(submission);
      var apiRoot = 'https://api.github.com/repos/' + encodeURIComponent(settings.githubOwner) +
        '/' + encodeURIComponent(settings.githubRepo) + '/contents/';
      var endpoint = apiRoot + path.split('/').map(encodeURIComponent).join('/');
      var problemFile = buildProblemFile(path);
      var problemEndpoint = apiRoot + problemFile.split('/').map(encodeURIComponent).join('/');
      var headers = {
        Accept: 'application/vnd.github+json',
        Authorization: 'Bearer ' + settings.githubToken,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      };

      console.log('AlgoNest: checking whether GitHub files already exist.', { path: path, problemFile: problemFile });

      return fetch(problemEndpoint + '?ref=' + encodeURIComponent(branch), { headers: headers })
        .then(function (response) {
          if (response.status === 404) {
            return writeFile(problemEndpoint, headers, {
              message: 'Add ' + problemFile,
              content: encodeContent(buildProblemReadme(submission)),
              branch: branch
            });
          }
          if (!response.ok) throw new Error('GitHub problem-file lookup failed (' + response.status + ').');
        })
        .then(function () {
          return fetch(endpoint + '?ref=' + encodeURIComponent(branch), { headers: headers });
        })
        .then(function (existing) {
          if (existing.status === 404) return null;
          if (!existing.ok) throw new Error('GitHub submission lookup failed (' + existing.status + ').');
          return existing.json();
        })
        .then(function (existing) {
          var body = {
            message: 'Add ' + path,
            content: encodeContent(submission.code),
            branch: branch
          };
          if (existing && existing.sha) body.sha = existing.sha;
          console.log('AlgoNest: writing submission to GitHub.', {
            path: path,
            updatingExistingFile: Boolean(body.sha)
          });
          return writeFile(endpoint, headers, body);
        })
        .then(function () {
          return {
            path: path,
            repository: settings.githubOwner + '/' + settings.githubRepo,
            branch: branch
          };
        });
    });
  }

  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (!message || message.type !== 'submission-ready') return;
    console.log('AlgoNest: submission-ready message received.', {
      senderTab: sender && sender.tab ? sender.tab.id : null,
      site: message.site
    });
    commitSubmission(message.submission)
      .then(function (result) {
        if (result.skipped) {
          notify('Submission skipped', result.reason || 'Submission was not accepted.');
          sendResponse({ ok: true, skipped: true, reason: result.reason });
          return;
        }
        var location = result.repository + '@' + result.branch + '/' + result.path;
        notify('Submission synced', location);
        console.log('AlgoNest: submission committed.', location);
        sendResponse({ ok: true, path: result.path, repository: result.repository, branch: result.branch });
      })
      .catch(function (error) {
        console.error('AlgoNest: commit failed.', error);
        notify('Submission sync failed', error.message);
        sendResponse({ ok: false, error: error.message });
      });
    return true;
  });
}());
