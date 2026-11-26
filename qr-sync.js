/* Touch Unique Studio — connexion et synchronisation par code QR.
   Le code contient le compte local (sel + haché PBKDF2), la session et une
   synchronisation compacte. Il s’agit d’un secret : à scanner uniquement
   entre ses propres appareils. Aucun secret n’est envoyé à un tiers. */
(function (root) {
  'use strict';

  var APP = 'tus';
  var VERSION = 1;
  var MAX_TEXT = 1400;
  var MAX_IMPORT_TEXT = 20000;
  var ID_RE = /^TU-[A-Z0-9-]{4,60}$/;
  var SAFE_KEY = /^[A-Za-z0-9_-]{1,80}$/;

  function qr() { return root.qrcode; }
  function decoder() { return root.jsQR; }
  function sec() { return root.TUSSecure || {}; }
  function plain(v) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
    try { return Object.getPrototypeOf(v) === Object.prototype; } catch (e) { return false; }
  }
  function simple(v, max) {
    if (['string', 'number', 'boolean'].indexOf(typeof v) < 0) return null;
    return typeof v === 'string' ? v.slice(0, max || 500) : v;
  }
  function records(list, count) {
    return (Array.isArray(list) ? list : []).slice(0, count).filter(plain).map(function (item) {
      var out = {};
      Object.keys(item).slice(0, 40).forEach(function (k) {
        if (!SAFE_KEY.test(k)) return;
        var value = simple(item[k], 500);
        if (value !== null) out[k] = value;
      });
      return out;
    });
  }

  function json(payload) {
    return JSON.stringify(Object.assign({ app: APP, v: VERSION, at: new Date().toISOString() }, payload));
  }

  function parse(raw) {
    var text = String(raw || '').trim();
    if (!text) throw new Error('Code QR vide.');
    if (text.length > MAX_IMPORT_TEXT) throw new Error('Code QR trop volumineux.');
    var data;
    try { data = JSON.parse(text); }
    catch (e) { throw new Error('Code QR illisible. Utilisez la saisie manuelle du code.'); }
    if (!plain(data) || data.app !== APP) throw new Error('Ce code QR n’appartient pas à Touch Unique Studio.');
    if (Number(data.v) !== VERSION) throw new Error('Version de code QR non prise en charge.');
    return data;
  }

  function makeLogin() {
    var A = root.TUSAccounts;
    if (!A || !A.current()) throw new Error('Connectez-vous d’abord sur cet appareil.');
    var account = A.exportAccount();
    if (!account) throw new Error('Compte introuvable sur cet appareil.');
    return json({ kind: 'login', account: account });
  }

  function makeSync() {
    var A = root.TUSAccounts;
    var payload = {
      kind: 'sync',
      account: A ? A.exportAccount() : null,
      session: null,
      remember: A ? A.remembered() : false
    };
    /* La session ne contient qu'un identifiant : aucun secret n'est exporté. */
    try {
      var s = JSON.parse(root.localStorage.getItem(A.SESSION_KEY) || 'null');
      if (plain(s) && ID_RE.test(String(s.id))) {
        payload.session = { id: String(s.id), at: String(s.at || '').slice(0, 40) };
      }
    } catch (e) { /* ignoré */ }
    if (root.Store && root.Store.db) {
      var db = root.Store.db;
      var settings = {};
      if (plain(db.settings)) Object.keys(db.settings).slice(0, 60).forEach(function (k) {
        if (SAFE_KEY.test(k)) {
          var v = simple(db.settings[k], 300);
          if (v !== null) settings[k] = v;
        }
      });
      payload.data = {
        settings: settings,
        companies: records(db.companies, 12),
        clients: records(db.clients, 12),
        projects: records(db.projects, 12),
        tasks: records(db.tasks, 30)
      };
    }
    /* La clé d'accès n'est jamais mise dans un QR code : elle est saisie sur
       l'autre appareil. Seule l'URL validée peut être transférée. */
    try {
      var url = sec().storedServerURL ? sec().storedServerURL() : root.localStorage.getItem('tus_proxy_url_v1');
      if (url && sec().isAllowedServer && sec().isAllowedServer(url)) {
        payload.tus_proxy_url_v1 = sec().serverURL(url);
      }
      var net = root.localStorage.getItem('tus_network_enabled_v1');
      if (net === '0' || net === '1') payload.tus_network_enabled_v1 = net;
      var profiles = root.localStorage.getItem('tus_robot_profiles_v1');
      if (profiles && profiles.length < 20000) {
        JSON.parse(profiles);
        payload.tus_robot_profiles_v1 = profiles;
      }
    } catch (e) { /* réglage ignoré */ }
    try {
      var cat = root.localStorage.getItem('tus_catalog_v1');
      if (cat) {
        var parsed = JSON.parse(cat);
        var clean = root.TUSCatalog && root.TUSCatalog.sanitizeState ? root.TUSCatalog.sanitizeState(parsed) : null;
        if (clean) payload.catalog = clean;
      }
    } catch (e) { /* catalogue ignoré */ }
    var text = json(payload);
    if (text.length > MAX_TEXT) {
      // Garde l’essentiel si le catalogue est trop volumineux pour un QR lisible.
      delete payload.catalog;
      if (payload.data) {
        delete payload.data.tasks;
        payload.data.projects = (payload.data.projects || []).slice(0, 5);
      }
      text = json(payload);
    }
    if (text.length > MAX_TEXT) {
      delete payload.data;
      text = json(payload);
    }
    return text;
  }

  function apply(raw, keep, options) {
    var text = String(raw || '').trim();
    if (text.length > MAX_IMPORT_TEXT) throw new Error('Code QR trop volumineux.');
    var data = parse(text);
    if (data.kind !== 'login' && data.kind !== 'sync') {
      throw new Error('Type de code QR inconnu.');
    }
    var A = root.TUSAccounts;
    if (!A) throw new Error('Module de comptes indisponible.');
    /* Un QR code peut contenir le sel et le haché du compte : jamais importés
       sans confirmation explicite, et jamais de clé serveur arbitraire. */
    if (data['tus_proxy_key_v1'] || data.key || data.proxyKey) {
      throw new Error('Les clés d’accès ne sont pas transférables par code QR : saisissez-les dans les réglages.');
    }
    var confirmed = !!(options && options.confirmed === true);
    if (data.account && !confirmed) {
      if (typeof root.confirm !== 'function') throw new Error('Confirmation requise avant d’importer un compte.');
      confirmed = root.confirm('Ce code contient un compte. Ne l’importez que s’il vient de votre propre appareil. Remplacer les données locales ?');
    }
    if (data.account && !confirmed) throw new Error('Import annulé.');

    var user = null;
    if (data.account) user = A.importAccount(data.account, keep !== false, { confirmed: true });
    else if (!A.current()) throw new Error('Aucun compte dans le code QR.');

    if (data.kind === 'sync') {
      if (data.data) {
        if (!plain(data.data)) throw new Error('Données QR invalides.');
        if (data.data.settings != null && !plain(data.data.settings)) throw new Error('Réglages QR invalides.');
        ['companies', 'clients', 'projects', 'tasks'].forEach(function (key) {
          if (data.data[key] != null && !Array.isArray(data.data[key])) throw new Error('Données QR invalides.');
        });
        if (root.Store && root.Store.db) {
          var db = root.Store.db;
          ['settings', 'companies', 'clients', 'projects', 'tasks'].forEach(function (key) {
            var incoming = data.data[key];
            if (Array.isArray(incoming)) {
              var current = Array.isArray(db[key]) ? db[key] : [];
              var byId = {};
              records(current.concat(incoming), 2000).forEach(function (item) {
                if (item && typeof item.id === 'string' && SAFE_KEY.test(item.id)) byId[item.id] = item;
              });
              db[key] = Object.keys(byId).map(function (id) { return byId[id]; });
            } else if (plain(incoming)) {
              var clean = {};
              Object.keys(incoming).slice(0, 60).forEach(function (k) {
                if (!SAFE_KEY.test(k)) return;
                var v = simple(incoming[k], 300);
                if (v !== null) clean[k] = v;
              });
              db[key] = Object.assign({}, plain(db[key]) ? db[key] : {}, clean);
            }
          });
          root.Store.save();
        }
      }
      if (data.tus_proxy_url_v1) {
        if (typeof data.tus_proxy_url_v1 !== 'string' || !sec().isAllowedServer || !sec().isAllowedServer(data.tus_proxy_url_v1)) {
          throw new Error('Adresse du serveur invalide dans le code QR.');
        }
        root.localStorage.setItem('tus_proxy_url_v1', sec().serverURL(data.tus_proxy_url_v1));
      }
      if (data.tus_network_enabled_v1 === '0' || data.tus_network_enabled_v1 === '1') {
        root.localStorage.setItem('tus_network_enabled_v1', data.tus_network_enabled_v1);
      }
      if (data.tus_robot_profiles_v1 && typeof data.tus_robot_profiles_v1 === 'string' && data.tus_robot_profiles_v1.length < 20000) {
        try {
          JSON.parse(data.tus_robot_profiles_v1);
          root.localStorage.setItem('tus_robot_profiles_v1', data.tus_robot_profiles_v1);
        } catch (e) { /* profils ignorés */ }
      }
      if (data.catalog) {
        var clean = root.TUSCatalog && root.TUSCatalog.sanitizeState ? root.TUSCatalog.sanitizeState(data.catalog) : null;
        if (!clean) throw new Error('Catalogue du code QR invalide.');
        root.localStorage.setItem('tus_catalog_v1', JSON.stringify(clean));
      }
    }
    return {
      kind: data.kind, user: user || A.current(), size: text.length,
      pending: !!(user && user.pending)
    };
  }

  function image(text, scale) {
    var Q = qr();
    if (!Q) throw new Error('Générateur de QR indisponible.');
    var code = Q(0, 'L');
    code.addData(text);
    code.make();
    var modules = code.getModuleCount();
    // Garde environ 700 px d’image source pour une lecture nette après mise à l’échelle.
    var cell = Math.max(1, Math.floor((Number(scale) || 5) * 140 / modules));
    return code.createDataURL(cell, 2);
  }

  function decodeImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var D = decoder();
        if (!D) return reject(new Error('Lecteur de QR indisponible.'));
        var canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        var ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        var found = D(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
        if (!found || !found.data) return reject(new Error('Aucun code QR détecté dans cette image.'));
        try { resolve(String(found.data)); }
        catch (e) { reject(e); }
      };
      img.onerror = function () { reject(new Error('Image du code QR illisible.')); };
      img.src = src;
    });
  }

  function decodeFile(file) {
    return new Promise(function (resolve, reject) {
      if (!file) return reject(new Error('Choisissez une image ou prenez une photo.'));
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('Lecture de l’image impossible.')); };
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.readAsDataURL(file);
    }).then(decodeImage);
  }

  root.TUSQRSync = {
    makeLogin: makeLogin,
    makeSync: makeSync,
    apply: apply,
    parse: parse,
    image: image,
    decodeImage: decodeImage,
    decodeFile: decodeFile,
    MAX_TEXT: MAX_TEXT
  };
})(window);
