/* Touch Unique Studio — pont de mise à jour en ligne (Android / Windows).
   Sur le navigateur, la gestion des mises à jour reste indisponible. */
(function (root) {
  'use strict';

  var URL_KEY = 'tus_update_url_v1';
  var AUTO_KEY = 'tus_update_auto_v1';
  var DEFAULT = 'https://phelobig.github.io/touchunique-updates/manifest.json';

  function platform() {
    if (root.TUSNative && typeof root.TUSNative.updateStatus === 'function') return 'android';
    if (root.electronAPI && root.electronAPI.updates) return 'windows';
    return 'web';
  }
  function local(key, fallback) {
    try { return root.localStorage.getItem(key) || fallback; } catch (e) { return fallback; }
  }
  function saveLocal(key, value) {
    try { root.localStorage.setItem(key, value); } catch (e) { /* ignore */ }
  }
  function normalize(raw) {
    if (!raw || typeof raw !== 'object') raw = {};
    return {
      platform: platform(),
      supported: platform() !== 'web',
      installed: raw.installed || raw.version || '—',
      bundled: raw.bundled || '',
      available: raw.available || '',
      updated: !!raw.updated,
      busy: !!raw.busy,
      error: raw.error || '',
      url: raw.url || local(URL_KEY, DEFAULT),
      auto: raw.auto !== false && local(AUTO_KEY, '1') !== '0'
    };
  }

  function status() {
    var p = platform();
    if (p === 'android') {
      try { return Promise.resolve(normalize(JSON.parse(root.TUSNative.updateStatus()))); }
      catch (e) { return Promise.resolve(normalize({ error: e.message })); }
    }
    if (p === 'windows') {
      return root.electronAPI.updates.status().then(normalize).catch(function (e) {
        return normalize({ error: e.message || 'État indisponible' });
      });
    }
    return Promise.resolve(normalize({}));
  }

  function check() {
    var p = platform();
    if (p === 'android') {
      root.TUSNative.checkUpdate();
      return status();
    }
    if (p === 'windows') {
      return root.electronAPI.updates.check().then(function (r) {
        var s = normalize(r);
        root.dispatchEvent(new CustomEvent('tusupdate', { detail: s }));
        return s;
      });
    }
    return Promise.reject(new Error('Mises à jour disponibles uniquement dans les applications installées.'));
  }

  function configure(value) {
    var url = String(value.url || '').trim() || local(URL_KEY, DEFAULT);
    if (!/^https:\/\//i.test(url)) return Promise.reject(new Error('URL HTTPS requise'));
    var auto = value.auto !== false;
    saveLocal(URL_KEY, url);
    saveLocal(AUTO_KEY, auto ? '1' : '0');
    if (platform() === 'android') {
      root.TUSNative.setUpdater(url);
      root.TUSNative.setAutoUpdate(auto);
      return status();
    }
    if (platform() === 'windows') {
      return root.electronAPI.updates.configure({ url: url, auto: auto }).then(status);
    }
    return status();
  }

  function rollback() {
    if (platform() === 'windows') return root.electronAPI.updates.rollback();
    if (platform() === 'android') { root.TUSNative.rollbackUpdate(); return Promise.resolve({ ok: true }); }
    return Promise.reject(new Error('Fonction indisponible dans le navigateur.'));
  }

  function onChange(fn) {
    if (typeof fn !== 'function') return;
    root.addEventListener('tusupdate', function (e) {
      var raw = e.detail;
      if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch (err) { raw = {}; } }
      fn(normalize(raw));
    });
  }

  root.TUSUpdates = {
    platform: platform, status: status, check: check,
    configure: configure, rollback: rollback, onChange: onChange,
    DEFAULT: DEFAULT
  };
})(window);
