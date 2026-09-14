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
    if (value.indexOf('cpp') !== -1 || value.indexOf('c++') !== -1) return 'cpp';
    if (value.indexOf('java') !== -1) return 'java';
    if (value === 'go' || value.indexOf('golang') !== -1) return 'go';
    if (value.indexOf('python') !== -1) return 'py';
    if (value.indexOf('javascript') !== -1 || value === 'js') return 'js';
    if (value.indexOf('typescript') !== -1 || value === 'ts') return 'ts';
    return 'txt';
  }

  function buildPath(submission) {
    var date = new Date().toISOString().slice(0, 10);
    var number = cleanSegment(submission.problemNumber, 'problem');
    var title = cleanSegment(submission.problemSlug, 'untitled-problem');
    var id = cleanSegment(submission.submissionId, 'submission');
    var extension = extensionFor(submission.language);
    return [date, number + '-' + title, id + '.' + extension].join('/');
  }

  function notify(title, message) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'images/icon.png',
      title: title,
      message: message
    });
  }

  function commitSubmission(submission) {
    return getSettings().then(function (settings) {
      if (!settings.githubOwner || !settings.githubRepo || !settings.githubToken) {
        throw new Error('Configure the GitHub destination and sign in with GitHub in the extension settings.');
      }

      if (settings.commitOnlyAccepted && submission.status && submission.status !== 'Accepted') {
        return { skipped: true, reason: 'Submission was not accepted.' };
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

      return fetch(endpoint + '?ref=' + encodeURIComponent(settings.githubBranch), { headers: headers })
        .then(function (response) {
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
          return fetch(endpoint, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify(body)
          });
        })
        .then(function (response) {
          if (!response.ok) {
            return response.json().catch(function () { return {}; }).then(function (body) {
              throw new Error((body.message || 'GitHub commit failed') + ' (' + response.status + ').');
            });
          }
          return { path: path };
        });
    });
  }

  chrome.runtime.onMessage.addListener(function (message, sender) {
    if (!message || message.type !== 'submission-ready') return;
    commitSubmission(message.submission)
      .then(function (result) {
        if (result.skipped) return;
        notify('Submission synced', result.path);
      })
      .catch(function (error) {
        notify('Submission sync failed', error.message);
      });
  });
}());