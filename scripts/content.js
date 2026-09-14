(function () {
  'use strict';

  var adapters = window.AlgoNestAdapters;
  var adapter = adapters.forLocation(window.location);

  console.log('AlgoNest: content script loaded.', window.location.href);

  if (!adapter) {
    console.log('AlgoNest: no site adapter matched this page.');
    return;
  }

  console.log('AlgoNest: site adapter initialized.', adapter.id);

  var lastSubmissionKey = '';
  var submitTimer = null;
  var statusCheckAttempts = 0;

  function readCodeFromPage() {
    var selectors = [
      'textarea:not([aria-hidden="true"])',
      '.monaco-editor .view-lines',
      '.CodeMirror-code',
      'pre'
    ];

    for (var i = 0; i < selectors.length; i += 1) {
      var element = document.querySelector(selectors[i]);
      var value = element && ('value' in element ? element.value : element.textContent);
      if (value && value.trim()) return value.trim();
    }

    return '';
  }

  function readStatusFromPage() {
    var selectors = [
      '[role="alert"]',
      '[data-e2e-locator="submission-result"]',
      '[class*="result"]'
    ];
    var statusPattern = /Accepted|Wrong Answer|Time Limit Exceeded|Runtime Error|Memory Limit Exceeded|Compile Error/i;

    for (var i = 0; i < selectors.length; i += 1) {
      var elements = document.querySelectorAll(selectors[i]);
      for (var j = 0; j < elements.length; j += 1) {
        var match = statusPattern.exec(elements[j].textContent || '');
        if (match) return match[0];
      }
    }

    var pageText = document.body ? document.body.innerText : '';
    var pageMatch = statusPattern.exec(pageText || '');
    if (pageMatch) return pageMatch[0];

    return '';
  }

  function readProblemMeta() {
    var slugMatch = /\/problems\/([^/]+)/.exec(window.location.pathname || '');
    var slug = slugMatch ? slugMatch[1] : '';
    var title = document.title || '';
    var cleanedTitle = title.replace(/\s*[-|].*$/, '').trim();

    return {
      problemSlug: slug,
      problemNumber: slug,
      problemTitle: cleanedTitle || slug || ''
    };
  }

  function readLanguageFromPage() {
    var languages = globalThis.AlgoNestLanguageConfig || [];
    var elements = document.querySelectorAll(
      'button[aria-haspopup="dialog"][aria-controls], select, [role="combobox"], button'
    );

    for (var i = 0; i < elements.length; i += 1) {
      var element = elements[i];
      var value = element.tagName === 'SELECT'
        ? element.value
        : (element.innerText || element.textContent);
      var normalized = String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
      for (var j = 0; j < languages.length; j += 1) {
        var alias = languages[j].aliases.find(function (item) {
          return normalized.indexOf(item) !== -1;
        });
        if (alias) {
          console.log('AlgoNest: language detected.', {
            label: normalized,
            language: alias
          });
          return alias;
        }
      }
    }

    console.warn('AlgoNest: language could not be detected.');
    return 'unknown';
  }

  function submitFromPage() {
    var code = readCodeFromPage();
    var status = readStatusFromPage();
    console.log('AlgoNest: checking submission result.', {
      hasCode: Boolean(code),
      codeLength: code.length,
      status: status || '(not found)'
    });
    if (!code || !status) {
      console.log('AlgoNest: submission not sent because code or status is missing.');
      if (code && !status && statusCheckAttempts < 5) {
        statusCheckAttempts += 1;
        console.log('AlgoNest: result not rendered yet; retrying.', statusCheckAttempts);
        submitTimer = window.setTimeout(submitFromPage, 1000);
      }
      return;
    }

    statusCheckAttempts = 0;

    var meta = readProblemMeta();
    var language = readLanguageFromPage();
    var submissionKey = meta.problemSlug + '|' + status + '|' + code;
    if (submissionKey === lastSubmissionKey) {
      console.log('AlgoNest: duplicate submission ignored.');
      return;
    }
    lastSubmissionKey = submissionKey;

    var payload = {
      submissionId: String(Date.now()),
      problemSlug: meta.problemSlug,
      problemNumber: meta.problemNumber,
      problemTitle: meta.problemTitle,
      code: code,
      language: language,
      status: status
    };

    try {
      if (!chrome.runtime || !chrome.runtime.id) {
        console.warn('AlgoNest: extension runtime is unavailable.');
        return;
      }

      console.log('AlgoNest: sending submission to background.', {
        problemSlug: meta.problemSlug,
        status: status,
        language: language,
        codeLength: code.length
      });
      chrome.runtime.sendMessage({
        type: 'submission-ready',
        site: adapter.id,
        submission: payload
      }, function (response) {
        if (chrome.runtime.lastError) {
          console.error('AlgoNest: background message failed.', chrome.runtime.lastError.message);
          return;
        }
        console.log('AlgoNest: background acknowledged submission.', response || {});
      });
    } catch (error) {
      console.warn('AlgoNest: extension context invalidated while sending submission payload.', error);
    }
  }

  function scheduleSubmissionCheck() {
    window.clearTimeout(submitTimer);
    console.log('AlgoNest: Submit action detected; checking result in 1 second.');
    submitTimer = window.setTimeout(submitFromPage, 1000);
  }

  document.addEventListener('click', function (event) {
    var button = event.target && event.target.closest ? event.target.closest('button') : null;
    var label = button ? (button.textContent || '').trim().toLowerCase() : '';
    if (label === 'submit' || label.indexOf('submit') !== -1) {
      console.log('AlgoNest: clicked button labeled:', label);
      statusCheckAttempts = 0;
      scheduleSubmissionCheck();
    }
  }, true);

  if (document.body) {
    new MutationObserver(scheduleSubmissionCheck).observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true
    });
  }
}());