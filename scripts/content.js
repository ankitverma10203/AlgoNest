(function () {
  'use strict';

  var adapters = window.AlgoNestAdapters;
  var adapter = adapters.forLocation(window.location);

  if (!adapter) return;

  var hook = document.createElement('script');
  hook.src = chrome.runtime.getURL('scripts/page-hook.js');
  hook.onload = function () { hook.remove(); };
  (document.head || document.documentElement).appendChild(hook);

  window.addEventListener('message', function (event) {
    if (event.source !== window || !event.data || event.data.source !== 'algonest') return;
    var submission = adapter.parseSubmission(event.data);
    if (!submission) return;

    fetch(submission.detailUrl, { credentials: 'include' })
      .then(function (response) { return response.json(); })
      .then(function (detail) {
        var parsed = adapter.parseDetail(detail);
        if (!parsed) throw new Error('The submission response did not include source code.');
        chrome.runtime.sendMessage({
          type: 'submission-ready',
          site: adapter.id,
          submission: Object.assign({}, submission, parsed)
        });
      })
      .catch(function (error) {
        chrome.runtime.sendMessage({
          type: 'sync-error',
          message: error.message || 'Could not read the submitted code.'
        });
      });
  });
}());