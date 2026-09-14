(function () {
  'use strict';

  var button = document.getElementById('open-settings');
  var status = document.getElementById('connection-status');
  var destination = document.getElementById('destination');
  var dot = document.getElementById('connection-dot');

  function setConnected(connected) {
    dot.classList.toggle('connected', connected);
  }

  chrome.storage.local.get({
    githubToken: '',
    githubOwner: '',
    githubRepo: '',
    githubBranch: 'main'
  }).then(function (settings) {
    var connected = Boolean(settings.githubToken && settings.githubOwner && settings.githubRepo);
    setConnected(connected);

    if (connected) {
      status.textContent = 'GitHub connected';
      destination.textContent = settings.githubOwner + '/' + settings.githubRepo + ' · ' + settings.githubBranch;
      button.textContent = 'Manage settings';
      return;
    }

    status.textContent = 'GitHub not connected';
    destination.textContent = 'Connect GitHub to start saving submissions.';
    button.textContent = 'Connect GitHub';
  });

  button.addEventListener('click', function () {
    chrome.runtime.openOptionsPage(function () {
      window.close();
    });
  });
}());
