/* Touch Unique Studio — robots de l’application.
   Génération locale quotidienne + exécution réelle via le serveur sécurisé.
   Chaque robot possède un profil personnalisable (nom, icône 3D, couleur) et
   son propre dossier : les résultats y sont classés automatiquement. */
(function (root) {
  'use strict';

  var URL_KEY = 'tus_proxy_url_v1';
  var KEY_KEY = 'tus_proxy_key_v1';
  var DAY_KEY = 'tus_robot_daily_v1';
  var PROFILE_KEY = 'tus_robot_profiles_v1';

  var ROBOTS = [
    { id: 'veille', name: 'Veille techno & services', kind: 'veille', icon: '🛰️', color: 'blue',
      desc: '5 informations utiles chaque jour, dans la techno et vos services.' },
    { id: 'publication', name: 'Publication automatique', kind: 'publication', icon: '📣', color: 'red',
      desc: '3 publications générées puis envoyées aux réseaux connectés.' },
    { id: 'conception', name: 'Nouvelle conception', kind: 'design', icon: '🎨', color: 'violet',
      desc: 'Un brief de conception complet, prêt à produire.' },
    { id: 'prospection', name: 'Recherche de prospects', kind: 'prospect', icon: '🔎', color: 'green',
      desc: '5 pistes qualifiées avec une approche personnalisée.' }
  ];

  /* Icônes « 3D » proposées dans le personnalisateur. */
  var ICONS = [
    { icon: '🤖', label: 'Robot' }, { icon: '🛰️', label: 'Veille' },
    { icon: '📣', label: 'Publication' }, { icon: '🎨', label: 'Création' },
    { icon: '🔎', label: 'Recherche' }, { icon: '🧠', label: 'Analyse' },
    { icon: '📡', label: 'Antenne' }, { icon: '⚙️', label: 'Automatisation' },
    { icon: '🚀', label: 'Lancement' }, { icon: '🛡️', label: 'Administration' },
    { icon: '💡', label: 'Idée' }, { icon: '📊', label: 'Rapports' }
  ];
  var COLORS = ['red', 'blue', 'green', 'violet', 'amber', 'cyan'];

  var KINDS = { veille: 'veille', publication: 'publication', conception: 'design', prospection: 'prospect' };
  var DEFAULT_ICONS = { veille: '🛰️', publication: '📣', conception: '🎨', prospection: '🔎' };

  function url() {
    try { return (root.localStorage.getItem(URL_KEY) || '').replace(/\/$/, ''); } catch (e) { return ''; }
  }
  function headers() {
    var h = { 'Content-Type': 'application/json' };
    var k = root.TUSSecure && root.TUSSecure.getSecret ? root.TUSSecure.getSecret() : '';
    if (!k) { try { k = root.localStorage.getItem(KEY_KEY) || ''; } catch (e) { /* mémoire */ } }
    if (k) h['X-Tus-Key'] = k;
    return h;
  }
  function http() { return (root.TUSSecure && root.TUSSecure.fetch) || root.fetch; }
  function get(path, timeout) {
    if (root.TUSNetwork && !root.TUSNetwork.enabled()) return Promise.resolve({ ok: false, offline: true, robots: ROBOTS });
    if (!url()) return Promise.resolve({ ok: false, configured: false, robots: ROBOTS });
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var t = ctl ? setTimeout(function () { ctl.abort(); }, timeout || 6000) : null;
    return http()(url() + path, { headers: headers(), signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.json(); })
      .catch(function (e) { return { ok: false, error: e.message }; })
      .then(function (j) { if (t) clearTimeout(t); return j; });
  }
  function post(path, payload, timeout) {
    if (root.TUSNetwork && !root.TUSNetwork.enabled()) return Promise.reject(new Error('Connexion réseau désactivée dans l’application'));
    if (!url()) return Promise.reject(new Error('Serveur non configuré'));
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var t = ctl ? setTimeout(function () { ctl.abort(); }, timeout || 90000) : null;
    return http()(url() + path, { method: 'POST', headers: headers(), body: JSON.stringify(payload || {}) })
      .then(function (r) { return r.json(); })
      .catch(function (e) { return { ok: false, error: e.message }; })
      .then(function (j) { if (t) clearTimeout(t); return j; });
  }

  function slug(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  }

  /* Profils locaux : personnalisation conservée avec la sauvegarde de l’app. */
  function loadProfiles() {
    try {
      var saved = JSON.parse(root.localStorage.getItem(PROFILE_KEY) || '{}') || {};
      return saved && typeof saved === 'object' ? saved : {};
    } catch (e) { return {}; }
  }
  function writeProfiles(map) {
    try { root.localStorage.setItem(PROFILE_KEY, JSON.stringify(map)); } catch (e) { /* mémoire seulement */ }
  }
  var profiles = loadProfiles();

  function folderName(robot) {
    return 'IA · ' + String(robot.name || robot.id || 'Robot').trim().slice(0, 60);
  }

  function apply(base) {
    var p = profiles[base.id] || {};
    var name = p.customName ? p.name : (base.name || p.name || base.id);
    var icon = p.icon || base.icon || DEFAULT_ICONS[base.id] || '🤖';
    var color = p.color || base.color || 'blue';
    return Object.assign({}, base, {
      name: name, icon: icon, color: color,
      custom: !!p.customName,
      folderId: p.folderId || '',
      folderName: p.folderName || folderName({ name: name, id: base.id })
    });
  }
  function all() { return ROBOTS.map(apply); }
  function profile(id) {
    var base = ROBOTS.find(function (r) { return r.id === id; });
    return base ? apply(base) : null;
  }

  /* La configuration quotidienne (actif, heure, fournisseur, consigne) vient du serveur. */
  function setConfig(list) {
    if (!Array.isArray(list) || !list.length) return all();
    ROBOTS = list.map(function (r) {
      var base = ROBOTS.find(function (x) { return x.id === r.id; }) || {};
      return {
        id: r.id, name: r.name || base.name || r.id,
        kind: KINDS[r.id] || base.kind || 'veille',
        icon: r.icon || DEFAULT_ICONS[r.id] || base.icon || '🤖',
        color: r.color || base.color || 'blue',
        desc: r.desc || base.desc || '',
        topic: r.topic || base.topic || '',
        enabled: r.enabled !== false,
        hour: Number(r.hour || 8),
        provider: r.provider || 'auto',
        folder: r.folder || ''
      };
    });
    ensureFolders();
    return all();
  }
  function status() {
    return get('/api/robots').then(function (s) {
      if (s && s.robots) setConfig(s.robots);
      return s;
    });
  }
  function run(id, dryRun) { return post('/api/robots/run', { id: id, dryRun: !!dryRun }); }
  function config() { return get('/api/robots').then(function (s) { return (s && s.robots) || all(); }); }

  /* Chaque IA reçoit un dossier réel dans le gestionnaire de fichiers local. */
  function ensureFolders() {
    var F = root.TUSFiles;
    if (!F || !F.ensureRoot) return Promise.resolve([]);
    return F.ensureRoot().then(function () {
      return F.allFolders().catch(function () { return []; });
    }).then(function (existing) {
      var tasks = all().map(function (robot) {
        var p = profiles[robot.id] || {};
        if (p.folderId && existing.some(function (f) { return f.id === p.folderId; })) return Promise.resolve(null);
        var wanted = p.folderName || robot.folderName;
        var found = existing.find(function (f) { return f.parent === 'root' && f.name.toLowerCase() === wanted.toLowerCase(); });
        if (found) {
          p.folderId = found.id; p.folderName = found.name;
          profiles[robot.id] = p; writeProfiles(profiles);
          return Promise.resolve(found);
        }
        return F.createFolder(wanted, 'root', robot.color).then(function (folder) {
          p.folderId = folder.id; p.folderName = folder.name;
          profiles[robot.id] = p; writeProfiles(profiles);
          return folder;
        }).catch(function () { return null; });
      });
      return Promise.all(tasks).then(function (list) { return list.filter(Boolean); });
    }).catch(function () { return []; });
  }

  function saveProfile(id, patch) {
    var base = ROBOTS.find(function (r) { return r.id === id; });
    if (!base) return Promise.reject(new Error('Robot introuvable'));
    var before = apply(base);
    var p = Object.assign({}, profiles[id] || {});
    var name = String(patch.name == null ? before.name : patch.name).trim().slice(0, 60) || before.name;
    p.customName = true;
    p.name = name;
    if (patch.icon) p.icon = String(patch.icon).slice(0, 12);
    if (patch.color) p.color = String(patch.color).slice(0, 20);
    profiles[id] = p;
    writeProfiles(profiles);
    var F = root.TUSFiles;
    var rename = Promise.resolve();
    if (F && p.folderId && p.folderId !== 'root' && name !== before.name) {
      rename = F.renameFolder(p.folderId, folderName({ name: name, id: id }))
        .then(function (f) { p.folderName = f.name; writeProfiles(profiles); return f; })
        .catch(function () { return null; });
    }
    return rename.then(function () { return ensureFolders().then(function () { return apply(base); }); });
  }

  function openFolder(id) {
    var p = profile(id);
    var Store = root.Store;
    if (p && p.folderId && Store) {
      Store.db.settings.activeFolder = p.folderId;
      Store.save();
    }
    return p;
  }

  /* Chaque résultat est archivé dans le dossier du robot, avec une limite saine. */
  function archive(robot, result) {
    var F = root.TUSFiles;
    if (!F || !result || !result.text) return Promise.resolve(null);
    return ensureFolders().then(function () {
      var p = profile(robot.id) || robot;
      var folder = p.folderId || 'root';
      var day = (result.at || new Date().toISOString()).slice(0, 10);
      var header = '# ' + (p.name || robot.name) + ' — ' + day + '\n\n';
      var body = String(result.text || '');
      var blob = new Blob([header + body], { type: 'text/markdown;charset=utf-8' });
      return F.listFiles(folder).then(function (existing) {
        var sameDay = existing.filter(function (f) { return (f.name || '').indexOf(day) >= 0; });
        return Promise.all(sameDay.map(function (f) { return F.deleteFile(f.id).catch(function () { return null; }); }))
          .then(function () {
            var name = slug(p.name || robot.id) + '-' + day + '.md';
            blob.name = name;
            return F.addFile(folder, blob);
          });
      }).then(function (meta) {
        return F.listFiles(folder).then(function (list) {
          var extra = list.filter(function (f) { return f.id !== meta.id; })
            .sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
          return Promise.all(extra.slice(29).map(function (f) { return F.deleteFile(f.id).catch(function () { return null; }); }))
            .then(function () { return meta; });
        });
      });
    }).catch(function () { return null; });
  }

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
    var p = profile(robot.id) || robot;
    var at = Store && Store.now ? Store.now() : new Date().toISOString();
    archive(p, Object.assign({}, result, { at: at }));
    if (!Store || !Store.add) return null;
    var entry = Store.add('robots', {
      robotId: robot.id,
      name: p.name,
      icon: p.icon,
      color: p.color,
      folderName: p.folderName,
      at: at,
      text: result.text || '',
      live: !!result.live,
      model: result.model || '',
      published: result.published || [],
      error: result.error || ''
    });
    /* Le robot de prospection classe ses pistes directement dans « Prospect ». */
    if ((robot.kind === 'prospect' || robot.id === 'prospection') && result.text && root.TUSProspects) {
      root.TUSProspects.fromReport(result.text, { name: p.name, robotId: robot.id });
    }
    return entry;
  }

  /* Au premier chargement d’un nouveau jour, on prépare un aperçu local.
     La publication réelle reste une action explicite côté serveur. */
  function maybeDaily() {
    var today = new Date().toISOString().slice(0, 10);
    var last = '';
    try { last = root.localStorage.getItem(DAY_KEY) || ''; } catch (e) { /* ignore */ }
    if (last === today) return ensureFolders();
    try { root.localStorage.setItem(DAY_KEY, today); } catch (e) { /* ignore */ }
    return ensureFolders().then(function () {
      return Promise.all(all().map(function (r) {
        return localRun(r).then(function (res) { return record(r, Object.assign(res, { ok: true })); });
      }));
    }).then(function () { return all().length; });
  }

  var api = {
    ICONS: ICONS, COLORS: COLORS,
    status: status, config: config, setConfig: setConfig,
    run: run, localRun: localRun, record: record, maybeDaily: maybeDaily,
    all: all, profile: profile, profiles: loadProfiles,
    saveProfile: saveProfile, ensureFolders: ensureFolders, openFolder: openFolder,
    archive: archive, folderName: folderName, slug: slug,
    configured: function () { return !!url(); }
  };
  Object.defineProperty(api, 'robots', { get: all, enumerable: true });
  root.TUSRobots = api;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureFolders);
  else ensureFolders();
})(window);
