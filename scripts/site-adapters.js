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

  function findNestedValue(node, candidates) {
    if (!node || typeof node !== 'object') return '';
    var keys = Object.keys(node);
    for (var i = 0; i < keys.length; i += 1) {
      var key = keys[i];
      if (candidates.indexOf(key) !== -1 && node[key] !== undefined && node[key] !== null && node[key] !== '') {
        return node[key];
      }
      if (key === 'data' || key === 'submission' || key === 'result' || key === 'body' || key === 'response') {
        var nested = findNestedValue(node[key], candidates);
        if (nested !== '') return nested;
      }
    }
    return '';
  }

  var leetcode = {
    id: 'leetcode',
    matches: function (url) {
      return /(^|\.)leetcode\.com$/.test(url.hostname);
    },
    parseSubmission: function (message) {
      var response = message && message.response;
      if (!response || typeof response !== 'object') return null;

      var submissionId = response.submission_id || response.submissionId ||
        findNestedValue(response, ['submission_id', 'submissionId']) || '';
      if (!submissionId) return null;

      var code = response.code || response.solution || response.source || response.submission_code ||
        findNestedValue(response, ['code', 'solution', 'source', 'submission_code', 'code_snippet', 'text', 'answer']) || '';
      var language = response.lang || response.language ||
        findNestedValue(response, ['lang', 'language']) || '';
      var status = response.status_display || response.status ||
        findNestedValue(response, ['status_display', 'status']) || 'Accepted';
      var problemSlug = response.question_slug || response.question_title_slug ||
        findNestedValue(response, ['question_slug', 'question_title_slug']) || '';
      var problemNumber = response.question_id || findNestedValue(response, ['question_id']) || '';
      var problemTitle = response.question_title || findNestedValue(response, ['question_title']) || '';

      return {
        submissionId: String(submissionId),
        problemSlug: normalize(problemSlug),
        problemNumber: problemNumber,
        problemTitle: problemTitle,
        code: code,
        language: language,
        status: status
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