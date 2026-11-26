/* Touch Unique — stockage local de l’application */
(function (root) {
  'use strict';

  var KEY = 'tus_app_db_v1';
  var SITE_LEADS_KEY = 'tus_site_leads_v1';
  var A = root.TUAutomation || {};

  function now() { return new Date().toISOString(); }
  function uid(prefix) { return A.uid ? A.uid(prefix || 'TU') : (prefix || 'TU') + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(); }
  function today() { return new Date().toISOString().slice(0, 10); }

  var MAX_IMPORT_BYTES = 4 * 1024 * 1024;
  var IMPORT_KEYS = ['version', 'demo', 'setupDone', 'createdAt', 'settings', 'clients', 'projects',
    'tasks', 'leads', 'prospects', 'knownLeadIds', 'companies', 'folders', 'contents', 'robots',
    'social', 'shop', 'logs', 'stats'];
  var IMPORT_LISTS = ['clients', 'projects', 'tasks', 'leads', 'prospects', 'companies', 'folders', 'contents', 'robots', 'social'];
  var SAFE_KEY = /^[A-Za-z0-9_-]{1,80}$/;

  function plainObject(v) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
    try { return Object.getPrototypeOf(v) === Object.prototype; } catch (e) { return false; }
  }
  function cleanText(v, max) { return String(v == null ? '' : v).slice(0, max || 1200); }
  function cleanNumber(v) {
    var n = Number(v);
    return isFinite(n) ? Math.min(Math.max(n, 0), 1000000000000) : 0;
  }
  /* Copie récursive bornée : aucun objet inattendu, aucune clé prototype. */
  function cleanValue(v, depth) {
    if (v == null || typeof v === 'boolean') return v;
    if (typeof v === 'string') return cleanText(v, 4000);
    if (typeof v === 'number') return cleanNumber(v);
    if (depth > 6) return null;
    if (Array.isArray(v)) return v.slice(0, 500).map(function (x) { return cleanValue(x, depth + 1); });
    if (plainObject(v)) {
      var out = {};
      Object.keys(v).slice(0, 150).forEach(function (k) {
        if (!SAFE_KEY.test(k) || k === '__proto__' || k === 'constructor' || k === 'prototype') return;
        out[k] = cleanValue(v[k], depth + 1);
      });
      return out;
    }
    return null;
  }

  function seed() {
    var p1 = uid('PR'), p2 = uid('PR'), p3 = uid('PR');
    var c1 = uid('CL'), c2 = uid('CL'), c3 = uid('CL');
    return {
      version: 2,
      demo: true,
      setupDone: false,
      createdAt: now(),
      settings: {
        studio: 'Touch Unique Studio',
        whatsapp: 'https://wa.me/22655041530',
        phone: '+226 55 04 15 30',
        autopilot: true,
        autoProjects: true,
        autoSocial: true,
        currency: 'FCFA',
        theme: 'light',
        activeCompany: '',
        activeProject: '',
        connectors: { whatsapp: true, facebook: false, instagram: false, linkedin: false, x: false, email: false, payment: false }
      },
      clients: [
        { id: c1, name: 'Maison Kaboré', phone: '+226 70 12 34 56', email: 'contact@maisonkabore.bf', city: 'Ouagadougou', createdAt: now() },
        { id: c2, name: 'Pharmacie Ar-Rahma', phone: '+226 76 00 11 22', email: '', city: 'Ouagadougou', createdAt: now() },
        { id: c3, name: 'École Les Étoiles', phone: '+226 65 22 33 44', email: 'ecole@etoiles.bf', city: 'Bobo-Dioulasso', createdAt: now() }
      ],
      projects: [
        { id: p1, name: 'Refonte identité — Maison Kaboré', type: 'Identité & branding', client: 'Maison Kaboré', phone: '+226 70 12 34 56', status: 'conception', amount: 60000, source: 'Manuel', createdAt: now(), due: '2026-12-08', ai: true },
        { id: p2, name: 'Vidéo promo 60 s — Ar-Rahma', type: 'Vidéo & motion', client: 'Pharmacie Ar-Rahma', phone: '+226 76 00 11 22', status: 'production', amount: 40000, source: 'Site web', createdAt: now(), due: '2026-12-02', ai: true },
        { id: p3, name: 'Kit réseaux — École Les Étoiles', type: 'Contenus réseaux', client: 'École Les Étoiles', phone: '+226 65 22 33 44', status: 'brief', amount: 20000, source: 'Académie', createdAt: now(), due: '2026-12-15', ai: false }
      ],
      tasks: [
        { id: uid('TK'), projectId: p1, title: 'Valider la direction créative', phase: 'Conception', priority: 'haute', status: 'à faire', createdAt: now(), ai: true },
        { id: uid('TK'), projectId: p2, title: 'Préparer le découpage plan par plan', phase: 'Production', priority: 'haute', status: 'en cours', createdAt: now(), ai: true },
        { id: uid('TK'), projectId: p3, title: 'Recevoir les photos d’élèves', phase: 'Brief', priority: 'moyenne', status: 'à faire', createdAt: now(), ai: false }
      ],
      leads: [],
      prospects: [],
      knownLeadIds: [],
      companies: [],
      folders: [],
      contents: [
        { id: uid('CT'), theme: 'Identité visuelle', type: 'reseau', text: 'Un visuel qui capte, un message qui reste, une action qui suit. C’est exactement ce qu’on construit avec une identité claire. #TouchUnique', createdAt: now(), ai: true }
      ],
      robots: [],
      social: [
        { id: uid('SO'), platform: 'instagram', text: 'Votre marque a quelque chose à dire. On l’aide à être comprise en trois secondes.', status: 'à valider', scheduledAt: now(), source: 'manuel' },
        { id: uid('SO'), platform: 'facebook', text: 'Pack Visibilité Pro : identité, 12 visuels, bannière et vidéo 30 s.', status: 'programmé', scheduledAt: now(), source: 'autopilot' },
        { id: uid('SO'), platform: 'linkedin', text: 'Une identité n’est pas un luxe : c’est un outil de confiance.', status: 'publié', scheduledAt: now(), source: 'manuel' }
      ],
      shop: { orders: [], overrides: {}, suggestions: [] },
      logs: [
        { id: uid('LG'), at: now(), text: 'Application initialisée en mode démonstration.' }
      ],
      stats: { runs: 0, generated: 0, social: 0, imports: 0 }
    };
  }

  function defaults() {
    var d = seed();
    d.demo = false;
    d.setupDone = false;
    d.clients = []; d.projects = []; d.tasks = []; d.leads = []; d.contents = []; d.social = []; d.robots = [];
    d.companies = []; d.folders = []; d.prospects = [];
    d.shop.orders = [];
    d.logs = [{ id: uid('LG'), at: now(), text: 'Application prête.' }];
    return d;
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return seed();
      var d = JSON.parse(raw);
      if (!d || typeof d !== 'object') return seed();
      var base = defaults();
      Object.keys(base).forEach(function (k) { if (d[k] == null) d[k] = base[k]; });
      if (!d.settings) d.settings = base.settings;
      Object.keys(base.settings).forEach(function (k) { if (d.settings[k] == null) d.settings[k] = base.settings[k]; });
      if (!d.shop) d.shop = base.shop;
      if (!d.shop.overrides) d.shop.overrides = {};
      /* Migration sans perte vers le format multi-entreprises (v2). */
      if (!Array.isArray(d.companies)) d.companies = [];
      if (!Array.isArray(d.folders)) d.folders = [];
      if (typeof d.setupDone !== 'boolean') d.setupDone = !!d.settings.setupDone;
      if (d.settings.activeCompany == null) d.settings.activeCompany = '';
      if (d.settings.activeProject == null) d.settings.activeProject = '';
      if (d.version !== 2) d.version = 2;
      return d;
    } catch (e) { return seed(); }
  }

  var db = load();
  var saveError = '';

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
      saveError = '';
      return true;
    } catch (e) {
      saveError = (e && e.message) || 'Stockage local indisponible';
      return false;
    }
  }
  function list(name) {
    if (!Array.isArray(db[name])) db[name] = [];
    return db[name];
  }
  function log(text) {
    list('logs').unshift({ id: uid('LG'), at: now(), text: String(text || '') });
    db.logs = db.logs.slice(0, 200);
  }
  function add(name, item) {
    var obj = Object.assign({}, item || {}, { id: item && item.id || uid(name.slice(0, 2).toUpperCase()) });
    list(name).unshift(obj);
    save();
    return obj;
  }
  function update(name, id, patch) {
    var arr = list(name), i = arr.findIndex(function (x) { return x.id === id; });
    if (i >= 0) { arr[i] = Object.assign({}, arr[i], patch || {}); save(); return arr[i]; }
    return null;
  }
  function remove(name, id) {
    db[name] = list(name).filter(function (x) { return x.id !== id; });
    save();
  }
  function readSiteLeads() {
    try {
      var v = JSON.parse(localStorage.getItem(SITE_LEADS_KEY) || '[]');
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }
  function syncSiteLeads() {
    var incoming = readSiteLeads();
    var known = Array.isArray(db.knownLeadIds) ? db.knownLeadIds : [];
    var imported = 0;
    incoming.forEach(function (raw) {
      if (!raw || !raw.id || known.indexOf(raw.id) >= 0) return;
      known.push(raw.id);
      var lead = Object.assign({}, raw, { importedAt: now(), seen: false });
      db.leads.unshift(lead);
      db.stats.imports = (db.stats.imports || 0) + 1;
      var score = A.scoreLead ? A.scoreLead(lead) : { score: 60, level: 'tiède', action: 'Qualifier le lead.' };
      lead.score = score.score; lead.level = score.level; lead.nextAction = score.action;
      if (db.settings.autopilot && db.settings.autoProjects && score.level !== 'froid') {
        var already = db.projects.some(function (p) { return p.sourceId === lead.id; });
        if (!already) {
          var p = {
            id: uid('PR'),
            name: 'Projet — ' + (lead.client && lead.client.name || lead.ref || 'lead'),
            type: String(lead.type || 'projet').replace(/^Demande de projet — /, ''),
            client: (lead.client && lead.client.name) || '',
            phone: (lead.client && lead.client.phone) || '',
            status: 'brief', amount: Number(lead.total || 0), source: lead.source || 'Site web',
            sourceId: lead.id, createdAt: now(), ai: true
          };
          db.projects.unshift(p);
          if (A.tasksForProject) {
            A.tasksForProject(p).slice(0, 4).forEach(function (t) { db.tasks.unshift(t); });
          }
          lead.autoProjectId = p.id;
        }
      }
      imported++;
      log('Lead importé : ' + (lead.ref || lead.id) + ' · score ' + score.score);
    });
    db.knownLeadIds = known.slice(-300);
    if (imported) save();
    return imported;
  }
  function products() {
    if (root.TUSCatalog) return root.TUSCatalog.products();
    var canonical = (root.TU_CATALOGUE && root.TU_CATALOGUE.products) || [];
    return canonical.map(function (p) {
      var o = db.shop.overrides[p.id] || {};
      return Object.assign({}, p, o);
    });
  }
  /* Migration unique des anciennes surcharges vers le catalogue partagé. */
  function migrateShop() {
    if (!root.TUSCatalog) return;
    var legacy = db.shop.overrides || {};
    var ids = Object.keys(legacy);
    if (!ids.length) return;
    root.TUSCatalog.importOverrides(legacy);
    db.shop.overrides = {};
    save();
  }
  function unreadLeads() { return db.leads.filter(function (l) { return !l.seen; }).length; }
  function exportData() { return JSON.stringify(db, null, 2); }
  /* Remplacement complet de la base : schéma strict, taille bornée et
     confirmation explicite de la part de l’appelant. */
  function importData(text, options) {
    if (!options || options.confirmed !== true) {
      throw new Error('Confirmez le remplacement des données locales avant l’import.');
    }
    if (typeof text !== 'string' || text.length > MAX_IMPORT_BYTES) {
      throw new Error('Fichier trop volumineux (4 Mo maximum).');
    }
    var parsed;
    try { parsed = JSON.parse(text); }
    catch (e) { throw new Error('Fichier JSON illisible.'); }
    if (!plainObject(parsed)) throw new Error('Format invalide.');
    if (Object.keys(parsed).some(function (k) { return IMPORT_KEYS.indexOf(k) < 0; })) {
      throw new Error('Format invalide : champs inattendus.');
    }
    if (!Array.isArray(parsed.projects)) throw new Error('Format invalide : projets manquants.');
    if (IMPORT_LISTS.some(function (k) { return parsed[k] != null && !Array.isArray(parsed[k]); })) {
      throw new Error('Format invalide : liste inattendue.');
    }
    [parsed.settings, parsed.shop, parsed.stats].forEach(function (v) {
      if (v != null && !plainObject(v)) throw new Error('Format invalide : objet inattendu.');
    });
    if (parsed.knownLeadIds != null && !Array.isArray(parsed.knownLeadIds)) throw new Error('Format invalide.');
    if (parsed.logs != null && !Array.isArray(parsed.logs)) throw new Error('Format invalide.');

    var clean = {};
    Object.keys(parsed).forEach(function (k) { clean[k] = cleanValue(parsed[k], 0); });
    clean.version = 2;
    clean.demo = !!clean.demo;
    clean.setupDone = !!clean.setupDone;
    clean.createdAt = cleanText(clean.createdAt, 40) || now();
    if (!plainObject(clean.settings)) clean.settings = {};
    if (!plainObject(clean.stats)) clean.stats = {};
    IMPORT_LISTS.forEach(function (k) {
      clean[k] = (Array.isArray(clean[k]) ? clean[k] : []).slice(0, 2000).filter(plainObject);
    });
    clean.knownLeadIds = (Array.isArray(clean.knownLeadIds) ? clean.knownLeadIds : [])
      .slice(0, 300).map(function (x) { return cleanText(x, 120); }).filter(Boolean);
    clean.logs = (Array.isArray(clean.logs) ? clean.logs : []).slice(0, 200).filter(plainObject);
    clean.shop = plainObject(clean.shop) ? clean.shop : {};
    var orders = clean.shop.orders, suggestions = clean.shop.suggestions, overrides = clean.shop.overrides;
    clean.shop = {
      orders: (Array.isArray(orders) ? orders : []).slice(0, 2000).filter(plainObject),
      overrides: {},
      suggestions: (Array.isArray(suggestions) ? suggestions : []).slice(0, 500).filter(plainObject)
    };
    if (plainObject(overrides)) {
      Object.keys(overrides).slice(0, 500).forEach(function (id) {
        if (SAFE_KEY.test(id) && plainObject(overrides[id])) clean.shop.overrides[id] = overrides[id];
      });
    }
    ['runs', 'generated', 'social', 'imports'].forEach(function (k) {
      clean.stats[k] = cleanNumber(clean.stats[k]);
    });
    var base = defaults();
    Object.keys(base).forEach(function (k) { if (clean[k] == null) clean[k] = base[k]; });
    Object.keys(base.settings).forEach(function (k) {
      if (clean.settings[k] == null) clean.settings[k] = base.settings[k];
    });
    db = clean;
    return save();
  }
  function reset(demo) {
    db = demo ? seed() : defaults();
    save();
  }

  root.Store = {
    KEY: KEY,
    get db() { return db; },
    save: save,
    storageError: function () { return saveError; },
    uid: uid,
    today: today,
    now: now,
    list: list,
    add: add,
    update: update,
    remove: remove,
    log: log,
    readSiteLeads: readSiteLeads,
    syncSiteLeads: syncSiteLeads,
    products: products, migrateShop: migrateShop,
    companies: function () { return list('companies'); },
    clients: function () { return list('clients'); },
    folders: function () { return list('folders'); },
    projectsFor: function (company) {
      return (db.projects || []).filter(function (p) { return !company || p.company === company; });
    },
    completeSetup: function () { db.setupDone = true; save(); },
    setupDone: function () { return !!db.setupDone; },
    unreadLeads: unreadLeads,
    exportData: exportData,
    importData: importData,
    reset: reset
  };
})(window);
