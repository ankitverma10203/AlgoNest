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
    githubBranch: ''
  }).then(function (settings) {
    var authenticated = Boolean(settings.githubToken);
    var destinationConfigured = Boolean(settings.githubOwner && settings.githubRepo && settings.githubBranch);
    setConnected(authenticated);

    if (authenticated && destinationConfigured) {
      status.textContent = 'GitHub connected';
      destination.textContent = settings.githubOwner + '/' + settings.githubRepo + ' · ' + settings.githubBranch;
      button.textContent = 'Manage settings';
      return;
    }

    if (authenticated) {
      status.textContent = 'GitHub connected';
      destination.textContent = 'Select a repository and branch in settings.';
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
