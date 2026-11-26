/* Touch Unique Studio — voyant et calculateur de débit réseau.
   La sonde mesure un petit document public. Aucune donnée privée n'est envoyée. */
(function (root) {
  'use strict';

  var ENABLE_KEY = 'tus_network_enabled_v1';
  var PROBE = 'https://touchunique-serveur.onrender.com/api/visits';
  var PROBE_FALLBACK = 'https://phelobig.github.io/?probe=';
  var BASE_INTERVAL = 20000;
  var MAX_INTERVAL = 300000;
  var MAX_BYTES = 50 * 1024 * 1024;
  var MAX_PROBE_BYTES = 65536;
  var MAX_SPEED = 1000;
  var listeners = [];
  var globalsBound = false;
  var enabled = true;
  var online = false;
  var serverDown = false;
  var speed = 0;
  var bytes = 0;
  var lastCheck = 0;
  var timer = null;
  var busy = false;
  var failures = 0;
  var epoch = 0;

  try { enabled = root.localStorage.getItem(ENABLE_KEY) !== '0'; } catch (e) { enabled = true; }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) online = false;

  function notify() {
    var s = status();
    listeners.forEach(function (fn) { try { fn(s); } catch (e) { /* ignore */ } });
  }
  function status() {
    return {
      enabled: enabled,
      online: enabled && online,
      serverDown: enabled && serverDown,
      speedMbps: Math.round(speed * 100) / 100,
      bytes: bytes,
      lastCheck: lastCheck
    };
  }
  function fmt(s) {
    if (!s.enabled) return 'Connexion désactivée';
    if (!s.online) return 'Hors ligne';
    if (s.serverDown) return 'Connecté · serveur indisponible';
    if (!s.speedMbps) return 'Connexion active · ' + s.bytes + ' octets';
    return s.speedMbps.toFixed(2) + ' Mb/s · ' + (s.bytes / (1024 * 1024)).toFixed(1) +
      ' Mo (' + s.bytes + ' octets)';
  }

  function finish(mine) {
    lastCheck = Date.now();
    busy = false;
    if (mine === epoch) notify();
    return status();
  }
  function probe() {
    if (!enabled || busy) return Promise.resolve(status());
    busy = true;
    var mine = epoch;
    var started = (root.performance && performance.now) ? performance.now() : Date.now();
    var connection = root.navigator && (navigator.connection || navigator.mozConnection);
    function nativeOnline() {
      try {
        var n = root.TUSNative;
        if (n && typeof n.online === 'function') return !!n.online();
      } catch (e) { /* ignore */ }
      return null;
    }
    function done(ok, measured, size) {
      if (ok) {
        failures = 0;
        online = true;
        serverDown = false;
        speed = Math.min(MAX_SPEED, measured > 0 ? measured : (connection && connection.downlink ? Number(connection.downlink) || 0 : 0));
        bytes = Math.min(MAX_BYTES, bytes + Math.max(0, size || 0));
      } else {
        failures = Math.min(failures + 1, 6);
        /* Le téléphone peut être connecté alors que le serveur est en pause
           (Render gratuit) : on ne l'affiche plus comme « Hors ligne ». */
        var device = nativeOnline();
        serverDown = device === true;
        online = serverDown;
        speed = 0;
      }
      return finish(mine);
    }
    function http() { return (root.TUSSecure && root.TUSSecure.fetch) || root.fetch; }
    function read(url) {
      return http()(url, { cache: 'no-store', credentials: 'omit' })
        .then(function (r) {
          if (!r.ok) throw new Error('Sonde indisponible');
          var len = r.headers && r.headers.get ? Number(r.headers.get('content-length')) || 0 : 0;
          if (len > MAX_PROBE_BYTES) throw new Error('Sonde trop volumineuse');
          return r.arrayBuffer();
        })
        .then(function (buf) {
          var size = buf && buf.byteLength ? buf.byteLength : 0;
          if (size > MAX_PROBE_BYTES) throw new Error('Sonde trop volumineuse');
          return size;
        });
    }
    if (typeof http() !== 'function') {
      online = navigator.onLine !== false;
      return Promise.resolve(done(online, connection && connection.downlink ? Number(connection.downlink) : 0, 0));
    }
    return read(PROBE + '?cb=' + Date.now())
      .catch(function () { return read(PROBE_FALLBACK + Date.now()); })
      .then(function (size) {
        var ended = (root.performance && performance.now) ? performance.now() : Date.now();
        var seconds = Math.max((ended - started) / 1000, 0.05);
        return done(true, (size * 8 / seconds) / 1000000, size);
      })
      .catch(function () { return done(false, 0, 0); });
  }

  function schedule() {
    if (timer) { root.clearTimeout(timer); timer = null; }
    if (!enabled) return;
    var delay = Math.min(BASE_INTERVAL * Math.pow(2, failures), MAX_INTERVAL);
    timer = root.setTimeout(function () {
      timer = null;
      probe().then(schedule);
    }, delay);
  }
  function start() {
    stop();
    bindGlobals();
    if (!enabled) { notify(); return; }
    var active = epoch;
    probe().then(function () { if (epoch === active) schedule(); });
  }
  function stop() {
    epoch++;
    if (timer) { root.clearTimeout(timer); timer = null; }
    busy = false;
  }
  function setEnabled(value) {
    enabled = !!value;
    try { root.localStorage.setItem(ENABLE_KEY, enabled ? '1' : '0'); } catch (e) { /* ignore */ }
    if (!enabled) { online = false; speed = 0; stop(); notify(); }
    else start();
    return status();
  }

  function onOnline() { if (enabled) probe(); }
  function onOffline() { online = false; speed = 0; failures = Math.min(failures + 1, 6); notify(); }
  function onVisible() { if (!document.hidden && enabled) probe(); }
  function bindGlobals() {
    if (globalsBound) return;
    root.addEventListener('online', onOnline);
    root.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);
    globalsBound = true;
  }
  function unbindGlobals() {
    if (!globalsBound) return;
    root.removeEventListener('online', onOnline);
    root.removeEventListener('offline', onOffline);
    document.removeEventListener('visibilitychange', onVisible);
    globalsBound = false;
  }
  function onChange(fn) {
    if (typeof fn !== 'function') return function () {};
    listeners.push(fn);
    bindGlobals();
    return function () {
      listeners = listeners.filter(function (x) { return x !== fn; });
      if (!listeners.length) unbindGlobals();
    };
  }
  function destroy() {
    stop();
    unbindGlobals();
    listeners = [];
  }

  root.TUSNetwork = {
    status: status,
    enabled: function () { return enabled; },
    setEnabled: setEnabled,
    toggle: function () { return setEnabled(!enabled); },
    probe: probe,
    format: fmt,
    onChange: onChange,
    start: start,
    stop: stop,
    destroy: destroy
  };
})(window);
