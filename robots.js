/* Touch Unique Studio — robots de l’application.
   Génération locale quotidienne + exécution réelle via le serveur sécurisé. */
(function (root) {
  'use strict';

  var URL_KEY = 'tus_proxy_url_v1';
  var KEY_KEY = 'tus_proxy_key_v1';
  var DAY_KEY = 'tus_robot_daily_v1';

  var ROBOTS = [
    { id: 'veille', name: 'Veille techno & services', kind: 'veille', icon: '⌕', desc: '5 informations utiles chaque jour, dans la techno et vos services.' },
    { id: 'publication', name: 'Publication automatique', kind: 'publication', icon: '▶', desc: '3 publications générées puis envoyées aux réseaux connectés.' },
    { id: 'conception', name: 'Nouvelle conception', kind: 'design', icon: '◆', desc: 'Un brief de conception complet, prêt à produire.' },
    { id: 'prospection', name: 'Recherche de prospects', kind: 'prospect', icon: '◎', desc: '5 pistes qualifiées avec une approche personnalisée.' }
  ];

  function url() {
    try { return (root.localStorage.getItem(URL_KEY) || '').replace(/\/$/, ''); } catch (e) { return ''; }
  }
  function headers() {
    var h = { 'Content-Type': 'application/json' };
    try {
      var k = root.localStorage.getItem(KEY_KEY) || '';
      if (k) h['X-Tus-Key'] = k;
    } catch (e) {}
    return h;
  }
  function get(path, timeout) {
    if (!url()) return Promise.resolve({ ok: false, configured: false, robots: ROBOTS });
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var t = ctl ? setTimeout(function () { ctl.abort(); }, timeout || 6000) : null;
    return fetch(url() + path, { signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.json(); })
      .catch(function (e) { return { ok: false, error: e.message }; })
      .then(function (j) { if (t) clearTimeout(t); return j; });
  }
  function post(path, payload, timeout) {
    if (!url()) return Promise.reject(new Error('Serveur non configuré'));
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var t = ctl ? setTimeout(function () { ctl.abort(); }, timeout || 90000) : null;
    return fetch(url() + path, { method: 'POST', headers: headers(), body: JSON.stringify(payload || {}) })
      .then(function (r) { return r.json(); })
      .catch(function (e) { return { ok: false, error: e.message }; })
      .then(function (j) { if (t) clearTimeout(t); return j; });
  }

  function status() { return get('/api/robots'); }
  function run(id, dryRun) { return post('/api/robots/run', { id: id, dryRun: !!dryRun }); }

  function localRun(robot) {
    var AI = root.TUSAI;
    var A = root.TUAutomation;
    var topic = {
      veille: 'technologie, design, vidéo et outils créatifs',
      publication: 'identité, vidéo courte et automatisation IA',
      design: 'un visuel de marque rouge sur fond clair',
      prospect: 'commerces et créateurs locaux'
    }[robot.id] || 'Touch Unique Studio';
    if (AI && AI.generate) return AI.generate(robot.kind, { topic: topic }, { countTrial: false });
    var fallback = {
      veille: 'Veille locale : gardez un œil sur les formats courts, la clarté des sites et les outils d’automatisation.',
      publication: A && A.content ? A.content({ theme: topic, kind: 'reseau' }).captions[0] : 'Préparez une publication courte sur ' + topic + '.',
      design: 'Brief : fond clair, rouge dominant, texte très lisible, aucun calque décoratif.',
      prospect: 'Pistes : commerces locaux, créateurs, petites structures en ligne.'
    }[robot.id] || '';
    return Promise.resolve({ text: fallback, live: false, model: 'moteur-local' });
  }

  function record(robot, result) {
    var Store = root.Store;
    if (!Store || !Store.add) return null;
    return Store.add('robots', {
      robotId: robot.id,
      name: robot.name,
      at: Store.now ? Store.now() : new Date().toISOString(),
      text: result.text || '',
      live: !!result.live,
      model: result.model || '',
      published: result.published || [],
      error: result.error || ''
    });
  }

  /* Au premier chargement d’un nouveau jour, on prépare un aperçu local.
     La publication réelle reste une action explicite côté serveur. */
  function maybeDaily() {
    var today = new Date().toISOString().slice(0, 10);
    var last = '';
    try { last = root.localStorage.getItem(DAY_KEY) || ''; } catch (e) {}
    if (last === today) return Promise.resolve(0);
    try { root.localStorage.setItem(DAY_KEY, today); } catch (e) {}
    return Promise.all(ROBOTS.map(function (r) {
      return localRun(r).then(function (res) { record(r, Object.assign(res, { ok: true })); });
    })).then(function () { return ROBOTS.length; });
  }

  root.TUSRobots = {
    robots: ROBOTS,
    status: status,
    run: run,
    localRun: localRun,
    record: record,
    maybeDaily: maybeDaily,
    configured: function () { return !!url(); }
  };
})(window);
