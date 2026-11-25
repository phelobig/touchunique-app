/* Touch Unique — contrôleur de l’application */
(function () {
  'use strict';

  var A = window.TUAutomation || {};
  var C = window.TU_CONTENT || {};
  var BRAND = C.brand || { whatsapp: 'https://wa.me/22655041530' };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var content = $('#content');
  var modalRoot = $('#modal-root');
  var page = 'home';
  var state = { lastContent: null, socialFilter: 'all', toastTimers: [] };

  var NAV = [
    { id: 'home', label: 'Tableau de bord', icon: '⌂', kicker: 'Vue d’ensemble', title: 'Tableau de bord' },
    { id: 'projects', label: 'Projets', icon: '◆', kicker: 'Orchestration', title: 'Projets' },
    { id: 'leads', label: 'Commandes du site', icon: '🌐', kicker: 'Pipeline commercial', title: 'Commandes du site' },
    { id: 'content', label: 'Contenus IA', icon: '✦', kicker: 'Création assistée', title: 'Contenus IA' },
    { id: 'social', label: 'File sociale', icon: '▶', kicker: 'Publication', title: 'File sociale' },
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
  function renderNav() {
    var unread = Store.unreadLeads();
    $('#side-nav').innerHTML = NAV.map(function (n) {
      var badge = n.id === 'leads' && unread ? '<span class="badge">' + unread + '</span>' : '';
      return '<button class="nav-item' + (n.id === page ? ' active' : '') + '" data-page="' + n.id + '">' +
        '<span class="ico">' + n.icon + '</span><span>' + n.label + '</span>' + badge + '</button>';
    }).join('');
    $('#demo-chip').hidden = !Store.db.demo;
    var dot = $('#notif-dot');
    if (dot) dot.hidden = unread === 0;
  }
  function go(id) {
    var n = NAV.find(function (x) { return x.id === id; }) || NAV[0];
    page = n.id;
    $('#page-title').textContent = n.title;
    $('#page-kicker').textContent = n.kicker;
    renderNav();
    content.innerHTML = views[page] ? views[page]() : '';
    content.scrollTop = 0;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    if (page === 'content' && state.lastContent) paintContentResult(state.lastContent);
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

  views.social = function () {
    var list = (Store.db.social || []).filter(function (s) {
      return state.socialFilter === 'all' || s.status === state.socialFilter;
    });
    return '<div class="section-title"><h2>' + list.length + ' publication(s)</h2>' +
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

  views.shop = function () {
    var products = Store.products();
    var suggestions = Store.db.shop.suggestions || [];
    return '<div class="kpi-grid">' +
      kpi(products.length, 'Offres catalogue', '▣') +
      kpi(products.filter(function (p) { return p.popular; }).length, 'Offres populaires', '★') +
      kpi((Store.db.shop.orders || []).length, 'Ventes enregistrées', '↗') +
      kpi(suggestions.length, 'Suggestions IA', '✺') +
      '</div>' +
      '<div class="section-title"><h2>Catalogue canonique</h2><div class="row">' +
      '<button class="btn btn-ghost btn-sm" data-act="shop-recommend">✺ Suggestions IA</button>' +
      '<button class="btn btn-primary btn-sm" data-act="shop-new">+ Nouvelle offre</button></div></div>' +
      '<div class="shop-grid">' + products.map(function (p) {
        return '<article class="shop-card"><img src="' + esc(p.img) + '" alt="" loading="lazy">' +
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
    var trainings = (window.TU_CATALOGUE && window.TU_CATALOGUE.products || []).filter(function (p) { return p.category === 'academie'; });
    return '<div class="auto-card card"><div class="card-head"><div><h2>' + esc(ac.eyebrow || 'Touch Unique Académie') + '</h2>' +
      '<div class="subtle">Apprenez à créer, puis à automatiser votre création.</div></div><span class="chip red">Formations</span></div>' +
      '<div class="row">' + modules.map(function (m) { return '<span class="chip blue">' + esc(m) + '</span>'; }).join('') + '</div></div>' +
      '<div class="section-title"><h2>Modules disponibles</h2></div><div class="three-col">' +
      trainings.map(function (t) {
        return '<article class="card"><div class="spread"><b>' + esc(t.name) + '</b><span class="chip blue">' + money(t.price) + '</span></div>' +
          '<p class="subtle">' + esc(t.short) + '</p><div class="subtle small">' + esc(t.delay) + ' · ' + esc(t.unit) + '</div>' +
          '<button class="btn btn-ghost btn-sm" style="margin-top:12px" data-act="academy-open" data-id="' + esc(t.id) + '">Voir le programme</button></article>';
      }).join('') + '</div>';
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
      '<div class="stack"><div class="card"><div class="card-head"><h2>Connecteurs</h2><span class="chip amber">Validation requise</span></div>' +
      rows.map(function (r) {
        var on = r[0] === 'whatsapp' ? !!connectors.whatsapp : !!connectors[r[0]];
        return '<div class="connector"><div><b>' + esc(r[1]) + '</b><div class="subtle small">' + (on ? 'Disponible' : 'Non connecté — clé ou permission requise') + '</div></div>' +
          '<span class="chip ' + (on ? 'green' : 'gray') + '">' + (on ? 'Actif' : 'Non connecté') + '</span></div>';
      }).join('') + '</div>' +
      '<div class="card"><div class="card-head"><h2>Sauvegarde</h2></div><div class="row">' +
      '<button class="btn btn-ghost btn-sm" data-act="settings-export">↓ Exporter JSON</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="settings-import">↑ Importer JSON</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="settings-reset">Réinitialiser</button>' +
      '<input type="file" id="import-file" accept="application/json" hidden></div>' +
      '<p class="subtle small">Toutes les données restent sur cet appareil. Aucune information n’est envoyée à un service externe sans votre action.</p></div></div></div>';
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
  function shopEdit(id) {
    var p = Store.products().find(function (x) { return x.id === id; });
    if (!p) return;
    var o = Store.db.shop.overrides[id] || {};
    openModal('<h3>Modifier · ' + esc(p.name) + '</h3><form id="shop-form" class="form-grid">' +
      '<label class="field full"><span>Nom affiché</span><input name="name" value="' + esc(o.name || p.name) + '"></label>' +
      '<label class="field"><span>Prix FCFA</span><input name="price" type="number" min="0" value="' + Number(o.price || p.price) + '"></label>' +
      '<label class="field"><span>Unité</span><input name="unit" value="' + esc(o.unit || p.unit) + '"></label>' +
      '<label class="field full"><span>Description courte</span><textarea name="short" rows="3">' + esc(o.short || p.short) + '</textarea></label>' +
      '<div class="modal-actions" style="grid-column:1/-1"><button class="btn btn-ghost" type="button" data-act="modal-close">Annuler</button>' +
      '<button class="btn btn-primary" type="submit">Enregistrer</button></div></form>');
    var form = $('#shop-form');
    if (form) form.dataset.id = id;
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

  /* ---------- Assistant ---------- */
  function assistantAsk(raw) {
    var q = A.norm ? A.norm(raw) : String(raw).toLowerCase();
    var answer = '', sources = [];
    if (/statut|projet|avancement/.test(q)) {
      var ps = Store.db.projects || [];
      answer = ps.length ? ps.slice(0, 6).map(function (p) { return '• ' + p.name + ' — ' + (p.status || '—'); }).join('\n') : 'Aucun projet enregistré.';
      sources.push('Projets');
    } else if (/commande|lead|demande|client/.test(q)) {
      var ls = Store.db.leads || [];
      answer = ls.length ? ls.slice(0, 4).map(function (l) {
        return '• ' + ((l.client && l.client.name) || l.ref) + ' — score ' + (l.score || '?') + ' · ' + (l.nextAction || 'à qualifier');
      }).join('\n') : 'Aucune demande importée pour le moment.';
      sources.push('Commandes du site');
    } else if (/contenu|caption|script|texte|publication/.test(q)) {
      var theme = String(raw).replace(/^(g[ée]n[èe]re|cr[ée]e|donne|fais|texte|contenu|script)\s*/i, '') || 'Touch Unique Studio';
      var c = A.content ? A.content({ theme: theme, kind: /vid[ée]o|script/.test(q) ? 'video' : 'reseau' }) : null;
      answer = c ? 'Titre : ' + c.titles[0] + '\n\n' + c.captions[0] + '\n\n' + c.hashtags.join(' ') : 'Générateur indisponible.';
      sources.push('Moteur de contenu');
    } else if (/boutique|catalogue|offre|prix/.test(q)) {
      var acts = A.shopActions ? A.shopActions(Store.products(), Store.db.leads || []) : [];
      answer = acts.map(function (a) { return '• ' + a.title + ' — ' + a.reason; }).join('\n');
      sources.push('Catalogue', 'Leads');
    } else if (/t[âa]che|todo|à faire/.test(q)) {
      var ts = (Store.db.tasks || []).filter(function (t) { return t.status !== 'terminée'; });
      answer = ts.length ? ts.slice(0, 8).map(function (t) { return '• ' + t.title; }).join('\n') : 'Aucune tâche en attente.';
      sources.push('Tâches');
    } else {
      answer = 'Je peux vous aider sur les projets, les commandes du site, la génération de contenus, la file sociale et la boutique.\n\nDites par exemple : « montre les projets », « génère un script vidéo » ou « suggère des offres ».';
      sources.push('Aide');
    }
    return { answer: answer, sources: sources };
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
    var sugg = ['Montre les projets', 'Génère un script vidéo', 'Suggère des offres', 'Tâches en attente'];
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
      var res = assistantAsk(text);
      setTimeout(function () {
        pushMsg('bot', res.answer + '\n\n— Sources : ' + res.sources.join(', '));
      }, 180);
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

  /* ---------- Événements ---------- */
  var ACTIONS = {
    'run-autopilot': runAutopilot,
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
    'shop-recommend': function () { Store.db.shop.suggestions = A.shopActions(Store.products(), Store.db.leads || []); Store.save(); toast('Suggestions actualisées'); go(page); },
    'shop-new': function () { toast('Ajoutez une offre dans catalogue.json, puis actualisez la page.'); },
    'shop-edit': shopEdit,
    'shop-copy': function (id) {
      var p = Store.products().find(function (x) { return x.id === id; });
      if (!p || !A.offerCopy) return;
      var o = A.offerCopy(p);
      copy([o.headline].concat(o.bullets, o.note).join('\n'));
    },
    'client-add-form': clientForm,
    'client-delete': function (id) { Store.remove('clients', id); toast('Client supprimé'); go(page); },
    'academy-open': function (id) {
      var p = Store.products().find(function (x) { return x.id === id; });
      if (!p) return;
      openModal('<h3>' + esc(p.name) + '</h3><p class="subtle">' + esc(p.desc) + '</p>' +
        '<ul class="modal-list">' + (p.deliverables || []).map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul>' +
        '<div class="modal-actions"><a class="btn btn-primary" href="' + esc(waLink('Bonjour Touch Unique, je veux m’inscrire à ' + p.name)) + '" target="_blank" rel="noopener">S’inscrire</a>' +
        '<button class="btn btn-ghost" data-act="modal-close">Fermer</button></div>');
    },
    'settings-export': function () {
      var blob = new Blob([Store.exportData()], { type: 'application/json' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'touchunique-sauvegarde.json'; a.click(); URL.revokeObjectURL(a.href);
      toast('Sauvegarde téléchargée');
    },
    'settings-import': function () { $('#import-file').click(); },
    'settings-reset': function () { confirmAction('Réinitialiser les données ?', 'Les données locales actuelles seront remplacées par un espace vide.', function () { Store.reset(false); toast('Données réinitialisées'); go('home'); }); },
    'modal-close': closeModal,
    'notifications': function () {
      openModal('<h3>Notifications</h3><div class="activity">' + (Store.db.logs || []).slice(0, 10).map(function (l) {
        return '<div class="log-line"><time>' + time(l.at) + '</time><span>' + esc(l.text) + '</span></div>';
      }).join('') + '</div><div class="modal-actions"><button class="btn btn-ghost" data-act="modal-close">Fermer</button></div>');
    }
  };

  function bindGlobal() {
    $('#side-nav').addEventListener('click', function (e) {
      var b = e.target.closest('[data-page]'); if (b) { go(b.dataset.page); $('#sidebar').classList.remove('open'); }
    });
    $('#menu-btn').addEventListener('click', function () { $('#sidebar').classList.add('open'); });
    $('#side-close').addEventListener('click', function () { $('#sidebar').classList.remove('open'); });
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
      if (e.target === modalRoot || e.target.closest('[data-act="modal-close"]')) closeModal();
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
          act === 'shop-copy' || act === 'client-delete' || act === 'academy-open') fn(target.dataset.id);
      else fn();
    });
    content.addEventListener('submit', function (e) {
      var form = e.target;
      if (form.id === 'content-form') { e.preventDefault(); contentFromForm(form); }
      else if (form.id === 'social-form') {
        e.preventDefault(); var fd = new FormData(form);
        Store.add('social', { platform: fd.get('platform'), text: fd.get('text'), status: 'à valider', scheduledAt: fd.get('scheduledAt'), source: 'manuel' });
        closeModal(); toast('Publication ajoutée'); go('social');
      } else if (form.id === 'project-form') {
        e.preventDefault(); var f = new FormData(form);
        var p = Store.add('projects', {
          name: f.get('name'), type: f.get('type'), client: f.get('client'), amount: Number(f.get('amount') || 0),
          due: f.get('due'), status: 'brief', source: 'Manuel', ai: !!f.get('aiTasks')
        });
        if (f.get('aiTasks') && A.tasksForProject) A.tasksForProject(p).slice(0, 5).forEach(function (t) { Store.add('tasks', t); });
        closeModal(); toast('Projet créé'); go('projects');
      } else if (form.id === 'client-form') {
        e.preventDefault(); var cf = new FormData(form);
        Store.add('clients', { name: cf.get('name'), phone: cf.get('phone'), email: cf.get('email'), city: cf.get('city') });
        closeModal(); toast('Client ajouté'); go('clients');
      } else if (form.id === 'shop-form') {
        e.preventDefault(); var sf = new FormData(form);
        var editId = form.dataset.id || '';
        Store.db.shop.overrides[editId] = { name: sf.get('name'), price: Number(sf.get('price') || 0), unit: sf.get('unit'), short: sf.get('short') };
        Store.save(); closeModal(); toast('Offre mise à jour'); go('shop');
      } else if (form.id === 'settings-form') {
        e.preventDefault(); var st = new FormData(form);
        Object.assign(Store.db.settings, {
          studio: st.get('studio'), phone: st.get('phone'), whatsapp: st.get('whatsapp'),
          autopilot: st.has('autopilot'), autoProjects: st.has('autoProjects'), autoSocial: st.has('autoSocial')
        });
        Store.save(); toast('Réglages enregistrés'); renderNav();
      }
    });
    content.addEventListener('change', function (e) {
      if (e.target.id === 'social-filter') { state.socialFilter = e.target.value; go('social'); }
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
        try { Store.importData(reader.result); toast('Sauvegarde importée'); go('home'); }
        catch (err) { toast('Fichier invalide', true); }
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
      }
    });
  }

  function syncAndNotify() {
    var n = Store.syncSiteLeads();
    if (window.TUSync) window.TUSync.pulse('app', { leads: Store.db.leads.length, projects: Store.db.projects.length });
    renderNav();
    if (n && page !== 'leads') toast(n + ' nouvelle(s) demande(s) du site');
    if (page === 'home' || page === 'leads') go(page);
  }

  function init() {
    if (Store.db.settings.theme) document.documentElement.dataset.theme = Store.db.settings.theme;
    bindGlobal();
    initAI();
    syncAndNotify();
    go('home');
    window.addEventListener('storage', function (e) {
      if (e.key === Store.KEY || e.key === 'tus_site_leads_v1') syncAndNotify();
    });
    window.addEventListener('focus', syncAndNotify);
    setInterval(syncAndNotify, 8000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
