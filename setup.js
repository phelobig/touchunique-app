/* Touch Unique Studio — configuration à la première ouverture et verrouillage.
   Le compte local est créé avec PBKDF2-SHA256 + sel (Web Crypto), puis une
   session est conservée dans tus_session_v1. Aucun mot de passe n'est stocké
   en clair, aucun secret n'est envoyé à un tiers. */
(function (root) {
  'use strict';

  var setupScreen = null, lockScreen = null, ready = null, mode = 'setup';

  function $(s, r) { return (r || document).querySelector(s); }
  function showError(form, message) {
    var box = $('.gate-error', form.parentNode);
    if (box) { box.textContent = message; box.hidden = false; }
  }
  function clearError(form) {
    var box = $('.gate-error', form.parentNode);
    if (box) { box.textContent = ''; box.hidden = true; }
  }

  function finish(user) {
    if (setupScreen) setupScreen.hidden = true;
    if (lockScreen) lockScreen.hidden = true;
    var cb = ready;
    ready = null;
    if (typeof cb === 'function') cb(user);
  }

  function init() {
    setupScreen = $('#setup-screen');
    lockScreen = $('#lock-screen');
    if (!setupScreen || !lockScreen) return;

    var setupForm = $('#setup-form');
    setupForm.addEventListener('submit', function (e) {
      e.preventDefault();
      clearError(setupForm);
      var f = new FormData(setupForm);
      if (String(f.get('password') || '') !== String(f.get('confirm') || '')) {
        return showError(setupForm, 'Les deux mots de passe ne correspondent pas.');
      }
      var Accounts = root.TUSAccounts;
      if (!Accounts || !Accounts.available()) {
        return showError(setupForm, 'Web Crypto indisponible : ouvrez l’application en HTTPS ou dans le logiciel Windows.');
      }
      try {
        var user = Accounts.register({
          name: f.get('name'), email: f.get('email'), password: f.get('password')
        });
        Promise.resolve(user).then(function (u) {
          var url = String(f.get('url') || '').trim();
          try {
            if (url && root.TUSCloud) {
              root.TUSCloud.connect(url);
              root.TUSCloud.setKey(f.get('key') || '');
              if (root.TUSAI) { root.TUSAI.connect(url); root.TUSAI.setKey(f.get('key') || ''); }
            }
            if (root.Store) root.Store.completeSetup();
            finish(u);
          } catch (err) { showError(setupForm, err.message); }
        }).catch(function (err) { showError(setupForm, err.message); });
      } catch (err) { showError(setupForm, err.message); }
    });

    var toggle = setupForm.querySelector('[name="show"]');
    if (toggle) toggle.addEventListener('change', function () {
      var type = toggle.checked ? 'text' : 'password';
      setupForm.querySelector('[name="password"]').type = type;
      setupForm.querySelector('[name="confirm"]').type = type;
    });

    var lockForm = $('#lock-form');
    lockForm.addEventListener('submit', function (e) {
      e.preventDefault();
      clearError(lockForm);
      var f = new FormData(lockForm);
      root.TUSAccounts.login(f.get('email'), f.get('password')).then(finish)
        .catch(function (err) { showError(lockForm, err.message); });
    });

    var help = $('#lock-help');
    if (help) help.addEventListener('click', function () {
      root.open('https://wa.me/22655041530?text=' + encodeURIComponent(
        'Bonjour Touch Unique, je ne parviens plus à ouvrir mon espace de gestion (compte ' +
        (lockForm.querySelector('[name="email"]').value || '').trim() + ').'),
        '_blank', 'noopener');
    });
  }

  function show(nextMode, onReady) {
    if (!setupScreen) init();
    mode = nextMode || (root.Store && root.Store.setupDone() ? 'lock' : 'setup');
    ready = onReady || null;
    setupScreen.hidden = mode !== 'setup';
    lockScreen.hidden = mode !== 'lock';
    var form = mode === 'setup' ? $('#setup-form') : $('#lock-form');
    if (form) {
      clearError(form);
      var first = form.querySelector('input');
      if (first) setTimeout(function () { first.focus(); }, 60);
    }
  }

  function hide() {
    if (setupScreen) setupScreen.hidden = true;
    if (lockScreen) lockScreen.hidden = true;
  }

  function lock(onReady) { show('lock', onReady); }
  function logout(onReady) {
    if (root.TUSAccounts) root.TUSAccounts.logout();
    lock(onReady);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  root.TUSetup = { show: show, hide: hide, lock: lock, logout: logout, get mode() { return mode; } };
})(window);
