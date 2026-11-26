/* Touch Unique Studio — liaison application <-> site (même origine) */
(function (root) {
  'use strict';

  var KEY = 'tus_sync_v1';
  var CHANNEL = 'touchunique-sync';
  var SOURCE = 'app-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  var MAX_COUNT = 1000000;
  var state = { site: 0, app: 0, leads: 0, projects: 0, updatedAt: 0 };
  var listeners = [];
  var bc = null;

  try { bc = new BroadcastChannel(CHANNEL); } catch (e) { bc = null; }

  /* Structure stricte : seuls des compteurs finis et bornés sont acceptés. */
  function clean(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
    var out = {};
    ['site', 'app', 'leads', 'projects', 'updatedAt'].forEach(function (k) {
      var n = Number(input[k]);
      if (!isFinite(n) || n < 0) return;
      var max = k === 'leads' || k === 'projects' ? MAX_COUNT : Date.now() + 60000;
      out[k] = Math.min(Math.floor(n), max);
    });
    return out;
  }
  function read() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || '{}');
      return Object.assign({}, state, clean(v) || {});
    } catch (e) { return Object.assign({}, state); }
  }

  function label(s) {
    var now = Date.now();
    var both = s.site && s.app && (now - Math.min(s.site, s.app)) < 300000;
    var text, kind;
    if (both) { text = 'Synchronisé · site ↔ app'; kind = 'ok'; }
    else if (s.app > s.site) { text = 'Application connectée · site en attente'; kind = 'wait'; }
    else if (s.site > s.app) { text = 'Site connecté · app en attente'; kind = 'wait'; }
    else { text = 'Synchronisation locale prête'; kind = 'wait'; }
    if (s.leads) text += ' · ' + s.leads + ' commande(s)';
    return { text: text, kind: kind };
  }

  function render() {
    var el = document.getElementById('sync-state');
    if (!el) return;
    var l = label(state);
    if (el.textContent !== l.text) el.textContent = l.text;
    el.dataset.state = l.kind;
    var when = state.updatedAt ? new Date(state.updatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';
    el.title = 'Bus local Touch Unique · dernière activité : ' + when + ' · origin: ' + location.origin;
  }

  function publish(s, local) {
    var valid = clean(s);
    if (!valid) return;
    state = Object.assign({}, state, valid);
    if (local) render();
    listeners.forEach(function (fn) { try { fn(state); } catch (e) { /* noop */ } });
  }

  function pulse(role, extra) {
    var s = read();
    s[role] = Date.now();
    if (extra && typeof extra === 'object') {
      Object.keys(extra).forEach(function (k) {
        if (['site', 'app', 'leads', 'projects', 'updatedAt'].indexOf(k) >= 0) s[k] = extra[k];
      });
    }
    s.updatedAt = Date.now();
    var cleanState = clean(s) || {};
    /* Le jeton de source reste dans le message BroadcastChannel : le bus
       partagé avec le site conserve son format de données simple. */
    try { localStorage.setItem(KEY, JSON.stringify(cleanState)); } catch (e) { /* mémoire seulement */ }
    publish(cleanState, true);
    if (bc) { try { bc.postMessage(Object.assign({ source: SOURCE }, cleanState)); } catch (e) { /* noop */ } }
    return cleanState;
  }

  function on(fn) {
    if (typeof fn !== 'function') return function () {};
    listeners.push(fn);
    fn(state);
    return function () { listeners = listeners.filter(function (x) { return x !== fn; }); };
  }

  function onStorage(e) {
    if (e.key !== KEY || !e.newValue) return;
    var incoming;
    try { incoming = JSON.parse(e.newValue); } catch (err) { return; }
    if (incoming && incoming.source === SOURCE) return;
    publish(incoming, true);
  }
  root.addEventListener('storage', onStorage);
  if (bc) bc.onmessage = function (e) {
    if (!e || !e.data || e.data.source === SOURCE) return;
    publish(e.data, true);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();

  root.TUSync = {
    pulse: pulse, read: read, on: on, state: function () { return Object.assign({}, state); },
    source: SOURCE,
    destroy: function () {
      root.removeEventListener('storage', onStorage);
      if (bc) { bc.onmessage = null; try { bc.close(); } catch (e) {} bc = null; }
      listeners = [];
    }
  };
})(window);
