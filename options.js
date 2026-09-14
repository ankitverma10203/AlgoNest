(function () {
  'use strict';

  var GITHUB_OAUTH_CLIENT_ID = 'Ov23liyQqCVHkVgyEBGu';
  var defaults = {
    githubRepo: '',
    githubOwner: '',
    githubToken: '',
    githubBranch: 'main',
    commitOnlyAccepted: true
  };
  var form = document.getElementById('settings-form');
  var status = document.getElementById('status');
  var authButton = document.getElementById('github-auth');
  var repositoryField = form.elements.githubRepo;
  var branchField = form.elements.githubBranch;
  var destinationFieldset = form.querySelector('fieldset');

  function setStatus(message) {
    status.textContent = message;
  }

  function updateAuthUi(isSignedIn) {
    authButton.hidden = isSignedIn;
    if (destinationFieldset) {
      destinationFieldset.hidden = !isSignedIn;
    }
    repositoryField.disabled = !isSignedIn;
    branchField.disabled = !isSignedIn;
  }

  function postForm(url, values) {
    return fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams(values)
    }).then(function (response) {
      return response.json().then(function (body) {
        if (!response.ok || body.error) {
          var error = new Error(body.error_description || body.message || 'GitHub authentication failed.');
          error.code = body.error;
          throw error;
        }
        return body;
      });
    });
  }

  function loadBranches(selectedBranch) {
    return chrome.storage.local.get({ githubToken: '', githubOwner: '', githubRepo: '' }).then(function (settings) {
      var owner = (settings.githubOwner || '').trim();
      var repo = (settings.githubRepo || '').trim();
      if (!owner || !repo || !settings.githubToken) {
        throw new Error('Sign in and select a repository first.');
      }
      return fetch('https://api.github.com/repos/' + encodeURIComponent(owner) + '/' +
        encodeURIComponent(repo) + '/branches?per_page=100', {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: 'Bearer ' + settings.githubToken,
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });
    }).then(function (response) {
      if (!response.ok) throw new Error('Could not load branches (' + response.status + ').');
      return response.json();
    }).then(function (branches) {
      if (!branches.length) throw new Error('This repository has no branches.');
      branchField.replaceChildren.apply(branchField, branches.map(function (branch) {
        var option = document.createElement('option');
        option.value = branch.name;
        option.textContent = branch.name;
        return option;
      }));
      var availableBranch = branches.some(function (branch) {
        return branch.name === selectedBranch;
      }) ? selectedBranch : (branches.some(function (branch) {
        return branch.name === 'main';
      }) ? 'main' : branches[0].name);
      branchField.value = availableBranch;
      branchField.disabled = false;
      return availableBranch;
    });
  }

  function loadRepositories(selectedRepository, selectedBranch) {
    return chrome.storage.local.get({ githubToken: '' }).then(function (settings) {
      if (!settings.githubToken) throw new Error('Sign in with GitHub first.');
      return fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: 'Bearer ' + settings.githubToken,
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });
    }).then(function (response) {
      if (!response.ok) throw new Error('Could not load repositories (' + response.status + ').');
      return response.json();
    }).then(function (repositories) {
      if (!repositories.length) throw new Error('No repositories are available for this account.');
      repositoryField.replaceChildren.apply(repositoryField, repositories.map(function (repository) {
        var option = document.createElement('option');
        option.value = repository.full_name;
        option.textContent = repository.full_name;
        return option;
      }));
      var repository = repositories.find(function (item) {
        return item.full_name === selectedRepository;
      }) || repositories[0];
      repositoryField.value = repository.full_name;
      repositoryField.disabled = false;
      return chrome.storage.local.set({
        githubOwner: repository.owner.login,
        githubRepo: repository.name
      }).then(function () {
        return loadBranches(selectedBranch);
      });
    });
  }

  function authenticateWithGitHub() {
    if (GITHUB_OAUTH_CLIENT_ID.indexOf('REPLACE_') === 0) {
      return Promise.reject(new Error('The extension OAuth client ID has not been configured.'));
    }
    return postForm('https://github.com/login/device/code', {
      client_id: GITHUB_OAUTH_CLIENT_ID,
      scope: 'repo'
    }).then(function (device) {
      return chrome.tabs.create({ url: device.verification_uri }).then(function () {
        setStatus('Enter ' + device.user_code + ' on GitHub to approve AlgoNest.');
        var interval = Math.max(Number(device.interval) || 5, 5) * 1000;
        var attempts = 0;

        return new Promise(function (resolve, reject) {
          function poll() {
            attempts += 1;
            if (attempts > 120) {
              reject(new Error('GitHub sign-in timed out.'));
              return;
            }
            postForm('https://github.com/login/oauth/access_token', {
              client_id: GITHUB_OAUTH_CLIENT_ID,
              device_code: device.device_code,
              grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
            }).then(resolve).catch(function (error) {
              if (error.code === 'authorization_pending' || error.code === 'slow_down') {
                setTimeout(poll, error.code === 'slow_down' ? interval + 5000 : interval);
                return;
              }
              reject(error);
            });
          }
          setTimeout(poll, interval);
        });
      });
    }).then(function (tokenResponse) {
      return chrome.storage.local.set({ githubToken: tokenResponse.access_token });
    });
  }

  chrome.storage.local.get(defaults).then(function (settings) {
    Object.keys(defaults).forEach(function (key) {
      var field = form.elements[key];
      if (!field) return;
      if (field.type === 'checkbox') field.checked = settings[key];
      else field.value = settings[key];
    });
    updateAuthUi(Boolean(settings.githubToken));
    if (settings.githubToken) {
      setStatus('Connected to GitHub. Loading repositories...');
      loadRepositories(settings.githubOwner + '/' + settings.githubRepo, settings.githubBranch)
        .then(function () {
          setStatus('Connected to GitHub. Choose a repository and branch.');
        })
        .catch(function (error) { setStatus(error.message); });
    }
  });

  authButton.addEventListener('click', function () {
    authButton.disabled = true;
    setStatus('Opening GitHub sign-in...');
    authenticateWithGitHub()
      .then(function () {
        updateAuthUi(true);
        setStatus('Connected to GitHub. Loading repositories...');
        return loadRepositories(repositoryField.value, branchField.value);
      })
      .then(function () { setStatus('Connected to GitHub. Choose a repository and branch.'); })
      .catch(function (error) { setStatus(error.message); })
      .then(function () { authButton.disabled = false; });
  });

  repositoryField.addEventListener('change', function () {
    var parts = repositoryField.value.split('/');
    repositoryField.disabled = true;
    branchField.disabled = true;
    chrome.storage.local.set({ githubOwner: parts[0], githubRepo: parts[1] })
      .then(function () { return loadBranches(branchField.value); })
      .then(function () { setStatus('Repository selected. Choose a branch.'); })
      .catch(function (error) { setStatus(error.message); })
      .then(function () { repositoryField.disabled = false; });
  });

  branchField.addEventListener('change', function () {
    chrome.storage.local.set({ githubBranch: branchField.value });
  });

  form.elements.commitOnlyAccepted.addEventListener('change', function () {
    chrome.storage.local.set({ commitOnlyAccepted: form.elements.commitOnlyAccepted.checked });
  });
}());