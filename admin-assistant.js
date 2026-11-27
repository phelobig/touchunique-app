/* Touch Unique Studio — assistant administrateur local.
   Il indexe les données de l'application, du site synchronisé et les fichiers
   que vous avez importés dans le gestionnaire. Aucun fichier du téléphone n'est
   lu sans import ou autorisation explicite. */
(function (root) {
  'use strict';

  var STOP = ('le la les un une des de du au aux et ou est sont pour dans sur avec par plus ' +
    'mon ma mes ton ta tes son sa ses notre vos leur leurs ce cet cette ces qui que quoi ' +
    'comment combien quand ou ouest ou est ce il elle on nous vous ils elles ai a as avons ' +
    'avez ont etre etre ete etait etaient faire fait faire qu il je tu se sa ou ou').split(/\s+/);
  var cache = null;
  var cacheAt = 0;
  var CACHE_MS = 45000;

  function $(s, r) { return (r || document).querySelector(s); }
  function norm(v) {
    return String(v == null ? '' : v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }
  function tokens(q) {
    return norm(q).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
      .filter(function (t) { return t.length > 2 && STOP.indexOf(t) < 0; });
  }
  function readJSON(key) {
    try {
      var v = JSON.parse(root.localStorage.getItem(key) || '[]');
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }
  function rec(type, source, title, text, meta) {
    return { type: type, source: source, title: String(title || 'Sans titre'), text: String(text || ''), meta: meta || {} };
  }

  function storeRecords() {
    var db = (root.Store && root.Store.db) || {};
    var out = [];
    function group(type, name, list, fields) {
      (list || []).forEach(function (item) {
        var text = fields.map(function (f) {
          var v = f.indexOf('.') >= 0
            ? f.split('.').reduce(function (o, k) { return o && o[k]; }, item)
            : item[f];
          return v == null ? '' : String(v);
        }).filter(Boolean).join(' · ');
        out.push(rec(type, name, item.name || item.title || item.ref || item.id || type, text, item));
      });
    }
    group('projet', 'Application', db.projects, ['name', 'client', 'type', 'status', 'amount', 'due', 'source', 'company', 'phone']);
    group('tâche', 'Application', db.tasks, ['title', 'phase', 'priority', 'status', 'projectId']);
    group('client', 'Application', db.clients, ['name', 'phone', 'email', 'city']);
    var prospects = db.prospects || [];
    group('prospect', 'Application · en ligne', prospects.filter(function (p) { return (p.bucket || 'online') !== 'images'; }),
      ['name', 'company', 'phone', 'email', 'city', 'need', 'source', 'status', 'domainLabel']);
    group('prospect image', 'Application · images', prospects.filter(function (p) { return p.bucket === 'images'; }),
      ['name', 'company', 'phone', 'email', 'city', 'need', 'source', 'status', 'domainLabel']);
    group('commande', 'Site web', db.leads, ['ref', 'client.name', 'client.phone', 'type', 'score', 'level', 'nextAction']);
    group('entreprise', 'Application', db.companies, ['name', 'sector', 'city', 'contact', 'phone', 'email']);
    group('dossier', 'Application', db.folders, ['name', 'parent', 'company']);
    group('contenu', 'Application', db.contents, ['theme', 'type', 'text']);
    group('publication', 'Application', db.social, ['platform', 'text', 'status', 'scheduledAt']);
    group('robot', 'Application', db.robots, ['id', 'topic', 'hour', 'provider', 'enabled']);
    group('journal', 'Application', (db.logs || []).slice(0, 60), ['text', 'at']);
    group('commande boutique', 'Boutique', (db.shop && db.shop.orders) || [], ['id', 'product', 'name', 'total', 'phone', 'createdAt']);
    group('commande site', 'Site web', readJSON('tus_site_leads_v1'), ['ref', 'client.name', 'client.phone', 'type', 'total']);
    group('panier site', 'Site web', readJSON('tus_site_cart_v1'), ['id', 'name', 'price', 'qty']);
    var catalogue = (root.TUSCatalog && root.TUSCatalog.products && root.TUSCatalog.products()) ||
      ((root.TU_CATALOGUE && root.TU_CATALOGUE.products) || []);
    (catalogue || []).forEach(function (p) {
      out.push(rec('offre', 'Boutique', p.name, [p.short, p.desc, p.category, p.price && (p.price + ' FCFA')].filter(Boolean).join(' · '), p));
    });
    var s = db.settings || {};
    out.push(rec('réglage', 'Application', 'Profil Touch Unique',
      [s.studio, s.phone, s.whatsapp, s.activeCompany, s.activeProject].filter(Boolean).join(' · '), s));
    return out;
  }

  function fileText(blob) {
    if (!blob) return Promise.resolve('');
    if (blob.size > 900000) return Promise.resolve('');
    if (typeof blob.text === 'function') return blob.text().catch(function () { return ''; });
    return new Promise(function (resolve) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = function () { resolve(''); };
      reader.readAsText(blob);
    });
  }

  function fileRecords() {
    var F = root.TUSFiles;
    if (!F || !F.allFolders) return Promise.resolve([]);
    return F.allFolders().then(function (folders) {
      return Promise.all((folders || []).map(function (folder) {
        return F.listFiles(folder.id).then(function (files) {
          return (files || []).map(function (f) { return Object.assign({}, f, { path: F.pathOf(f.folder, folders) }); });
        }).catch(function () { return []; });
      }));
    }).then(function (lists) {
      var files = [].concat.apply([], lists).slice(0, 400);
      var textFiles = files.filter(function (f) {
        return /^(text\/|application\/(json|xml|csv|javascript)|image\/svg)/.test(f.mime || '') ||
          /\.(txt|md|csv|json|xml|html|js|log|svg)$/i.test(f.name || '');
      }).slice(0, 80);
      var records = files.map(function (f) {
        return rec('fichier', 'Téléphone · ' + (f.path || 'Mes fichiers'), f.name,
          [f.mime, f.size && (Math.round(f.size / 1024) + ' Ko'), f.createdAt, f.source].filter(Boolean).join(' · '), f);
      });
      return Promise.all(textFiles.map(function (f) {
        return F.getFile(f.id).then(function (meta) { return fileText(meta && meta.blob); })
          .then(function (text) {
            var item = records.find(function (r) { return r.meta && r.meta.id === f.id; });
            if (item && text) item.text += ' · ' + norm(text).slice(0, 4000);
          }).catch(function () { return null; });
      })).then(function () { return records; });
    }).catch(function () { return []; });
  }

  function buildIndex() {
    if (cache && Date.now() - cacheAt < CACHE_MS) return Promise.resolve(cache);
    return fileRecords().then(function (files) {
      cache = storeRecords().concat(files);
      cacheAt = Date.now();
      return cache;
    });
  }

  function search(index, query) {
    var ts = tokens(query);
    if (!ts.length) return [];
    return index.map(function (item) {
      var title = norm(item.title), text = norm(item.text);
      var score = ts.reduce(function (sum, t) {
        return sum + (title.indexOf(t) >= 0 ? 6 : 0) + (text.split(t).length - 1);
      }, 0);
      if (!score) return null;
      return Object.assign({}, item, { score: score });
    }).filter(Boolean).sort(function (a, b) { return b.score - a.score; });
  }

  function snippet(text, query) {
    var clean = String(text || '').replace(/\s+/g, ' ').trim();
    var ts = tokens(query);
    var pos = -1;
    ts.some(function (t) { pos = norm(clean).indexOf(t); return pos >= 0; });
    if (pos < 0) return clean.slice(0, 180);
    return (pos > 50 ? '…' : '') + clean.slice(Math.max(0, pos - 50), pos + 140) + '…';
  }

  function counts(index) {
    var out = {};
    index.forEach(function (r) { out[r.type] = (out[r.type] || 0) + 1; });
    return out;
  }

  /* Réponses exactes aux questions de comptage, sans passer par l'IA distante. */
  function countAnswer(index, query) {
    var q = norm(query);
    if (q.indexOf('combien') < 0) return '';
    var c = counts(index);
    var lines = [];
    function add(label, n) { lines.push(label + ' : ' + n); }
    if (q.indexOf('prospect') >= 0) {
      var images = c['prospect image'] || 0;
      var online = c['prospect'] || 0;
      if (q.indexOf('image') >= 0) {
        add('Prospects issus d’images', images);
        var domains = {};
        index.forEach(function (r) {
          if (r.type !== 'prospect image') return;
          var d = r.meta && (r.meta.domainLabel || r.meta.domain) || 'Autre domaine';
          domains[d] = (domains[d] || 0) + 1;
        });
        if (Object.keys(domains).length) add('Par domaine', Object.keys(domains).sort().map(function (d) { return d + ' (' + domains[d] + ')'; }).join(', '));
      } else if (q.indexOf('ligne') >= 0 || q.indexOf('en ligne') >= 0) {
        add('Prospects en ligne', online);
      } else {
        add('Prospects en ligne', online);
        add('Prospects issus d’images', images);
        add('Total prospects', online + images);
      }
    }
    if (q.indexOf('fichier') >= 0) add('Fichiers importés', c['fichier'] || 0);
    if (q.indexOf('client') >= 0) add('Clients', c['client'] || 0);
    if (q.indexOf('projet') >= 0) add('Projets', c['projet'] || 0);
    if (q.indexOf('offre') >= 0) add('Offres', c['offre'] || 0);
    if (!lines.length) return '';
    return 'Voici le décompte exact de l’index local :\n' + lines.join('\n') +
      '\n\nLes deux bacs Prospect restent séparés : aucun doublon n’est fusionné entre le web et les images.';
  }

  function localAnswer(index, query, hits) {
    var c = counts(index);
    var files = index.filter(function (r) { return r.type === 'fichier'; }).length;
    var intro = 'J’ai analysé ' + index.length + ' éléments locaux, dont ' + files +
      ' fichier(s) du téléphone importé(s) dans l’application.';
    if (!hits.length) {
      return intro + '\nAucun résultat précis pour « ' + query + ' ». Essayez un nom de projet, de client, de fichier ou un mot-clé.';
    }
    var top = hits.slice(0, 6).map(function (h, i) {
      return (i + 1) + '. [' + h.type + ' · ' + h.source + '] **' + h.title + '** — ' + snippet(h.text, query);
    }).join('\n');
    var summary = Object.keys(c).sort().map(function (k) { return k + ' : ' + c[k]; }).join(', ');
    return intro + '\n\nRésultats (' + hits.length + ' correspondance(s)) :\n' + top +
      '\n\nIndex disponible : ' + summary + '.';
  }

  function ask(query) {
    var q = String(query || '').trim();
    if (!q) return Promise.resolve({ answer: 'Posez une question sur vos données.', sources: [] });
    return buildIndex().then(function (index) {
      var exact = countAnswer(index, q);
      if (exact) return { answer: exact, sources: [] };
      var hits = search(index, q);
      var sources = hits.slice(0, 6).map(function (h) { return h.source + ' · ' + h.title; });
      var AI = root.TUSAI;
      var allowed = !root.TUSNetwork || root.TUSNetwork.enabled();
      if (AI && AI.ask && allowed && index.length) {
        var context = hits.slice(0, 8).map(function (h) {
          return '- [' + h.type + ' · ' + h.source + '] ' + h.title + ' : ' + String(h.text).slice(0, 500);
        }).join('\n');
        var tallyMap = counts(index);
        var tally = Object.keys(tallyMap).sort().map(function (k) { return k + ' : ' + tallyMap[k]; }).join(', ');
        var prompt = 'Tu es l’assistant administrateur local Touch Unique. Réponds en français, de façon précise, ' +
          'uniquement à partir des éléments ci-dessous. Cite les sources. Si l’information manque, dis-le.\n\n' +
          'Données indexées : ' + index.length + ' éléments. Répartition : ' + tally + '.\n' + context + '\n\nQuestion : ' + q;
        var lang = root.TUSLang && root.TUSLang.detect ? root.TUSLang.detect(q) : 'fr';
        return AI.ask(prompt, { lang: lang }).then(function (r) {
          return {
            answer: (r.text || localAnswer(index, q, hits)) + '\n\n— Sources : ' +
              (sources.length ? sources.join(', ') : 'données locales'),
            sources: sources, lang: r.lang || lang
          };
        }).catch(function () {
          return { answer: localAnswer(index, q, hits), sources: sources };
        });
      }
      return { answer: localAnswer(index, q, hits), sources: sources };
    });
  }

  function importFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length || !root.TUSFiles) return Promise.resolve(0);
    return root.TUSFiles.addFiles('root', files).then(function (added) {
      cache = null;
      return added.length;
    });
  }

  function init() {
    var panel = $('#admin-panel'), fab = $('#admin-fab');
    if (!panel || !fab) return;
    var box = $('#admin-messages');
    function push(cls, text) {
      var el = document.createElement('div');
      el.className = 'msg ' + cls;
      el.textContent = text;
      box.appendChild(el);
      box.scrollTop = box.scrollHeight;
    }
    function toggle(open) {
      var isOpen = typeof open === 'boolean' ? open : !panel.classList.contains('open');
      panel.classList.toggle('open', isOpen);
      if (isOpen) panel.removeAttribute('inert'); else panel.setAttribute('inert', '');
      fab.setAttribute('aria-expanded', String(isOpen));
      if (isOpen) $('#admin-text').focus();
    }
    push('bot', 'Je suis l’administrateur local. Je fouille les données de l’application, du site et les fichiers que vous m’avez confiés. Tout reste sur cet appareil.');
    $('#admin-suggestions').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      var text = b.dataset.query || b.textContent;
      if (text === '@import') { $('#admin-file-input').click(); return; }
      $('#admin-text').value = text;
      $('#admin-form').requestSubmit();
    });
    $('#admin-file-input').addEventListener('change', function (e) {
      var files = e.target.files;
      if (!files || !files.length) return;
      push('user', 'Import de ' + files.length + ' fichier(s)');
      importFiles(files).then(function (n) {
        push('bot', n + ' fichier(s) classé(s) dans « Mes fichiers ». L’index est actualisé.');
      }).catch(function (err) { push('bot', 'Import impossible : ' + err.message); });
      e.target.value = '';
    });
    $('#admin-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var input = $('#admin-text'), q = input.value.trim();
      if (!q) return;
      push('user', q); input.value = '';
      var btn = $('button[type="submit"]', e.target);
      if (btn) btn.disabled = true;
      push('bot', 'Analyse de l’index local…');
      ask(q).then(function (res) {
        var last = box.lastElementChild;
        if (last) last.textContent = res.answer;
      }).catch(function (err) {
        var last = box.lastElementChild;
        if (last) last.textContent = 'Erreur : ' + err.message;
      }).then(function () { if (btn) btn.disabled = false; });
    });
    fab.addEventListener('click', function () { toggle(); });
    $('#admin-close').addEventListener('click', function () { toggle(false); });
    root.addEventListener('tusback', function () { toggle(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') toggle(false); });
  }

  root.TUSAdmin = { ask: ask, importFiles: importFiles, search: search, buildIndex: buildIndex, invalidate: function () { cache = null; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
