/* Touch Unique Studio — espace Prospect.
   Deux bacs distincts : « en ligne » (robot, site, saisie manuelle) et
   « images » (reconnaissance automatique sur lots de photos/documents).
   Les deux bacs ne sont jamais fusionnés, même si un même contact apparaît. */
(function (root) {
  'use strict';

  function Store() { return root.Store; }
  function now() { return new Date().toISOString(); }
  function clean(v, n) { return String(v == null ? '' : v).trim().slice(0, n || 300); }
  function first(v) { return Array.isArray(v) ? (v[0] || '') : (v || ''); }

  /* Domaines métiers : chaque domaine porte les offres Touch Unique les plus
     pertinentes. Le classement reste local et déterministe ; l'IA distante
     fournit les faits, ce tableau fournit la mise en relation commerciale. */
  var DOMAINS = [
    { id: 'commerce', label: 'Commerce & boutique', words: ['boutique', 'magasin', 'vente', 'commerce', 'produit', 'caisse', 'stock', 'livraison', 'shop', 'marchand', 'supermarché'], offers: ['Identité de marque', 'Visuels produits', 'Boutique en ligne', 'Calendrier éditorial'] },
    { id: 'restauration', label: 'Restauration & hôtellerie', words: ['restaurant', 'café', 'bar', 'hôtel', 'menu', 'repas', 'cuisine', 'réservation', 'brasserie', 'maquis'], offers: ['Carte & menu', 'Photos plat', 'Page Instagram', 'Site de réservation'] },
    { id: 'sante', label: 'Santé & bien-être', words: ['clinique', 'pharmacie', 'docteur', 'dentiste', 'santé', 'bien-être', 'spa', 'massage', 'médical', 'laboratoire'], offers: ['Identité rassurante', 'Support patient', 'Site vitrine', 'Formation équipe'] },
    { id: 'immobilier', label: 'Immobilier & BTP', words: ['immobilier', 'maison', 'appartement', 'chantier', 'construction', 'architecte', 'bureau', 'terrain', 'bâtiment', 'plomberie'], offers: ['Présentation de biens', 'Visuels chantier', 'Site vitrine', 'Catalogue PDF'] },
    { id: 'mode', label: 'Mode & beauté', words: ['mode', 'vêtement', 'couture', 'coiffure', 'beauté', 'maquillage', 'bijou', 'styliste', 'salon'], offers: ['Shooting produit', 'Identité mode', 'Contenus réseaux', 'Boutique en ligne'] },
    { id: 'education', label: 'Éducation & formation', words: ['école', 'formation', 'cours', 'académie', 'université', 'étudiant', 'professeur', 'enfant', 'crèche'], offers: ['Support pédagogique', 'Site école', 'Vidéo de présentation', 'Formation IA'] },
    { id: 'tech', label: 'Tech & services', words: ['informatique', 'logiciel', 'digital', 'agence', 'startup', 'application', 'site web', 'cyber', 'data', 'imprimerie'], offers: ['Site web', 'Application', 'Automatisation IA', 'Outils internes'] },
    { id: 'transport', label: 'Transport & logistique', words: ['transport', 'logistique', 'livraison', 'coursier', 'voiture', 'taxi', 'camion', 'entrepôt', 'déménagement'], offers: ['Identité flotte', 'Suivi de livraison', 'Site vitrine', 'Support chauffeurs'] },
    { id: 'finance', label: 'Finance & assurance', words: ['banque', 'assurance', 'finance', 'crédit', 'épargne', 'mutuelle', 'comptable', 'investissement'], offers: ['Charte confiance', 'Documents clients', 'Site vitrine', 'Devis automatisé'] },
    { id: 'autre', label: 'Autre domaine', words: [], offers: ['Audit visuel', 'Identité visuelle', 'Plan de contenu', 'Site vitrine'] }
  ];

  function domains() { return DOMAINS.map(function (d) { return { id: d.id, label: d.label, offers: d.offers.slice() }; }); }

  function classify(text) {
    var hay = String(text || '').toLowerCase();
    var best = DOMAINS[DOMAINS.length - 1], top = 0;
    DOMAINS.forEach(function (d) {
      var score = 0;
      d.words.forEach(function (w) { if (hay.indexOf(w) >= 0) score++; });
      if (score > top) { top = score; best = d; }
    });
    return { id: best.id, label: best.label, offers: best.offers.slice(), score: top };
  }

  function domainById(id) {
    var found = DOMAINS.find(function (d) { return d.id === id; });
    return found ? { id: found.id, label: found.label, offers: found.offers.slice() } : classify('');
  }

  function phoneOf(text) {
    var m = String(text || '').match(/\+\d[\d\s().-]{7,}\d|\b0[567]\d{8}\b/);
    return m ? m[0].trim() : '';
  }
  function emailOf(text) {
    var m = String(text || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return m ? m[0].toLowerCase() : '';
  }
  function addressOf(text) {
    var m = String(text || '').match(/(?:adresse|siège|localisation|quartier|lieu)\s*[:：]\s*([^\n]{3,160})/i);
    if (m) return clean(m[1], 160);
    var city = String(text || '').match(/\b(Ouagadougou|Bobo-Dioulasso|Koudougou|Pô|Kaya|Dédougou|Fada N'gourma|Abidjan|Dakar|Paris|Lyon)\b/i);
    return city ? clean(city[0], 120) : '';
  }
  function field(text, labels) {
    for (var i = 0; i < labels.length; i++) {
      var re = new RegExp(labels[i] + '\\s*[:：]\\s*(.+)', 'i');
      var m = String(text || '').match(re);
      if (m) return clean(m[1], 300);
    }
    return '';
  }
  function digits(phone) {
    var d = String(phone || '').replace(/\D/g, '');
    if (d.length === 9 && d[0] === '0') d = '226' + d;
    return d;
  }
  function bucketOf(p) { return (p && p.bucket) || 'online'; }

  function duplicate(p) {
    var list = (Store() && Store().db && Store().db.prospects) || [];
    var bucket = bucketOf(p);
    return list.find(function (x) {
      if (bucketOf(x) !== bucket) return false; // séparation stricte des deux bacs
      return (p.phone && x.phone && digits(x.phone) === digits(p.phone)) ||
        (p.email && x.email && x.email === p.email) ||
        (p.name && x.name && x.name.toLowerCase() === p.name.toLowerCase());
    });
  }

  function add(patch) {
    var S = Store();
    if (!S || !S.add) return null;
    var p = Object.assign({
      name: '', phone: '', email: '', city: '', need: '', source: 'Manuel',
      bucket: 'online', domain: '', domainLabel: '', offers: [], images: [],
      status: 'à contacter', createdAt: now(), tags: []
    }, patch || {});
    p.name = clean(p.name, 120); p.phone = clean(p.phone, 40);
    p.email = clean(p.email, 160); p.need = clean(p.need, 2000);
    var found = duplicate(p);
    if (found) {
      var updates = {};
      ['name', 'phone', 'email', 'city', 'need', 'source', 'domain', 'domainLabel'].forEach(function (k) {
        if (p[k] && !found[k]) updates[k] = p[k];
      });
      if (p.offers && p.offers.length && !(found.offers || []).length) updates.offers = p.offers;
      if (p.images && p.images.length) {
        var imgs = (found.images || []).concat(p.images).filter(function (v, i, a) { return v && a.indexOf(v) === i; }).slice(0, 16);
        if (imgs.length !== (found.images || []).length) updates.images = imgs;
      }
      if (Object.keys(updates).length) S.update('prospects', found.id, updates);
      return S.db.prospects.find(function (x) { return x.id === found.id; });
    }
    return S.add('prospects', p);
  }

  function fromReport(text, meta) {
    var blocks = String(text || '').split(/\n\s*(?:\n|[-*•]|\d+[.)])/).filter(Boolean);
    if (!blocks.length) blocks = [String(text || '')];
    var added = [];
    blocks.forEach(function (block) {
      var name = field(block, ['nom', 'entreprise', 'client', 'prospect', 'structure']) ||
        clean(block.split(/[—–-]/)[0], 120);
      var phone = phoneOf(block), email = emailOf(block);
      var need = field(block, ['besoin', 'projet', 'demande', 'service', 'intérêt', 'offre']) ||
        clean(block, 400);
      if (!phone && !email) return;
      if (!name || name.length < 3) name = email.split('@')[0] || phone;
      var p = add({
        bucket: 'online', name: name, phone: phone, email: email, need: need,
        city: field(block, ['ville', 'localité', 'adresse']),
        source: (meta && meta.name ? 'Robot · ' + meta.name : 'Robot prospection'),
        status: 'à contacter',
        robotId: meta && meta.robotId || '',
        at: now()
      });
      if (p) added.push(p);
    });
    return added;
  }

  function fromMessage(message, thread) {
    if (!message || message.direction === 'out') return null;
    return add({
      bucket: 'online',
      name: message.name || 'Visiteur du site',
      phone: message.phone || phoneOf(message.text || ''),
      email: message.email || emailOf(message.text || ''),
      need: message.need || message.text || (message.attachment ? 'Pièce jointe reçue' : ''),
      source: 'Messagerie site',
      status: 'à contacter',
      thread: thread || message.thread || '',
      at: message.at || now()
    });
  }

  /* Une image analysée devient une fiche du bac « images », classée par domaine,
     avec les services Touch Unique suggérés. Aucune fusion avec le bac en ligne. */
  function fromImageReport(report, meta) {
    report = report || {};
    meta = meta || {};
    var entities = report.entities || {};
    var values = [];
    ['names', 'organisations', 'phones', 'emails', 'urls', 'addresses', 'lieux'].forEach(function (k) {
      var arr = Array.isArray(entities[k]) ? entities[k] : (entities[k] ? [entities[k]] : []);
      arr.forEach(function (v) { values.push(String(v || '')); });
    });
    var text = [report.summary, (report.details || []).join('\n'), values.join('\n'), report.raw]
      .filter(Boolean).join('\n');
    var forced = meta.forcedDomain && meta.forcedDomain !== 'auto' ? domainById(meta.forcedDomain) : null;
    var cls = forced || classify(text);
    var phone = phoneOf(text) || first(entities.phones) || phoneOf(meta.name || '');
    var email = emailOf(text) || first(entities.emails) || emailOf(meta.name || '');
    var fallback = clean((meta.name || report.name || 'image').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '), 120);
    var name = clean(first(entities.organisations) || first(entities.names) || field(text, ['entreprise', 'nom', 'raison sociale']) ||
      fallback || email.split('@')[0] || phone, 120);
    if (!name || name.length < 3) name = fallback || 'Prospect image';
    var mission = clean(report.suggestedMission || '', 500);
    var need = clean([mission, report.summary].filter(Boolean).join(' · ') || 'Informations à vérifier sur l’image', 1200);
    return add({
      bucket: 'images',
      name: name,
      phone: clean(phone, 40),
      email: clean(email, 160),
      city: addressOf(text) || clean(first(entities.addresses || entities.lieux || []), 160),
      need: need,
      source: 'Analyse images · ' + cls.label,
      domain: cls.id,
      domainLabel: cls.label,
      offers: cls.offers,
      images: [clean(meta.name || report.name || 'image', 160)],
      confidence: clean(report.confidence || '', 40),
      reportFile: clean(report.analysisFile || '', 200),
      status: 'à contacter',
      at: now()
    });
  }

  function fromImageReports(reports, meta) {
    var arr = Array.isArray(reports) ? reports : [reports];
    var out = [];
    arr.forEach(function (r) {
      var p = fromImageReport(r, meta);
      if (p) out.push(p);
    });
    return out;
  }

  function whatsapp(p, message) {
    var to = digits(p && p.phone) || '22655041530';
    var text = message || ('Bonjour ' + (p && p.name || '') + ', suite à votre message sur Touch Unique Studio…');
    return 'https://wa.me/' + to + '?text=' + encodeURIComponent(text);
  }

  function list() {
    return (Store() && Store().db && Store().db.prospects) || [];
  }

  root.TUSProspects = {
    list: list, add: add, fromReport: fromReport, fromMessage: fromMessage,
    fromImageReport: fromImageReport, fromImageReports: fromImageReports,
    domains: domains, classify: classify, domainById: domainById, bucketOf: bucketOf,
    whatsapp: whatsapp, phoneOf: phoneOf, emailOf: emailOf, digits: digits
  };
})(window);
