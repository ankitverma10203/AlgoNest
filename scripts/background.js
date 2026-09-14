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
    var number = cleanSegment(submission.problemNumber, 'problem');
    var title = cleanSegment(submission.problemSlug, 'untitled-problem');
    var id = cleanSegment(submission.submissionId, 'submission');
    var extension = extensionFor(submission.language);
    return [date, number + '-' + title, id + (extension ? '.' + extension : '')].join('/');
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
      console.log('AlgoNest: GitHub settings loaded.', {
        owner: settings.githubOwner || '(missing)',
        repo: settings.githubRepo || '(missing)',
        branch: settings.githubBranch || '(missing)',
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
      var endpoint = 'https://api.github.com/repos/' + encodeURIComponent(settings.githubOwner) +
        '/' + encodeURIComponent(settings.githubRepo) + '/contents/' +
        path.split('/').map(encodeURIComponent).join('/');
      var headers = {
        Accept: 'application/vnd.github+json',
        Authorization: 'Bearer ' + settings.githubToken,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      };

      console.log('AlgoNest: checking whether GitHub file already exists.', endpoint);

      return fetch(endpoint + '?ref=' + encodeURIComponent(settings.githubBranch), { headers: headers })
        .then(function (response) {
          console.log('AlgoNest: GitHub lookup response:', response.status);
          if (response.status === 404) return null;
          if (!response.ok) throw new Error('GitHub lookup failed (' + response.status + ').');
          return response.json();
        })
        .then(function (existing) {
          var body = {
            message: 'Add ' + path,
            content: encodeContent(submission.code),
            branch: settings.githubBranch
          };
          if (existing && existing.sha) body.sha = existing.sha;
          console.log('AlgoNest: writing submission to GitHub.', {
            path: path,
            updatingExistingFile: Boolean(body.sha)
          });
          return fetch(endpoint, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify(body)
          });
        })
        .then(function (response) {
          console.log('AlgoNest: GitHub write response:', response.status);
          if (!response.ok) {
            return response.json().catch(function () { return {}; }).then(function (body) {
              throw new Error((body.message || 'GitHub commit failed') + ' (' + response.status + ').');
            });
          }
          return {
            path: path,
            repository: settings.githubOwner + '/' + settings.githubRepo,
            branch: settings.githubBranch
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