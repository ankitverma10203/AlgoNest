(function () {
  'use strict';

  function normalize(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function extensionFor(language) {
    var value = String(language || '').toLowerCase();
    if (value.indexOf('cpp') !== -1 || value.indexOf('c++') !== -1) return 'cpp';
    if (value.indexOf('java') !== -1) return 'java';
    if (value === 'go' || value.indexOf('golang') !== -1) return 'go';
    if (value.indexOf('python') !== -1) return 'py';
    if (value.indexOf('javascript') !== -1 || value === 'js') return 'js';
    if (value.indexOf('typescript') !== -1 || value === 'ts') return 'ts';
    return normalize(language) || 'txt';
  }

  var leetcode = {
    id: 'leetcode',
    matches: function (url) {
      return /(^|\.)leetcode\.com$/.test(url.hostname);
    },
    parseSubmission: function (message) {
      var response = message && message.response;
      var submissionId = response && (response.submission_id || response.submissionId);
      if (!submissionId) return null;
      return {
        submissionId: String(submissionId),
        detailUrl: 'https://leetcode.com/api/submissions/' + encodeURIComponent(submissionId) + '/',
        problemSlug: normalize(response.question_slug || response.question_title_slug || ''),
        problemNumber: response.question_id || '',
        problemTitle: response.question_title || ''
      };
    },
    parseDetail: function (detail) {
      var result = detail && (detail.submission || detail);
      if (!result || !result.code) return null;
      return {
        code: result.code,
        language: result.lang || result.language || '',
        status: result.status_display || result.status || '',
        problemSlug: normalize(result.question_title_slug || result.question_slug || ''),
        problemNumber: result.question_id || '',
        problemTitle: result.question_title || ''
      };
    }
  };

  window.AlgoNestAdapters = {
    normalize: normalize,
    extensionFor: extensionFor,
    all: [leetcode],
    forLocation: function (location) {
      return this.all.find(function (adapter) {
        return adapter.matches(location);
      }) || null;
    }
  };
}());