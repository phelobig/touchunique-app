/* Touch Unique — moteur d’automatisation local
   Aucun appel réseau. Génère des briefs, tâches, contenus, file sociale et actions boutique.
   Contrat volontairement déterministe et auditable : chaque sortie est réversible et modifiable.
*/
(function (root) {
  'use strict';

  function clean(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
  function norm(v) { return clean(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function now() { return new Date().toISOString(); }
  function uid(prefix) { return (prefix || 'TU') + '-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(); }
  function pick(list, seed) {
    if (!list.length) return '';
    var h = 0, s = norm(seed || 'touch');
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return list[h % list.length];
  }
  function titleCase(v) {
    return clean(v).toLowerCase().replace(/(^|[\s\-–—:])(\p{L})/gu, function (_, a, b) { return a + b.toUpperCase(); });
  }

  var ANGLES = [
    'montrez le résultat avant la méthode',
    'commencez par le problème que votre client reconnaît',
    'remplacez l’argument par une situation vécue',
    'donnez une seule action à faire, tout de suite',
    'montrez ce qui change en 30 jours',
    'utilisez une comparaison simple et mémorable'
  ];
  var TONES = {
    pro: ['claire', 'assurée', 'directe'],
    chaleureux: ['proche', 'humaine', 'simple'],
    audacieux: ['franche', 'percutante', 'courte'],
    pedagogique: ['explicative', 'calme', 'utile']
  };

  function brief(input) {
    var o = input || {};
    var theme = clean(o.theme || o.title || 'votre projet');
    var goal = clean(o.goal || 'être contacté');
    var audience = clean(o.audience || 'clients potentiels');
    var tone = norm(o.tone || 'pro');
    var words = (TONES[tone] || TONES.pro).slice();
    return {
      id: uid('BR'),
      at: now(),
      theme: theme,
      goal: goal,
      audience: audience,
      tone: tone,
      angle: pick(ANGLES, theme + goal),
      promise: 'Un résultat concret, une étape claire, une raison de répondre.',
      structure: [
        'Accroche : une phrase que la cible reconnaît immédiatement',
        'Problème : ce qui bloque aujourd’hui',
        'Solution : ce que Touch Unique met en place',
        'Preuve : un livrable ou une étape visible',
        'Action : un seul geste attendu'
      ],
      words: words,
      checklist: [
        'Le bénéfice est-il visible dans les 3 premières secondes ?',
        'Le message tient-il sur un écran de téléphone ?',
        'Y a-t-il un seul appel à l’action ?',
        'Le ton ressemble-t-il à la marque ?'
      ]
    };
  }

  function tasksForProject(p) {
    var name = clean(p.name || p.title || 'Nouveau projet');
    var type = norm(p.type || 'projet');
    var base = [
      { title: 'Cadrer le brief et confirmer les objectifs', phase: 'Brief', priority: 'haute' },
      { title: 'Réunir les supports et les références utiles', phase: 'Brief', priority: 'moyenne' },
      { title: 'Proposer une direction créative', phase: 'Conception', priority: 'haute' },
      { title: 'Valider la piste avec le client', phase: 'Conception', priority: 'haute' },
      { title: 'Produire les livrables principaux', phase: 'Production', priority: 'haute' },
      { title: 'Contrôler les fichiers et les formats', phase: 'Livraison', priority: 'moyenne' },
      { title: 'Livrer et préparer la relance', phase: 'Livraison', priority: 'moyenne' }
    ];
    if (/video|film|motion|montage/.test(type)) {
      base.splice(4, 0, { title: 'Préparer le script et le découpage plan par plan', phase: 'Production', priority: 'haute' });
      base.push({ title: 'Décliner en formats réseaux', phase: 'Livraison', priority: 'moyenne' });
    }
    if (/formation|academie|cours/.test(type)) {
      base.splice(4, 0, { title: 'Structurer les leçons et les exercices', phase: 'Production', priority: 'haute' });
      base.push({ title: 'Préparer le suivi post-formation', phase: 'Livraison', priority: 'basse' });
    }
    return base.map(function (t, i) {
      return Object.assign({}, t, {
        id: uid('TK'),
        projectId: p.id || '',
        createdAt: now(),
        status: 'à faire',
        order: i + 1,
        ai: true
      });
    });
  }

  function content(input) {
    var o = input || {};
    var b = brief(o);
    var theme = b.theme;
    var kind = norm(o.kind || 'reseau');
    var audience = b.audience;
    var t = titleCase(theme);

    var titles = [
      t + ' : ce qui change vraiment',
      'Arrêtez de chercher. Voici ' + t.toLowerCase() + '.',
      'Le détail qui fait toute la différence',
      t + ' sans jargon, sans détour',
      'Ce que votre marque gagne à ' + t.toLowerCase()
    ];
    var hooks = [
      'Vous avez une idée claire, mais elle ne se voit pas encore.',
      'Un bon visuel ne suffit pas. Il faut un système derrière.',
      'La différence entre “j’aime” et “je contacte” tient souvent à une phrase.',
      'Ce n’est pas une question de budget. C’est une question de clarté.',
      'Votre prochain client décide en trois secondes. Autant lui faciliter la tâche.'
    ];
    var captions = [
      hooks[0] + '\n\n' + t + ' — pensé pour ' + audience + '. On part du résultat attendu, puis on construit le chemin le plus court : idée claire, direction nette, livrables utilisables.\n\nUn seul objectif : que la bonne personne comprenne et passe à l’action.\n\nÉcrivez « PROJET » en commentaire ou envoyez un message pour en parler. #TouchUnique',
      'Un visuel qui capte, un message qui reste, une action qui suit.\n\nC’est exactement ce qu’on construit avec ' + t.toLowerCase() + '. Pas de détour, pas de jargon : juste ce qui sert à ' + b.goal + '.\n\nDites-nous ce que vous voulez créer — on vous répond avec une piste concrète. #StudioCréatif',
      b.angle.charAt(0).toUpperCase() + b.angle.slice(1) + '. C’est notre règle pour ' + t.toLowerCase() + '.\n\nParce qu’un contenu utile ne cherche pas à tout dire. Il donne une raison de s’arrêter, puis une raison de répondre.\n\nVotre projet mérite cette clarté. Parlons-en. #TouchUniqueStudio'
    ];
    var scripts = [
      ' PLAN 30 s\n0–3 s | Plan serré, lumière rouge, regard caméra. Texte : « Votre marque a quelque chose à dire. »\n3–10 s | Plan large, mains sur le bureau, esquisse. Voix : « On transforme l’idée en identité et en vidéo qui tiennent ensemble. »\n10–22 s | Montage rapide des réalisations : logo, packaging, affiche, bannière. Voix : « Design, filmage, réseaux, académie — une seule direction. »\n22–30 s | Portrait, sourire, texte final : « Touch Unique. Parlons de votre projet. »',
      ' PLAN 60 s\n0–5 s | Accroche visuelle forte + question courte.\n5–18 s | Le problème en une phrase, avec un plan qui montre l’avant.\n18–38 s | La solution en trois gestes : cadrer, créer, diffuser.\n38–52 s | Trois preuves visuelles rapides, sans texte superflu.\n52–60 s | Appel à l’action unique et numéro WhatsApp.'
    ];
    var hashtags = ['#TouchUnique', '#StudioCréatif', '#DesignGraphique', '#IdentitéVisuelle', '#Vidéo', '#Montage', '#MarketingDigital', '#Académie', '#BurkinaFaso', '#CréationDeContenu'];
    var calendar = ['J1 Accroche + visuel principal', 'J2 Coulisses / processus', 'J3 Avant-après', 'J4 Question à la communauté', 'J5 Offre courte + appel à l’action'];
    return {
      id: uid('CT'),
      at: now(),
      type: kind,
      theme: theme,
      brief: b,
      titles: titles,
      captions: captions,
      scripts: kind.indexOf('video') >= 0 ? scripts : [scripts[0]],
      hashtags: hashtags.slice(0, 8),
      calendar: calendar,
      score: 86 + (theme.length % 11)
    };
  }

  function scoreLead(lead) {
    var text = norm([lead && lead.message, lead && lead.type, lead && (lead.client && lead.client.name)].join(' '));
    var score = 35;
    if (/devis|prix|budget|combien|commande|commander/.test(text)) score += 24;
    if (/urgent|vite|demain|cette semaine|deadline/.test(text)) score += 18;
    if (/logo|identite|video|formation|site|pack|banniere|affiche|reseau/.test(text)) score += 14;
    if ((lead && lead.items && lead.items.length) || (lead && lead.total > 0)) score += 12;
    if (/bonjour|merci|souhaite|besoin|projet/.test(text)) score += 6;
    score = Math.min(98, score);
    var level = score >= 75 ? 'chaud' : score >= 55 ? 'tiède' : 'froid';
    var action = level === 'chaud'
      ? 'Répondre sous 2 h avec deux créneaux et une offre adaptée.'
      : level === 'tiède'
        ? 'Envoyer une question de qualification puis proposer un devis court.'
        : 'Ajouter à la séquence de nurturance et relancer sous 72 h.';
    return { score: score, level: level, action: action, at: now() };
  }

  function offerCopy(p) {
    var name = clean(p.name || 'Offre');
    var short = clean(p.short || p.desc || 'Une solution claire et utilisable.');
    return {
      headline: name + ' — ' + short,
      bullets: (p.deliverables || []).map(function (d) { return '✓ ' + d; }),
      cta: 'Écrire pour confirmer cette offre',
      note: 'Prix de départ : ' + (p.price || 0) + ' FCFA · ' + (p.unit || 'forfait') + ' · délai ' + (p.delay || 'à définir')
    };
  }

  function shopActions(products, leads) {
    var list = Array.isArray(products) ? products : [];
    var cable = Array.isArray(leads) ? leads : [];
    var demand = norm(cable.map(function (l) { return l.type + ' ' + (l.message || ''); }).join(' '));
    var map = [
      { test: /video|montage|film/, id: 'video-impact' },
      { test: /logo|identite|charte/, id: 'identite-express' },
      { test: /formation|apprendre|cours/, id: 'formation-ai-contenus' },
      { test: /reseau|publication|contenu/, id: 'abonnement-ai-content' },
      { test: /packaging|etiquette|boite/, id: 'packaging-produit' }
    ];
    var actions = [];
    map.forEach(function (m) {
      if (!m.test.test(demand)) return;
      var p = list.find(function (x) { return x.id === m.id; });
      if (p) actions.push({ type: 'mettre-en-avant', productId: p.id, title: p.name, reason: 'Demande récurrente détectée dans les leads.', priority: 'haute' });
    });
    list.filter(function (p) { return p.popular; }).slice(0, 2).forEach(function (p) {
      actions.push({ type: 'verifier-stock', productId: p.id, title: p.name, reason: 'Offre populaire : confirmer la capacité de livraison.', priority: 'moyenne' });
    });
    if (!actions.length) actions.push({ type: 'observer', title: 'Boutique stable', reason: 'Aucun signal fort détecté dans les demandes récentes.', priority: 'basse' });
    return actions;
  }

  function socialLinks(text) {
    var t = clean(text || 'Bonjour Touch Unique, parlons de mon projet.');
    return {
      whatsapp: 'https://wa.me/22655041530?text=' + encodeURIComponent(t),
      facebook: 'https://www.facebook.com/',
      instagram: 'https://www.instagram.com/',
      linkedin: 'https://www.linkedin.com/feed/',
      x: 'https://x.com/compose/post'
    };
  }

  function runCycle(state) {
    var s = state || {};
    var products = (s.catalogue && s.catalogue.products) || s.products || [];
    var leads = s.leads || [];
    var projects = s.projects || [];
    var generatedLeads = leads.filter(function (l) { return !l.autopilotDone; }).slice(0, 8);
    var newTasks = [];
    var newProjects = [];
    var newSocial = [];
    var log = [];

    generatedLeads.forEach(function (l) {
      var score = scoreLead(l);
      l.autopilotScore = score.score;
      l.autopilotLevel = score.level;
      l.autopilotAction = score.action;
      l.autopilotDone = true;
      var existing = projects.find(function (p) { return p.sourceId === l.id; });
      if (!existing && score.level !== 'froid') {
        var p = {
          id: uid('PR'),
          name: 'Projet — ' + clean((l.client && l.client.name) || l.ref || 'lead'),
          type: clean(l.type || 'projet').replace(/^Demande de projet — /, ''),
          client: clean((l.client && l.client.name) || ''),
          phone: clean((l.client && l.client.phone) || ''),
          status: 'brief',
          amount: Number(l.total || 0),
          sourceId: l.id,
          createdAt: now(),
          ai: true
        };
        newProjects.push(p);
        newTasks = newTasks.concat(tasksForProject(p).slice(0, 4));
        log.push('Projet créé depuis ' + (l.ref || 'lead') + ' · score ' + score.score);
      }
      if (score.level === 'chaud') {
        var c = content({ kind: 'reseau', theme: clean(l.type || 'votre projet'), audience: clean((l.client && l.client.name) || 'clients potentiels'), goal: 'être contacté' });
        newSocial.push({
          id: uid('SO'), platform: 'whatsapp', text: c.captions[0], status: 'à valider',
          scheduledAt: new Date(Date.now() + 3600000).toISOString(), source: 'autopilot', leadId: l.id
        });
      }
    });

    var actions = shopActions(products, leads);
    log.push('Boutique : ' + actions.length + ' suggestion(s) préparée(s)');
    log.push('Cycle terminé : ' + newProjects.length + ' projet(s), ' + newTasks.length + ' tâche(s), ' + newSocial.length + ' publication(s)');

    return {
      at: now(),
      leads: leads,
      projects: newProjects,
      tasks: newTasks,
      social: newSocial,
      shopActions: actions,
      log: log
    };
  }

  var api = {
    brief: brief,
    tasksForProject: tasksForProject,
    content: content,
    scoreLead: scoreLead,
    offerCopy: offerCopy,
    shopActions: shopActions,
    socialLinks: socialLinks,
    runCycle: runCycle,
    uid: uid,
    now: now,
    clean: clean,
    norm: norm
  };

  root.TUAutomation = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
