/* Touch Unique Studio — préparation automatique d’une mission de collaboration.
   Lit les fichiers du dossier choisi, reconnaît les images et en déduit le client,
   l’entreprise, le secteur et le sujet. Le serveur analyse les images quand il est
   configuré ; sinon l’analyse locale reste disponible hors ligne. */
(function (root) {
  'use strict';

  var SECTORS = [
    { name: 'Santé & pharmacie', words: ['pharmac', 'clinique', 'santé', 'medical', 'docteur', 'hopital'] },
    { name: 'Éducation & formation', words: ['ecole', 'école', 'universite', 'formation', 'eleve', 'étudiant'] },
    { name: 'Restauration & hôtellerie', words: ['restaurant', 'cafe', 'café', 'hotel', 'hôtel', 'menu', 'maquis'] },
    { name: 'Mode & beauté', words: ['mode', 'boutique', 'vetement', 'vêtement', 'salon', 'coiff', 'beauté'] },
    { name: 'Immobilier & construction', words: ['immo', 'maison', 'appartement', 'construction', 'chantier', 'architecte'] },
    { name: 'Commerce & distribution', words: ['commerce', 'vente', 'magasin', 'produit', 'client', 'offre'] },
    { name: 'Technologie & services', words: ['tech', 'digital', 'logiciel', 'application', 'agence', 'studio'] }
  ];

  function norm(v) {
    return String(v == null ? '' : v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }
  function isText(meta) {
    return /^(text\/|application\/(json|xml|csv|javascript|pdf))/i.test(meta.mime || '') ||
      /\.(txt|md|csv|json|xml|html|js|log|svg|pdf)$/i.test(meta.name || '');
  }
  function isImage(meta) { return /^image\//i.test(meta.mime || ''); }

  function descendants(id, items) {
    var out = [];
    (items || []).forEach(function (f) {
      if (f.parent === id) { out.push(f); out = out.concat(descendants(f.id, items)); }
    });
    return out;
  }

  function readText(meta) {
    var F = root.TUSFiles;
    if (!F) return Promise.resolve('');
    return F.getFile(meta.id).then(function (full) {
      var blob = full && full.blob;
      if (!blob) return '';
      if (blob.size > 400000) return '';
      if (typeof blob.text === 'function') return blob.text().catch(function () { return ''; });
      return new Promise(function (resolve) {
        var reader = new FileReader();
        reader.onload = function () { resolve(String(reader.result || '')); };
        reader.onerror = function () { resolve(''); };
        reader.readAsText(blob);
      });
    }).catch(function () { return ''; });
  }

  function sectorOf(text) {
    var clean = norm(text);
    var best = null, score = 0;
    SECTORS.forEach(function (rule) {
      var n = rule.words.reduce(function (sum, w) { return sum + (clean.indexOf(w) >= 0 ? 1 : 0); }, 0);
      if (n > score) { score = n; best = rule.name; }
    });
    return best || '';
  }

  function companyOf(folder, files, text, clients) {
    var clean = String(folder && folder.name || '').replace(/^IA\s*·\s*/i, '').trim();
    if (clean && !/^(mes fichiers|documents|briefs|contrats|visuels)$/i.test(clean)) return clean;
    var names = (clients || []).map(function (c) { return c.name; }).filter(Boolean);
    var all = norm(text + ' ' + files.map(function (f) { return f.name; }).join(' '));
    var found = names.find(function (n) { return all.indexOf(norm(n)) >= 0; });
    if (found) return found;
    var first = files.find(function (f) { return /\.(pdf|docx?|jpg|png)$/i.test(f.name || ''); });
    if (first) return String(first.name).replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').slice(0, 80);
    return '';
  }

  function clientOf(company, clients) {
    var clean = norm(company);
    var found = (clients || []).find(function (c) {
      return clean && (clean.indexOf(norm(c.name)) >= 0 || norm(c.name).indexOf(clean) >= 0);
    });
    return found ? found.id : '';
  }

  function analyze(folderId) {
    var F = root.TUSFiles;
    if (!F || !F.allFolders) return Promise.resolve({ error: 'Gestionnaire de fichiers indisponible' });
    var Store = root.Store || {};
    var clients = Store.clients ? Store.clients() : [];
    return F.allFolders().then(function (folders) {
      var target = folders.find(function (f) { return f.id === folderId; }) || folders.find(function (f) { return f.id === 'root'; }) || { id: 'root', name: 'Mes fichiers' };
      var ids = [target.id].concat(descendants(target.id, folders).map(function (f) { return f.id; }));
      return Promise.all(ids.map(function (id) { return F.listFiles(id).catch(function () { return []; }); }))
        .then(function (lists) {
          var seen = {}, files = [];
          [].concat.apply([], lists).forEach(function (f) { if (!seen[f.id]) { seen[f.id] = 1; files.push(f); } });
          return { folder: target, files: files.slice(0, 120) };
        });
    }).then(function (data) {
      var textFiles = data.files.filter(isText).slice(0, 40);
      return Promise.all(textFiles.map(function (f) {
        return readText(f).then(function (text) { return String(text || '').slice(0, 3000); });
      })).then(function (texts) {
        var text = texts.join('\n') + '\n' + data.files.map(function (f) { return f.name || ''; }).join('\n');
        var company = companyOf(data.folder, data.files, text, clients);
        var sector = sectorOf(data.folder.name + ' ' + text);
        var evidence = ['Dossier analysé : ' + data.folder.name, 'Fichiers : ' + data.files.length].join('\n') +
          data.files.slice(0, 30).map(function (f) {
            return '- ' + (f.name || 'sans nom') + ' · ' + (f.mime || '') + ' · ' + Math.round((f.size || 0) / 1024) + ' Ko';
          }).join('\n') + '\nExtraits :\n' + texts.slice(0, 8).join('\n---\n');
        return {
          folderId: data.folder.id, folderName: data.folder.name,
          _files: data.files, files: data.files.length, images: data.files.filter(isImage).length,
          company: company, sector: sector,
          client: clientOf(company, clients),
          topic: company ? ('Préparer une offre et un plan de production pour ' + company + (sector ? ' (' + sector + ')' : '') + ' à partir des fichiers du dossier ' + data.folder.name) : ('Analyser le dossier ' + data.folder.name + ' et proposer une mission adaptée'),
          research: evidence
        };
      });
    }).then(function (result) {
      var Cloud = root.TUSCloud;
      var F2 = root.TUSFiles;
      if (!Cloud || !Cloud.configured() || !result.images) return result;
      var images = (result._files || []).filter(isImage).slice(0, 3);
      return Promise.all(images.map(function (meta) {
        return F2.readAsDataURL(meta.id).then(function (r) {
          var dataUrl = String(r.content || '');
          var comma = dataUrl.indexOf(',');
          return Cloud.analyzeMedia({
            name: meta.name, mime: meta.mime || 'image/jpeg',
            content: comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl,
            company: result.company, question: 'Décris ce visuel et indique le secteur, la marque et les éléments utiles pour une mission de communication.'
          });
        }).then(function (res) {
          return '[Image ' + meta.name + '] ' + String((res && (res.summary || res.text)) || '').slice(0, 700);
        }).catch(function () { return ''; });
      })).then(function (summaries) {
        summaries = summaries.filter(Boolean);
        result.research += '\nAnalyse des images :\n' + summaries.join('\n');
        if (!result.sector) {
          var joined = summaries.join(' ');
          result.sector = sectorOf(joined);
        }
        return result;
      });
    });
  }

  root.TUSCollabAuto = { analyze: analyze, sectorOf: sectorOf, SECTORS: SECTORS };
})(window);
