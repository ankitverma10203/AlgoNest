(function () {
  'use strict';

  var submitPattern = /\/problems\/[^/]+\/submit\/|\/submit\/.*\/check/;
  var originalFetch = window.fetch;

  function publish(response) {
    if (!response || typeof response.clone !== 'function') return;
    response.clone().json().then(function (body) {
      if (body && (body.submission_id || body.submissionId)) {
        window.postMessage({
          source: 'algonest',
          type: 'submission-created',
          response: body
        }, '*');
      }
    }).catch(function () {});
  }

  window.fetch = function () {
    var request = arguments[0];
    var url = typeof request === 'string' ? request : request && request.url;
    var promise = originalFetch.apply(this, arguments);
    if (url && submitPattern.test(url)) promise.then(publish).catch(function () {});
    return promise;
  };
}());