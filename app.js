/* Touch Unique — contrôleur de l’application */
(function () {
  'use strict';

  var A = window.TUAutomation || {};
  var Cloud = window.TUSCloud || null;
  var Accounts = window.TUSAccounts || null;
  var C = window.TU_CONTENT || {};
  var BRAND = C.brand || { whatsapp: 'https://wa.me/22655041530' };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var content = $('#content');
  var modalRoot = $('#modal-root');
  var page = 'home';
  var state = {
    lastContent: null, socialFilter: 'all', toastTimers: [], robotInfo: null,
    cloudInfo: null, oauthInfo: null, agentInfo: null, filesList: [], fileCompany: '', fileProject: '',
    fileFolder: '', pipelineResult: null, companyFilter: '', nativePerms: null,
    collabFolders: [], collabEvidence: null,
    managerFolder: 'root', managerFolders: [], managerFiles: [], managerAll: [], managerPath: 'Mes fichiers',
    msgThread: '', msgRec: null, prospectFilter: 'tous', prospectBucket: 'online', prospectDomain: 'tous',
    update: null, updateDismissed: ''
  };

  function nativeBridge() {
    return window.TUSNative && window.TUSNative.permissions ? window.TUSNative : null;
  }

  function readNativePermissions() {
    var bridge = nativeBridge();
    if (!bridge) return null;
    try { return JSON.parse(bridge.permissions()); } catch (e) { return null; }
  }

  function permChip(label, ok) {
    return '<span class="chip ' + (ok ? 'green' : 'gray') + '">' + esc(label) + ' ' + (ok ? '✓' : 'à autoriser') + '</span>';
  }

  function paintNativePermissions() {
    var box = $('#native-perms');
    if (!box) return;
    var p = state.nativePerms;
    if (!p || !p.android) {
      box.textContent = 'Application web : les autorisations sont gérées par le navigateur.';
      return;
    }
    box.innerHTML = permChip('Fichiers', !!p.storage) + ' ' +
      permChip('Caméra / photo', !!p.camera) + ' ' +
      permChip('Superposition', !!p.overlay) + ' ' +
      permChip('Notifications', !!p.notifications);
  }

  function refreshNativePermissions() {
    state.nativePerms = readNativePermissions();
    if (page === 'settings') paintNativePermissions();
  }

  function oauthStatuses() {
    var list = state.oauthInfo;
    if (!list || !list.length) list = state.cloudInfo && state.cloudInfo.oauth;
    if (!list || !list.length) {
      list = (Cloud && Cloud.OAUTH_PROVIDERS ? Cloud.OAUTH_PROVIDERS : []).map(function (p) {
        return { id: p.id, name: p.name, hint: p.hint, console: p.console, configured: false, connected: false };
      });
    }
    return list;
  }

  function oauthChip(provider) {
    var connected = provider.id === 'google'
      ? !!(state.cloudInfo && state.cloudInfo.google && state.cloudInfo.google.connected)
      : !!provider.connected;
    var cls = connected ? 'green' : (provider.configured ? 'amber' : 'gray');
    var label = connected ? 'Connecté' : (provider.configured ? 'Prêt à connecter' : 'À configurer');
    return '<span class="chip ' + cls + '">' + label + '</span>';
  }

  function paintOAuth() {
    var box = $('#oauth-list');
    if (!box || !Cloud) return;
    var redirect = (state.oauthInfo && state.oauthInfo.length && state.oauthInfo[0].redirectUri) ||
      (state.cloudInfo && state.cloudInfo.redirectUri) || '';
    box.innerHTML = oauthStatuses().map(function (p) {
      var meta = (Cloud.OAUTH_PROVIDERS || []).find(function (x) { return x.id === p.id; }) || p;
      var connected = p.id === 'google'
        ? !!(state.cloudInfo && state.cloudInfo.google && state.cloudInfo.google.connected)
        : !!p.connected;
      return '<div class="account-row"><div><b>' + esc(meta.name || p.name || p.id) + '</b>' +
        '<div class="subtle small">' + esc(meta.hint || p.hint || '') + '</div>' +
        '<div class="row" style="margin-top:6px">' + oauthChip(p) +
        (safeExternal(meta.console, CONSOLE_HOSTS) ? '<a class="link-btn" href="' + safeExternal(meta.console, CONSOLE_HOSTS) + '" target="_blank" rel="noopener noreferrer">Créer l’application ↗</a>' : '') +
        '</div></div><div class="row">' +
        (connected && p.id !== 'google' ? '<button class="btn btn-ghost btn-sm" data-act="oauth-disconnect" data-id="' + esc(p.id) + '">Retirer</button>' : '') +
        '<button class="btn btn-ghost btn-sm" data-act="oauth-connect" data-id="' + esc(p.id) + '">' +
        (connected ? 'Reconnecter' : 'Connecter') + '</button></div></div>';
    }).join('') + (redirect ? '<p class="subtle small">URI de redirection à déclarer : <code>' + esc(redirect) + '</code></p>' : '');
  }

  function refreshOAuth() {
    if (!Cloud || !Cloud.configured()) { state.oauthInfo = null; return Promise.resolve(); }
    return Cloud.oauthProviders().then(function (res) {
      state.oauthInfo = res.providers || [];
      if (page === 'settings') paintOAuth();
    }).catch(function () { return null; });
  }

  function paintUpdates(s) {
    if (!window.TUSUpdates || page !== 'settings') return;
    window.TUSUpdates.status().then(function (info) {
      var current = s || info;
      var badge = $('#updates-platform'), box = $('#updates-status');
      var url = $('#updates-url'), auto = $('#updates-auto');
      if (badge) {
        badge.textContent = current.supported ? (current.platform === 'android' ? 'Android' : 'Windows') : 'Navigateur';
        badge.className = 'chip ' + (current.supported ? 'green' : 'gray');
      }
      if (box) {
        var msg = 'Version installée : ' + esc(current.installed || '—');
        if (current.available && current.available !== current.installed) msg += ' · version disponible : ' + esc(current.available);
        if (current.updated) msg += ' · mise à jour appliquée';
        if (current.busy) msg += ' · vérification en cours…';
        if (current.error) msg += ' · ' + esc(current.error);
        if (!current.supported) msg = 'Disponible uniquement dans les applications Android et Windows installées.';
        box.textContent = msg;
      }
      if (url && document.activeElement !== url) url.value = current.url || '';
      if (auto) auto.checked = current.auto !== false;
    }).catch(function () { /* affichage non bloquant */ });
  }

  /* Bandeau de mise à jour directement dans l’interface, sans ouvrir les réglages. */
  function updateBannerKey(info) {
    var installed = String(info.installed || '');
    var available = String(info.available || '');
    if (info.updated) return installed ? ('installed:' + installed) : '';
    return available ? ('available:' + available) : '';
  }

  function paintUpdateBanner(s) {
    var box = $('#update-banner');
    if (!box) return;
    var info = s || state.update || {};
    var installed = String(info.installed || '');
    var available = String(info.available || '');
    var justUpdated = !!info.updated;
    var version = justUpdated ? installed : available;
    var key = updateBannerKey(info);
    var seen = state.updateDismissed;
    try { seen = seen || localStorage.getItem('tus_update_seen_v1') || ''; } catch (e) { /* ignore */ }
    var show = !!(version && version !== '—' && key && seen !== key && info.supported !== false);
    box.hidden = !show;
    box.classList.toggle('installed', !!justUpdated);
    if (!show) return;
    var prefix = $('#update-prefix');
    if (prefix) prefix.textContent = justUpdated ? 'Mise à jour installée' : 'Mise à jour disponible';
    var icon = $('#update-icon');
    if (icon) icon.textContent = justUpdated ? '✓' : '↻';
    $('#update-version').textContent = version;
    $('#update-current').textContent = justUpdated
      ? ('Votre application utilise maintenant la version ' + version)
      : (installed ? ('Version installée : ' + installed) : '');
    $('#update-note').textContent = info.notes || (justUpdated
      ? 'Les derniers correctifs sont actifs sur cet appareil.'
      : 'Ouvrez la mise à jour pour bénéficier des derniers correctifs.');
    var btn = $('#update-install');
    if (btn) { btn.hidden = !!justUpdated; btn.disabled = !!info.busy; }
  }

  function probeUpdates() {
    if (!window.TUSUpdates || !window.TUSUpdates.probe) return Promise.resolve();
    return window.TUSUpdates.probe().then(function (s) {
      state.update = s;
      state.updateDismissed = s.seen || state.updateDismissed;
      paintUpdateBanner(s);
      if (page === 'settings') paintUpdates(s);
    }).catch(function () { /* silencieux : la mise à jour reste facultative */ });
  }

  var NAV = [
    { id: 'home', label: 'Tableau de bord', icon: '⌂', kicker: 'Vue d’ensemble', title: 'Tableau de bord' },
    { id: 'projects', label: 'Projets', icon: '◆', kicker: 'Orchestration', title: 'Projets' },
    { id: 'companies', label: 'Entreprises', icon: '▤', kicker: 'Espace multi-entreprises', title: 'Entreprises & projets' },
    { id: 'files', label: 'Dossiers & fichiers', icon: '📁', kicker: 'Base de connaissances IA', title: 'Dossiers & fichiers' },
    { id: 'manager', label: 'Gestionnaire de fichiers', icon: '📂', kicker: 'Dossiers, fichiers et analyse', title: 'Gestionnaire de fichiers' },
    { id: 'collab', label: 'Collaboration IA', icon: '⇄', kicker: 'Quatre agents, un dossier', title: 'Collaboration IA' },
    { id: 'leads', label: 'Commandes du site', icon: '🌐', kicker: 'Pipeline commercial', title: 'Commandes du site' },
    { id: 'prospect', label: 'Prospect', icon: '🔎', kicker: 'Pistes classées par le robot', title: 'Prospect' },
    { id: 'content', label: 'Contenus IA', icon: '✦', kicker: 'Création assistée', title: 'Contenus IA' },
    { id: 'social', label: 'File sociale', icon: '▶', kicker: 'Publication', title: 'File sociale' },
    { id: 'robots', label: 'Robots', icon: '✺', kicker: 'Tâches automatiques', title: 'Robots' },
    { id: 'shop', label: 'Boutique', icon: '▣', kicker: 'Catalogue & ventes', title: 'Boutique automatisée' },
    { id: 'clients', label: 'Clients', icon: '◎', kicker: 'Base de contacts', title: 'Clients' },
    { id: 'academy', label: 'Académie', icon: '◈', kicker: 'Formations', title: 'Touch Unique Académie' },
    { id: 'settings', label: 'Réglages', icon: '⚙', kicker: 'Configuration', title: 'Réglages' }
  ];

  /* ---------- Helpers ---------- */
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function nl(v) { return esc(v).replace(/\n/g, '<br>'); }
  function money(n) { return new Intl.NumberFormat('fr-FR').format(Number(n) || 0) + ' FCFA'; }
  function date(v) {
    if (!v) return '—';
    try { return new Date(v).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch (e) { return String(v); }
  }
  function time(v) {
    if (!v) return '—';
    try { return new Date(v).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return ''; }
  }
  function toast(msg, err) {
    var root = $('#toast-root');
    if (!root) return;
    var t = document.createElement('div');
    t.className = 'toast' + (err ? ' err' : '');
    t.textContent = msg;
    root.appendChild(t);
    setTimeout(function () { t.remove(); }, 3200);
  }
  function confirmAction(title, text, onOk) {
    openModal('<h3>' + esc(title) + '</h3><p class="subtle">' + esc(text) + '</p>' +
      '<div class="modal-actions"><button class="btn btn-ghost" data-act="modal-close">Annuler</button>' +
      '<button class="btn btn-primary" id="confirm-ok">Confirmer</button></div>');
    $('#confirm-ok').onclick = function () { closeModal(); onOk(); };
  }
  function openModal(html) {
    modalRoot.innerHTML = '<div class="modal">' + html + '</div>';
    modalRoot.hidden = false;
    var f = $('input, button', modalRoot);
    if (f) setTimeout(function () { f.focus(); }, 40);
  }
  function closeModal() { modalRoot.hidden = true; modalRoot.innerHTML = ''; }
  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast('Copié dans le presse-papiers'); });
    } else {
      var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('Copié dans le presse-papiers'); } catch (e) { toast('Copie impossible', true); }
      ta.remove();
    }
  }
  function waLink(text) { return BRAND.whatsapp + '?text=' + encodeURIComponent(text || 'Bonjour Touch Unique.'); }
  var CONSOLE_HOSTS = /^(console\.cloud\.google\.com|developers\.facebook\.com|www\.linkedin\.com|developer\.x\.com)$/i;
  var PROVIDER_HOSTS = /^(platform\.openai\.com|www\.perplexity\.ai|aistudio\.google\.com|console\.anthropic\.com)$/i;
  /* Liens externes : TUSSecure.safeHref + HTTPS + hôtes attendus uniquement. */
  function safeExternal(value, hosts) {
    try {
      var S = window.TUSSecure || {};
      if (!S.safeHref) return '';
      var href = S.safeHref(value);
      var u = new URL(href);
      if (u.protocol !== 'https:' || !hosts.test(u.hostname)) return '';
      return esc(href);
    } catch (e) { return ''; }
  }
  /* Pièce jointe : même hôte que le serveur autorisé, jamais un tiers. */
  function safeAttachment(value) {
    try {
      var S = window.TUSSecure || {};
      if (!S.safeHref) return '';
      var href = S.safeHref(value);
      var u = new URL(href);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
      var M = window.TUSMessages || {};
      var base = M.server ? M.server() : (S.storedServerURL ? S.storedServerURL() : '');
      var allowed = false;
      if (base) {
        try {
          var clean = S.serverURL ? S.serverURL(base) : base;
          allowed = new URL(clean).hostname === u.hostname;
        } catch (e) { allowed = false; }
      }
      if (!allowed && u.protocol === 'http:' && /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(u.hostname)) allowed = true;
      return allowed ? esc(href) : '';
    } catch (e) { return ''; }
  }
  function statusChip(status) {
    var s = String(status || '').toLowerCase();
    var cls = /livr|publi|trait|confirm/.test(s) ? 'green' : /production|en cours|programm/.test(s) ? 'blue' : /brief|à faire|nouveau/.test(s) ? 'amber' : 'gray';
    return '<span class="chip ' + cls + '">' + esc(status || '—') + '</span>';
  }
  function levelChip(level) {
    var cls = level === 'chaud' ? 'red' : level === 'tiède' ? 'amber' : 'gray';
    return '<span class="chip ' + cls + '">' + esc(level || 'à qualifier') + '</span>';
  }

  /* ---------- Navigation ---------- */
  function updateBadges() {
    var unread = Store.unreadLeads();
    var demo = $('#demo-chip');
    if (demo) demo.hidden = !Store.db.demo;
    var dot = $('#notif-dot');
    if (dot) dot.hidden = unread === 0;
    var badge = $('#side-nav .nav-item[data-page="leads"] .badge');
    if (badge) {
      badge.textContent = unread;
      badge.hidden = !unread;
    }
  }

  function renderNav() {
    var unread = Store.unreadLeads();
    $('#side-nav').innerHTML = NAV.map(function (n) {
      var badge = n.id === 'leads' && unread ? '<span class="badge">' + unread + '</span>' : '';
      return '<button class="nav-item' + (n.id === page ? ' active' : '') + '" data-page="' + n.id + '">' +
        '<span class="ico">' + n.icon + '</span><span>' + n.label + '</span>' + badge + '</button>';
    }).join('');
    updateBadges();
  }

  function go(id) {
    var n = NAV.find(function (x) { return x.id === id; }) || NAV[0];
    var changed = page !== n.id;
    var previousTop = content.scrollTop;
    page = n.id;
    $('#page-title').textContent = n.title;
    $('#page-kicker').textContent = n.kicker;
    renderNav();
    content.innerHTML = views[page] ? views[page]() : '';
    content.scrollTop = changed ? 0 : previousTop;
    if (page === 'content' && state.lastContent) paintContentResult(state.lastContent);
    if (page === 'settings') { refreshNativePermissions(); paintOAuth(); paintUpdates(); }
    if (page === 'manager') { bindManager(); loadManager(); }
    if (page === 'social') refreshInbox(true);
    if (page === 'social' || page === 'prospect') startNativePollingSilent();
  }

  /* ---------- Vues ---------- */
  var views = {};

  views.home = function () {
    var d = Store.db;
    var leads = d.leads || [];
    var projects = d.projects || [];
    var tasks = d.tasks || [];
    var social = d.social || [];
    var score = Math.min(100, 62 + Math.round((d.stats.runs || 0) * 6) % 38);
    var recent = leads.slice(0, 4);
    var pending = tasks.filter(function (t) { return t.status !== 'terminée'; }).slice(0, 5);
    return '<div class="kpi-grid">' +
      kpi(leads.length, 'Demandes reçues', '🌐') +
      kpi(projects.length, 'Projets actifs', '◆') +
      kpi(d.stats.generated || 0, 'Contenus générés', '✦') +
      kpi(social.filter(function (s) { return s.status !== 'publié'; }).length, 'Publications à traiter', '▶') +
      '</div>' +
      '<div class="dash-grid">' +
      '<div class="stack">' +
      '<div class="card auto-card"><div class="card-head"><div><h2>Autopilot Touch Unique</h2><div class="subtle">Un cycle prépare projets, tâches, contenus et suggestions boutique.</div></div>' +
      '<span class="chip blue">' + (d.settings.autopilot ? 'Actif' : 'En pause') + '</span></div>' +
      '<div class="auto-score"><div class="score-ring" style="--p:' + score + '%"><span>' + score + '</span></div>' +
      '<div><b>Score d’autonomie</b><div class="subtle">' + (d.stats.runs || 0) + ' cycle(s) exécuté(s) · Dernier : ' + date(d.stats.lastRun) + '</div></div></div>' +
      '<div class="progress"><span style="width:' + score + '%"></span></div>' +
      '<div class="row" style="margin-top:14px"><button class="btn btn-primary" data-act="run-autopilot">✺ Lancer un cycle</button>' +
      '<button class="btn btn-ghost" data-act="go-content">Générer un contenu</button></div></div>' +
      '<div class="card"><div class="card-head"><h2>Dernières demandes</h2><button class="btn btn-ghost btn-sm" data-act="go-leads">Tout voir</button></div>' +
      (recent.length ? '<div class="list">' + recent.map(function (l) {
        return '<div class="list-row"><div class="row-main"><b>' + esc((l.client && l.client.name) || l.ref || 'Sans nom') + '</b>' +
          '<small>' + esc(l.type || 'Demande') + ' · ' + date(l.at) + '</small></div>' + levelChip(l.level) + '</div>';
      }).join('') + '</div>' : '<div class="empty">Aucune demande pour le moment. Elles arriveront depuis le site public.</div>') + '</div>' +
      '</div>' +
      '<div class="stack">' +
      '<div class="card"><div class="card-head"><h2>À faire maintenant</h2><span class="chip">' + tasks.filter(function (t) { return t.status !== 'terminée'; }).length + '</span></div>' +
      (pending.length ? '<div class="list">' + pending.map(function (t) {
        var p = projects.find(function (x) { return x.id === t.projectId; });
        return '<div class="list-row"><div class="row-main"><b>' + esc(t.title) + '</b><small>' + esc(p ? p.name : t.phase || 'Tâche') + '</small></div>' +
          '<button class="btn btn-ghost btn-sm" data-act="task-done" data-id="' + esc(t.id) + '">✓</button></div>';
      }).join('') + '</div>' : '<div class="empty">Tout est à jour.</div>') + '</div>' +
      '<div class="card"><div class="card-head"><h2>Activité récente</h2></div><div class="activity">' +
      (d.logs || []).slice(0, 6).map(function (l) {
        return '<div class="log-line"><time>' + time(l.at) + '</time><span>' + esc(l.text) + '</span></div>';
      }).join('') + '</div></div>' +
      '</div></div>';
  };
  function loadCollabFolders() {
    if (!window.TUSFiles) return Promise.resolve([]);
    return window.TUSFiles.allFolders().then(function (list) {
      state.collabFolders = list || [];
      if (page === 'collab') go('collab');
      return state.collabFolders;
    }).catch(function () { return []; });
  }

  function robotAvatar(r, large) {
    return '<span class="robot-avatar ' + esc(r.color || 'blue') + (large ? ' lg' : '') + '" aria-hidden="true">' + esc(r.icon || '🤖') + '</span>';
  }
  function kpi(v, label, icon) {
    return '<div class="kpi"><i>' + icon + '</i><b class="num">' + v + '</b><span>' + esc(label) + '</span></div>';
  }

  views.projects = function () {
    var statuses = [
      { id: 'brief', label: 'Brief' }, { id: 'conception', label: 'Conception' },
      { id: 'production', label: 'Production' }, { id: 'livré', label: 'Livré' }
    ];
    var projects = Store.db.projects || [];
    return '<div class="section-title"><h2>' + projects.length + ' projet(s) suivis</h2>' +
      '<button class="btn btn-primary btn-sm" data-act="new-project">+ Nouveau projet</button></div>' +
      '<div class="kanban">' + statuses.map(function (s) {
        var list = projects.filter(function (p) { return p.status === s.id; });
        return '<div class="kanban-col"><h3>' + esc(s.label) + '<span class="chip">' + list.length + '</span></h3>' +
          (list.length ? list.map(function (p) {
            return '<article class="kanban-card"><b>' + esc(p.name) + '</b>' +
              '<div class="subtle small">' + esc(p.client || 'Client non renseigné') + '</div>' +
              '<div class="row"><span class="chip blue">' + money(p.amount) + '</span>' + (p.ai ? '<span class="chip red">IA</span>' : '') + '</div>' +
              '<div class="row" style="margin-top:8px"><button class="btn btn-ghost btn-sm" data-act="project-detail" data-id="' + esc(p.id) + '">Ouvrir</button>' +
              '<button class="btn btn-ghost btn-sm" data-act="project-advance" data-id="' + esc(p.id) + '">Avancer →</button></div></article>';
          }).join('') : '<div class="empty small">Aucun projet</div>') + '</div>';
      }).join('') + '</div>';
  };

  views.companies = function () {
    var companies = Store.companies();
    var projects = Store.db.projects || [];
    var active = Store.db.settings.activeCompany || '';
    return '<div class="kpi-grid">' +
      kpi(companies.length, 'Entreprises suivies', '▤') +
      kpi(projects.length, 'Projets tous confondus', '◆') +
      kpi(projects.filter(function (p) { return p.status !== 'livré'; }).length, 'Projets en cours', '◷') +
      kpi(Store.folders().length, 'Dossiers classés', '📁') +
      '</div>' +
      '<div class="section-title"><h2>Espaces entreprises</h2>' +
      '<button class="btn btn-primary btn-sm" data-act="company-form">+ Nouvelle entreprise</button></div>' +
      (companies.length ? '<div class="company-grid">' + companies.map(function (c) {
        var mine = projects.filter(function (p) { return p.company === c.name; });
        return '<article class="card company-card' + (active === c.name ? ' active' : '') + '">' +
          '<div class="card-head"><div><h2>' + esc(c.name) + '</h2>' +
          '<div class="subtle small">' + esc(c.sector || 'Secteur non précisé') + ' · ' + esc(c.city || '—') + '</div></div>' +
          (active === c.name ? '<span class="chip green">Active</span>' : '<span class="chip gray">Archive</span>') + '</div>' +
          '<div class="subtle small">' + esc(c.contact || 'Aucun contact') + ' · ' + esc(c.phone || '—') + '</div>' +
          '<div class="row" style="margin-top:10px">' + mine.slice(0, 3).map(function (p) {
            return '<span class="chip blue">' + esc(p.name) + '</span>';
          }).join('') + (mine.length > 3 ? '<span class="chip">+' + (mine.length - 3) + '</span>' : '') + '</div>' +
          '<div class="row" style="margin-top:14px">' +
          '<button class="btn btn-ghost btn-sm" data-act="company-activate" data-id="' + esc(c.name) + '">Activer</button>' +
          '<button class="btn btn-ghost btn-sm" data-act="company-project" data-id="' + esc(c.name) + '">+ Projet</button>' +
          '<button class="btn btn-ghost btn-sm" data-act="company-files" data-id="' + esc(c.name) + '">Dossiers</button>' +
          '<button class="btn btn-primary btn-sm" data-act="company-collab" data-id="' + esc(c.name) + '">Lancer l’IA</button>' +
          '<button class="btn btn-ghost btn-sm" data-act="company-delete" data-id="' + esc(c.id) + '">✕</button>' +
          '</div></article>';
      }).join('') + '</div>' : '<div class="empty">Aucune entreprise. Créez un espace pour classer vos projets, fichiers et résultats IA.</div>') +
      '<div class="section-title" style="margin-top:22px"><h2>Tous les projets</h2></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Projet</th><th>Entreprise</th><th>Statut</th><th>Montant</th><th>Échéance</th></tr></thead><tbody>' +
      (projects.length ? projects.map(function (p) {
        return '<tr><td><b>' + esc(p.name) + '</b></td><td>' + esc(p.company || '—') + '</td><td>' + statusChip(p.status) + '</td>' +
          '<td>' + money(p.amount) + '</td><td>' + date(p.due) + '</td></tr>';
      }).join('') : '<tr><td colspan="5" class="dim">Aucun projet enregistré.</td></tr>') + '</tbody></table></div>';
  };

  views.files = function () {
    var companies = Store.companies();
    var company = state.fileCompany || Store.db.settings.activeCompany || (companies[0] && companies[0].name) || '';
    var project = state.fileProject || '';
    var folders = Store.folders().filter(function (f) { return !company || f.company === company; });
    var names = [];
    folders.forEach(function (f) { if (names.indexOf(f.name) < 0) names.push(f.name); });
    ['Briefs', 'Contrats', 'Visuels', 'IA-prospection', 'IA-conception', 'IA-contact', 'IA-rapports'].forEach(function (n) {
      if (names.indexOf(n) < 0) names.push(n);
    });
    names.unshift('Tous les dossiers');
    var folder = state.fileFolder || '';
    var files = (state.filesList || []).filter(function (f) {
      return (!company || f.company === company) && (!folder || f.folder === folder);
    });
    var projects = Store.projectsFor(company);
    return '<div class="card"><div class="card-head"><div><h2>Dépôt classé</h2>' +
      '<div class="subtle small">Les IA lisent ces fichiers comme source autorisée pour chaque entreprise et chaque projet.</div></div>' +
      '<span class="chip blue">' + (Cloud && Cloud.configured() ? 'Serveur connecté' : 'Local') + '</span></div>' +
      '<div class="filter-grid">' +
      '<label class="field"><span>Entreprise</span><select id="file-company"><option value="">Toutes</option>' +
      companies.map(function (c) { return '<option value="' + esc(c.name) + '"' + (company === c.name ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') +
      '</select></label>' +
      '<label class="field"><span>Projet</span><select id="file-project"><option value="">Tous</option>' +
      projects.map(function (p) { return '<option value="' + esc(p.name) + '"' + (project === p.name ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('') +
      '</select></label>' +
      '<label class="field"><span>Dossier</span><select id="file-folder">' +
      names.map(function (n) {
        var v = n === 'Tous les dossiers' ? '' : n;
        return '<option value="' + esc(v) + '"' + (folder === v ? ' selected' : '') + '>' + esc(n) + '</option>';
      }).join('') +
      '</select></label></div>' +
      '<form id="file-upload-form" class="form-grid" style="margin-top:14px">' +
      '<label class="field"><span>Fichier à classer</span><input type="file" name="file" required></label>' +
      '<label class="field"><span>Dossier</span><input name="folder" value="' + esc(folder) + '" required></label>' +
      '<button class="btn btn-primary" type="submit" style="grid-column:1/-1">↑ Déposer dans le dossier</button></form>' +
      '<p class="subtle small">Tous types de fichiers : images, audio, vidéo, PDF, documents — jusqu’à 12 Mo. Le contenu est stocké sur votre serveur sécurisé, pas dans le navigateur.</p>' +
      '<div class="row" style="margin-top:14px;flex-wrap:wrap">' +
      '<button class="btn btn-primary btn-sm" data-act="media-open">✦ Importer et analyser un média</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="media-report">Voir la dernière analyse</button></div></div>' +
      '<div class="section-title"><h2>' + files.length + ' fichier(s) · ' + esc(folder) + '</h2>' +
      '<div class="row"><button class="btn btn-ghost btn-sm" data-act="files-refresh">↻ Actualiser</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="files-note">+ Note texte</button></div></div>' +
      (files.length ? '<div class="list">' + files.map(function (f) {
        var id = f.id || '';
        return '<div class="list-row"><div class="row-main"><b>' + esc(f.name) + '</b>' +
          '<small>' + esc(f.company || '—') + ' · ' + esc(f.project || '—') + ' · ' + esc(f.folder || '—') +
          ' · ' + Math.round((f.size || 0) / 1024) + ' Ko · ' + esc(f.source || '') + '</small></div>' +
          '<div class="row"><button class="btn btn-ghost btn-sm" data-act="file-analyze" data-id="' + esc(id) + '">✦ Analyser</button>' +
          '<button class="btn btn-ghost btn-sm" data-act="file-download" data-id="' + esc(id) + '">↓</button>' +
          '<button class="btn btn-ghost btn-sm" data-act="file-delete" data-id="' + esc(id) + '">✕</button></div></div>';
      }).join('') + '</div>' : '<div class="empty">Aucun fichier dans ce dossier. Déposez un brief, un contrat ou une note pour que les agents IA puissent le consulter.</div>');
  };

  views.manager = function () {
    var F = window.TUSFiles;
    if (!F) return '<div class="empty">Gestionnaire de fichiers indisponible.</div>';
    var folders = state.managerFolders || [];
    var files = state.managerFiles || [];
    var total = files.reduce(function (s, f) { return s + (f.size || 0); }, 0);
    return '<div class="kpi-grid">' +
      kpi((state.managerAll || []).length, 'Dossiers créés', '📂') +
      kpi(files.length, 'Fichiers dans ce dossier', '📄') +
      kpi(Math.round(total / 1024), 'Kilooctets conservés', '◈') +
      kpi(state.managerFolder === 'root' ? 'Racine' : 'Imbriqué', 'Emplacement actuel', '▤') +
      '</div>' +
      '<div class="card"><div class="card-head"><div><h2>' + esc(state.managerPath || 'Mes fichiers') + '</h2>' +
      '<div class="subtle small">Ajoutez des fichiers directement depuis la mémoire du téléphone. Tout reste sur cet appareil, même hors connexion.</div></div>' +
      '<div class="row"><button class="btn btn-ghost btn-sm" data-act="folder-new">+ Nouveau dossier</button>' +
      (state.managerFolder !== 'root' ? '<button class="btn btn-ghost btn-sm" data-act="folder-rename" data-id="' + esc(state.managerFolder) + '">✎ Renommer</button>' +
        '<button class="btn btn-ghost btn-sm" data-act="folder-delete" data-id="' + esc(state.managerFolder) + '">✕ Supprimer</button>' : '') +
      '</div></div>' +
      '<div id="drop-zone" class="drop-zone">' +
      '<div class="drop-icon">📥</div><b>Glissez vos fichiers ici</b>' +
      '<div class="subtle small">ou choisissez-les dans la mémoire du téléphone</div>' +
      '<div class="row" style="justify-content:center;margin-top:10px"><label class="btn btn-primary btn-sm">＋ Ajouter des fichiers' +
      '<input type="file" id="manager-input" multiple hidden></label>' +
      '<label class="btn btn-ghost btn-sm">📷 Prendre une photo' +
      '<input type="file" id="manager-camera-input" accept="image/*" capture="environment" hidden></label></div></div></div>' +
      (folders.length ? '<div class="section-title"><h2>Sous-dossiers · ' + folders.length + '</h2></div>' +
        '<div class="folder-grid">' + folders.map(function (f) {
          return '<article class="folder-card"><div class="folder-icon">📁</div>' +
            '<div class="row-main"><b>' + esc(f.name) + '</b><small>' + esc((f.createdAt || '').slice(0, 10)) + '</small></div>' +
            '<div class="row"><button class="btn btn-ghost btn-sm" data-act="folder-open" data-id="' + esc(f.id) + '">Ouvrir</button>' +
            '<button class="btn btn-ghost btn-sm" data-act="folder-rename" data-id="' + esc(f.id) + '">✎</button>' +
            '<button class="btn btn-ghost btn-sm" data-act="folder-delete" data-id="' + esc(f.id) + '">✕</button></div></article>';
        }).join('') + '</div>' : '') +
      '<div class="section-title"><h2>Fichiers · ' + files.length + '</h2>' +
      '<div class="row"><button class="btn btn-ghost btn-sm" data-act="manager-refresh">↻ Actualiser</button></div></div>' +
      (files.length ? '<div class="list">' + files.map(function (f) {
        var icon = /^image\//.test(f.mime || '') ? '🖼' : /^video\//.test(f.mime || '') ? '🎬' : /^audio\//.test(f.mime || '') ? '🎵' : '📄';
        return '<div class="list-row"><div class="file-icon">' + icon + '</div>' +
          '<div class="row-main"><b>' + esc(f.name) + '</b><small>' + Math.round((f.size || 0) / 1024) + ' Ko · ' +
          esc((f.createdAt || '').slice(0, 16).replace('T', ' ')) + ' · ' + esc(f.mime || '') + '</small></div>' +
          '<div class="row"><button class="btn btn-ghost btn-sm" data-act="file-analyze-local" data-id="' + esc(f.id) + '">✦ Analyser IA</button>' +
          '<button class="btn btn-ghost btn-sm" data-act="file-rename-local" data-id="' + esc(f.id) + '">✎</button>' +
          '<button class="btn btn-ghost btn-sm" data-act="file-move-local" data-id="' + esc(f.id) + '">↪</button>' +
          '<button class="btn btn-ghost btn-sm" data-act="file-download-local" data-id="' + esc(f.id) + '">↓</button>' +
          '<button class="btn btn-ghost btn-sm" data-act="file-delete-local" data-id="' + esc(f.id) + '">✕</button></div></div>';
      }).join('') + '</div>' : '<div class="empty">Aucun fichier ici. Ajoutez-en depuis la mémoire du téléphone.</div>');
  };

  views.collab = function () {
    var companies = Store.companies();
    var company = Store.db.settings.activeCompany || (companies[0] && companies[0].name) || '';
    var projects = Store.projectsFor(company);
    var agents = (state.agentInfo && state.agentInfo.agents) || [
      { id: 'prospection', name: 'Agent 1 · Prospection & recherche', provider: 'perplexity' },
      { id: 'conception', name: 'Agent 2 · Maquettes & devis', provider: 'gemini' },
      { id: 'contact', name: 'Agent 3 · Contact client & production', provider: 'anthropic' },
      { id: 'rapports', name: 'Agent 4 · Rapports, contrôle & publication', provider: 'openai' }
    ];
    var providers = (state.cloudInfo && state.cloudInfo.ai) || {};
    var result = state.pipelineResult;
    return '<div class="two-col">' +
      '<div class="card"><div class="card-head"><div><h2>Lancer une mission</h2>' +
      '<div class="subtle small">La prospection transmet au concepteur, qui transmet au producteur, qui transmet au contrôleur.</div></div></div>' +
      '<form id="pipeline-form" class="form-grid">' +
      '<label class="field"><span>Client (liste)</span><select name="client" id="pipeline-client"><option value="">À déduire du dossier</option>' +
      (Store.clients() || []).map(function (c) {
        return '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>';
      }).join('') + '</select></label>' +
      '<label class="field"><span>Dossier sur lequel travailler</span><select name="folder" id="pipeline-folder"><option value="">Mes fichiers (racine)</option>' +
      (state.collabFolders || []).filter(function (f) { return f.id !== 'root'; }).map(function (f) {
        return '<option value="' + esc(f.id) + '"' + (f.id === state.fileFolder ? ' selected' : '') + '>' + esc(f.name) + '</option>';
      }).join('') + '</select></label>' +
      '<label class="field"><span>Entreprise concernée</span><input name="companyName" id="pipeline-company-name" placeholder="Déduite du dossier ou saisie manuellement"></label>' +
      '<label class="field"><span>Secteur d’activité</span><input name="sector" id="pipeline-sector" placeholder="Ex. Santé, éducation, commerce…"></label>' +
      '<label class="field"><span>Entreprise existante</span><select name="company" id="pipeline-company"><option value="">Aucune</option>' +
      companies.map(function (c) { return '<option value="' + esc(c.name) + '"' + (company === c.name ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') +
      '</select></label>' +
      '<label class="field"><span>Projet</span><select name="project" id="pipeline-project"><option value="">Tous les projets</option>' +
      projects.map(function (p) { return '<option value="' + esc(p.name) + '">' + esc(p.name) + '</option>'; }).join('') +
      '</select></label>' +
      '<label class="field full"><span>Sujet de la mission</span><input name="topic" id="pipeline-topic" required placeholder="Ex. Prospecter des pharmacies à Ouagadougou"></label>' +
      '<label class="field full"><span>Recherches déjà collectées (ou laissées vides)</span><textarea name="research" rows="6" id="pipeline-research" placeholder="Le dossier est analysé automatiquement avant le lancement…"></textarea></label>' +
      '<div id="collab-analysis" class="subtle small" style="grid-column:1/-1"></div>' +
      '<div class="field full"><label class="switch"><input type="checkbox" name="publish"> Autoriser la publication sur les réseaux connectés</label></div>' +
      '<div class="row full" style="grid-column:1/-1;flex-wrap:wrap"><button class="btn btn-ghost btn-sm" type="button" data-act="collab-analyze">✦ Analyser le dossier et remplir automatiquement</button>' +
      '<button class="btn btn-ghost btn-sm" type="button" data-act="research-open">🔎 Ouvrir la fenêtre de recherche</button>' +
      '<button class="btn btn-primary" type="submit">⇄ Lancer les 4 agents</button></div></form></div>' +
      '<div class="stack"><div class="card"><div class="card-head"><h2>Chaîne de collaboration</h2>' +
      '<span class="chip ' + (providers.perplexity || providers.openai || providers.gemini || providers.anthropic ? 'green' : 'amber') + '">' +
      (providers.perplexity || providers.openai || providers.gemini || providers.anthropic ? 'IA connectées' : 'Clés à configurer') + '</span></div>' +
      '<div class="pipeline-flow">' + agents.map(function (a, i) {
        var ready = !!providers[a.provider];
        return '<div class="pipeline-node"><span class="pipeline-num">' + (i + 1) + '</span>' +
          '<div><b>' + esc(a.name || a.id) + '</b><div class="subtle small">' + esc(a.role || a.provider || '') + '</div></div>' +
          '<span class="chip ' + (ready ? 'green' : 'gray') + '">' + esc(a.provider || 'auto') + '</span></div>';
      }).join('') + '</div>' +
      '<button class="btn btn-ghost btn-sm" style="margin-top:12px" data-act="agents-config">Configurer les agents</button></div>' +
      '<div class="card"><div class="card-head"><h2>Dernier résultat</h2></div>' +
      (result ? '<div class="subtle small">' + esc(result.note || '') + '</div>' +
        '<div class="result-grid">' + (result.stages || []).map(function (s) {
          return '<div class="result-card"><h3>' + esc(s.name || s.id) + '</h3>' +
            '<div class="subtle small">' + esc(s.provider || '—') + (s.file ? ' · enregistré' : '') + '</div>' +
            '<div class="copy-box">' + esc((s.text || s.error || '').slice(0, 1400)) + '</div></div>';
        }).join('') + '</div>' : '<div class="empty">Lancez une mission pour voir les quatre étapes et leurs fichiers classés.</div>') +
      '</div></div></div>';
  };

  views.leads = function () {
    var leads = Store.db.leads || [];
    return '<div class="section-title"><h2>' + leads.length + ' demande(s) · ' + Store.unreadLeads() + ' à traiter</h2>' +
      '<div class="row"><button class="btn btn-ghost btn-sm" data-act="sync-leads">↻ Actualiser</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="leads-read">Tout marquer traité</button></div></div>' +
      (leads.length ? '<div class="stack">' + leads.map(function (l) {
        var items = (l.items || []).map(function (i) { return i.qty + ' × ' + i.name; }).join(' · ') || 'Aucun article';
        return '<article class="card' + (l.seen ? '' : ' auto-card') + '">' +
          '<div class="card-head"><div><h2>' + esc((l.client && l.client.name) || 'Client sans nom') + '</h2>' +
          '<div class="subtle">' + esc(l.ref || l.id) + ' · ' + esc(l.type || 'Demande') + ' · ' + date(l.at) + '</div></div>' +
          '<div class="row">' + levelChip(l.level) + (l.seen ? '<span class="chip green">Traité</span>' : '<span class="chip red">Nouveau</span>') + '</div></div>' +
          '<div class="row"><span class="chip gray">' + esc((l.client && l.client.phone) || '—') + '</span>' +
          '<span class="chip blue">' + money(l.total) + '</span><span class="subtle">' + esc(items) + '</span></div>' +
          '<p class="subtle" style="white-space:pre-wrap;margin:12px 0">' + esc(l.message || '') + '</p>' +
          (l.nextAction ? '<div class="brief-box"><b>Action suggérée par l’IA</b><div class="subtle">' + esc(l.nextAction) + '</div></div>' : '') +
          '<div class="row" style="margin-top:14px">' +
          '<a class="btn btn-primary btn-sm" href="' + esc(waLink(l.message || 'Bonjour Touch Unique, suite à ma demande.')) + '" target="_blank" rel="noopener">💬 Répondre</a>' +
          '<button class="btn btn-ghost btn-sm" data-act="lead-convert" data-id="' + esc(l.id) + '">Créer un projet</button>' +
          '<button class="btn btn-ghost btn-sm" data-act="lead-done" data-id="' + esc(l.id) + '">' + (l.seen ? 'Rouvrir' : 'Traiter') + '</button>' +
          '<button class="btn btn-ghost btn-sm" data-act="lead-delete" data-id="' + esc(l.id) + '">Supprimer</button></div></article>';
      }).join('') + '</div>' : '<div class="empty">Aucune commande reçue. Le site public enverra ses demandes ici automatiquement.</div>');
  };

  views.prospect = function () {
    var P = window.TUSProspects || { list: function () { return []; } };
    var bucketOf = P.bucketOf || function (p) { return (p && p.bucket) || 'online'; };
    var all = P.list();
    var counts = {
      online: all.filter(function (p) { return bucketOf(p) === 'online'; }).length,
      images: all.filter(function (p) { return bucketOf(p) === 'images'; }).length
    };
    var bucket = state.prospectBucket === 'images' ? 'images' : 'online';
    var domains = P.domains ? P.domains() : [];
    var filtered = all.filter(function (p) {
      if (bucketOf(p) !== bucket) return false;
      if (state.prospectDomain !== 'tous' && (p.domain || 'autre') !== state.prospectDomain) return false;
      return state.prospectFilter === 'tous' ||
        (state.prospectFilter === 'à contacter' && p.status !== 'contacté') ||
        (state.prospectFilter === 'contacté' && p.status === 'contacté');
    });
    return '<div class="card"><div class="card-head"><div><h2>Prospection · ' +
      (bucket === 'images' ? counts.images : counts.online) + ' fiche(s)</h2>' +
      '<div class="subtle">' +
      (bucket === 'images'
        ? 'Fiches extraites automatiquement de vos images, classées par domaine avec les offres à proposer. Ce bac reste séparé des prospects trouvés en ligne.'
        : 'Le robot de prospection, la messagerie du site et la saisie manuelle déposent ici leurs contacts.') +
      '</div></div><div class="row" style="flex-wrap:wrap;gap:6px">' +
      '<button class="btn btn-primary btn-sm" data-act="prospect-add-form">+ Ajouter</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="prospect-images-modal">🖼️ Analyser un lot d’images</button></div></div>' +
      '<div class="prospect-tabs">' +
      '<button class="btn ' + (bucket === 'online' ? 'btn-primary' : 'btn-ghost') + ' btn-sm" data-act="prospect-bucket" data-id="online">🌐 En ligne · ' + counts.online + '</button>' +
      '<button class="btn ' + (bucket === 'images' ? 'btn-primary' : 'btn-ghost') + ' btn-sm" data-act="prospect-bucket" data-id="images">🖼️ Images · ' + counts.images + '</button></div>' +
      '<div class="filters"><select id="prospect-filter"><option value="tous">Tous les statuts</option>' +
      '<option value="à contacter"' + (state.prospectFilter === 'à contacter' ? ' selected' : '') + '>À contacter</option>' +
      '<option value="contacté"' + (state.prospectFilter === 'contacté' ? ' selected' : '') + '>Contactés</option></select>' +
      (bucket === 'images' ? '<select id="prospect-domain"><option value="tous">Tous les domaines</option>' +
        domains.map(function (d) { return '<option value="' + esc(d.id) + '"' + (state.prospectDomain === d.id ? ' selected' : '') + '>' + esc(d.label) + '</option>'; }).join('') +
        '</select>' : '<button class="btn btn-ghost btn-sm" data-act="msg-refresh">↻ Importer les messages du site</button>') +
      '</div></div>' +
      (filtered.length ? '<div class="prospect-grid">' + filtered.map(function (p) {
        return '<article class="card prospect-card"><div class="spread"><b>' + esc(p.name || 'Prospect') + '</b>' +
          '<span class="chip ' + (p.status === 'contacté' ? 'green' : 'red') + '">' + esc(p.status || 'à contacter') + '</span></div>' +
          '<div class="subtle small">' + esc(p.source || 'Manuel') + ' · ' + date(p.createdAt || p.at) + '</div>' +
          (bucket === 'images' ? '<div class="row" style="flex-wrap:wrap;gap:5px;margin-top:6px">' +
            '<span class="chip blue">' + esc(p.domainLabel || P.domainById && P.domainById(p.domain || 'autre').label || 'Domaine') + '</span>' +
            (p.confidence ? '<span class="chip gray">' + esc(p.confidence) + '</span>' : '') +
            ((p.images || []).length ? '<span class="chip gray">' + (p.images || []).length + ' image(s)</span>' : '') + '</div>' +
            ((p.offers || []).length ? '<div class="offer-chips subtle small" style="margin-top:6px">À proposer : ' +
              p.offers.map(function (o) { return '<span class="chip">' + esc(o) + '</span>'; }).join(' ') + '</div>' : '') : '') +
          '<div class="prospect-lines">' +
          (p.phone ? '<div>📞 ' + esc(p.phone) + '</div>' : '') +
          (p.email ? '<div>✉ ' + esc(p.email) + '</div>' : '') +
          (p.city ? '<div>📍 ' + esc(p.city) + '</div>' : '') + '</div>' +
          (p.need ? '<p class="subtle">Besoin : ' + esc(p.need) + '</p>' : '') +
          '<div class="row" style="flex-wrap:wrap;gap:6px">' +
          '<a class="btn btn-primary btn-sm" href="' + esc(P.whatsapp(p)) + '" target="_blank" rel="noopener">💬 WhatsApp</a>' +
          '<button class="btn btn-ghost btn-sm" data-act="prospect-status" data-id="' + esc(p.id) + '">' +
          (p.status === 'contacté' ? 'Rouvrir' : 'Marquer contacté') + '</button>' +
          '<button class="btn btn-ghost btn-sm" data-act="prospect-client" data-id="' + esc(p.id) + '">Créer client</button>' +
          '<button class="btn btn-ghost btn-sm" data-act="prospect-delete" data-id="' + esc(p.id) + '">✕</button>' +
          '</div></article>';
      }).join('') + '</div>' : '<div class="empty">' +
      (bucket === 'images' ? 'Aucune fiche image. Importez un lot de photos pour extraire entreprises, contacts, adresses et offres à proposer.'
        : 'Aucun prospect en ligne. Lancez le robot de prospection ou importez les messages du site.') + '</div>');
  };

  views.content = function () {
    return '<div class="two-col">' +
      '<div class="card"><div class="card-head"><h2>Générateur de contenu</h2><span class="chip blue">Local · IA</span></div>' +
      '<form id="content-form" class="form-grid">' +
      '<label class="field"><span>Thème / produit</span><input name="theme" required placeholder="Ex. Pack Visibilité Pro"></label>' +
      '<label class="field"><span>Type</span><select name="kind"><option value="reseau">Publication réseau</option><option value="video">Script vidéo</option><option value="offre">Texte d’offre</option></select></label>' +
      '<label class="field"><span>Audience</span><input name="audience" value="artisans et petites entreprises"></label>' +
      '<label class="field"><span>Objectif</span><input name="goal" value="être contacté"></label>' +
      '<label class="field full"><span>Ton</span><select name="tone"><option value="pro">Professionnel</option><option value="chaleureux">Chaleureux</option><option value="audacieux">Audacieux</option><option value="pedagogique">Pédagogique</option></select></label>' +
      '<button class="btn btn-primary btn-block" style="grid-column:1/-1" type="submit">✺ Générer le pack de contenu</button></form></div>' +
      '<div class="card"><div class="card-head"><h2>Brief structuré</h2></div><div id="content-result">' +
      '<div class="empty">Remplissez le formulaire pour obtenir titres, légendes, scripts et calendrier.</div></div></div></div>' +
      '<div class="section-title"><h2>Historique</h2></div>' +
      '<div class="card">' + ((Store.db.contents || []).length ? '<div class="list">' + (Store.db.contents || []).slice(0, 8).map(function (c) {
        return '<div class="list-row"><div class="row-main"><b>' + esc(c.theme || 'Contenu') + '</b><small>' + esc(c.type || 'reseau') + ' · ' + date(c.createdAt) + '</small></div>' +
          '<button class="btn btn-ghost btn-sm" data-act="content-reuse" data-id="' + esc(c.id) + '">Réutiliser</button></div>';
      }).join('') + '</div>' : '<div class="empty">Aucun contenu généré.</div>') + '</div>';
  };

  function messagingCard() {
    var M = window.TUSMessages || {};
    var configured = !!(M.server && M.server());
    var threads = state.msgThreads || [];
    return '<div class="card msg-card"><div class="card-head"><div><h2>Messagerie du site</h2>' +
      '<div class="subtle">Les visiteurs vous écrivent ici, avec photos, fichiers et vocaux. Vous répondez depuis l’application.</div></div>' +
      '<span class="chip ' + (configured ? 'green' : 'gray') + '" id="msg-status">' + (configured ? 'Serveur configuré' : 'Serveur non configuré') + '</span></div>' +
      '<div class="row" style="flex-wrap:wrap;gap:6px">' +
      '<select id="msg-thread"><option value="">Toutes les conversations</option>' + threads.map(function (t) {
        return '<option value="' + esc(t.id) + '"' + (state.msgThread === t.id ? ' selected' : '') + '>' +
          esc((t.client && t.client.name) || t.id) + '</option>';
      }).join('') + '</select>' +
      '<button class="btn btn-ghost btn-sm" data-act="msg-refresh">↻ Actualiser</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="msg-perm" data-id="camera">🎥 Caméra</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="msg-perm" data-id="micro">🎤 Micro</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="msg-push">🔔 Notifications</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="msg-native-poll">📲 Notifications hors app</button></div>' +
      '<div id="msg-inbox" class="msg-inbox"><div class="empty">Chargement des conversations…</div></div>' +
      '<form id="msg-form" class="msg-form">' +
      '<textarea id="msg-text" rows="2" placeholder="Répondre au client…"></textarea>' +
      '<div class="row" style="flex-wrap:wrap;gap:6px">' +
      '<label class="btn btn-ghost btn-sm">📎 <input id="msg-file" type="file" accept="image/*,audio/*,application/pdf,.doc,.docx,.txt" hidden></label>' +
      '<button class="btn btn-ghost btn-sm" type="button" data-act="msg-record">● Enregistrer un vocal</button>' +
      '<button class="btn btn-primary btn-sm" type="submit">Répondre</button></div></form></div>';
  }

  views.social = function () {
    var list = (Store.db.social || []).filter(function (s) {
      return state.socialFilter === 'all' || s.status === state.socialFilter;
    });
    return messagingCard() + '<div class="section-title"><h2>' + list.length + ' publication(s)</h2>' +
      '<div class="row"><button class="btn btn-ghost btn-sm" data-act="social-export">↓ Exporter CSV</button>' +
      '<button class="btn btn-primary btn-sm" data-act="social-add-form">+ Ajouter</button></div></div>' +
      '<div class="filters"><input id="social-search" placeholder="Rechercher un texte…">' +
      '<select id="social-filter"><option value="all">Tous les statuts</option><option value="à valider">À valider</option><option value="programmé">Programmé</option><option value="publié">Publié</option></select></div>' +
      (list.length ? '<div class="stack">' + list.map(function (s) {
        var links = A.socialLinks ? A.socialLinks(s.text) : {};
        return '<article class="social-item"><div><span class="platform ' + esc(s.platform) + '">' + esc(s.platform) + '</span>' +
          '<div class="subtle small">' + date(s.scheduledAt) + '</div></div>' +
          '<div><p>' + esc(s.text) + '</p><div class="row">' + statusChip(s.status) + (s.source === 'autopilot' ? '<span class="chip blue">IA</span>' : '') + '</div></div>' +
          '<div class="row-actions">' +
          '<a class="btn btn-ghost btn-sm" href="' + esc(links[s.platform] || links.whatsapp) + '" target="_blank" rel="noopener">Ouvrir</a>' +
          '<button class="btn btn-ghost btn-sm" data-act="social-copy" data-id="' + esc(s.id) + '">Copier</button>' +
          '<button class="btn btn-ghost btn-sm" data-act="social-publish" data-id="' + esc(s.id) + '">' + (s.status === 'publié' ? 'Revenir' : 'Publié') + '</button>' +
          '<button class="btn btn-ghost btn-sm" data-act="social-delete" data-id="' + esc(s.id) + '">✕</button></div></article>';
      }).join('') + '</div>' : '<div class="empty">Aucune publication dans cette file.</div>');
  };

  views.robots = function () {
    var R = window.TUSRobots || { robots: [], configured: function () { return false; } };
    var info = state.robotInfo || {};
    var history = (Store.db.robots || []).slice(0, 6);
    var social = info.social || {};
    var readyNetworks = Object.keys(social).filter(function (k) { return social[k]; });
    return '<div class="kpi-grid">' +
      kpi(R.robots.length, 'Robots actifs', '✺') +
      kpi(readyNetworks.length, 'Réseaux connectés', '▶') +
      kpi((Store.db.robots || []).length, 'Exécutions enregistrées', '◎') +
      kpi(info.autorun ? 1 : 0, 'Publication auto', '◆') +
      '</div>' +
      '<div class="section-title"><h2>File de tâches automatiques</h2>' +
      '<div class="row"><button class="btn btn-ghost btn-sm" data-act="robots-status">Actualiser l’état</button>' +
      '<button class="btn btn-primary btn-sm" data-act="robot-run-all">Exécuter tous les robots</button></div></div>' +
      '<p class="subtle small">Le moteur local prépare un aperçu chaque jour. Pour une publication réelle, configurez le serveur sécurisé et connectez vos tokens sociaux dans les réglages. Aucun statut « publié » n’est affiché sans confirmation de l’API.</p>' +
      '<div class="three-col" style="margin-top:14px">' + R.robots.map(function (r) {
        var last = (info.robots || []).find(function (x) { return x.id === r.id; }) || {};
        return '<div class="card robot-card"><div class="card-head"><h3>' + robotAvatar(r) + ' ' + esc(r.name) + '</h3>' +
          (last.lastRun ? '<span class="chip green">Exécuté</span>' : '<span class="chip gray">Local</span>') + '</div>' +
          '<p class="subtle small">' + esc(r.desc) + '</p>' +
          '<div class="row"><span class="chip ' + (r.enabled === false ? 'gray' : 'green') + '">' +
          (r.enabled === false ? 'Désactivé' : 'Quotidien · ' + (r.hour != null ? String(r.hour).padStart(2, '0') + 'h00' : '08h00')) + '</span>' +
          '<span class="chip blue">' + esc(r.provider || 'auto') + '</span></div>' +
          '<div class="subtle small" style="margin-top:8px">Dossier IA : <b>' + esc(r.folderName || 'IA · ' + r.name) + '</b><br>' +
          'Dernière exécution serveur : ' + esc(last.lastRun ? time(last.lastRun) + ' · ' + (last.lastResult || '') : 'aucune') + '</div>' +
          '<div class="row" style="margin-top:10px;flex-wrap:wrap"><button class="btn btn-ghost btn-sm" data-act="robot-edit" data-id="' + esc(r.id) + '">✎ Personnaliser</button>' +
          '<button class="btn btn-ghost btn-sm" data-act="robot-folder" data-id="' + esc(r.id) + '">📂 Dossier IA</button></div>' +
          '<div class="row" style="margin-top:10px;flex-wrap:wrap"><button class="btn btn-ghost btn-sm" data-act="robot-local" data-id="' + esc(r.id) + '">Aperçu local</button>' +
          '<button class="btn btn-ghost btn-sm" data-act="robot-dry" data-id="' + esc(r.id) + '">Générer serveur</button>' +
          '<button class="btn btn-primary btn-sm" data-act="robot-run" data-id="' + esc(r.id) + '">Exécuter</button></div></div>';
      }).join('') + '</div>' +
      '<div class="section-title" style="margin-top:22px"><h2>Derniers résultats</h2></div>' +
      (history.length ? '<div class="list">' + history.map(function (h) {
        var robot = (window.TUSRobots && window.TUSRobots.robots || []).find(function (x) { return x.id === h.robotId; });
        return '<div class="list-row">' + (robot ? robotAvatar(robot) : '<div class="file-icon">✺</div>') +
          '<div class="row-main"><b>' + esc(h.name) + '</b><small>' + esc(String(h.text || h.error || '').slice(0, 160)) + '</small></div>' +
          '<span class="chip ' + (h.live ? 'green' : 'blue') + '">' + (h.live ? 'Temps réel' : 'Local') + '</span></div>';
      }).join('') + '</div>' : '<div class="empty">Aucun résultat pour le moment.</div>');
  };

  views.shop = function () {
    var products = Store.products();
    var suggestions = Store.db.shop.suggestions || [];
    return '<div class="kpi-grid">' +
      kpi(products.length, 'Offres catalogue', '▣') +
      kpi(products.filter(function (p) { return p.popular; }).length, 'Offres populaires', '★') +
      kpi((Store.db.shop.orders || []).length, 'Ventes enregistrées', '↗') +
      kpi(suggestions.length, 'Suggestions IA', '✺') +
      '</div>' +
      '<div class="section-title"><h2>Catalogue synchronisé</h2><div class="row">' +
      '<span class="chip ' + (Cloud && Cloud.configured() ? 'green' : 'amber') + '">' +
      (Cloud && Cloud.configured() ? 'Synchronisé avec le site' : 'Synchronisé sur cet appareil') + '</span>' +
      '<button class="btn btn-ghost btn-sm" data-act="shop-recommend">✺ Suggestions IA</button>' +
      '<button class="btn btn-primary btn-sm" data-act="shop-new">+ Nouvelle offre</button></div></div>' +
      '<div class="shop-grid">' + products.map(function (p) {
        var imgs = window.TUSCatalog ? window.TUSCatalog.images(p) : (p.img ? [p.img] : []);
        return '<article class="shop-card"><img src="' + esc(imgs[0] || '') + '" alt="" loading="lazy">' +
          (imgs.length > 1 ? '<span class="chip blue shop-count">' + imgs.length + ' images</span>' : '') +
          '<div class="shop-card-body"><div class="spread"><b>' + esc(p.name) + '</b>' + (p.popular ? '<span class="chip red">Top</span>' : '') + '</div>' +
          '<p>' + esc(p.short) + '</p><div class="spread"><span class="chip blue">' + money(p.price) + '</span>' +
          '<span class="subtle small">' + esc(p.unit) + '</span></div>' +
          '<div class="row" style="margin-top:10px"><button class="btn btn-ghost btn-sm" data-act="shop-edit" data-id="' + esc(p.id) + '">Modifier</button>' +
          '<button class="btn btn-ghost btn-sm" data-act="shop-copy" data-id="' + esc(p.id) + '">Texte IA</button></div></div></article>';
      }).join('') + '</div>' +
      '<div class="section-title"><h2>Suggestions de l’assistant</h2></div>' +
      '<div class="card">' + (suggestions.length ? '<div class="list">' + suggestions.map(function (s) {
        return '<div class="list-row"><div class="row-main"><b>' + esc(s.title) + '</b><small>' + esc(s.reason) + '</small></div>' +
          levelChip(s.priority === 'haute' ? 'chaud' : s.priority === 'moyenne' ? 'tiède' : 'froid') + '</div>';
      }).join('') + '</div>' : '<div class="empty">Lancez un cycle ou demandez des suggestions.</div>') + '</div>';
  };

  views.clients = function () {
    var clients = Store.db.clients || [];
    return '<div class="section-title"><h2>' + clients.length + ' client(s)</h2><button class="btn btn-primary btn-sm" data-act="client-add-form">+ Ajouter</button></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Nom</th><th>Téléphone</th><th>E-mail</th><th>Ville</th><th>Actions</th></tr></thead><tbody>' +
      (clients.length ? clients.map(function (c) {
        return '<tr><td><b>' + esc(c.name) + '</b></td><td>' + esc(c.phone || '—') + '</td><td>' + esc(c.email || '—') + '</td><td>' + esc(c.city || '—') + '</td>' +
          '<td><div class="row"><a class="btn btn-ghost btn-sm" href="' + esc(waLink('Bonjour ' + c.name)) + '" target="_blank" rel="noopener">💬</a>' +
          '<button class="btn btn-ghost btn-sm" data-act="client-delete" data-id="' + esc(c.id) + '">Supprimer</button></div></td></tr>';
      }).join('') : '<tr><td colspan="5" class="dim">Aucun client enregistré.</td></tr>') + '</tbody></table></div>';
  };

  views.academy = function () {
    var ac = C.academy || {};
    var modules = ac.modules || [];
    var offerings = ac.offerings || [];
    var trainings = (window.TU_CATALOGUE && window.TU_CATALOGUE.products || []).filter(function (p) { return p.category === 'academie'; });
    return '<div class="academy-banner"><img src="academie-couverture.webp" alt="Couverture Touch Unique Académie"></div>' +
      '<div class="auto-card card"><div class="card-head"><div><h2>' + esc(ac.eyebrow || 'Touch Unique Académie') + '</h2>' +
      '<div class="subtle">Apprenez à créer, puis à automatiser votre création.</div></div><span class="chip red">Formations</span></div>' +
      '<div class="row">' + modules.map(function (m) { return '<span class="chip blue">' + esc(m) + '</span>'; }).join('') + '</div></div>' +
      '<div class="section-title"><h2>Formations proposées</h2><span class="subtle small">Prix indicatifs · devis gratuit</span></div>' +
      '<div class="three-col">' + offerings.map(function (t) {
        return '<article class="card academy-offer"><div class="spread"><b>' + esc(t.name) + '</b><span class="chip red">' + money(t.price) + '</span></div>' +
          '<p class="subtle">' + esc(t.short) + '</p>' +
          '<div class="row" style="gap:6px"><span class="chip blue">' + esc(t.duration) + '</span><span class="chip gray">' + esc(t.level) + '</span></div>' +
          '<ul class="academy-list">' + (t.details || []).map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul>' +
          '<div class="row"><button class="btn btn-ghost btn-sm" data-act="academy-open" data-id="' + esc(t.id) + '">Voir le programme</button>' +
          '<a class="btn btn-primary btn-sm" href="' + esc(waLink('Bonjour Touch Unique, je veux m’inscrire à ' + t.name)) + '" target="_blank" rel="noopener">S’inscrire</a></div></article>';
      }).join('') + '</div>' +
      (trainings.length ? '<div class="section-title"><h2>Formations du catalogue</h2></div><div class="three-col">' +
        trainings.map(function (t) {
          return '<article class="card"><div class="spread"><b>' + esc(t.name) + '</b><span class="chip blue">' + money(t.price) + '</span></div>' +
            '<p class="subtle">' + esc(t.short) + '</p><div class="subtle small">' + esc(t.delay) + ' · ' + esc(t.unit) + '</div>' +
            '<button class="btn btn-ghost btn-sm" style="margin-top:12px" data-act="academy-open" data-id="' + esc(t.id) + '">Voir le programme</button></article>';
        }).join('') + '</div>' : '');
  };

  views.settings = function () {
    var s = Store.db.settings;
    var connectors = s.connectors || {};
    var rows = [
      ['whatsapp', 'WhatsApp', true], ['facebook', 'Facebook Graph API', false], ['instagram', 'Instagram Graph API', false],
      ['linkedin', 'LinkedIn', false], ['x', 'X / Twitter', false], ['email', 'E-mail SMTP', false], ['payment', 'Paiement en ligne', false]
    ];
    return '<div class="two-col">' +
      '<div class="card"><div class="card-head"><h2>Atelier</h2></div>' +
      '<form id="settings-form" class="form-grid">' +
      '<label class="field"><span>Nom affiché</span><input name="studio" value="' + esc(s.studio) + '"></label>' +
      '<label class="field"><span>Téléphone WhatsApp</span><input name="phone" value="' + esc(s.phone) + '"></label>' +
      '<label class="field full"><span>Lien WhatsApp</span><input name="whatsapp" value="' + esc(s.whatsapp) + '"></label>' +
      '<div class="field full"><label class="switch"><input type="checkbox" name="autopilot" ' + (s.autopilot ? 'checked' : '') + '> Autopilot activé</label></div>' +
      '<div class="field full"><label class="switch"><input type="checkbox" name="autoProjects" ' + (s.autoProjects ? 'checked' : '') + '> Créer un projet depuis les leads scorés</label></div>' +
      '<div class="field full"><label class="switch"><input type="checkbox" name="autoSocial" ' + (s.autoSocial ? 'checked' : '') + '> Préparer une publication pour les leads chauds</label></div>' +
      '<button class="btn btn-primary" type="submit" style="grid-column:1/-1">Enregistrer</button></form></div>' +
      '<div class="stack">' +
      '<div class="card"><div class="card-head"><h2>Compte local</h2><span class="chip green">' +
      esc((Accounts && Accounts.current() && Accounts.current().email) || 'Session active') + '</span></div>' +
      '<div class="row"><button class="btn btn-ghost btn-sm" data-act="account-logout">Verrouiller l’application</button></div></div>' +
      '<div class="card"><div class="card-head"><h2>Connexion & synchronisation QR</h2><span class="chip green">PC ↔ Android</span></div>' +
      '<div class="row" style="flex-wrap:wrap;gap:6px"><button class="btn btn-ghost btn-sm" data-act="qr-show">Afficher mon code</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="qr-scan">Scanner une photo</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="qr-paste">Saisir un code</button></div>' +
      '<div class="qr-panel" id="qr-settings-panel" hidden>' +
      '<img class="qr-image" id="qr-settings-image" alt="Code QR de synchronisation" hidden>' +
      '<label class="field full"><span>Photo du code QR (caméra sur Android)</span><input class="qr-file" id="qr-settings-file" type="file" accept="image/*" capture="environment"></label>' +
      '<label class="field full"><span>Code QR (texte)</span><textarea class="qr-text" id="qr-settings-text" rows="3" placeholder="Collez le code de l’autre appareil"></textarea></label>' +
      '<div class="row"><button class="btn btn-primary btn-sm" data-act="qr-apply">Connecter et synchroniser</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="qr-close">Fermer</button></div></div>' +
      '<p class="subtle small">Le code QR contient votre compte et une copie compacte de vos données : traitez-le comme un secret et ne le montrez qu’à vos propres appareils.</p></div>' +
      '<div class="card"><div class="card-head"><h2>Mises à jour en ligne</h2><span class="chip blue" id="updates-platform">—</span></div>' +
      '<div class="subtle small" id="updates-status">Vérification du canal de mise à jour…</div>' +
      '<form id="updates-form" class="form-grid" style="margin-top:10px">' +
      '<label class="field full"><span>URL du manifeste de mise à jour</span><input name="url" id="updates-url" type="url" placeholder="https://…/manifest.json"></label>' +
      '<label class="field full"><label class="switch"><input type="checkbox" name="auto" id="updates-auto" checked> Vérifier automatiquement au démarrage</label></label>' +
      '<div class="row" style="grid-column:1/-1"><button class="btn btn-ghost btn-sm" type="button" data-act="updates-check">↻ Vérifier et installer</button>' +
      '<button class="btn btn-primary btn-sm" type="submit">Enregistrer</button></div></form>' +
      '<p class="subtle small">Les mises à jour sont téléchargées et vérifiées par empreinte SHA-256. Aucune réinstallation n’est nécessaire. Le paquet n’est pas accessible depuis le site public.</p></div>' +
      '<div class="card"><div class="card-head"><h2>Autorisations de l’appareil</h2><span class="chip ' +
      (state.nativePerms && state.nativePerms.android ? 'green' : 'gray') + '">' +
      (state.nativePerms && state.nativePerms.android ? 'Android' : 'Navigateur') + '</span></div>' +
      '<div id="native-perms" class="row" style="flex-wrap:wrap;gap:6px"></div>' +
      '<div class="row" style="margin-top:10px"><button class="btn btn-ghost btn-sm" data-act="native-permissions">Autoriser fichiers, photos et caméra</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="native-overlay">Autoriser la superposition</button></div>' +
      '<p class="subtle small">Ces autorisations servent à importer des fichiers, prendre une photo et afficher l’assistant par-dessus les autres écrans. Sur Android, la superposition s’active dans les réglages système.</p></div>' +
      '<div class="card"><div class="card-head"><h2>Serveur sécurisé</h2><span class="chip blue">Clés côté serveur</span></div>' +
      '<form id="proxy-form" class="form-grid">' +
      '<label class="field full"><span>URL du serveur sécurisé</span><input name="url" type="url" placeholder="https://touchunique-serveur.onrender.com" value="' + esc((Cloud && Cloud.url()) || (window.TUSAI && window.TUSAI.getURL()) || 'https://touchunique-serveur.onrender.com') + '"></label>' +
      '<label class="field"><span>Clé d’accès (X-Tus-Key)</span><input name="key" type="password" autocomplete="off" placeholder="Facultatif"></label>' +
      '<div class="field"><button class="btn btn-ghost btn-sm" type="submit">Enregistrer</button></div></form>' +
      '<div id="proxy-status" class="subtle small" style="margin-top:10px">Non configuré.</div>' +
      '<div class="row" style="margin-top:10px"><button class="btn btn-ghost btn-sm" data-act="cloud-refresh">↻ Tester la connexion</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="robots-config">Configurer les robots</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="agents-config">Configurer les agents</button></div>' +
      '<p class="subtle small">Les clés saisies ci-dessous sont envoyées au serveur puis chiffrées dans son coffre. Elles ne sont jamais renvoyées à l’application.</p></div>' +
      '<div class="card"><div class="card-head"><h2>Connexions automatiques</h2><span class="chip red">Un clic</span></div>' +
      '<p class="subtle small">Google Drive, Facebook, Instagram, LinkedIn et X s’autorisent depuis l’application. Les jetons restent chiffrés sur le serveur.</p>' +
      '<div id="oauth-list" class="stack"></div>' +
      (Cloud ? '<details style="margin-top:12px"><summary class="subtle">Configurer les applications OAuth sur le serveur</summary>' +
        '<form id="oauth-config-form" class="form-grid" style="margin-top:10px">' +
        Cloud.OAUTH_FIELDS.map(function (f) {
          return '<label class="field"><span>' + esc(f.label) + '</span><input type="password" name="' + esc(f.id) + '" autocomplete="off" placeholder="Déjà enregistré ou variable d’environnement"></label>';
        }).join('') +
        '<button class="btn btn-ghost" type="submit" style="grid-column:1/-1">Enregistrer la configuration OAuth</button></form></details>' : '') +
      '</div>' +
      '<div class="card"><div class="card-head"><h2>Comptes IA</h2><span class="chip amber">Saisie différée possible</span></div>' +
      '<div class="account-grid">' + (Cloud ? Cloud.PROVIDERS.map(function (p) {
        var on = !!(state.cloudInfo && state.cloudInfo.ai && state.cloudInfo.ai[p.id]);
        return '<form class="account-row" data-account="' + esc(p.id) + '">' +
          '<div><b>' + esc(p.label) + '</b><div class="subtle small">' + (on ? 'Connecté · prêt à exécuter ses tâches' : 'Non connecté') + '</div>' +
          (safeExternal(p.url, PROVIDER_HOSTS) ? '<a class="link-btn" href="' + safeExternal(p.url, PROVIDER_HOSTS) + '" target="_blank" rel="noopener noreferrer">Obtenir une clé ↗</a>' : '') + '</div>' +
          '<div class="row"><input type="password" name="value" placeholder="' + esc(p.hint) + '" autocomplete="off" aria-label="Clé ' + esc(p.name) + '">' +
          '<button class="btn btn-ghost btn-sm" type="submit">' + (on ? 'Remplacer' : 'Connecter') + '</button>' +
          (on ? '<button class="btn btn-ghost btn-sm" type="button" data-act="account-remove" data-id="' + esc(p.id) + '">Retirer</button>' : '') +
          '</div></form>';
      }).join('') : '<div class="empty">Module de connexion indisponible.</div>') + '</div></div>' +
      '<div class="card"><div class="card-head"><h2>Réseaux sociaux</h2><span class="chip amber">Publication réelle uniquement</span></div>' +
      (Cloud ? Cloud.NETWORKS.map(function (n) {
        var on = !!(state.cloudInfo && state.cloudInfo.social && state.cloudInfo.social[n.id]);
        return '<form class="account-row" data-network="' + esc(n.id) + '"><div><b>' + esc(n.name) + '</b>' +
          '<div class="subtle small">' + (on ? 'Connecté' : 'Non connecté — publication désactivée') + '</div></div>' +
          '<div class="row">' + n.fields.map(function (f) {
            return '<input type="password" name="' + esc(f.id) + '" placeholder="' + esc(f.label) + '" autocomplete="off" aria-label="' + esc(f.label) + '">';
          }).join('') + '<button class="btn btn-ghost btn-sm" type="submit">Enregistrer</button></div></form>';
      }).join('') : '') + '</div>' +
      '<div class="card"><div class="card-head"><h2>Google Drive</h2>' +
      '<span class="chip ' + (state.cloudInfo && state.cloudInfo.google && state.cloudInfo.google.connected ? 'green' : 'gray') + '">' +
      (state.cloudInfo && state.cloudInfo.google && state.cloudInfo.google.connected ? esc(state.cloudInfo.google.email || 'Connecté') : 'Non connecté') + '</span></div>' +
      (Cloud ? '<form id="google-form" class="form-grid">' +
        Cloud.GOOGLE_FIELDS.map(function (f) {
          return '<label class="field full"><span>' + esc(f.label) + '</span><input name="' + esc(f.id) + '" type="text" autocomplete="off" placeholder="' + esc(f.id === 'google_redirect_uri' ? 'https://touchunique-serveur.onrender.com/api/google/callback' : 'À saisir une fois') + '"></label>';
        }).join('') +
        '<button class="btn btn-ghost" type="submit" style="grid-column:1/-1">Enregistrer la configuration Google</button></form>' : '') +
      '<div class="row" style="margin-top:12px"><button class="btn btn-primary btn-sm" data-act="google-connect">Se connecter à Google Drive</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="google-sync">☁ Synchroniser maintenant</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="google-backups">Voir les sauvegardes</button></div>' +
      '<p class="subtle small">Scope demandé : fichiers créés par cette application uniquement. Aucun accès à vos autres documents.</p></div>' +
      '<div class="card"><div class="card-head"><h2>Sauvegarde locale</h2></div><div class="row">' +
      '<button class="btn btn-ghost btn-sm" data-act="settings-export">↓ Exporter JSON</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="settings-import">↑ Importer JSON</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="settings-reset">Réinitialiser</button>' +
      '<input type="file" id="import-file" accept="application/json" hidden></div>' +
      '<p class="subtle small">Export local immédiat. Pour une synchronisation automatique, connectez Google Drive ci-dessus.</p></div></div></div>';
  };

  /* ---------- Actions ---------- */
  function runAutopilot() {
    var res = A.runCycle ? A.runCycle({
      catalogue: window.TU_CATALOGUE,
      leads: Store.db.leads,
      projects: Store.db.projects
    }) : null;
    if (!res) return toast('Moteur IA indisponible', true);
    res.projects.forEach(function (p) { Store.add('projects', p); });
    res.tasks.forEach(function (t) { Store.add('tasks', t); });
    if (Store.db.settings.autoSocial !== false) res.social.forEach(function (s) { Store.add('social', s); });
    Store.db.shop.suggestions = res.shopActions || [];
    Store.db.stats.runs = (Store.db.stats.runs || 0) + 1;
    Store.db.stats.generated = (Store.db.stats.generated || 0) + res.social.length;
    Store.db.stats.social = (Store.db.stats.social || 0) + res.social.length;
    Store.db.stats.lastRun = res.at;
    Store.log('Cycle IA : ' + res.log.join(' · '));
    Store.save();
    toast('Cycle terminé : ' + res.projects.length + ' projet(s), ' + res.tasks.length + ' tâche(s)');
    go(page);
  }
  function newProject() {
    openModal('<h3>Nouveau projet</h3><form id="project-form" class="form-grid">' +
      '<label class="field full"><span>Nom du projet</span><input name="name" required placeholder="Ex. Identité Maison Kaboré"></label>' +
      '<label class="field"><span>Type</span><select name="type"><option>Identité & branding</option><option>Vidéo & motion</option><option>Contenus réseaux</option><option>Print & packaging</option><option>Formation Académie</option><option>Automatisation IA</option></select></label>' +
      '<label class="field"><span>Client</span><input name="client" placeholder="Nom du client"></label>' +
      '<label class="field"><span>Montant FCFA</span><input name="amount" type="number" min="0" value="0"></label>' +
      '<label class="field"><span>Échéance</span><input name="due" type="date"></label>' +
      '<div class="field full"><label class="switch"><input type="checkbox" name="aiTasks" checked> Générer les tâches avec l’IA</label></div>' +
      '<div class="modal-actions" style="grid-column:1/-1"><button class="btn btn-ghost" type="button" data-act="modal-close">Annuler</button>' +
      '<button class="btn btn-primary" type="submit">Créer le projet</button></div></form>');
  }
  function projectDetail(id) {
    var p = (Store.db.projects || []).find(function (x) { return x.id === id; });
    if (!p) return;
    var tasks = (Store.db.tasks || []).filter(function (t) { return t.projectId === id; });
    openModal('<h3>' + esc(p.name) + '</h3>' +
      '<div class="row"><span class="chip blue">' + esc(p.type || 'projet') + '</span>' + statusChip(p.status) + '<span class="chip gray">' + money(p.amount) + '</span></div>' +
      '<p class="subtle">' + esc(p.client || 'Client non renseigné') + ' · Échéance ' + date(p.due) + '</p>' +
      '<div class="card-head" style="margin-top:16px"><h3>Tâches</h3><button class="btn btn-ghost btn-sm" data-act="project-tasks" data-id="' + esc(id) + '">✺ Ajouter par IA</button></div>' +
      (tasks.length ? '<div class="list">' + tasks.map(function (t) {
        return '<div class="list-row"><div class="row-main"><b>' + esc(t.title) + '</b><small>' + esc(t.phase || '') + '</small></div>' + statusChip(t.status) + '</div>';
      }).join('') + '</div>' : '<div class="empty">Aucune tâche.</div>') +
      '<div class="modal-actions"><button class="btn btn-ghost" data-act="modal-close">Fermer</button></div>');
  }
  function leadConvert(id) {
    var l = (Store.db.leads || []).find(function (x) { return x.id === id; });
    if (!l) return;
    var p = Store.add('projects', {
      name: 'Projet — ' + ((l.client && l.client.name) || l.ref || 'lead'),
      type: String(l.type || 'projet').replace(/^Demande de projet — /, ''),
      client: (l.client && l.client.name) || '', phone: (l.client && l.client.phone) || '',
      status: 'brief', amount: Number(l.total || 0), source: l.source || 'Site web', sourceId: l.id, ai: true
    });
    if (A.tasksForProject) A.tasksForProject(p).slice(0, 5).forEach(function (t) { Store.add('tasks', t); });
    Store.update('leads', id, { seen: true, convertedProjectId: p.id });
    Store.log('Lead ' + (l.ref || l.id) + ' converti en projet ' + p.id);
    toast('Projet créé et tâches générées');
    go(page);
  }
  function contentFromForm(form) {
    var fd = new FormData(form);
    var res = A.content ? A.content({
      kind: fd.get('kind'), theme: fd.get('theme'), audience: fd.get('audience'),
      goal: fd.get('goal'), tone: fd.get('tone')
    }) : null;
    if (!res) return toast('Moteur IA indisponible', true);
    state.lastContent = res;
    Store.add('contents', {
      id: res.id, theme: res.theme, type: res.type, text: res.captions[0],
      createdAt: res.at, ai: true, data: res
    });
    Store.db.stats.generated = (Store.db.stats.generated || 0) + 1;
    Store.log('Contenu généré : ' + res.theme);
    Store.save();
    paintContentResult(res);
    toast('Pack de contenu généré');
  }
  function paintContentResult(res) {
    var root = $('#content-result');
    if (!root) return;
    root.innerHTML = '<div class="brief-box"><b>Brief · ' + esc(res.theme) + '</b>' +
      '<div class="subtle">' + esc(res.brief.angle) + ' · ton ' + esc(res.brief.tone) + '</div></div>' +
      '<div class="result-grid">' +
      '<div class="result-card"><h3>Titres</h3><div class="copy-box">' + esc(res.titles.join('\n')) + '</div></div>' +
      '<div class="result-card"><h3>Hashtags</h3><div class="copy-box">' + esc(res.hashtags.join(' ')) + '</div></div>' +
      '<div class="result-card"><h3>Légendes</h3><div class="copy-box">' + esc(res.captions.join('\n\n---\n\n')) + '</div></div>' +
      '<div class="result-card"><h3>Scripts</h3><div class="copy-box">' + esc(res.scripts.join('\n\n---\n\n')) + '</div></div>' +
      '<div class="result-card" style="grid-column:1/-1"><h3>Calendrier</h3><div class="copy-box">' + esc(res.calendar.join('\n')) + '</div></div></div>' +
      '<div class="row" style="margin-top:14px"><button class="btn btn-primary btn-sm" data-act="content-copy">Copier les légendes</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="content-social">Ajouter à la file sociale</button></div>';
  }
  function socialAddForm() {
    openModal('<h3>Ajouter une publication</h3><form id="social-form" class="form-grid">' +
      '<label class="field"><span>Plateforme</span><select name="platform"><option value="whatsapp">WhatsApp</option><option value="facebook">Facebook</option><option value="instagram">Instagram</option><option value="linkedin">LinkedIn</option><option value="x">X</option></select></label>' +
      '<label class="field"><span>Date</span><input name="scheduledAt" type="date" value="' + Store.today() + '"></label>' +
      '<label class="field full"><span>Texte</span><textarea name="text" rows="5" required></textarea></label>' +
      '<div class="modal-actions" style="grid-column:1/-1"><button class="btn btn-ghost" type="button" data-act="modal-close">Annuler</button>' +
      '<button class="btn btn-primary" type="submit">Ajouter</button></div></form>');
  }
  function shopGallery(imgs) {
    return '<div class="shop-gallery" id="shop-gallery">' + (imgs || []).map(function (src, i) {
      return '<div class="shop-thumb"><img src="' + esc(src) + '" alt="Image ' + (i + 1) + '">' +
        '<button type="button" class="thumb-remove" data-act="shop-image-remove" data-index="' + i + '" aria-label="Retirer">✕</button>' +
        '<button type="button" class="thumb-move" data-act="shop-image-left" data-index="' + i + '" aria-label="Déplacer à gauche">‹</button>' +
        '</div>';
    }).join('') + '</div>';
  }

  function shopForm(product, isNew) {
    var p = product || {};
    var CAT = window.TUSCatalog;
    var imgs = CAT ? CAT.images(p) : (p.img ? [p.img] : []);
    state.shopDraftImages = imgs.slice();
    var cats = (CAT ? CAT.categories() : ((window.TU_CATALOGUE || {}).categories || []));
    openModal('<h3>' + (isNew ? 'Nouvelle offre' : 'Modifier · ' + esc(p.name)) + '</h3>' +
      '<p class="subtle small">Les modifications sont visibles immédiatement sur le site public (même origine) et envoyées au serveur sécurisé si celui-ci est configuré.</p>' +
      '<form id="shop-form" class="form-grid" data-id="' + esc(p.id || '') + '" data-new="' + (isNew ? '1' : '0') + '">' +
      '<label class="field full"><span>Nom de l’offre</span><input name="name" required value="' + esc(p.name || '') + '"></label>' +
      '<label class="field"><span>Prix de départ (FCFA)</span><input name="price" type="number" min="0" required value="' + Number(p.price || 0) + '"></label>' +
      '<label class="field"><span>Unité</span><input name="unit" value="' + esc(p.unit || 'forfait') + '"></label>' +
      '<label class="field"><span>Catégorie</span><select name="category">' +
      cats.map(function (c) { return '<option value="' + esc(c.id) + '"' + (p.category === c.id ? ' selected' : '') + '>' + esc(c.label) + '</option>'; }).join('') +
      '</select></label>' +
      '<label class="field"><span>Délai</span><input name="delay" value="' + esc(p.delay || '') + '" placeholder="48 h, 5 jours…"></label>' +
      '<label class="field"><span>Badge</span><input name="badge" value="' + esc(p.badge || '') + '" placeholder="Le plus demandé"></label>' +
      '<div class="field"><label class="switch"><input type="checkbox" name="popular"' + (p.popular ? ' checked' : '') + '> Offre populaire</label></div>' +
      '<label class="field full"><span>Description courte</span><textarea name="short" rows="3">' + esc(p.short || '') + '</textarea></label>' +
      '<label class="field full"><span>Description complète</span><textarea name="desc" rows="4">' + esc(p.desc || '') + '</textarea></label>' +
      '<label class="field full"><span>Livrables (un par ligne)</span><textarea name="deliverables" rows="3">' + esc((p.deliverables || []).join('\n')) + '</textarea></label>' +
      '<label class="field full"><span>Automatisations IA (une par ligne)</span><textarea name="ai" rows="2">' + esc((p.ai || []).join('\n')) + '</textarea></label>' +
      '<div class="field full"><div class="gate-divider">Images du produit — la première sert de vignette sur le site</div></div>' +
      '<div class="field full">' + shopGallery(state.shopDraftImages) +
      '<label class="btn btn-ghost btn-sm" style="margin-top:10px">＋ Ajouter des images' +
      '<input type="file" id="shop-images-input" accept="image/*" multiple hidden></label></div>' +
      '<div class="modal-actions" style="grid-column:1/-1">' +
      (!isNew ? '<button class="btn btn-ghost" type="button" data-act="shop-delete">Supprimer l’offre</button>' : '') +
      '<button class="btn btn-ghost" type="button" data-act="modal-close">Annuler</button>' +
      '<button class="btn btn-primary" type="submit">Enregistrer et synchroniser</button></div></form>');
    var input = $('#shop-images-input');
    if (input) input.addEventListener('change', function () {
      var files = Array.prototype.slice.call(input.files || []);
      if (!files.length) return;
      toast('Préparation de ' + files.length + ' image(s)…');
      files.reduce(function (chain, file) {
        return chain.then(function () {
          return new Promise(function (resolve) {
            CAT.prepareImage(file, function (err, dataUrl) {
              if (!err && dataUrl && state.shopDraftImages.indexOf(dataUrl) < 0) state.shopDraftImages.push(dataUrl);
              resolve();
            });
          });
        });
      }, Promise.resolve()).then(function () {
        var box = $('#shop-gallery');
        if (box) box.outerHTML = shopGallery(state.shopDraftImages);
        toast('Images ajoutées');
      });
      input.value = '';
    });
  }
  function shopEdit(id) {
    var p = Store.products().find(function (x) { return x.id === id; });
    if (p) shopForm(p, false);
  }
  function shopNewForm() {
    shopForm({ category: 'outils', unit: 'forfait', price: 0, images: [] }, true);
  }
  function shopSave(form) {
    var CAT = window.TUSCatalog;
    if (!CAT) return toast('Catalogue partagé indisponible', true);
    var fd = new FormData(form);
    var id = form.dataset.id || '';
    var lines = function (v) { return String(v || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean); };
    var product = {
      id: id || ('offre-' + Date.now().toString(36)),
      name: String(fd.get('name') || '').trim(),
      price: Number(fd.get('price') || 0), unit: String(fd.get('unit') || 'forfait'),
      category: String(fd.get('category') || 'outils'), delay: String(fd.get('delay') || ''),
      badge: String(fd.get('badge') || ''), popular: !!fd.get('popular'),
      short: String(fd.get('short') || ''), desc: String(fd.get('desc') || ''),
      deliverables: lines(fd.get('deliverables')), ai: lines(fd.get('ai')),
      images: (state.shopDraftImages || []).slice()
    };
    product.img = product.images[0] || '';
    if (!product.name) return toast('Nom requis', true);
    try {
      CAT.saveProduct(product);
      closeModal();
      Store.log('Boutique synchronisée : ' + product.name + ' · ' + product.price + ' FCFA');
      Store.save();
      toast('Offre enregistrée · visible sur le site');
      go('shop');
    } catch (e) { toast(e.message, true); }
  }
  function clientForm() {
    openModal('<h3>Ajouter un client</h3><form id="client-form" class="form-grid">' +
      '<label class="field full"><span>Nom</span><input name="name" required></label>' +
      '<label class="field"><span>Téléphone</span><input name="phone" inputmode="tel"></label>' +
      '<label class="field"><span>E-mail</span><input name="email" type="email"></label>' +
      '<label class="field full"><span>Ville</span><input name="city"></label>' +
      '<div class="modal-actions" style="grid-column:1/-1"><button class="btn btn-ghost" type="button" data-act="modal-close">Annuler</button>' +
      '<button class="btn btn-primary" type="submit">Ajouter</button></div></form>');
  }
  function exportCSV() {
    var rows = [['plateforme', 'date', 'statut', 'texte']].concat((Store.db.social || []).map(function (s) {
      return [s.platform, s.scheduledAt || '', s.status || '', s.text || ''];
    }));
    var csv = rows.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
    var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'touchunique-file-sociale.csv'; a.click();
    URL.revokeObjectURL(a.href);
    toast('Export CSV téléchargé');
  }

  /* ---------- Assistant & connexions ---------- */
  function refreshConnections() {
    var badge = $('#ai-mode'), box = $('#proxy-status');
    function paint(s) {
      var live = s.ok && Object.keys(s.ai || {}).some(function (k) { return s.ai[k]; });
      if (badge) badge.textContent = live ? 'IA temps réel connectée' : 'Moteur local inclus';
      if (!box) return;
      if (!s.configured) { box.innerHTML = 'Serveur non configuré — moteur local actif.'; return; }
      if (!s.ok) { box.innerHTML = 'Serveur injoignable : ' + esc(s.error || 'erreur'); return; }
      var aiSrc = (s.ai && typeof s.ai === 'object' && !Array.isArray(s.ai)) ? s.ai : {};
      var socialSrc = (s.social && typeof s.social === 'object' && !Array.isArray(s.social)) ? s.social : {};
      /* Clés serveur : filtrées puis échappées avant toute injection HTML. */
      var names = function (src) {
        return Object.keys(src).filter(function (k) {
          return !!src[k] && /^[a-z0-9_-]{1,40}$/i.test(k);
        }).map(esc).join(', ');
      };
      var ai = names(aiSrc) || 'aucune';
      var social = names(socialSrc) || 'aucun';
      var drive = s.google && s.google.connected ? ' · Drive connecté' : '';
      box.textContent = 'IA : ' + ai + ' · Réseaux : ' + social + drive + '.';
    }
    if (state.cloudInfo) { paint(state.cloudInfo); return; }
    if (window.TUSAI) window.TUSAI.status().then(paint);
  }
  function assistantAsk(raw) {
    var q = A.norm ? A.norm(raw) : String(raw).toLowerCase();
    var local = null, sources = [];
    if (/statut|projet|avancement/.test(q)) {
      var ps = Store.db.projects || [];
      local = ps.length ? ps.slice(0, 6).map(function (p) { return '• ' + p.name + ' — ' + (p.status || '—'); }).join('\n') : 'Aucun projet enregistré.';
      sources.push('Projets');
    } else if (/commande|lead|demande|client/.test(q)) {
      var ls = Store.db.leads || [];
      local = ls.length ? ls.slice(0, 4).map(function (l) {
        return '• ' + ((l.client && l.client.name) || l.ref) + ' — score ' + (l.score || '?') + ' · ' + (l.nextAction || 'à qualifier');
      }).join('\n') : 'Aucune demande importée pour le moment.';
      sources.push('Commandes du site');
    } else if (/boutique|catalogue|offre|prix/.test(q)) {
      var acts = A.shopActions ? A.shopActions(Store.products(), Store.db.leads || []) : [];
      local = acts.map(function (a) { return '• ' + a.title + ' — ' + a.reason; }).join('\n');
      sources.push('Catalogue', 'Leads');
    } else if (/t[âa]che|todo|à faire/.test(q)) {
      var ts = (Store.db.tasks || []).filter(function (t) { return t.status !== 'terminée'; });
      local = ts.length ? ts.slice(0, 8).map(function (t) { return '• ' + t.title; }).join('\n') : 'Aucune tâche en attente.';
      sources.push('Tâches');
    }
    if (local !== null) return Promise.resolve({ answer: local, sources: sources });

    var AI = window.TUSAI;
    if (!AI) return Promise.resolve({
      answer: 'Je peux vous aider sur les projets, les commandes, les contenus, les robots et la boutique.', sources: ['Aide']
    });
    return AI.ask(raw).then(function (r) {
      return { answer: r.text, sources: [r.live ? 'IA temps réel' : 'Moteur local'], trials: r.trials };
    });
  }
  function pushMsg(cls, text) {
    var box = $('#ai-messages');
    var el = document.createElement('div');
    el.className = 'msg ' + cls;
    el.innerHTML = nl(text).replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
  }
  function initAI() {
    pushMsg('bot', 'Bonjour. Je suis l’assistant local Touch Unique. Je prépare, je classe et je rédige — vous validez.');
    var sugg = ['Montre les projets', 'Trouve une offre', 'Génère une publication', 'Cherche des prospects', 'Tâches en attente'];
    $('#ai-suggestions').innerHTML = sugg.map(function (s) { return '<button type="button">' + esc(s) + '</button>'; }).join('');
    $('#ai-suggestions').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      $('#ai-text').value = b.textContent;
      $('#ai-form').requestSubmit();
    });
    $('#ai-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var input = $('#ai-text'), text = input.value.trim();
      if (!text) return;
      pushMsg('user', text); input.value = '';
      var btn = $('button', e.target);
      if (btn) btn.disabled = true;
      assistantAsk(text).then(function (res) {
        var footer = '\n\n— Sources : ' + res.sources.join(', ');
        /* Indicateur informatif seulement : le quota est appliqué par le serveur. */
        if (res.trials && res.trials.limit) {
          footer += ' · Indicateur local : ' + (res.trials.remaining || 0) + '/' + res.trials.limit + ' essais aujourd’hui (limite effective côté serveur)';
        }
        pushMsg('bot', res.answer + footer);
        refreshConnections();
      }).catch(function (err) {
        pushMsg('bot', 'Erreur : ' + err.message);
      }).then(function () { if (btn) btn.disabled = false; });
    });
    function toggle(open) {
      var panel = $('#ai-panel'), fab = $('#ai-fab');
      var isOpen = typeof open === 'boolean' ? open : !panel.classList.contains('open');
      panel.classList.toggle('open', isOpen);
      if (isOpen) panel.removeAttribute('inert'); else panel.setAttribute('inert', '');
      fab.setAttribute('aria-expanded', String(isOpen));
      if (isOpen) $('#ai-text').focus();
    }
    $('#ai-fab').addEventListener('click', function () { toggle(); });
    $('#ai-close').addEventListener('click', function () { toggle(false); });
  }

  function initNetworkMeter() {
    var N = window.TUSNetwork;
    if (!N) return;
    var meter = $('#net-meter'), led = $('#net-led'), label = $('#net-label'),
      detail = $('#net-detail'), button = $('#net-toggle'), sync = $('#sync-state');
    function paint(s) {
      if (meter) meter.classList.toggle('online', !!s.online);
      if (label) label.textContent = s.enabled ? (s.online ? 'Connecté' : 'Hors ligne') : 'Désactivé';
      if (detail) detail.textContent = N.format(s);
      if (button) {
        button.textContent = s.enabled ? 'ACTIF' : 'OFF';
        button.setAttribute('aria-pressed', String(!!s.enabled));
        button.title = s.enabled ? 'Désactiver la connexion réseau' : 'Activer la connexion réseau';
      }
      if (sync && !s.enabled) sync.textContent = 'Connexion réseau désactivée';
    }
    N.onChange(paint);
    paint(N.status());
    if (button) button.addEventListener('click', function () { N.toggle(); });
    N.start();
  }

  /* ---------- Robots ---------- */
  function refreshRobotStatus() {
    var R = window.TUSRobots;
    if (!R) return;
    R.status().then(function (s) {
      state.robotInfo = s;
      refreshConnections();
      if (page === 'robots') go('robots');
    });
  }
  function robotLocal(id) {
    var R = window.TUSRobots;
    var r = R && R.robots.find(function (x) { return x.id === id; });
    if (!r) return;
    toast('Préparation de l’aperçu…');
    R.localRun(r).then(function (res) {
      R.record(r, Object.assign({ ok: true }, res));
      Store.log('Robot ' + r.name + ' : aperçu local généré');
      Store.save();
      toast('Aperçu généré : ' + r.name);
      go(page);
    }).catch(function (err) { toast(err.message, true); });
  }
  function robotExecute(id, dry) {
    var R = window.TUSRobots;
    var r = R && R.robots.find(function (x) { return x.id === id; });
    if (!r) return;
    if (!R.configured()) return toast('Configurez le serveur sécurisé dans les réglages.', true);
    toast(dry ? 'Génération sur le serveur…' : 'Exécution du robot…');
    R.run(id, dry).then(function (res) {
      if (!res || !res.ok) return toast((res && res.error) || 'Exécution impossible', true);
      R.record(r, Object.assign({ ok: true }, res));
      Store.log('Robot ' + r.name + ' : ' + (dry ? 'génération serveur' : 'exécution') +
        (res.published && res.published.length ? ' · ' + res.published.map(function (p) { return p.network + (p.ok ? ' ✓' : ' ✕'); }).join(' ') : ''));
      Store.save();
      toast(dry ? 'Contenu généré sur le serveur' : 'Robot exécuté');
      refreshRobotStatus();
    }).catch(function (err) { toast(err.message, true); });
  }

  /* ---------- Entreprises, dossiers et collaboration IA ---------- */
  function companyForm() {
    openModal('<h3>Nouvelle entreprise</h3><form id="company-form" class="form-grid">' +
      '<label class="field full"><span>Nom de l’entreprise</span><input name="name" required placeholder="Ex. Maison Kaboré"></label>' +
      '<label class="field"><span>Secteur</span><input name="sector" placeholder="Commerce, pharmacie, école…"></label>' +
      '<label class="field"><span>Ville</span><input name="city" placeholder="Ouagadougou"></label>' +
      '<label class="field full"><span>Contact principal</span><input name="contact" placeholder="Nom du responsable"></label>' +
      '<label class="field"><span>Téléphone</span><input name="phone" inputmode="tel"></label>' +
      '<label class="field"><span>E-mail</span><input name="email" type="email"></label>' +
      '<div class="modal-actions" style="grid-column:1/-1"><button class="btn btn-ghost" type="button" data-act="modal-close">Annuler</button>' +
      '<button class="btn btn-primary" type="submit">Créer l’espace</button></div></form>');
  }
  function companyProject(name) {
    newProject();
    var form = $('#project-form');
    if (form && name) {
      form.dataset.company = name;
      var client = form.querySelector('[name="client"]');
      if (client && !client.value) client.value = name;
    }
  }
  function loadFiles() {
    if (!Cloud || !Cloud.configured()) { state.filesList = []; return Promise.resolve(0); }
    return Cloud.files(state.fileCompany, state.fileProject, state.fileFolder).then(function (list) {
      state.filesList = list || [];
      return state.filesList.length;
    }).catch(function (e) { toast(e.message, true); state.filesList = []; return 0; });
  }
  function fileNoteForm() {
    openModal('<h3>Nouvelle note classée</h3><form id="note-form" class="form-grid">' +
      '<label class="field full"><span>Titre</span><input name="name" required placeholder="Ex. Brief client du 26/11"></label>' +
      '<label class="field full"><span>Texte</span><textarea name="text" rows="8" required></textarea></label>' +
      '<div class="modal-actions" style="grid-column:1/-1"><button class="btn btn-ghost" type="button" data-act="modal-close">Annuler</button>' +
      '<button class="btn btn-primary" type="submit">Enregistrer</button></div></form>');
  }

  /* ---------- Analyse multimédia par IA ---------- */
  function mediaModal() {
    if (!Cloud || !Cloud.configured()) return toast('Configurez le serveur sécurisé pour analyser un média.', true);
    var companies = Store.companies();
    var company = state.fileCompany || Store.db.settings.activeCompany || (companies[0] && companies[0].name) || '';
    var projects = Store.projectsFor(company);
    var project = state.fileProject || '';
    openModal('<h3>✦ Analyser un média par IA</h3>' +
      '<p class="subtle small">Image, audio, vidéo ou document : le fichier est classé puis analysé. ' +
      'Les informations extraites peuvent lancer directement une mission complète.</p>' +
      '<form id="media-form" class="form-grid">' +
      '<label class="field full"><span>Fichier à analyser</span>' +
      '<input type="file" name="file" accept="image/*,audio/*,video/*,.pdf,.txt,.md,.csv,.json,.xml,.html,.docx"></label>' +
      '<label class="field full"><span>Ou prendre une photo</span>' +
      '<input type="file" name="camera" accept="image/*" capture="environment"></label>' +
      '<div class="field full" id="media-preview" class="media-preview" hidden></div>' +
      '<label class="field"><span>Entreprise</span><select name="company">' +
      '<option value="">— Choisir —</option>' +
      companies.map(function (c) { return '<option value="' + esc(c.name) + '"' + (company === c.name ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') +
      '</select></label>' +
      '<label class="field"><span>Projet</span><select name="project"><option value="">— Aucun —</option>' +
      projects.map(function (p) { return '<option value="' + esc(p.name) + '"' + (project === p.name ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('') +
      '</select></label>' +
      '<label class="field full"><span>Question à l’IA (facultatif)</span>' +
      '<textarea name="question" rows="2" placeholder="Ex. Quels sont les coordonnées et le besoin exprimé dans ce document ?"></textarea></label>' +
      '<div class="field full"><label class="switch"><input type="checkbox" name="mission"> Créer et exécuter une mission complète à partir des informations extraites</label></div>' +
      '<div class="modal-actions" style="grid-column:1/-1"><button class="btn btn-ghost" type="button" data-act="modal-close">Annuler</button>' +
      '<button class="btn btn-primary" type="submit">✦ Analyser le média</button></div></form>');
    function showMediaPreview(file) {
      var box = $('#media-preview');
      if (!box) return;
      if (!file) { box.hidden = true; return; }
      box.hidden = false;
      box.innerHTML = '';
      if (/^image\//.test(file.type)) {
        var img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.alt = 'Aperçu du fichier';
        box.appendChild(img);
      }
      var info = document.createElement('div');
      info.className = 'subtle small';
      info.textContent = (file.name || 'fichier') + ' · ' + Math.round(file.size / 1024) + ' Ko · ' + (file.type || 'type inconnu');
      box.appendChild(info);
    }
    $$('#media-form input[type="file"]').forEach(function (field) {
      field.addEventListener('change', function () {
        showMediaPreview(field.files && field.files[0]);
      });
    });
  }

  function fileToPayload(file, extra) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('Lecture du fichier impossible')); };
      reader.onload = function () {
        var dataUrl = String(reader.result || '');
        var comma = dataUrl.indexOf(',');
        if (comma < 0) return reject(new Error('Format de fichier illisible'));
        var payload = {
          name: file.name || 'fichier', mime: file.type || 'application/octet-stream',
          content: dataUrl.slice(comma + 1),
          company: extra.company || '', project: extra.project || '',
          folder: extra.mission ? 'Médias' : 'Médias',
          question: extra.question || ''
        };
        resolve(payload);
      };
      reader.readAsDataURL(file);
    });
  }

  function mediaAnalyze(form) {
    if (!Cloud || !Cloud.configured()) return toast('Serveur non configuré.', true);
    var fd = new FormData(form);
    var file = fd.get('file');
    var camera = fd.get('camera');
    if ((!file || !file.size) && camera && camera.size) file = camera;
    if (!file || !file.size) return toast('Choisissez un fichier ou prenez une photo', true);
    var extra = {
      company: fd.get('company') || '', project: fd.get('project') || '',
      question: fd.get('question') || '', mission: !!fd.get('mission')
    };
    toast(extra.mission ? 'Analyse puis mission des 4 agents en cours…' : 'Analyse du média en cours…');
    fileToPayload(file, extra).then(function (payload) {
      var call = extra.mission ? Cloud.mediaMission(payload) : Cloud.analyzeMedia(payload);
      return call.then(function (res) {
        state.lastMediaReport = extra.mission ? (res.analysis || res) : res;
        state.filesList = state.filesList || [];
        loadFiles();
        if (extra.mission) {
          state.pipelineResult = res;
          closeModal();
          go('collab');
          toast('Mission terminée à partir du média · ' + ((res.stages || []).length) + ' étapes');
        } else {
          showMediaReport(state.lastMediaReport, false);
        }
      });
    }).catch(function (e) { toast(e.message, true); });
  }

  function analyzeExistingFile(id) {
    if (!Cloud || !Cloud.configured()) return toast('Serveur non configuré.', true);
    var meta = (state.filesList || []).find(function (f) { return f.id === id; }) || {};
    toast('Analyse de ' + (meta.name || 'fichier') + '…');
    Cloud.downloadFile(id).then(function (res) {
      return Cloud.analyzeMedia({
        name: (res.meta && res.meta.name) || meta.name || 'fichier',
        mime: (res.meta && res.meta.mime) || meta.mime || 'application/octet-stream',
        content: res.content || '', company: meta.company || '', project: meta.project || '',
        folder: meta.folder || 'Médias', question: ''
      });
    }).then(function (report) {
      state.lastMediaReport = report;
      showMediaReport(report, true);
    }).catch(function (e) { toast(e.message, true); });
  }

  function mediaEntities(report) {
    var entities = (report && report.entities) || {};
    var rows = [];
    Object.keys(entities).forEach(function (key) {
      var vals = entities[key] || [];
      if (vals.length) rows.push('<div><b>' + esc(key) + '</b> : ' + esc(vals.join(', ')) + '</div>');
    });
    return rows.length ? rows.join('') : '<div class="subtle small">Aucune entité détectée.</div>';
  }

  function showMediaReport(report, fromExisting) {
    if (!report) return toast('Aucune analyse disponible.', true);
    var mission = mediaMissionFromReport(report);
    openModal('<h3>✦ Analyse · ' + esc(report.name || 'média') + '</h3>' +
      '<div class="media-report">' +
      '<div class="row"><span class="chip blue">' + esc(report.kind || 'fichier') + '</span>' +
      '<span class="chip green">' + esc(report.engine || 'local') + '</span>' +
      '<span class="chip ' + (report.confidence === 'faible' ? 'amber' : 'gray') + '">' + esc(report.confidence || '—') + '</span></div>' +
      '<h4 style="margin:14px 0 6px">Synthèse</h4><div class="subtle">' + esc(report.summary || '') + '</div>' +
      '<h4 style="margin:14px 0 6px">Faits observés</h4><div class="media-facts">' +
      ((report.details || []).length ? report.details.map(function (d) { return '<div>· ' + esc(d) + '</div>'; }).join('') : '<div class="subtle small">Aucun fait détaillé.</div>') +
      '</div><h4 style="margin:14px 0 6px">Informations détectées</h4><div class="media-entities">' + mediaEntities(report) + '</div>' +
      '<h4 style="margin:14px 0 6px">Mission suggérée</h4><div class="copy-box">' + esc(report.suggestedMission || 'Aucune suggestion') + '</div>' +
      '<div class="subtle small" style="margin-top:8px">Rapport enregistré dans : ' + esc(report.analysisFile || (report.file && report.file.path) || '') + '</div>' +
      (report.error ? '<div class="gate-error" style="margin-top:10px">' + esc(report.error) + '</div>' : '') +
      '</div><div class="modal-actions" style="margin-top:16px;flex-wrap:wrap">' +
      '<button class="btn btn-ghost" type="button" data-act="modal-close">Fermer</button>' +
      '<button class="btn btn-ghost" type="button" data-act="media-copy">Copier la synthèse</button>' +
      '<button class="btn btn-ghost" type="button" data-act="media-edit-mission">Modifier la mission</button>' +
      '<button class="btn btn-primary" type="button" data-act="media-launch">⇄ Lancer la mission complète</button></div>');
    state.mediaMissionDraft = mission;
  }

  function mediaMissionFromReport(report) {
    return {
      company: report.company || Store.db.settings.activeCompany || '',
      project: report.project || '',
      topic: report.suggestedMission || ('Créer une mission à partir de ' + (report.name || 'ce fichier')),
      research: (report.summary || '') + '\n\n' + (report.details || []).join('\n- ') +
                '\n\nSignaux : ' + JSON.stringify(report.entities || {}),
      publish: false
    };
  }

  function mediaMissionEditor() {
    var mission = state.mediaMissionDraft || {};
    var companies = Store.companies();
    var projects = Store.projectsFor(mission.company);
    openModal('<h3>Modifier la mission</h3>' +
      '<p class="subtle small">Les informations extraites du média sont reprises automatiquement. Ajustez-les avant de lancer les agents.</p>' +
      '<form id="media-mission-form" class="form-grid">' +
      '<label class="field"><span>Entreprise</span><select name="company"><option value="">—</option>' +
      companies.map(function (c) { return '<option value="' + esc(c.name) + '"' + (mission.company === c.name ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') +
      '</select></label>' +
      '<label class="field"><span>Projet</span><select name="project"><option value="">—</option>' +
      projects.map(function (p) { return '<option value="' + esc(p.name) + '"' + (mission.project === p.name ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('') +
      '</select></label>' +
      '<label class="field full"><span>Objectif de la mission</span><input name="topic" value="' + esc(mission.topic || '') + '" required></label>' +
      '<label class="field full"><span>Informations transmises aux agents</span><textarea name="research" rows="10">' + esc(mission.research || '') + '</textarea></label>' +
      '<div class="field full"><label class="switch"><input type="checkbox" name="publish"' + (mission.publish ? ' checked' : '') + '> Autoriser la publication sur les réseaux connectés</label></div>' +
      '<div class="modal-actions" style="grid-column:1/-1"><button class="btn btn-ghost" type="button" data-act="media-back">Retour</button>' +
      '<button class="btn btn-primary" type="submit">⇄ Lancer les 4 agents</button></div></form>');
  }

  function mediaLaunchMission(mission) {
    if (!Cloud || !Cloud.configured()) return toast('Serveur non configuré.', true);
    toast('Les quatre agents travaillent à partir du média…');
    Cloud.runPipeline(mission).then(function (res) {
      state.pipelineResult = res;
      Store.log('Analyse média → mission : ' + String(mission.topic || '').slice(0, 90));
      Store.save();
      closeModal();
      go('collab');
      toast('Mission terminée · ' + ((res.stages || []).length) + ' étapes enregistrées');
      loadFiles();
    }).catch(function (e) { toast(e.message, true); });
  }

  /* ---------- Gestionnaire de fichiers local ---------- */
  function loadManager() {
    var F = window.TUSFiles;
    if (!F) return Promise.resolve();
    return Promise.all([
      F.allFolders(), F.listFolders(state.managerFolder), F.listFiles(state.managerFolder)
    ]).then(function (arr) {
      state.managerAll = arr[0] || [];
      state.managerFolders = arr[1] || [];
      state.managerFiles = arr[2] || [];
      var map = {};
      state.managerAll.forEach(function (f) { map[f.id] = f; });
      var parts = [], cur = map[state.managerFolder], guard = 0;
      while (cur && cur.id !== 'root' && guard++ < 30) {
        parts.unshift(cur.name);
        cur = map[cur.parent];
      }
      state.managerPath = parts.join(' / ') || 'Mes fichiers';
      if (page === 'manager') { content.innerHTML = views.manager(); bindManager(); }
    }).catch(function (e) { toast(e.message, true); });
  }

  function folderNewForm() {
    openModal('<h3>Nouveau dossier</h3><form id="folder-form" class="form-grid">' +
      '<label class="field full"><span>Nom du dossier</span><input name="name" required maxlength="80" placeholder="Ex. Contrats 2026"></label>' +
      '<label class="field full"><span>Couleur</span><select name="color">' +
      '<option value="red">Rouge</option><option value="blue">Bleu</option><option value="green">Vert</option><option value="amber">Ambre</option>' +
      '</select></label>' +
      '<div class="modal-actions" style="grid-column:1/-1"><button class="btn btn-ghost" type="button" data-act="modal-close">Annuler</button>' +
      '<button class="btn btn-primary" type="submit">Créer le dossier</button></div></form>');
  }

  function folderRenameForm(id) {
    var F = window.TUSFiles;
    if (!F) return;
    F.folder(id).then(function (f) {
      if (!f) return toast('Dossier introuvable', true);
      openModal('<h3>Renommer le dossier</h3><form id="folder-rename-form" class="form-grid" data-id="' + esc(id) + '">' +
        '<label class="field full"><span>Nouveau nom</span><input name="name" required maxlength="80" value="' + esc(f.name) + '"></label>' +
        '<div class="modal-actions" style="grid-column:1/-1"><button class="btn btn-ghost" type="button" data-act="modal-close">Annuler</button>' +
        '<button class="btn btn-primary" type="submit">Enregistrer</button></div></form>');
    }).catch(function (e) { toast(e.message, true); });
  }

  function folderDelete(id) {
    var F = window.TUSFiles;
    if (!F) return;
    F.folder(id).then(function (f) {
      confirmAction('Supprimer le dossier « ' + (f && f.name || id) + ' » ?',
        'Les sous-dossiers et tous les fichiers qu’ils contiennent seront aussi supprimés de cet appareil.',
        function () {
          F.deleteFolder(id).then(function (res) {
            if (state.managerFolder === id || (state.managerAll || []).some(function (x) { return x.id === state.managerFolder && x.parent === id; })) {
              state.managerFolder = 'root';
            }
            toast('Dossier supprimé · ' + (res.folders || 0) + ' dossier(s), ' + (res.files || 0) + ' fichier(s)');
            loadManager();
          }).catch(function (e) { toast(e.message, true); });
        });
    }).catch(function (e) { toast(e.message, true); });
  }

  function managerUpload(files) {
    var F = window.TUSFiles;
    if (!F) return;
    var list = Array.prototype.slice.call(files || []);
    if (!list.length) return;
    toast('Ajout de ' + list.length + ' fichier(s)…');
    F.addFiles(state.managerFolder, list).then(function (added) {
      Store.log('Gestionnaire : ' + added.length + ' fichier(s) ajouté(s) dans ' + state.managerPath);
      Store.save();
      toast(added.length + ' fichier(s) enregistré(s) sur cet appareil');
      loadManager();
    }).catch(function (e) { toast(e.message, true); });
  }

  function fileRenameLocalForm(id) {
    var F = window.TUSFiles;
    if (!F) return;
    F.getFile(id).then(function (f) {
      if (!f) return;
      openModal('<h3>Renommer le fichier</h3><form id="file-rename-local-form" class="form-grid" data-id="' + esc(id) + '">' +
        '<label class="field full"><span>Nouveau nom</span><input name="name" required maxlength="180" value="' + esc(f.name) + '"></label>' +
        '<div class="modal-actions" style="grid-column:1/-1"><button class="btn btn-ghost" type="button" data-act="modal-close">Annuler</button>' +
        '<button class="btn btn-primary" type="submit">Enregistrer</button></div></form>');
    }).catch(function (e) { toast(e.message, true); });
  }

  function fileMoveLocalForm(id) {
    var F = window.TUSFiles;
    if (!F) return;
    F.getFile(id).then(function (f) {
      if (!f) return;
      var folders = state.managerAll || [];
      openModal('<h3>Déplacer le fichier</h3><form id="file-move-local-form" class="form-grid" data-id="' + esc(id) + '">' +
        '<div class="field full"><div class="subtle small">Fichier : ' + esc(f.name) + '</div></div>' +
        '<label class="field full"><span>Dossier de destination</span><select name="folder">' +
        folders.map(function (d) {
          return '<option value="' + esc(d.id) + '"' + (d.id === f.folder ? ' selected' : '') + '>' +
            esc(F.pathOf(d.id, folders)) + '</option>';
        }).join('') + '</select></label>' +
        '<div class="modal-actions" style="grid-column:1/-1"><button class="btn btn-ghost" type="button" data-act="modal-close">Annuler</button>' +
        '<button class="btn btn-primary" type="submit">Déplacer</button></div></form>');
    }).catch(function (e) { toast(e.message, true); });
  }

  function fileAnalyzeLocal(id) {
    var F = window.TUSFiles;
    if (!F) return;
    if (!Cloud || !Cloud.configured()) return toast('Configurez le serveur sécurisé pour analyser ce fichier.', true);
    F.readAsDataURL(id).then(function (res) {
      var dataUrl = String(res.content || '');
      var comma = dataUrl.indexOf(',');
      if (comma < 0) throw new Error('Fichier illisible');
      toast('Analyse IA de ' + res.meta.name + '…');
      return Cloud.analyzeMedia({
        name: res.meta.name, mime: res.meta.mime, content: dataUrl.slice(comma + 1),
        company: Store.db.settings.activeCompany || '', project: '', question: ''
      });
    }).then(function (report) {
      state.lastMediaReport = report;
      showMediaReport(report, true);
    }).catch(function (e) { toast(e.message, true); });
  }

  function bindManager() {
    var input = $('#manager-input');
    if (input) input.addEventListener('change', function () { managerUpload(input.files); input.value = ''; });
    var camera = $('#manager-camera-input');
    if (camera) camera.addEventListener('change', function () { managerUpload(camera.files); camera.value = ''; });
    var zone = $('#drop-zone');
    if (zone) {
      ['dragenter', 'dragover'].forEach(function (ev) {
        zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.add('drag-over'); });
      });
      ['dragleave', 'drop'].forEach(function (ev) {
        zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.remove('drag-over'); });
      });
      zone.addEventListener('drop', function (e) {
        if (e.dataTransfer && e.dataTransfer.files) managerUpload(e.dataTransfer.files);
      });
    }
  }

  function downloadFile(id) {
    if (!Cloud) return;
    Cloud.downloadFile(id).then(function (res) {
      var raw = atob(res.content || '');
      var bytes = new Uint8Array(raw.length);
      for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([bytes], { type: (res.meta && res.meta.mime) || 'application/octet-stream' }));
      a.download = (res.meta && res.meta.name) || 'fichier';
      a.click();
      URL.revokeObjectURL(a.href);
    }).catch(function (e) { toast(e.message, true); });
  }
  function collabAnalyze() {
    var A = window.TUSCollabAuto;
    if (!A) return toast('Module d’analyse indisponible.', true);
    var folder = $('#pipeline-folder');
    toast('Analyse du dossier et des images en cours…');
    A.analyze(folder ? folder.value : '').then(function (r) {
      if (r.error) throw new Error(r.error);
      state.collabEvidence = r;
      var set = function (sel, value) { var el = $(sel); if (el && value) el.value = value; };
      set('#pipeline-company-name', r.company);
      set('#pipeline-sector', r.sector);
      set('#pipeline-topic', r.topic);
      set('#pipeline-client', r.client);
      if (!$('#pipeline-research').value.trim()) set('#pipeline-research', r.research);
      var box = $('#collab-analysis');
      if (box) box.textContent = 'Analyse terminée : ' + r.files + ' fichier(s), ' + r.images + ' image(s), entreprise « ' +
        (r.company || 'non identifiée') + ' », secteur « ' + (r.sector || 'non identifié') + ' ». Vérifiez les champs proposés.';
      toast('Champs remplis automatiquement à partir du dossier');
    }).catch(function (e) { toast(e.message || 'Analyse impossible', true); });
  }

  function runPipeline(form) {
    if (!Cloud || !Cloud.configured()) return toast('Configurez le serveur sécurisé dans les réglages.', true);
    var fd = new FormData(form);
    var client = (Store.clients() || []).find(function (c) { return c.id === fd.get('client'); }) || {};
    var company = String(fd.get('companyName') || fd.get('company') || client.name || '').trim();
    var sector = String(fd.get('sector') || '').trim();
    var folderId = String(fd.get('folder') || '');
    var folder = (state.collabFolders || []).find(function (f) { return f.id === folderId; }) || {};
    var evidence = state.collabEvidence || {};
    if (company && !(Store.companies() || []).some(function (c) { return String(c.name).toLowerCase() === company.toLowerCase(); })) {
      Store.add('companies', {
        name: company, sector: sector || evidence.sector || '', city: '',
        contact: client.name || '', phone: client.phone || '', email: client.email || ''
      });
    }
    var prefix = [
      client.name ? 'Client : ' + client.name : '',
      company ? 'Entreprise : ' + company : '',
      sector ? 'Secteur : ' + sector : '',
      folder.name ? 'Dossier : ' + folder.name : '',
      evidence.research || ''
    ].filter(Boolean).join('\n');
    var payload = {
      company: company, project: fd.get('project') || '',
      topic: fd.get('topic') || '',
      research: (prefix ? prefix + '\n\n' : '') + (fd.get('research') || ''),
      publish: !!fd.get('publish')
    };
    toast('Les quatre agents travaillent sur le dossier…');
    Cloud.runPipeline(payload).then(function (res) {
      state.pipelineResult = res;
      var published = (res.published || []).map(function (p) { return p.network + (p.ok ? ' ✓' : ' ✕'); }).join(' ');
      Store.log('Collaboration IA · ' + payload.company + ' / ' + payload.topic.slice(0, 80) +
        (published ? ' · publication : ' + published : ''));
      Store.save();
      toast('Mission terminée : 4 étapes enregistrées dans le dossier');
      go('collab');
      loadFiles();
    }).catch(function (e) { toast(e.message, true); });
  }
  function researchModal() {
    openModal('<h3>🔎 Fenêtre de recherche web</h3>' +
      '<p class="subtle small">La recherche est exécutée par Perplexity sur le serveur, avec ses sources. Le résultat est transmis à l’agent de conception.</p>' +
      '<form id="research-form" class="form-grid">' +
      '<label class="field full"><span>Que rechercher ?</span><input name="query" required placeholder="Ex. Pharmacies à Ouagadougou avec site web"></label>' +
      '<button class="btn btn-primary" type="submit" style="grid-column:1/-1">Lancer la recherche</button></form>' +
      '<div id="research-result" class="copy-box" style="margin-top:12px">Aucune recherche effectuée.</div>' +
      '<div class="modal-actions"><button class="btn btn-ghost" type="button" data-act="research-use">Utiliser ce résultat dans la mission</button>' +
      '<button class="btn btn-ghost" data-act="modal-close">Fermer</button></div>');
  }
  function researchRun(form) {
    if (!Cloud || !Cloud.configured()) return toast('Configurez le serveur sécurisé.', true);
    var q = new FormData(form).get('query');
    var box = $('#research-result');
    if (box) box.textContent = 'Recherche en cours sur le web…';
    Cloud.request('/api/ai', {
      provider: 'perplexity', prompt: 'Recherche web approfondie pour la prospection Touch Unique Studio au Burkina-Faso : ' + q +
        '\n\nDonne une liste factuelle avec noms, structures, signaux observables, sources URL et pistes d’approche. Signale ce qui n’est pas vérifiable.',
      system: 'Tu es un assistant de recherche factuelle. Cite tes sources. Ne prétends jamais avoir contacté une structure.',
      maxTokens: 1800
    }).then(function (r) {
      var text = r.text || '';
      state.lastResearch = text;
      if (box) box.textContent = text;
      toast('Recherche terminée · ' + (r.provider || 'perplexity'));
    }).catch(function (e) {
      if (box) box.textContent = 'Recherche impossible : ' + e.message;
      toast(e.message, true);
    });
  }
  function agentsConfig() {
    if (!Cloud || !Cloud.configured()) return toast('Configurez le serveur sécurisé.', true);
    Cloud.agents().then(function (res) {
      var agents = res.agents || [];
      openModal('<h3>Configuration des agents IA</h3><p class="subtle small">Chaque agent exécute fidèlement sa consigne et reçoit le travail des précédents.</p>' +
        '<form id="agents-form" class="form-grid">' + agents.map(function (a, i) {
          return '<div class="agent-edit" style="grid-column:1/-1"><b>' + esc(a.name || a.id) + '</b>' +
            '<div class="row"><label class="field"><span>Ordre</span><input type="number" name="order-' + i + '" value="' + Number(a.order || i + 1) + '" min="1" max="9"></label>' +
            '<label class="field"><span>Fournisseur</span><select name="provider-' + i + '">' +
            ['perplexity', 'gemini', 'anthropic', 'openai', 'auto'].map(function (p) {
              return '<option value="' + p + '"' + (a.provider === p ? ' selected' : '') + '>' + p + '</option>';
            }).join('') + '</select></label>' +
            '<label class="field"><span>Actif</span><select name="enabled-' + i + '"><option value="1"' + (a.enabled !== false ? ' selected' : '') + '>Oui</option><option value="0"' + (a.enabled === false ? ' selected' : '') + '>Non</option></select></label></div>' +
            '<label class="field full"><span>Consigne de l’agent</span><textarea name="prompt-' + i + '" rows="5">' + esc(a.prompt || '') + '</textarea></label></div>';
        }).join('') +
        '<div class="modal-actions" style="grid-column:1/-1"><button class="btn btn-ghost" type="button" data-act="modal-close">Annuler</button>' +
        '<button class="btn btn-primary" type="submit">Enregistrer la configuration</button></div></form>');
      var form = $('#agents-form');
      if (form) form.dataset.count = String(agents.length);
    }).catch(function (e) { toast(e.message, true); });
  }
  function robotEdit(id) {
    var R = window.TUSRobots;
    if (!R) return;
    var r = R.profile(id);
    if (!r) return;
    var icons = R.ICONS || [];
    openModal('<h3>Personnaliser « ' + esc(r.name) + ' »</h3>' +
      '<p class="subtle small">Le nom, l’icône 3D et le dossier de cette IA sont propres à ce robot. Les résultats générés y seront classés automatiquement.</p>' +
      '<form id="robot-profile-form" class="form-grid">' +
      '<label class="field full"><span>Nom affiché</span><input name="name" maxlength="60" required value="' + esc(r.name) + '"></label>' +
      '<div class="field full"><span>Icône 3D</span><div class="icon-picker">' + icons.map(function (it) {
        return '<label class="icon-choice' + (it.icon === r.icon ? ' selected' : '') + '"><input type="radio" name="icon" value="' + esc(it.icon) + '"' + (it.icon === r.icon ? ' checked' : '') + '>' +
          '<span class="robot-avatar ' + esc(r.color || 'blue') + '">' + esc(it.icon) + '</span><small>' + esc(it.label) + '</small></label>';
      }).join('') + '</div></div>' +
      '<label class="field full"><span>Couleur de l’icône</span><select name="color">' +
      (R.COLORS || ['red', 'blue', 'green', 'violet', 'amber', 'cyan']).map(function (c) {
        return '<option value="' + esc(c) + '"' + (c === r.color ? ' selected' : '') + '>' + esc(c) + '</option>';
      }).join('') + '</select></label>' +
      '<div class="field full"><span>Dossier dédié</span><div class="ai-folder-line">' + robotAvatar(r, true) +
      '<div><b>' + esc(r.folderName) + '</b><div class="subtle small">Créé dans le gestionnaire de fichiers de cet appareil.</div></div></div></div>' +
      '<div class="modal-actions" style="grid-column:1/-1"><button class="btn btn-ghost" type="button" data-act="modal-close">Annuler</button>' +
      '<button class="btn btn-primary" type="submit">Enregistrer</button></div></form>');
    var form = $('#robot-profile-form');
    if (form) form.dataset.id = id;
  }
  function robotFolder(id) {
    var R = window.TUSRobots;
    if (!R) return;
    R.ensureFolders().then(function () {
      var r = R.profile(id);
      if (!r || !r.folderId) return toast('Dossier indisponible sur cet appareil.', true);
      state.managerFolder = r.folderId;
      go('manager');
    });
  }
  function robotsConfigModal() {
    if (!Cloud || !Cloud.configured()) return toast('Configurez le serveur sécurisé.', true);
    Cloud.robotsConfig().then(function (res) {
      var robots = res.robots || [];
      openModal('<h3>Configuration des robots quotidiens</h3><p class="subtle small">Chaque robot a son heure, son fournisseur et sa consigne. Le serveur exécute ceux qui sont dus.</p>' +
        '<form id="robots-config-form" class="form-grid">' + robots.map(function (r, i) {
          var local = window.TUSRobots ? window.TUSRobots.profile(r.id) || {} : {};
          var icons = (window.TUSRobots && window.TUSRobots.ICONS) || [];
          return '<div class="agent-edit" style="grid-column:1/-1"><b>' + esc(r.icon || '✺') + ' ' + esc(r.name) + '</b>' +
            '<div class="row"><label class="field"><span>Nom personnalisé</span><input name="name-' + i + '" maxlength="60" value="' + esc(local.custom ? local.name : (r.name || '')) + '"></label>' +
            '<label class="field"><span>Icône 3D</span><select name="icon-' + i + '">' +
            (icons.length ? icons : [{ icon: r.icon || '🤖', label: 'Actuelle' }]).map(function (it) {
              return '<option value="' + esc(it.icon) + '"' + (it.icon === (local.icon || r.icon) ? ' selected' : '') + '>' + esc(it.icon + ' ' + it.label) + '</option>';
            }).join('') + '</select></label></div>' +
            '<div class="row"><label class="field"><span>Actif</span><select name="enabled-' + i + '"><option value="1"' + (r.enabled !== false ? ' selected' : '') + '>Oui</option><option value="0"' + (r.enabled === false ? ' selected' : '') + '>Non</option></select></label>' +
            '<label class="field"><span>Heure</span><input type="number" name="hour-' + i + '" value="' + Number(r.hour || 8) + '" min="0" max="23"></label>' +
            '<label class="field"><span>Fournisseur</span><select name="provider-' + i + '">' +
            ['auto', 'perplexity', 'gemini', 'anthropic', 'openai'].map(function (p) {
              return '<option value="' + p + '"' + ((r.provider || 'auto') === p ? ' selected' : '') + '>' + p + '</option>';
            }).join('') + '</select></label></div>' +
            '<label class="field full"><span>Sujet quotidien</span><textarea name="topic-' + i + '" rows="3">' + esc(r.topic || '') + '</textarea></label></div>';
        }).join('') +
        '<div class="modal-actions" style="grid-column:1/-1"><button class="btn btn-ghost" type="button" data-act="modal-close">Annuler</button>' +
        '<button class="btn btn-primary" type="submit">Enregistrer</button></div></form>');
      var form = $('#robots-config-form');
      if (form) form.dataset.count = String(robots.length);
    }).catch(function (e) { toast(e.message, true); });
  }
  function accountRemove(id) {
    confirmAction('Retirer cette connexion ?', 'Le secret sera supprimé du coffre chiffré sur le serveur.', function () {
      Cloud.credentials(id, '').then(function () { toast('Connexion retirée'); refreshCloud(); }).catch(function (e) { toast(e.message, true); });
    });
  }
  function refreshCloud() {
    if (!Cloud) return Promise.resolve();
    if (!Cloud.configured()) {
      state.cloudInfo = null;
      state.oauthInfo = null;
      refreshConnections();
      if (page === 'settings') go('settings');
      return Promise.resolve();
    }
    return Promise.all([
      Cloud.status(),
      Accounts && Accounts.available() ? Cloud.googleStatus().catch(function () { return null; }) : Promise.resolve(null),
      Cloud.oauthProviders().catch(function () { return null; })
    ]).then(function (arr) {
      state.cloudInfo = arr[0];
      state.oauthInfo = (arr[2] && arr[2].providers) || (arr[0] && arr[0].oauth) || null;
      refreshConnections();
      if (page === 'settings' || page === 'collab' || page === 'robots') go(page);
    });
  }
  function googleSync() {
    if (!Cloud) return;
    var payload = JSON.parse(Store.exportData());
    payload.exportedAt = Store.now();
    payload.origin = 'Touch Unique Studio';
    toast('Synchronisation avec Google Drive…');
    Cloud.googleSync(payload).then(function (res) {
      Store.log('Sauvegarde Drive : ' + (res.name || res.id));
      Store.save();
      toast('Sauvegarde envoyée : ' + (res.name || ''));
    }).catch(function (e) { toast(e.message, true); });
  }
  function googleBackups() {
    if (!Cloud) return;
    Cloud.googleBackups().then(function (list) {
      openModal('<h3>Sauvegardes Google Drive</h3>' + (list.length ? '<div class="list">' + list.map(function (f) {
        return '<div class="list-row"><div class="row-main"><b>' + esc(f.name) + '</b><small>' + esc(f.createdTime || '') + ' · ' + esc(f.id) + '</small></div>' +
          '<button class="btn btn-ghost btn-sm" data-act="google-restore" data-id="' + esc(f.id) + '">Restaurer</button></div>';
      }).join('') + '</div>' : '<div class="empty">Aucune sauvegarde pour le moment.</div>') +
        '<div class="modal-actions"><button class="btn btn-ghost" data-act="modal-close">Fermer</button></div>');
    }).catch(function (e) { toast(e.message, true); });
  }
  function googleRestore(id) {
    confirmAction('Restaurer cette sauvegarde ?', 'Les données locales actuelles seront remplacées par la version choisie.', function () {
      Cloud.googleRestore(id).then(function (data) {
        Store.importData(JSON.stringify(data), { confirmed: true });
        toast('Sauvegarde restaurée');
        go('home');
      }).catch(function (e) { toast(e.message, true); });
    });
  }

  /* ---------- Événements ---------- */
  /* ---------- Messagerie du site et prospects ---------- */
  function msgAttachment(m) {
    if (!m.attachment) return '';
    var M = window.TUSMessages || {};
    var label = m.kind === 'voice' ? '▶ Message vocal' : m.kind === 'photo' ? '🖼️ Photo' : '📎 Fichier';
    var raw = m.attachment.url;
    var href = safeAttachment(M.urlFor ? M.urlFor(raw) : raw);
    if (!href) return '<span class="subtle small">Pièce jointe indisponible</span>';
    return '<a href="' + href + '" target="_blank" rel="noopener noreferrer">' + label + '</a>';
  }

  function refreshInbox(quiet) {
    var M = window.TUSMessages;
    var box = $('#msg-inbox');
    if (!M || !M.server()) {
      if (box) box.innerHTML = '<div class="empty">Configurez l’URL du serveur dans les réglages pour recevoir les messages du site.</div>';
      return Promise.resolve(false);
    }
    return M.list(state.msgThread || '', '', true).then(function (res) {
      var before = window.TUSProspects ? window.TUSProspects.list().length : 0;
      state.msgThreads = res.threads || [];
      var threads = state.msgThreads;
      if (threads.length && (!state.msgThread || !threads.some(function (t) { return t.id === state.msgThread; }))) {
        state.msgThread = threads[0].id;
      }
      var select = $('#msg-thread');
      if (select) {
        select.innerHTML = '<option value="">Toutes les conversations</option>' + threads.map(function (t) {
          return '<option value="' + esc(t.id) + '">' + esc((t.client && t.client.name) || t.id) + '</option>';
        }).join('');
        select.value = state.msgThread || '';
      }
      var messages = [];
      threads.forEach(function (t) {
        if (state.msgThread && t.id !== state.msgThread) return;
        (t.messages || []).forEach(function (m) { messages.push(Object.assign({ thread: t.id, client: t.client }, m)); });
        (t.messages || []).forEach(function (m) {
          if (m.direction !== 'out' && window.TUSProspects) window.TUSProspects.fromMessage(m, t.id);
        });
      });
      messages.sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); });
      if (box) {
        box.innerHTML = messages.length ? messages.slice(-120).map(function (m) {
          var mine = m.direction === 'out';
          return '<div class="msg-item ' + (mine ? 'out' : 'in') + '">' +
            '<div class="msg-meta">' + esc(m.name || (mine ? 'Vous' : (m.client && m.client.name) || 'Visiteur')) +
            ' · ' + esc((m.at || '').replace('T', ' ').slice(0, 16)) + '</div>' +
            (m.text ? '<div class="msg-text">' + nl(m.text) + '</div>' : '') + msgAttachment(m) + '</div>';
        }).join('') : '<div class="empty">Aucun message pour le moment. Les messages du site apparaîtront ici.</div>';
      }
      var badge = $('#msg-status');
      if (badge) { badge.textContent = messages.length + ' message(s) · ' + threads.length + ' conversation(s)'; badge.className = 'chip green'; }
      var after = window.TUSProspects ? window.TUSProspects.list().length : 0;
      if (after > before && page === 'prospect') go('prospect');
      return true;
    }).catch(function (e) {
      if (box && !quiet) box.innerHTML = '<div class="empty">Serveur indisponible : ' + esc(e.message) + '</div>';
      var badge = $('#msg-status');
      if (badge) { badge.textContent = e.message; badge.className = 'chip red'; }
      return false;
    });
  }

  function msgSend(text, file, kind) {
    var M = window.TUSMessages;
    if (!M || !M.server()) return toast('Serveur non configuré dans les réglages.', true);
    if (!state.msgThread) return toast('Choisissez une conversation dans la liste.', true);
    var badge = $('#msg-status');
    if (badge) badge.textContent = 'Envoi du message en cours…';
    return M.send({ thread: state.msgThread, admin: true, text: text || '', file: file, kind: kind }).then(function (res) {
      toast('Réponse enregistrée sur le serveur.');
      return refreshInbox(true);
    }).catch(function (e) { toast(e.message, true); });
  }

  function startNativePollingSilent() {
    var bridge = nativeBridge();
    if (!bridge || !bridge.configureMessages || !window.TUSMessages || !window.TUSMessages.server()) return;
    try {
      bridge.configureMessages(window.TUSMessages.server(), window.TUSMessages.apiKey());
      bridge.startMessagePolling();
    } catch (e) { /* configuration incomplète */ }
  }

  function startNativePolling() {
    var bridge = nativeBridge();
    if (!bridge || !bridge.configureMessages) return toast('Notifications hors application disponibles sur Android.', true);
    try {
      bridge.configureMessages(window.TUSMessages.server(), window.TUSMessages.apiKey());
      bridge.startMessagePolling();
      toast('Notifications activées même quand l’application est fermée.');
    } catch (e) { toast(e.message, true); }
  }

  function prospectForm() {
    openModal('<h3>Ajouter un prospect</h3><form id="prospect-form" class="form-grid">' +
      '<label class="field full"><span>Nom / entreprise</span><input name="name" required></label>' +
      '<label class="field"><span>Téléphone</span><input name="phone" placeholder="+226 …"></label>' +
      '<label class="field"><span>E-mail</span><input name="email" type="email"></label>' +
      '<label class="field"><span>Ville</span><input name="city"></label>' +
      '<label class="field"><span>Source</span><input name="source" value="Manuel"></label>' +
      '<label class="field full"><span>Besoin identifié</span><textarea name="need" rows="3"></textarea></label>' +
      '<div class="modal-actions" style="grid-column:1/-1"><button class="btn btn-primary" type="submit">Enregistrer</button>' +
      '<button class="btn btn-ghost" type="button" data-act="modal-close">Annuler</button></div></form>');
  }

  function prospectImagesModal() {
    var P = window.TUSProspects || { domains: function () { return []; } };
    var opts = (P.domains ? P.domains() : []).map(function (d) {
      return '<option value="' + esc(d.id) + '">' + esc(d.label) + '</option>';
    }).join('');
    openModal('<h3>🖼️ Analyser un lot d’images</h3>' +
      '<form id="prospect-images-form" class="form-grid">' +
      '<label class="field full"><span>Photos, captures ou documents image (plusieurs possibles)</span>' +
      '<input name="files" type="file" accept="image/*" multiple required></label>' +
      '<label class="field full"><span>Photo directe (appareil photo)</span>' +
      '<input name="camera" type="file" accept="image/*" capture="environment"></label>' +
      '<label class="field full"><span>Domaine à forcer (facultatif)</span>' +
      '<select name="domain"><option value="auto">Détection automatique</option>' + opts + '</select></label>' +
      '<div class="subtle small" style="grid-column:1/-1">Les fiches issues des images restent dans le bac « Images », séparé des prospects trouvés en ligne. ' +
      'L’IA distante est utilisée si le serveur sécurisé est configuré ; sinon une analyse locale indicative est enregistrée avec une confiance faible.</div>' +
      '<div class="modal-actions" style="grid-column:1/-1"><button class="btn btn-primary" type="submit">Lancer l’analyse du lot</button>' +
      '<button class="btn btn-ghost" type="button" data-act="modal-close">Annuler</button></div></form>');
  }

  function localImageReport(file, domain) {
    var base = String(file.name || 'image').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
    var P = window.TUSProspects || {};
    var cls = P.domainById && domain && domain !== 'auto' ? P.domainById(domain) : (P.classify ? P.classify(base) : { id: 'autre', label: 'Autre domaine', offers: [] });
    return {
      name: file.name || 'image',
      summary: 'Image « ' + base + ' » importée pour analyse. Lecture différée : configurez le serveur IA pour extraire les textes visibles.',
      details: ['Fichier local : ' + base],
      entities: { names: [base] },
      suggestedMission: '',
      confidence: 'faible',
      local: true
    };
  }

  function prospectImageAnalyze(form) {
    var P = window.TUSProspects;
    if (!P) return toast('Module Prospect indisponible.', true);
    var fd = new FormData(form);
    var files = Array.prototype.slice.call(fd.getAll('files') || []).filter(function (f) { return f && f.size; });
    var camera = fd.get('camera');
    if (camera && camera.size) files.push(camera);
    if (!files.length) return toast('Choisissez au moins une image.', true);
    if (files.length > 80) files = files.slice(0, 80);
    var forced = String(fd.get('domain') || 'auto');
    var online = !!(Cloud && Cloud.configured());
    openModal('<h3>Analyse du lot en cours…</h3>' +
      '<div class="subtle small">Mode ' + (online ? 'IA distante' : 'local indicatif') + ' · ' + files.length + ' image(s)</div>' +
      '<div class="prospect-progress"><span id="prospect-progress-bar" style="width:0%"></span></div>' +
      '<div id="prospect-progress" class="subtle small" style="margin-top:8px">0 / ' + files.length + '</div>');
    var done = 0, added = 0;
    function next() {
      if (done >= files.length) {
        closeModal();
        state.prospectBucket = 'images';
        state.prospectDomain = 'tous';
        go('prospect');
        toast(added + ' fiche(s) image classée(s) dans le bac séparé.');
        return;
      }
      var file = files[done];
      var label = $('#prospect-progress');
      if (label) label.textContent = (done + 1) + ' / ' + files.length + ' · ' + file.name;
      var bar = $('#prospect-progress-bar');
      if (bar) bar.style.width = Math.round(done / files.length * 100) + '%';
      function finish(report) {
        try {
          var p = P.fromImageReport(report, { name: file.name, forcedDomain: forced });
          if (p) added++;
        } catch (e) { Store.log('Erreur classement image ' + file.name + ' : ' + e.message); }
        done++;
        Store.save();
        next();
      }
      if (!online) return finish(localImageReport(file, forced));
      fileToPayload(file, {
        company: '', project: 'Prospection images',
        question: 'Extraire le nom de l’entreprise, les contacts, l’adresse, le domaine d’activité et les services que Touch Unique Studio peut proposer.'
      }).then(function (payload) {
        return Cloud.analyzeMedia(payload).catch(function (e) {
          var r = localImageReport(file, forced);
          r.error = e.message;
          return r;
        });
      }).then(finish).catch(function (e) {
        var r = localImageReport(file, forced);
        r.error = e.message;
        finish(r);
      });
    }
    next();
  }

  function prospectAction(act, id) {
    var P = window.TUSProspects;
    var p = (P && P.list() || []).find(function (x) { return x.id === id; });
    if (!p) return;
    if (act === 'prospect-status') {
      Store.update('prospects', id, { status: p.status === 'contacté' ? 'à contacter' : 'contacté' });
      toast('Statut mis à jour'); go('prospect');
    } else if (act === 'prospect-client') {
      if ((Store.db.clients || []).some(function (c) { return c.name === p.name; })) return toast('Client déjà enregistré.', true);
      Store.add('clients', { name: p.name, phone: p.phone || '', email: p.email || '', city: p.city || '', source: p.source || 'Prospect', createdAt: Store.now() });
      toast('Client créé à partir du prospect'); go('clients');
    } else if (act === 'prospect-delete') {
      confirmAction('Supprimer ce prospect ?', 'La fiche sera retirée de votre espace.', function () {
        Store.remove('prospects', id); toast('Prospect supprimé'); go('prospect');
      });
    }
  }

  var ACTIONS = {
    'run-autopilot': runAutopilot,
    'robots-status': refreshRobotStatus,
    'collab-analyze': collabAnalyze,
    'robot-edit': robotEdit,
    'robot-folder': robotFolder,
    'robot-local': robotLocal,
    'robot-dry': function (id) { robotExecute(id, true); },
    'robot-run': function (id) {
      confirmAction('Exécuter ce robot ?', 'Le contenu sera généré par l’IA connectée et, pour la publication, envoyé aux réseaux dont les tokens sont configurés.', function () { robotExecute(id, false); });
    },
    'robot-run-all': function () {
      confirmAction('Exécuter tous les robots ?', 'Quatre tâches seront générées. La publication n’aura lieu que sur les comptes réellement connectés.', function () {
        var R = window.TUSRobots;
        if (!R || !R.configured()) return toast('Configurez le serveur sécurisé dans les réglages.', true);
        toast('Exécution des quatre robots…');
        R.run('all').then(function (res) {
          var results = (res && res.results) || [];
          results.forEach(function (out) {
            var r = R.robots.find(function (x) { return x.id === out.id; });
            if (r && out.ok) R.record(r, Object.assign({ ok: true }, out));
          });
          Store.log('File de robots exécutée : ' + results.filter(function (x) { return x.ok; }).length + '/' + results.length);
          Store.save();
          toast('Robots terminés');
          refreshRobotStatus();
        }).catch(function (err) { toast(err.message, true); });
      });
    },
    'go-content': function () { go('content'); },
    'go-leads': function () { go('leads'); },
    'task-done': function (id) { Store.update('tasks', id, { status: 'terminée' }); toast('Tâche terminée'); go(page); },
    'new-project': newProject,
    'project-detail': projectDetail,
    'project-tasks': function (id) {
      var p = (Store.db.projects || []).find(function (x) { return x.id === id; });
      if (!p || !A.tasksForProject) return;
      A.tasksForProject(p).forEach(function (t) { Store.add('tasks', t); });
      toast('Tâches générées par l’IA'); go(page);
    },
    'project-advance': function (id) {
      var order = ['brief', 'conception', 'production', 'livré'];
      var p = (Store.db.projects || []).find(function (x) { return x.id === id; });
      if (!p) return;
      var i = order.indexOf(p.status);
      var next = order[Math.min(order.length - 1, i + 1)];
      Store.update('projects', id, { status: next });
      Store.log(p.name + ' → ' + next);
      toast('Projet avancé : ' + next); go(page);
    },
    'sync-leads': function () { var n = Store.syncSiteLeads(); toast(n ? n + ' nouvelle(s) demande(s)' : 'Aucune nouvelle demande'); go(page); },
    'leads-read': function () { (Store.db.leads || []).forEach(function (l) { l.seen = true; }); Store.save(); toast('Demandes marquées traitées'); go(page); },
    'lead-convert': leadConvert,
    'lead-done': function (id) { var l = Store.db.leads.find(function (x) { return x.id === id; }); Store.update('leads', id, { seen: !l.seen }); go(page); },
    'lead-delete': function (id) { confirmAction('Supprimer cette demande ?', 'Cette action retire la demande de l’application.', function () { Store.remove('leads', id); toast('Demande supprimée'); go(page); }); },
    'content-reuse': function (id) {
      var c = (Store.db.contents || []).find(function (x) { return x.id === id; });
      if (!c) return;
      state.lastContent = c.data || A.content({ theme: c.theme, type: c.type });
      go('content');
    },
    'content-copy': function () { if (state.lastContent) copy(state.lastContent.captions.join('\n\n---\n\n')); },
    'content-social': function () {
      if (!state.lastContent) return;
      Store.add('social', { platform: 'instagram', text: state.lastContent.captions[0], status: 'à valider', scheduledAt: Store.now(), source: 'IA' });
      Store.db.stats.social = (Store.db.stats.social || 0) + 1; Store.save();
      toast('Ajouté à la file sociale'); go('social');
    },
    'social-add-form': socialAddForm,
    'social-export': exportCSV,
    'social-copy': function (id) { var s = (Store.db.social || []).find(function (x) { return x.id === id; }); if (s) copy(s.text); },
    'social-publish': function (id) {
      var s = (Store.db.social || []).find(function (x) { return x.id === id; });
      if (!s) return;
      Store.update('social', id, { status: s.status === 'publié' ? 'à valider' : 'publié', publishedAt: Store.now() });
      toast(s.status === 'publié' ? 'Statut réouvert' : 'Marqué publié'); go(page);
    },
    'social-delete': function (id) { Store.remove('social', id); toast('Publication supprimée'); go(page); },
    'msg-refresh': function () { refreshInbox().then(function (ok) { if (ok) toast('Conversations actualisées'); }); },
    'msg-perm': function (kind) {
      if (!window.TUSMessages) return toast('Module de messagerie indisponible.', true);
      var bridge = nativeBridge();
      if (bridge && bridge.requestPermissions) bridge.requestPermissions();
      window.TUSMessages.askPermission(kind === 'micro' ? 'micro' : 'camera')
        .then(function (r) { toast(r.message); });
    },
    'msg-push': function () {
      if (!window.TUSMessages) return toast('Module de messagerie indisponible.', true);
      if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then(function (reg) {
          return window.TUSMessages.subscribe(reg, 'admin', state.msgThread || 'admin');
        }).then(function () { toast('Notifications push activées.'); })
          .catch(function (e) { toast(e.message, true); });
      } else startNativePolling();
    },
    'msg-native-poll': startNativePolling,
    'msg-record': function () {
      if (!window.TUSMessages) return toast('Module de messagerie indisponible.', true);
      if (state.msgRec && state.msgRec.active()) {
        var btn = $('[data-act="msg-record"]');
        if (btn) btn.textContent = '● Enregistrer un vocal';
        state.msgRec.stop().then(function (blob) {
          state.msgRec = null;
          msgSend('Message vocal', blob, 'voice');
        }).catch(function (e) { toast(e.message, true); state.msgRec = null; });
        return;
      }
      state.msgRec = window.TUSMessages.recorder();
      if (!state.msgRec) return toast('Enregistrement indisponible sur cet appareil.', true);
      state.msgRec.start().then(function () {
        var btn = $('[data-act="msg-record"]');
        if (btn) btn.textContent = '■ Arrêter et envoyer';
        toast('Enregistrement en cours…');
      }).catch(function (e) { toast(e.message, true); state.msgRec = null; });
    },
    'prospect-add-form': prospectForm,
    'prospect-images-modal': prospectImagesModal,
    'prospect-bucket': function (id) { state.prospectBucket = id === 'images' ? 'images' : 'online'; state.prospectDomain = 'tous'; go('prospect'); },
    'prospect-status': function (id) { prospectAction('prospect-status', id); },
    'prospect-client': function (id) { prospectAction('prospect-client', id); },
    'prospect-delete': function (id) { prospectAction('prospect-delete', id); },
    'shop-recommend': function () { Store.db.shop.suggestions = A.shopActions(Store.products(), Store.db.leads || []); Store.save(); toast('Suggestions actualisées'); go(page); },
    'shop-new': shopNewForm,
    'shop-edit': shopEdit,
    'shop-delete': function () {
      var form = $('#shop-form');
      var id = form && form.dataset.id;
      if (!id) return closeModal();
      confirmAction('Supprimer cette offre ?', 'Elle sera retirée du catalogue sur le site et sur le serveur synchronisé.', function () {
        if (window.TUSCatalog) { window.TUSCatalog.removeProduct(id); closeModal(); toast('Offre supprimée'); go('shop'); }
      });
    },
    'shop-image-remove': function () {},
    'shop-image-left': function () {},
    'shop-copy': function (id) {
      var p = Store.products().find(function (x) { return x.id === id; });
      if (!p || !A.offerCopy) return;
      var o = A.offerCopy(p);
      copy([o.headline].concat(o.bullets, o.note).join('\n'));
    },
    'client-add-form': clientForm,
    'client-delete': function (id) { Store.remove('clients', id); toast('Client supprimé'); go(page); },
    'academy-open': function (id) {
      var p = (C.academy && C.academy.offerings || []).find(function (x) { return x.id === id; }) ||
        Store.products().find(function (x) { return x.id === id; });
      if (!p) return;
      var details = p.details || p.deliverables || [];
      var meta = p.price ? '<div class="row" style="gap:6px;margin:8px 0"><span class="chip red">' + money(p.price) + '</span>' +
        (p.duration ? '<span class="chip blue">' + esc(p.duration) + '</span>' : '') +
        (p.level ? '<span class="chip gray">' + esc(p.level) + '</span>' : '') + '</div>' : '';
      openModal('<h3>' + esc(p.name) + '</h3><p class="subtle">' + esc(p.short || p.desc || '') + '</p>' + meta +
        '<h4 style="margin:12px 0 6px">Programme</h4>' +
        '<ul class="modal-list">' + details.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul>' +
        '<div class="modal-actions"><a class="btn btn-primary" href="' + esc(waLink('Bonjour Touch Unique, je veux m’inscrire à ' + p.name)) + '" target="_blank" rel="noopener">S’inscrire</a>' +
        '<button class="btn btn-ghost" data-act="modal-close">Fermer</button></div>');
    },
    'native-permissions': function () {
      var bridge = nativeBridge();
      if (!bridge || !bridge.requestPermissions) {
        return toast('Disponible dans l’application Android.', true);
      }
      bridge.requestPermissions();
      toast('Demande d’autorisation envoyée sur Android.');
    },
    'native-overlay': function () {
      var bridge = nativeBridge();
      if (!bridge || !bridge.requestOverlay) {
        return toast('Disponible dans l’application Android.', true);
      }
      bridge.requestOverlay();
      toast('Activez la superposition dans les réglages Android.');
    },
    'settings-export': function () {
      var data = Store.exportData();
      var name = 'touchunique-sauvegarde-' + new Date().toISOString().slice(0, 10) + '.json';
      var bridge = nativeBridge();
      if (bridge && bridge.downloadText) {
        try {
          var where = bridge.downloadText(name, data, 'application/json');
          toast(where ? ('Sauvegarde enregistrée : ' + where) : 'Sauvegarde enregistrée sur l’appareil');
        } catch (err) { toast(err.message || 'Export impossible', true); }
        return;
      }
      try {
        var blob = new Blob([data], { type: 'application/json' });
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
        toast('Sauvegarde téléchargée');
      } catch (err) { toast(err.message || 'Export impossible', true); }
    },
    'settings-import': function () {
      var bridge = nativeBridge();
      if (bridge && bridge.pickText) {
        try { bridge.pickText(); toast('Choisissez votre fichier de sauvegarde.'); }
        catch (err) { toast(err.message || 'Import impossible', true); }
        return;
      }
      var input = $('#import-file');
      if (input) input.click();
      else toast('Champ d’import introuvable', true);
    },
    'settings-reset': function () { confirmAction('Réinitialiser les données ?', 'Les données locales actuelles seront remplacées par un espace vide.', function () { Store.reset(false); toast('Données réinitialisées'); go('home'); }); },
    'company-form': companyForm,
    'company-activate': function (id) {
      Store.db.settings.activeCompany = id; Store.save(); toast('Entreprise active : ' + id); go(page);
    },
    'company-project': function (id) { companyProject(id); },
    'company-files': function (id) { state.fileCompany = id; state.fileProject = ''; go('files'); loadFiles(); },
    'company-collab': function (id) {
      Store.db.settings.activeCompany = id; Store.save();
      state.pipelineResult = null; go('collab'); refreshCloud();
    },
    'company-delete': function (id) {
      confirmAction('Supprimer cette entreprise ?', 'Ses projets et dossiers resteront conservés, l’espace sera retiré de la liste.', function () {
        Store.remove('companies', id); toast('Entreprise retirée'); go(page);
      });
    },
    'files-refresh': function () { loadFiles().then(function (n) { toast(n + ' fichier(s) sur le serveur'); go(page); }); },
    'files-note': fileNoteForm,
    'media-open': mediaModal,
    'media-report': function () { showMediaReport(state.lastMediaReport, false); },
    'file-analyze': analyzeExistingFile,
    'media-launch': function () { mediaLaunchMission(state.mediaMissionDraft); },
    'media-edit-mission': mediaMissionEditor,
    'media-back': function () { showMediaReport(state.lastMediaReport, false); },
    'media-copy': function () {
      if (!state.lastMediaReport) return;
      copy([state.lastMediaReport.summary, state.lastMediaReport.suggestedMission].filter(Boolean).join('\n\n'));
    },
    'folder-new': folderNewForm,
    'folder-open': function (id) { state.managerFolder = id; loadManager(); },
    'folder-rename': folderRenameForm,
    'folder-delete': folderDelete,
    'manager-refresh': function () { loadManager().then(function () { toast('Gestionnaire actualisé'); }); },
    'file-rename-local': fileRenameLocalForm,
    'file-move-local': fileMoveLocalForm,
    'file-download-local': function (id) {
      if (window.TUSFiles) window.TUSFiles.downloadFile(id).catch(function (e) { toast(e.message, true); });
    },
    'file-delete-local': function (id) {
      confirmAction('Supprimer ce fichier ?', 'Le fichier sera retiré définitivement de cet appareil.', function () {
        if (!window.TUSFiles) return;
        window.TUSFiles.deleteFile(id).then(function () { toast('Fichier supprimé'); loadManager(); })
          .catch(function (e) { toast(e.message, true); });
      });
    },
    'file-analyze-local': fileAnalyzeLocal,
    'file-download': downloadFile,
    'file-delete': function (id) {
      confirmAction('Supprimer ce fichier ?', 'Le fichier sera retiré du dossier classé sur le serveur.', function () {
        Cloud.deleteFile(id).then(function () { toast('Fichier supprimé'); loadFiles().then(function () { go(page); }); })
          .catch(function (e) { toast(e.message, true); });
      });
    },
    'research-open': researchModal,
    'research-use': function () {
      var box = $('#pipeline-research');
      if (box && state.lastResearch) box.value = state.lastResearch;
      closeModal();
      toast('Recherche transmise à la mission');
    },
    'agents-config': agentsConfig,
    'robots-config': robotsConfigModal,
    'cloud-refresh': function () { refreshCloud().then(function () { toast('État des connexions actualisé'); }); },
    'account-remove': accountRemove,
    'account-logout': function () {
      confirmAction('Verrouiller l’application ?', 'Vous devrez saisir votre e-mail et votre mot de passe pour rouvrir l’espace.', function () {
        if (window.TUSetup) window.TUSetup.lock(boot);
      });
    },
    'qr-show': function () {
      if (!window.TUSQRSync) return toast('Module QR indisponible.', true);
      try {
        var code = window.TUSQRSync.makeSync();
        var panel = $('#qr-settings-panel'); if (panel) panel.hidden = false;
        var img = $('#qr-settings-image'); if (img) { img.src = window.TUSQRSync.image(code, 5); img.hidden = false; }
        var text = $('#qr-settings-text'); if (text) text.value = code;
        toast('Code QR prêt : scannez-le depuis votre autre appareil.');
      } catch (e) { toast(e.message, true); }
    },
    'qr-scan': function () {
      var panel = $('#qr-settings-panel'); if (panel) panel.hidden = false;
      var file = $('#qr-settings-file'); if (file) file.click();
    },
    'qr-paste': function () {
      var panel = $('#qr-settings-panel'); if (panel) panel.hidden = false;
      var text = $('#qr-settings-text'); if (text) text.focus();
    },
    'qr-close': function () {
      var panel = $('#qr-settings-panel'); if (panel) panel.hidden = true;
    },
    'qr-apply': function () {
      if (!window.TUSQRSync) return toast('Module QR indisponible.', true);
      var text = $('#qr-settings-text');
      try {
        var res = window.TUSQRSync.apply(text ? text.value : '');
        if (res.pending) {
          toast('Compte importé. Verrouillez l’espace et saisissez votre mot de passe sur cet appareil.');
          if (window.TUSetup) window.TUSetup.lock(boot);
          return;
        }
        toast('Connexion ' + (res.kind === 'login' ? 'effectuée' : 'et synchronisation terminée') + ' · ' + (res.user && res.user.email || ''));
        render();
      } catch (e) { toast(e.message, true); }
    },
    'updates-check': function () {
      if (!window.TUSUpdates) return;
      toast('Vérification du serveur de mises à jour…');
      window.TUSUpdates.check().then(function (s) {
        state.update = s;
        paintUpdateBanner(s);
        var msg = s.error ? s.error : (s.updated ? ('Version ' + s.installed + ' installée')
          : (s.available ? ('Mise à jour disponible : ' + s.available) : 'Aucune nouvelle version'));
        toast(msg, !!s.error);
        paintUpdates(s);
      }).catch(function (e) { toast(e.message, true); paintUpdates(); });
    },
    'google-connect': function () {
      if (!Cloud) return;
      toast('Ouverture de Google…');
      Cloud.googleConnect().then(function (ok) {
        toast(ok ? 'Google Drive connecté' : 'Connexion Google interrompue', !ok);
        refreshCloud();
      }).catch(function (e) { toast(e.message, true); });
    },
    'oauth-connect': function (id) {
      if (!Cloud) return;
      if (id === 'google') return ACTIONS['google-connect']();
      toast('Ouverture de ' + id + '…');
      Cloud.oauthConnect(id).then(function () {
        toast('Connexion réussie'); refreshCloud();
      }).catch(function (e) { toast(e.message, true); });
    },
    'oauth-disconnect': function (id) {
      if (!Cloud) return;
      confirmAction('Retirer cette connexion ?', 'Le jeton sera supprimé du coffre chiffré sur le serveur.', function () {
        Cloud.oauthDisconnect(id).then(function () {
          toast('Connexion retirée'); refreshCloud();
        }).catch(function (e) { toast(e.message, true); });
      });
    },
    'google-sync': googleSync,
    'google-backups': googleBackups,
    'google-restore': googleRestore,
    'modal-close': closeModal,
    'notifications': function () {
      openModal('<h3>Notifications</h3><div class="activity">' + (Store.db.logs || []).slice(0, 10).map(function (l) {
        return '<div class="log-line"><time>' + time(l.at) + '</time><span>' + esc(l.text) + '</span></div>';
      }).join('') + '</div><div class="modal-actions"><button class="btn btn-ghost" data-act="modal-close">Fermer</button></div>');
    }
  };

  function bindGlobal() {
    window.__tusImportCallback = function (text, name) {
      confirmAction('Importer cette sauvegarde ?', 'Les données locales actuelles seront remplacées par le fichier choisi.', function () {
        try {
          Store.importData(text, { confirmed: true });
          var issue = Store.storageError && Store.storageError();
          toast(issue ? ('Importé, mais non enregistré sur l’appareil : ' + issue) : ('Sauvegarde importée' + (name ? ' : ' + name : '')), !!issue);
          go('home');
        } catch (err) { toast('Fichier invalide : ' + err.message, true); }
      });
    };
    window.addEventListener('tusback', function () {
      if (modalRoot && !modalRoot.hidden) { closeModal(); return; }
      var panel = $('#ai-panel');
      if (panel && panel.classList.contains('open')) {
        panel.classList.remove('open');
        panel.setAttribute('inert', '');
      }
      var admin = $('#admin-panel');
      if (admin && admin.classList.contains('open')) {
        admin.classList.remove('open');
        admin.setAttribute('inert', '');
      }
    });
    $('#side-nav').addEventListener('click', function (e) {
      var b = e.target.closest('[data-page]'); if (b) { go(b.dataset.page); $('#sidebar').classList.remove('open'); }
    });
    $('#menu-btn').addEventListener('click', function () { $('#sidebar').classList.add('open'); });
    $('#side-close').addEventListener('click', function () { $('#sidebar').classList.remove('open'); });
    var updateInstall = $('#update-install');
    if (updateInstall) updateInstall.addEventListener('click', function () {
      if (!window.TUSUpdates) return;
      var btn = this;
      btn.disabled = true;
      toast('Installation de la mise à jour…');
      window.TUSUpdates.check().then(function (s) {
        state.update = s;
        paintUpdateBanner(s);
        toast(s.updated ? ('Version ' + s.installed + ' installée.') : 'Installation lancée…', !!s.error);
      }).catch(function (err) { toast(err.message, true); })
        .then(function () { btn.disabled = false; });
    });
    var updateDismiss = $('#update-dismiss');
    if (updateDismiss) updateDismiss.addEventListener('click', function () {
      var key = state.update ? updateBannerKey(state.update) : '';
      state.updateDismissed = key;
      if (window.TUSUpdates && window.TUSUpdates.markSeen) window.TUSUpdates.markSeen(key);
      paintUpdateBanner();
    });
    /* Un appui ailleurs sur l’écran (ou Échap) referme le menu sans toucher le bouton. */
    document.addEventListener('pointerdown', function (e) {
      var sb = $('#sidebar');
      if (!sb || !sb.classList.contains('open')) return;
      if (e.target && e.target.closest && (e.target.closest('#sidebar') || e.target.closest('#menu-btn'))) return;
      sb.classList.remove('open');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var sb = $('#sidebar');
        if (sb) sb.classList.remove('open');
      }
    });
    $('#new-project').addEventListener('click', newProject);
    $('#theme-btn').addEventListener('click', function () {
      var root = document.documentElement;
      var next = root.dataset.theme === 'light' ? 'dark' : 'light';
      root.dataset.theme = next;
      Store.db.settings.theme = next; Store.save();
      toast(next === 'light' ? 'Thème clair' : 'Thème sombre');
    });
    $('#notif-btn').addEventListener('click', ACTIONS.notifications);
    modalRoot.addEventListener('click', function (e) {
      if (e.target === modalRoot) return closeModal();
      var target = e.target.closest('[data-act]');
      if (!target) return;
      var act = target.dataset.act;
      if (act === 'modal-close') return closeModal();
      if (act === 'shop-image-remove' || act === 'shop-image-left') {
        var idx = Number(target.dataset.index || 0);
        if (act === 'shop-image-remove') state.shopDraftImages.splice(idx, 1);
        else if (idx > 0) {
          var tmp = state.shopDraftImages[idx - 1];
          state.shopDraftImages[idx - 1] = state.shopDraftImages[idx];
          state.shopDraftImages[idx] = tmp;
        }
        var box = $('#shop-gallery');
        if (box) box.outerHTML = shopGallery(state.shopDraftImages);
        return;
      }
      var fn = ACTIONS[act];
      if (!fn) return;
      if (act === 'research-use' || act === 'google-restore') fn(target.dataset.id);
      else fn();
    });
    content.addEventListener('click', function (e) {
      var target = e.target.closest('[data-act]');
      if (!target) return;
      var act = target.dataset.act;
      var fn = ACTIONS[act];
      if (!fn) return;
      if (act === 'task-done' || act === 'lead-convert' || act === 'lead-done' || act === 'lead-delete' ||
          act === 'project-detail' || act === 'project-tasks' || act === 'project-advance' || act === 'social-copy' ||
          act === 'social-publish' || act === 'social-delete' || act === 'content-reuse' || act === 'shop-edit' ||
          act === 'shop-copy' || act === 'client-delete' || act === 'academy-open' ||
           act === 'collab-analyze' || act === 'robot-edit' || act === 'robot-folder' ||
           act === 'robot-local' || act === 'robot-dry' || act === 'robot-run' ||
           act === 'company-activate' || act === 'company-project' || act === 'company-files' ||
           act === 'company-collab' || act === 'company-delete' || act === 'file-download' ||
           act === 'file-delete' || act === 'file-analyze' || act === 'account-remove' ||
           act === 'google-restore' || act === 'oauth-connect' || act === 'oauth-disconnect' || act === 'updates-check' ||
           act === 'qr-show' || act === 'qr-scan' || act === 'qr-paste' || act === 'qr-apply' || act === 'qr-close' ||
            act === 'msg-perm' || act === 'prospect-bucket' ||
             act === 'prospect-status' || act === 'prospect-client' || act === 'prospect-delete' ||
           act === 'folder-open' || act === 'folder-rename' ||
           act === 'folder-delete' || act === 'file-rename-local' || act === 'file-move-local' ||
           act === 'file-download-local' || act === 'file-delete-local' || act === 'file-analyze-local') fn(target.dataset.id);
      else fn();
    });
    /* Les formulaires sont dans la vue OU dans une modale : l'écoute est globale. */
    document.addEventListener('submit', function (e) {
      var form = e.target;
      if (form.id === 'content-form') { e.preventDefault(); contentFromForm(form); }
      else if (form.id === 'social-form') {
        e.preventDefault(); var fd = new FormData(form);
        Store.add('social', { platform: fd.get('platform'), text: fd.get('text'), status: 'à valider', scheduledAt: fd.get('scheduledAt'), source: 'manuel' });
        closeModal(); toast('Publication ajoutée'); go('social');
      } else if (form.id === 'msg-form') {
        e.preventDefault();
        var mf = $('#msg-text');
        var value = mf ? (mf.value || '').trim() : '';
        if (!value) return toast('Écrivez un message.', true);
        msgSend(value);
      } else if (form.id === 'prospect-images-form') {
        e.preventDefault();
        prospectImageAnalyze(form);
      } else if (form.id === 'prospect-form') {
        e.preventDefault();
        var pf2 = new FormData(form);
        if (window.TUSProspects) window.TUSProspects.add({
          name: pf2.get('name'), phone: pf2.get('phone'), email: pf2.get('email'),
          city: pf2.get('city'), source: pf2.get('source') || 'Manuel', need: pf2.get('need')
        });
        closeModal(); toast('Prospect enregistré'); go('prospect');
      } else if (form.id === 'project-form') {
        e.preventDefault(); var f = new FormData(form);
        var p = Store.add('projects', {
          name: f.get('name'), type: f.get('type'), client: f.get('client'), amount: Number(f.get('amount') || 0),
          due: f.get('due'), status: 'brief', source: 'Manuel', ai: !!f.get('aiTasks'),
          company: form.dataset.company || Store.db.settings.activeCompany || ''
        });
        if (f.get('aiTasks') && A.tasksForProject) A.tasksForProject(p).slice(0, 5).forEach(function (t) { Store.add('tasks', t); });
        closeModal(); toast('Projet créé'); go('projects');
      } else if (form.id === 'client-form') {
        e.preventDefault(); var cf = new FormData(form);
        Store.add('clients', { name: cf.get('name'), phone: cf.get('phone'), email: cf.get('email'), city: cf.get('city') });
        closeModal(); toast('Client ajouté'); go('clients');
      } else if (form.id === 'shop-form') {
        e.preventDefault(); shopSave(form);
      } else if (form.id === 'proxy-form') {
        e.preventDefault();
        var pf = new FormData(form), AI = window.TUSAI;
        if (!AI) return toast('Couche IA indisponible', true);
        try {
          var S = window.TUSSecure || {};
          if (!S.serverURL) throw new Error('Validation du serveur indisponible.');
          var rawUrl = String(pf.get('url') || '').trim();
          if (rawUrl) {
            var cleanUrl = S.serverURL(rawUrl);
            AI.connect(cleanUrl);
            if (window.TUSMessages) window.TUSMessages.setServer(cleanUrl);
            if (window.TUSCloud) window.TUSCloud.connect(cleanUrl);
            S.setSecret(pf.get('key') || '');
          } else {
            AI.disconnect();
            if (window.TUSCloud) window.TUSCloud.disconnect();
            S.clearSecrets();
          }
          if (window.electronAPI && window.electronAPI.setConfig) {
            window.electronAPI.setConfig({ url: rawUrl, key: pf.get('key') });
          }
          toast('Connexion au serveur enregistrée');
          refreshConnections(); refreshRobotStatus();
        } catch (err) { toast(err.message, true); }
      } else if (form.id === 'settings-form') {
        e.preventDefault(); var st = new FormData(form);
        Object.assign(Store.db.settings, {
          studio: st.get('studio'), phone: st.get('phone'), whatsapp: st.get('whatsapp'),
          autopilot: st.has('autopilot'), autoProjects: st.has('autoProjects'), autoSocial: st.has('autoSocial')
        });
        Store.save(); toast('Réglages enregistrés'); renderNav();
      } else if (form.id === 'company-form') {
        e.preventDefault(); var cf = new FormData(form);
        var company = Store.add('companies', {
          name: cf.get('name'), sector: cf.get('sector'), city: cf.get('city'),
          contact: cf.get('contact'), phone: cf.get('phone'), email: cf.get('email')
        });
        if (!Store.db.settings.activeCompany) Store.db.settings.activeCompany = company.name;
        Store.save(); closeModal(); toast('Espace entreprise créé'); go('companies');
      } else if (form.id === 'file-upload-form') {
        e.preventDefault();
        var ff = new FormData(form), file = ff.get('file');
        if (!file || !file.size) return toast('Choisissez un fichier', true);
        if (!Cloud || !Cloud.configured()) return toast('Configurez le serveur sécurisé pour déposer des fichiers.', true);
        var reader = new FileReader();
        reader.onload = function () {
          var dataUrl = String(reader.result || '');
          Cloud.uploadFile({
            company: ff.get('company') || state.fileCompany || Store.db.settings.activeCompany || '',
            project: ff.get('project') || state.fileProject || '',
            folder: ff.get('folder') || 'Documents',
            name: file.name, mime: file.type || 'application/octet-stream',
            content: dataUrl.slice(dataUrl.indexOf(',') + 1)
          }).then(function () {
            toast('Fichier classé'); loadFiles().then(function () { go(page); });
          }).catch(function (err) { toast(err.message, true); });
        };
        reader.readAsDataURL(file);
      } else if (form.id === 'note-form') {
        e.preventDefault();
        if (!Cloud || !Cloud.configured()) return toast('Serveur sécurisé non configuré.', true);
        var nf = new FormData(form);
        Cloud.saveTextFile(state.fileCompany || Store.db.settings.activeCompany || '', state.fileProject || '',
          state.fileFolder || 'Documents', nf.get('name') + '.md', nf.get('text'))
          .then(function () { closeModal(); toast('Note classée'); loadFiles().then(function () { go(page); }); })
          .catch(function (err) { toast(err.message, true); });
      } else if (form.id === 'folder-form') {
        e.preventDefault();
        var fo = new FormData(form);
        if (!window.TUSFiles) return;
        window.TUSFiles.createFolder(fo.get('name'), state.managerFolder, fo.get('color'))
          .then(function () { closeModal(); toast('Dossier créé'); loadManager(); })
          .catch(function (err) { toast(err.message, true); });
      } else if (form.id === 'folder-rename-form') {
        e.preventDefault();
        var rn = new FormData(form);
        window.TUSFiles.renameFolder(form.dataset.id, rn.get('name'))
          .then(function () { closeModal(); toast('Dossier renommé'); loadManager(); })
          .catch(function (err) { toast(err.message, true); });
      } else if (form.id === 'file-rename-local-form') {
        e.preventDefault();
        var fr = new FormData(form);
        window.TUSFiles.renameFile(form.dataset.id, fr.get('name'))
          .then(function () { closeModal(); toast('Fichier renommé'); loadManager(); })
          .catch(function (err) { toast(err.message, true); });
      } else if (form.id === 'file-move-local-form') {
        e.preventDefault();
        var fm = new FormData(form);
        window.TUSFiles.moveFile(form.dataset.id, fm.get('folder'))
          .then(function () { closeModal(); toast('Fichier déplacé'); loadManager(); })
          .catch(function (err) { toast(err.message, true); });
      } else if (form.id === 'media-form') {
        e.preventDefault(); mediaAnalyze(form);
      } else if (form.id === 'media-mission-form') {
        e.preventDefault();
        var mf = new FormData(form);
        mediaLaunchMission({
          company: mf.get('company') || '', project: mf.get('project') || '',
          topic: mf.get('topic') || '', research: mf.get('research') || '', publish: !!mf.get('publish')
        });
      } else if (form.id === 'pipeline-form') {
        e.preventDefault(); runPipeline(form);
      } else if (form.id === 'research-form') {
        e.preventDefault(); researchRun(form);
      } else if (form.id === 'agents-form') {
        e.preventDefault();
        var count = Number(form.dataset.count || 0), agents = [], afd = new FormData(form);
        for (var i = 0; i < count; i++) {
          agents.push({
            id: ['prospection', 'conception', 'contact', 'rapports'][i] || ('agent-' + i),
            order: Number(afd.get('order-' + i) || i + 1),
            provider: afd.get('provider-' + i) || 'auto',
            enabled: afd.get('enabled-' + i) === '1',
            prompt: afd.get('prompt-' + i) || ''
          });
        }
        Cloud.saveAgents(agents).then(function () { closeModal(); toast('Agents configurés'); refreshCloud(); })
          .catch(function (err) { toast(err.message, true); });
      } else if (form.id === 'robot-profile-form') {
        e.preventDefault();
        var R = window.TUSRobots;
        if (!R) return;
        var pf = new FormData(form);
        R.saveProfile(form.dataset.id, {
          name: pf.get('name'), icon: pf.get('icon'), color: pf.get('color')
        }).then(function (r) {
          closeModal(); toast('IA personnalisée : ' + r.name);
          if (page === 'robots' || page === 'manager') go(page);
        }).catch(function (err) { toast(err.message, true); });
      } else if (form.id === 'robots-config-form') {
        e.preventDefault();
        var rc = new FormData(form), nrobot = Number(form.dataset.count || 4), list = [];
        for (var j = 0; j < nrobot; j++) {
          var rid = ['veille', 'publication', 'conception', 'prospection'][j] || ('robot-' + j);
          list.push({
            id: rid,
            name: rc.get('name-' + j) || '',
            icon: rc.get('icon-' + j) || '',
            enabled: rc.get('enabled-' + j) === '1',
            hour: Number(rc.get('hour-' + j) || 8),
            provider: rc.get('provider-' + j) || 'auto',
            topic: rc.get('topic-' + j) || ''
          });
        }
        Cloud.saveRobots(list).then(function () {
          var R2 = window.TUSRobots;
          if (R2) return Promise.all(list.filter(function (x) { return x.name || x.icon; }).map(function (x) {
            return R2.saveProfile(x.id, { name: x.name, icon: x.icon });
          }));
          return null;
        }).then(function () { closeModal(); toast('Robots configurés'); refreshCloud(); })
          .catch(function (err) { toast(err.message, true); });
      } else if (form.id === 'google-form') {
        e.preventDefault();
        var gf = new FormData(form), done = 0, total = 0, errs = [];
        Cloud.GOOGLE_FIELDS.forEach(function (f) {
          var v = String(gf.get(f.id) || '').trim();
          if (!v) return;
          total++;
          Cloud.credentials(f.id, v).catch(function (err) { errs.push(err.message); })
            .then(function () { if (++done === total) { toast(errs.length ? errs[0] : 'Configuration Google enregistrée', !!errs.length); refreshCloud(); } });
        });
        if (!total) toast('Saisissez au moins le Client ID et le Secret', true);
      } else if (form.id === 'updates-form') {
        e.preventDefault();
        if (!window.TUSUpdates) return;
        var uf = new FormData(form);
        window.TUSUpdates.configure({ url: uf.get('url'), auto: uf.has('auto') }).then(function (s) {
          toast('Canal de mise à jour enregistré'); paintUpdates(s);
        }).catch(function (err) { toast(err.message, true); });
      } else if (form.id === 'oauth-config-form') {
        e.preventDefault();
        var ofd = new FormData(form), oauthTasks = [], oauthCount = 0;
        Cloud.OAUTH_FIELDS.forEach(function (f) {
          var value = String(ofd.get(f.id) || '').trim();
          if (!value) return;
          oauthCount++;
          oauthTasks.push(Cloud.credentials(f.id, value));
        });
        if (!oauthCount) return toast('Saisissez au moins un Client ID', true);
        Promise.all(oauthTasks).then(function () {
          form.reset(); toast('Configuration OAuth enregistrée'); refreshCloud();
        }).catch(function (err) { toast(err.message, true); });
      } else if (form.matches && form.matches('[data-account]')) {
        e.preventDefault();
        var value = new FormData(form).get('value');
        if (!value) return toast('Saisissez une clé', true);
        Cloud.saveProvider(form.dataset.account, value).then(function () {
          form.reset(); toast('Compte connecté'); refreshCloud();
        }).catch(function (err) { toast(err.message, true); });
      } else if (form.matches && form.matches('[data-network]')) {
        e.preventDefault();
        var fdnet = new FormData(form), tasks = [];
        Cloud.NETWORKS.find(function (n) { return n.id === form.dataset.network; }).fields.forEach(function (f) {
          var v = String(fdnet.get(f.id) || '').trim();
          if (v) tasks.push(Cloud.saveNetworkField(f.id, v));
        });
        Promise.all(tasks).then(function () {
          form.reset(); toast(tasks.length ? 'Réseau enregistré' : 'Aucun champ saisi', !tasks.length); refreshCloud();
        }).catch(function (err) { toast(err.message, true); });
      }
    });
    content.addEventListener('change', function (e) {
      if (e.target.id === 'social-filter') { state.socialFilter = e.target.value; go('social'); }
      else if (e.target.id === 'msg-thread') { state.msgThread = e.target.value; refreshInbox(true); }
      else if (e.target.id === 'prospect-filter') { state.prospectFilter = e.target.value; go('prospect'); }
      else if (e.target.id === 'prospect-domain') { state.prospectDomain = e.target.value; go('prospect'); }
      else if (e.target.id === 'msg-file') {
        var chosen = e.target.files && e.target.files[0];
        e.target.value = '';
        if (chosen) msgSend('Pièce jointe', chosen, String(chosen.type || '').indexOf('audio/') === 0 ? 'voice' : 'file');
      }
      else if (e.target.id === 'file-company') { state.fileCompany = e.target.value; state.fileProject = ''; state.fileFolder = ''; go('files'); loadFiles(); }
      else if (e.target.id === 'file-project') { state.fileProject = e.target.value; go('files'); loadFiles(); }
      else if (e.target.id === 'file-folder') { state.fileFolder = e.target.value; go('files'); loadFiles(); }
      else if (e.target.id === 'pipeline-company') {
        Store.db.settings.activeCompany = e.target.value; Store.save(); go('collab'); refreshCloud();
      }
    });
    content.addEventListener('input', function (e) {
      if (e.target.id === 'social-search') {
        var q = A.norm ? A.norm(e.target.value) : e.target.value.toLowerCase();
        $$('.social-item').forEach(function (item) {
          item.style.display = A.norm(item.textContent).indexOf(q) >= 0 ? '' : 'none';
        });
      }
    });
    document.addEventListener('change', function (e) {
      if (e.target.id !== 'import-file') return;
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        if (typeof window.__tusImportCallback === 'function') window.__tusImportCallback(reader.result, file.name);
      };
      reader.readAsText(file);
      e.target.value = '';
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeModal();
        var panel = $('#ai-panel');
        panel.classList.remove('open');
        panel.setAttribute('inert', '');
        var admin = $('#admin-panel');
        if (admin) { admin.classList.remove('open'); admin.setAttribute('inert', ''); }
      }
    });
  }

  function refreshVisitors() {
    if (!window.TUSVisits) return;
    window.TUSVisits.stats().then(function (v) {
      var box = $('#visitors-chip');
      var total = $('#visitors-total');
      if (!box || !total) return;
      total.textContent = Number(v.total || 0).toLocaleString('fr-FR');
      var today = $('#visitors-today');
      if (today) today.textContent = 'aujourd’hui : ' + Number(v.today || 0).toLocaleString('fr-FR');
      box.dataset.synced = String(!!v.synced);
      box.title = 'Site public · ' + Number(v.total || 0).toLocaleString('fr-FR') + ' visiteurs uniques · '
        + Number(v.online || 0) + ' en ligne · ' + Number(v.views || 0) + ' pages vues'
        + (v.synced ? '' : ' (dernier relevé enregistré)');
    });
  }

  function syncAndNotify() {
    var n = Store.syncSiteLeads();
    if (window.TUSync) window.TUSync.pulse('app', { leads: Store.db.leads.length, projects: Store.db.projects.length });
    updateBadges();
    if (n && page !== 'leads') toast(n + ' nouvelle(s) demande(s) du site');
  }

  function boot() {
    Store.migrateShop();
    if (window.TUSCatalog && Cloud && Cloud.configured()) {
      window.TUSCatalog.syncFromServer().catch(function () {});
    }
    if (window.TUSCatalog) {
      window.TUSCatalog.subscribe(function () { if (page === 'shop') go('shop'); });
    }
    refreshCloud();
    syncAndNotify();
    refreshVisitors();
    go('home');
    probeUpdates();
    setTimeout(probeUpdates, 45000);
    if (window.TUSRobots) {
      window.TUSRobots.maybeDaily().then(function (n) {
        if (n) Store.log('Robots : ' + n + ' aperçus locaux générés pour aujourd’hui.');
      });
      refreshRobotStatus();
    }
    if (Cloud && Cloud.configured()) {
      Cloud.agents().then(function (res) { state.agentInfo = res; if (page === 'collab') go('collab'); }).catch(function () {});
      loadFiles();
    }
    window.addEventListener('storage', function (e) {
      if (e.key === Store.KEY || e.key === 'tus_site_leads_v1') syncAndNotify();
    });
    window.addEventListener('focus', function () { syncAndNotify(); refreshVisitors(); });
    setInterval(syncAndNotify, 8000);
    setInterval(refreshVisitors, 60000);
    setInterval(function () {
      if ((page === 'social' || page === 'prospect') && window.TUSMessages && window.TUSMessages.server()) {
        refreshInbox(true);
      }
    }, 25000);
  }

  function init() {
    if (Store.db.settings.theme) document.documentElement.dataset.theme = Store.db.settings.theme;
    bindGlobal();
    refreshNativePermissions();
    document.addEventListener('change', function (e) {
      if (!e.target || e.target.id !== 'qr-settings-file') return;
      if (!window.TUSQRSync) return;
      window.TUSQRSync.decodeFile(e.target.files && e.target.files[0]).then(function (code) {
        var box = $('#qr-settings-text'); if (box) box.value = code;
        var panel = $('#qr-settings-panel'); if (panel) panel.hidden = false;
        toast('Code QR lu. Appuyez sur « Connecter et synchroniser ».');
      }).catch(function (err) { toast(err.message, true); });
    });
    window.addEventListener('tuspermissionschange', refreshNativePermissions);
    if (window.TUSUpdates) window.TUSUpdates.onChange(function (s) {
      state.update = s;
      state.updateDismissed = s.seen || state.updateDismissed;
      paintUpdateBanner(s);
      if (page === 'settings') paintUpdates(s);
    });
    initNetworkMeter();
    loadCollabFolders();
    initAI();
    var Setup = window.TUSetup;
    if (!Store.setupDone()) {
      if (Setup) Setup.show('setup', boot); else boot();
      return;
    }
    if (Accounts && Accounts.available() && !Accounts.current()) {
      var resumed = Accounts.resume && Accounts.resume();
      if (!resumed) {
        if (Setup) Setup.show('lock', boot); else boot();
        return;
      }
    }
    boot();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
