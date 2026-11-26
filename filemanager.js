/* Touch Unique Studio — gestionnaire de fichiers local.
   Les fichiers ajoutés depuis la mémoire du téléphone sont conservés dans
   IndexedDB (pas dans localStorage, afin d'accepter photos, vidéos et PDF
   volumineux). Dossiers imbriqués, renommage, déplacement et suppression sont
   disponibles hors ligne. Un envoi vers le serveur sécurisé reste possible. */
(function (root) {
  'use strict';

  var DB_NAME = 'tus_filemanager_v1';
  var VERSION = 1;
  var FOLDERS = 'folders';
  var FILES = 'files';
  var dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise(function (resolve, reject) {
      if (!root.indexedDB) return reject(new Error('IndexedDB indisponible sur cet appareil'));
      var req = root.indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(FOLDERS)) {
          var f = db.createObjectStore(FOLDERS, { keyPath: 'id' });
          f.createIndex('parent', 'parent', { unique: false });
        }
        if (!db.objectStoreNames.contains(FILES)) {
          var s = db.createObjectStore(FILES, { keyPath: 'id' });
          s.createIndex('folder', 'folder', { unique: false });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('Ouverture du gestionnaire impossible')); };
    });
    return dbp;
  }

  function run(storeName, mode, work) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(storeName, mode);
        var store = tx.objectStore(storeName);
        var out;
        try { out = work(store); } catch (e) { reject(e); return; }
        tx.oncomplete = function () { resolve(out && out.result !== undefined ? out.result : out); };
        tx.onerror = function () { reject(tx.error || new Error('Erreur de stockage')); };
        tx.onabort = function () { reject(tx.error || new Error('Opération annulée')); };
      });
    });
  }
  function req(request) {
    return new Promise(function (resolve, reject) {
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error('Erreur de lecture')); };
    });
  }
  function uid(prefix) {
    return (prefix || 'ID') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();
  }
  function now() { return new Date().toISOString(); }

  function ensureRoot() {
    return run(FOLDERS, 'readwrite', function (store) {
      var r = store.get('root');
      return new Promise(function (resolve, reject) {
        r.onsuccess = function () {
          if (r.result) return resolve(r.result);
          var rootFolder = { id: 'root', name: 'Mes fichiers', parent: '', createdAt: now(), color: 'red' };
          store.put(rootFolder);
          resolve(rootFolder);
        };
        r.onerror = function () { reject(r.error); };
      });
    });
  }

  function listFolders(parent) {
    return ensureRoot().then(function () {
      return run(FOLDERS, 'readonly', function (store) {
        var index = store.index('parent');
        return req(index.getAll(parent || ''));
      });
    }).then(function (list) {
      return (list || []).sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'fr'); });
    });
  }

  function allFolders() {
    return ensureRoot().then(function () {
      return run(FOLDERS, 'readonly', function (store) { return req(store.getAll()); });
    }).then(function (list) {
      return (list || []).sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'fr'); });
    });
  }

  function folder(id) {
    return run(FOLDERS, 'readonly', function (store) { return req(store.get(id)); });
  }

  function createFolder(name, parent, color) {
    var clean = String(name || '').trim().slice(0, 80);
    if (!clean) return Promise.reject(new Error('Nom de dossier requis'));
    parent = parent || 'root';
    return allFolders().then(function (items) {
      var sibling = items.some(function (f) { return f.parent === parent && f.name.toLowerCase() === clean.toLowerCase(); });
      if (sibling) throw new Error('Un dossier porte déjà ce nom ici');
      var obj = { id: uid('FD'), name: clean, parent: parent, createdAt: now(), color: color || 'blue' };
      return run(FOLDERS, 'readwrite', function (store) { store.put(obj); return obj; });
    });
  }

  function renameFolder(id, name) {
    var clean = String(name || '').trim().slice(0, 80);
    if (!clean) return Promise.reject(new Error('Nom de dossier requis'));
    if (id === 'root') return Promise.reject(new Error('Le dossier racine ne peut pas être renommé'));
    return folder(id).then(function (obj) {
      if (!obj) throw new Error('Dossier introuvable');
      return allFolders().then(function (items) {
        if (items.some(function (f) { return f.parent === obj.parent && f.name.toLowerCase() === clean.toLowerCase() && f.id !== id; })) {
          throw new Error('Un dossier porte déjà ce nom ici');
        }
        obj.name = clean; obj.updatedAt = now();
        return run(FOLDERS, 'readwrite', function (store) { store.put(obj); return obj; });
      });
    });
  }

  function descendants(id, items) {
    var out = [];
    (items || []).forEach(function (f) {
      if (f.parent === id) {
        out.push(f);
        out = out.concat(descendants(f.id, items));
      }
    });
    return out;
  }

  function deleteFolder(id) {
    if (id === 'root') return Promise.reject(new Error('Le dossier racine ne peut pas être supprimé'));
    return allFolders().then(function (items) {
      var ids = [id].concat(descendants(id, items).map(function (f) { return f.id; }));
      return run(FILES, 'readonly', function (store) { return req(store.getAll()); }).then(function (files) {
        var toDelete = (files || []).filter(function (f) { return ids.indexOf(f.folder) >= 0; }).map(function (f) { return f.id; });
        return run(FILES, 'readwrite', function (store) {
          toDelete.forEach(function (fid) { store.delete(fid); });
        }).then(function () {
          return run(FOLDERS, 'readwrite', function (store) {
            ids.forEach(function (fid) { store.delete(fid); });
          });
        }).then(function () { return { folders: ids.length, files: toDelete.length }; });
      });
    });
  }

  function listFiles(folderId) {
    var id = folderId || 'root';
    return run(FILES, 'readonly', function (store) { return req(store.index('folder').getAll(id)); })
      .then(function (list) {
        return (list || []).sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); })
          .map(function (f) {
            var copy = Object.assign({}, f);
            delete copy.blob; // ne jamais renvoyer le binaire dans l'interface
            return copy;
          });
      });
  }

  function addFile(folderId, file) {
    if (!file) return Promise.reject(new Error('Fichier absent'));
    var id = uid('FL');
    var meta = {
      id: id, folder: folderId || 'root', name: String(file.name || 'fichier').slice(0, 180),
      mime: file.type || 'application/octet-stream', size: file.size || 0,
      createdAt: now(), updatedAt: now(), blob: file, source: 'appareil'
    };
    return run(FILES, 'readwrite', function (store) { store.put(meta); }).then(function () {
      var out = Object.assign({}, meta); delete out.blob; return out;
    });
  }

  function addFiles(folderId, fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return Promise.resolve([]);
    return files.reduce(function (chain, file) {
      return chain.then(function (acc) {
        return addFile(folderId, file).then(function (meta) { acc.push(meta); return acc; });
      });
    }, Promise.resolve([]));
  }

  function renameFile(id, name) {
    var clean = String(name || '').trim().slice(0, 180);
    if (!clean) return Promise.reject(new Error('Nom de fichier requis'));
    return run(FILES, 'readonly', function (store) { return req(store.get(id)); }).then(function (meta) {
      if (!meta) throw new Error('Fichier introuvable');
      meta.name = clean; meta.updatedAt = now();
      return run(FILES, 'readwrite', function (store) { store.put(meta); }).then(function () {
        var out = Object.assign({}, meta); delete out.blob; return out;
      });
    });
  }

  function moveFile(id, folderId) {
    return run(FILES, 'readonly', function (store) { return req(store.get(id)); }).then(function (meta) {
      if (!meta) throw new Error('Fichier introuvable');
      meta.folder = folderId || 'root'; meta.updatedAt = now();
      return run(FILES, 'readwrite', function (store) { store.put(meta); }).then(function () {
        var out = Object.assign({}, meta); delete out.blob; return out;
      });
    });
  }

  function deleteFile(id) {
    return run(FILES, 'readwrite', function (store) { store.delete(id); });
  }

  function getFile(id) {
    return run(FILES, 'readonly', function (store) { return req(store.get(id)); });
  }

  function downloadFile(id) {
    return getFile(id).then(function (meta) {
      if (!meta) throw new Error('Fichier introuvable');
      var url = root.URL.createObjectURL(meta.blob);
      var a = document.createElement('a');
      a.href = url; a.download = meta.name || 'fichier';
      document.body.appendChild(a); a.click();
      setTimeout(function () { root.URL.revokeObjectURL(url); a.remove(); }, 1500);
      return meta;
    });
  }

  function readAsDataURL(id) {
    return getFile(id).then(function (meta) {
      if (!meta) throw new Error('Fichier introuvable');
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () { resolve({ meta: meta, content: String(reader.result || '') }); };
        reader.onerror = function () { reject(new Error('Lecture impossible')); };
        reader.readAsDataURL(meta.blob);
      });
    });
  }

  function pathOf(id, items) {
    var map = {};
    (items || []).forEach(function (f) { map[f.id] = f; });
    var parts = [], cur = map[id], guard = 0;
    while (cur && cur.id !== 'root' && guard++ < 30) {
      parts.unshift(cur.name);
      cur = map[cur.parent];
    }
    return parts.join(' / ') || 'Mes fichiers';
  }

  root.TUSFiles = {
    open: open, ensureRoot: ensureRoot,
    listFolders: listFolders, allFolders: allFolders, folder: folder,
    createFolder: createFolder, renameFolder: renameFolder, deleteFolder: deleteFolder,
    listFiles: listFiles, addFile: addFile, addFiles: addFiles,
    renameFile: renameFile, moveFile: moveFile, deleteFile: deleteFile,
    getFile: getFile, downloadFile: downloadFile, readAsDataURL: readAsDataURL,
    pathOf: pathOf, uid: uid
  };
})(window);
