/* Touch Unique Studio — pont de mise à jour en ligne (Android / Windows).
   La disponibilité est vérifiée directement depuis le manifeste officiel :
   le bandeau s'affiche donc même sur une application déjà installée. */
(function (root) {
  'use strict';

  var URL_KEY = 'tus_update_url_v1';
  var AUTO_KEY = 'tus_update_auto_v1';
  var SEEN_KEY = 'tus_update_seen_v1';
  var DEFAULT = 'https://phelobig.github.io/touchunique-updates/manifest.json';
  var ALLOWED_HOST = 'phelobig.github.io';

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
  function safeUrl(raw) {
    try {
      var u = new URL(String(raw || '').trim());
      if (u.protocol !== 'https:' || u.host.toLowerCase() !== ALLOWED_HOST) return '';
      return u.href;
    } catch (e) { return ''; }
  }
  function compare(a, b) {
    var x = String(a || '0').split('.'), y = String(b || '0').split('.');
    var n = Math.max(x.length, y.length);
    for (var i = 0; i < n; i++) {
      var p = parseInt(String(x[i] || '0').replace(/[^0-9]/g, ''), 10) || 0;
      var q = parseInt(String(y[i] || '0').replace(/[^0-9]/g, ''), 10) || 0;
      if (p !== q) return p > q ? 1 : -1;
    }
    return 0;
  }
  function normalize(raw) {
    if (!raw || typeof raw !== 'object') raw = {};
    return {
      platform: platform(),
      supported: platform() !== 'web',
      installed: raw.installed || raw.version || '—',
      bundled: raw.bundled || '',
      available: raw.available || '',
      notes: String(raw.notes || '').slice(0, 500),
      size: Number(raw.size) || 0,
      updated: !!raw.updated,
      busy: !!raw.busy,
      error: raw.error || '',
      url: raw.url || local(URL_KEY, DEFAULT),
      auto: raw.auto !== false && local(AUTO_KEY, '1') !== '0',
      seen: local(SEEN_KEY, '')
    };
  }
  function emit(s) {
    root.dispatchEvent(new CustomEvent('tusupdate', { detail: s }));
  }
  function nativeStatus() {
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
  function fetchManifest(url) {
    var clean = safeUrl(url);
    if (!clean || typeof root.fetch !== 'function') return Promise.resolve(null);
    return root.fetch(clean, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (m) {
      return m && typeof m === 'object' ? m : null;
    }).catch(function () { return null; });
  }
  function mergeManifest(s, m) {
    if (!m) return s;
    var version = String(m.version || '').trim();
    if (!version) return s;
    s.available = compare(version, s.installed) > 0 ? version : '';
    s.notes = String(m.notes || s.notes || '').slice(0, 500);
    s.size = Number(m.size) || s.size;
    return s;
  }

  /* Vérifie le manifeste sans installer : le bandeau s'affiche au démarrage. */
  function probe() {
    var base = nativeStatus();
    if (platform() === 'windows' && root.electronAPI.updates.probe) {
      base = root.electronAPI.updates.probe().then(normalize).catch(function () { return nativeStatus(); });
    }
    return base.then(function (s) {
      return fetchManifest(s.url).then(function (m) {
        var out = mergeManifest(s, m);
        emit(out);
        return out;
      });
    }).catch(function (e) {
      var s = normalize({ error: e.message || 'Vérification impossible' });
      emit(s);
      return s;
    });
  }

  function check() {
    var p = platform();
    if (p === 'android') {
      root.TUSNative.checkUpdate();
      return nativeStatus();
    }
    if (p === 'windows') {
      return root.electronAPI.updates.check().then(function (r) {
        var s = normalize(r);
        emit(s);
        return s;
      });
    }
    return Promise.reject(new Error('Mises à jour disponibles uniquement dans les applications installées.'));
  }

  function markSeen(key) {
    saveLocal(SEEN_KEY, String(key || ''));
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
      return probe();
    }
    if (platform() === 'windows') {
      return root.electronAPI.updates.configure({ url: url, auto: auto }).then(probe);
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
    platform: platform, status: nativeStatus, probe: probe, check: check,
    configure: configure, rollback: rollback, onChange: onChange,
    markSeen: markSeen, DEFAULT: DEFAULT
  };
})(window);
