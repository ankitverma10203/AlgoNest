(function () {
  'use strict';

  var button = document.getElementById('open-settings');
  var status = document.getElementById('connection-status');
  var destinationLabel = document.getElementById('destination-label');
  var destination = document.getElementById('destination');
  var destinationMarker = document.getElementById('destination-marker');
  var dot = document.getElementById('connection-dot');

  function setConnected(connected) {
    dot.classList.toggle('connected', connected);
  }

  function setDestination(message, markerState) {
    destination.textContent = message;
    destination.title = message;
    destinationMarker.hidden = !markerState;
    destinationMarker.classList.toggle('connected', markerState === 'connected');
  }

  function validateToken(token) {
    return fetch('https://api.github.com/user', {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: 'Bearer ' + token,
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }).then(function (response) {
      if (response.status === 401) {
        return chrome.storage.local.remove('githubToken').then(function () { return false; });
      }
      return response.ok;
    }).catch(function () {
      return true;
    });
  }

  chrome.storage.local.get({
    githubToken: '',
    githubOwner: '',
    githubRepo: '',
    githubBranch: ''
  }).then(function (settings) {
    var authenticated = Boolean(settings.githubToken);
    var destinationConfigured = Boolean(settings.githubOwner && settings.githubRepo && settings.githubBranch);
    return validateToken(settings.githubToken).then(function (tokenIsValid) {
      authenticated = authenticated && tokenIsValid;
      setConnected(authenticated);

      if (authenticated && destinationConfigured) {
        status.textContent = 'GitHub connected';
        status.classList.remove('selection-warning');
        destinationLabel.textContent = 'Destination';
        setDestination(settings.githubOwner + '/' + settings.githubRepo + ' · ' + settings.githubBranch, 'connected');
        button.textContent = 'Manage settings';
        return;
      }

      if (authenticated) {
        status.textContent = 'GitHub connected';
        status.classList.remove('selection-warning');
        destinationLabel.textContent = 'Destination';
        setDestination('Select a repository and branch in settings.', 'warning');
        button.textContent = 'Manage settings';
        return;
      }

      status.textContent = settings.githubToken ? 'GitHub sign-in expired' : 'GitHub not connected';
      status.classList.remove('selection-warning');
      destinationLabel.textContent = 'Setup';
      setDestination('Sign in again to start saving submissions.', 'warning');
      button.textContent = 'Sign in again';
    });
  });

  button.addEventListener('click', function () {
    chrome.runtime.openOptionsPage(function () {
      window.close();
    });
  });
}());
