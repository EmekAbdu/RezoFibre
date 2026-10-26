/* =====================================================================
   REZO FIBRE — serveur de l'application (Google Apps Script)
   ---------------------------------------------------------------------
   Le script s'exécute avec le compte Google d'Abdou (propriétaire du
   dossier « REZO FIBRE APP » dans son Drive). Les droits sont vérifiés
   ICI, côté serveur : l'application ne peut pas les contourner.

   Rôles (clé d'accès personnelle, stockée dans les propriétés du script) :
   - admin  : Abdou — tout lire, tout modifier.
   - ridha  : Ridha — consulte tout ; dans la rubrique Photo il ajoute,
              modifie et efface SES photos le jour même de la prise
              (heure de Paris). Dès le lendemain : plus de modification
              ni d'effacement, il doit passer par l'administrateur.
              Seule exception : il peut toujours marquer une photo comme
              transmise au suivi comptable.
   ===================================================================== */

const RACINE = 'REZO FIBRE APP';
const DOSSIERS = 'DOSSIERS';
const PHOTOS = 'PHOTOS';
const FICHIER_DONNEES = 'donnees_facturation.json';
const FICHIER_INDEX = 'index_photos.json';
const TZ = 'Europe/Paris';
const TAILLE_MAX = 25 * 1024 * 1024;

/* ---------- installation : à lancer une fois depuis l'éditeur ---------- */
function installer() {
  const p = PropertiesService.getScriptProperties();
  if (!p.getProperty('CLE_ADMIN')) p.setProperty('CLE_ADMIN', cleNeuve_());
  if (!p.getProperty('CLE_RIDHA')) p.setProperty('CLE_RIDHA', cleNeuve_());
  const r = racine_();
  sous_(DOSSIERS); sous_(PHOTOS);
  ecrireAcces_();
  Logger.log('Installation terminée. Dossier : ' + r.getUrl());
  Logger.log('Les liens de connexion sont dans le document « ACCES APPLICATION REZO FIBRE » de votre Drive.');
}

/* Change la clé de Ridha (ex. téléphone perdu) : l'ancien lien cesse de fonctionner. */
function renouvelerCleRidha() {
  PropertiesService.getScriptProperties().setProperty('CLE_RIDHA', cleNeuve_());
  ecrireAcces_();
}

function cleNeuve_() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
}

function lienDe_(cle) {
  const p = PropertiesService.getScriptProperties();
  const base = p.getProperty('URL_APP') || 'https://emekabdu.github.io/RezoFibre/';
  return base + '#cle=' + cle;
}

function ecrireAcces_() {
  const p = PropertiesService.getScriptProperties();
  const nom = 'ACCES APPLICATION REZO FIBRE';
  const it = racine_().getFilesByName(nom);
  let doc;
  if (it.hasNext()) doc = DocumentApp.openById(it.next().getId());
  else {
    doc = DocumentApp.create(nom);
    const f = DriveApp.getFileById(doc.getId());
    f.moveTo(racine_());
  }
  const b = doc.getBody();
  b.clear();
  b.appendParagraph('Accès à l\'application REZO FIBRE').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  b.appendParagraph('Document privé. Chaque lien est une clé personnelle : ne le transférez qu\'à la personne concernée.');
  b.appendParagraph('Abdou — administrateur').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  b.appendParagraph(lienDe_(p.getProperty('CLE_ADMIN')));
  b.appendParagraph('Ridha — consultation + rubrique Photo').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  b.appendParagraph(lienDe_(p.getProperty('CLE_RIDHA')));
  b.appendParagraph('Ouvrez le lien sur le téléphone concerné : l\'application mémorise la clé. ' +
    'En cas de perte du téléphone de Ridha, lancez renouvelerCleRidha() dans le script.');
  doc.saveAndClose();
}

/* ---------- utilitaires ---------- */
function racine_() {
  const p = PropertiesService.getScriptProperties();
  const id = p.getProperty('RACINE_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  const it = DriveApp.getFoldersByName(RACINE);
  const f = it.hasNext() ? it.next() : DriveApp.createFolder(RACINE);
  p.setProperty('RACINE_ID', f.getId());
  return f;
}
function sous_(nom) {
  const r = racine_();
  const it = r.getFoldersByName(nom);
  return it.hasNext() ? it.next() : r.createFolder(nom);
}
function jour_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function sortie_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function role_(cle) {
  if (!cle || typeof cle !== 'string') return null;
  const p = PropertiesService.getScriptProperties();
  if (cle === p.getProperty('CLE_ADMIN')) return 'admin';
  if (cle === p.getProperty('CLE_RIDHA')) return 'ridha';
  return null;
}
function adminSeul_(r) {
  if (r !== 'admin') throw new Error('Consultation seule : cette action est réservée à l\'administrateur.');
}
function verrou_(fn) {
  const l = LockService.getScriptLock();
  l.waitLock(25000);
  try { return fn(); } finally { l.releaseLock(); }
}
function lireJson_(dossier, nom, defaut) {
  const it = dossier.getFilesByName(nom);
  if (!it.hasNext()) return defaut;
  try { return JSON.parse(it.next().getBlob().getDataAsString('UTF-8')); } catch (e) { return defaut; }
}
function ecrireJson_(dossier, nom, obj) {
  const txt = JSON.stringify(obj);
  const it = dossier.getFilesByName(nom);
  if (it.hasNext()) it.next().setContent(txt);
  else dossier.createFile(nom, txt, 'application/json');
}
/* Vrai si le fichier/dossier est rangé (à n'importe quelle profondeur) sous « parent ». */
function estSous_(item, parentId) {
  const vus = {};
  let niv = [item];
  for (let pas = 0; pas < 12 && niv.length; pas++) {
    const suiv = [];
    for (const x of niv) {
      const ps = x.getParents();
      while (ps.hasNext()) {
        const p = ps.next();
        if (p.getId() === parentId) return true;
        if (!vus[p.getId()]) { vus[p.getId()] = 1; suiv.push(p); }
      }
    }
    niv = suiv;
  }
  return false;
}

/* ---------- points d'entrée web ---------- */
function doGet() {
  return sortie_({ ok: true, app: 'REZO FIBRE', jour: jour_() });
}

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (x) { return sortie_({ ok: false, err: 'Requête illisible' }); }
  const r = role_(req.cle);
  if (!r) return sortie_({ ok: false, code: 401, err: 'Clé d\'accès invalide ou révoquée' });
  const f = ACTIONS[req.action];
  if (!f) return sortie_({ ok: false, err: 'Action inconnue : ' + req.action });
  try {
    const res = f(req, r) || {};
    return sortie_(Object.assign({ ok: true, role: r, jour: jour_() }, res));
  } catch (x) {
    return sortie_({ ok: false, role: r, jour: jour_(), err: String((x && x.message) || x) });
  }
}

/* ---------- photos : index ---------- */
const CHAMPS_PHOTO = ['nom', 'fournisseur', 'date', 'montant', 'note', 'rubrique', 'auto', 'confiance',
  'type', 'taille', 'cree', 'transmisLe', 'vignette'];
function indexPhotos_() { return lireJson_(sous_(PHOTOS), FICHIER_INDEX, {}); }
function ecrireIndex_(ix) { ecrireJson_(sous_(PHOTOS), FICHIER_INDEX, ix); }
function peutToucher_(m, r) {
  return r === 'admin' || (m.par === 'ridha' && r === 'ridha' && m.jour === jour_());
}
const REFUS_PHOTO = 'Cette photo n\'est plus modifiable depuis votre téléphone (prise un autre jour ou par l\'administrateur). Demandez à Abdou.';

/* ---------- actions ---------- */
const ACTIONS = {

  moi: function (q, r) { return {}; },

  /* Partage de l'accès de Ridha depuis l'espace admin de l'application */
  lienRidha: function (q, r) {
    adminSeul_(r);
    return { lien: lienDe_(PropertiesService.getScriptProperties().getProperty('CLE_RIDHA')) };
  },

  /* Données de facturation (clients, factures, devis, banque…) */
  donnees: function (q, r) {
    const it = racine_().getFilesByName(FICHIER_DONNEES);
    if (!it.hasNext()) return { donnees: null, maj: 0 };
    const f = it.next();
    return { donnees: f.getBlob().getDataAsString('UTF-8'), maj: f.getLastUpdated().getTime() };
  },
  enregistrerDonnees: function (q, r) {
    adminSeul_(r);
    if (typeof q.donnees !== 'string' || q.donnees.length < 20) throw new Error('Données vides refusées');
    JSON.parse(q.donnees); // contrôle de forme
    return verrou_(function () {
      ecrireJson_(racine_(), FICHIER_DONNEES, JSON.parse(q.donnees));
      return { maj: Date.now() };
    });
  },

  /* Rubriques = dossiers du PC copiés dans DOSSIERS */
  dossiers: function (q, r) {
    const arbre = function (d) {
      const o = { id: d.getId(), nom: d.getName(), dossiers: [], fichiers: [] };
      const ds = d.getFolders();
      while (ds.hasNext()) o.dossiers.push(arbre(ds.next()));
      const fs = d.getFiles();
      while (fs.hasNext()) {
        const f = fs.next();
        o.fichiers.push({ id: f.getId(), nom: f.getName(), taille: f.getSize(), type: f.getMimeType(),
          maj: f.getLastUpdated().getTime() });
      }
      o.dossiers.sort(function (a, b) { return a.nom.localeCompare(b.nom, 'fr'); });
      o.fichiers.sort(function (a, b) { return a.nom.localeCompare(b.nom, 'fr'); });
      return o;
    };
    return { arbre: arbre(sous_(DOSSIERS)) };
  },
  fichier: function (q, r) {
    const f = DriveApp.getFileById(String(q.id));
    if (!estSous_(f, sous_(DOSSIERS).getId())) throw new Error('Fichier hors des rubriques');
    if (f.getSize() > TAILLE_MAX) throw new Error('Fichier trop volumineux pour l\'application (' +
      Math.round(f.getSize() / 1048576) + ' Mo) — ouvrez-le depuis Google Drive');
    let b;
    const mt = f.getMimeType();
    if (/^application\/vnd\.google-apps\./.test(mt)) b = f.getAs('application/pdf');
    else b = f.getBlob();
    return { nom: f.getName(), type: b.getContentType(), b64: Utilities.base64Encode(b.getBytes()) };
  },
  ajouterFichier: function (q, r) {
    adminSeul_(r);
    const d = DriveApp.getFolderById(String(q.dossier));
    const racineDos = sous_(DOSSIERS);
    if (d.getId() !== racineDos.getId() && !estSous_(d, racineDos.getId())) throw new Error('Rubrique inconnue');
    const blob = Utilities.newBlob(Utilities.base64Decode(q.b64), q.type || 'application/octet-stream', q.nom);
    const f = d.createFile(blob);
    return { id: f.getId() };
  },
  supprimerFichier: function (q, r) {
    adminSeul_(r);
    const f = DriveApp.getFileById(String(q.id));
    if (!estSous_(f, sous_(DOSSIERS).getId())) throw new Error('Fichier hors des rubriques');
    f.setTrashed(true); // corbeille Drive : récupérable 30 jours
    return {};
  },

  /* Rubrique Photo, partagée */
  photos: function (q, r) {
    const ix = indexPhotos_();
    return { photos: Object.keys(ix).map(function (k) { return ix[k]; }) };
  },
  photo: function (q, r) {
    const m = indexPhotos_()[q.id];
    if (!m) throw new Error('Photo introuvable (supprimée ?)');
    const b = DriveApp.getFileById(m.fichierId).getBlob();
    return { type: m.type || b.getContentType(), b64: Utilities.base64Encode(b.getBytes()) };
  },
  ajouterPhoto: function (q, r) {
    const m0 = q.meta || {};
    if (!m0.id || !/^[A-Za-z0-9_-]{4,64}$/.test(m0.id)) throw new Error('Identifiant de photo invalide');
    const octets = Utilities.base64Decode(q.b64 || '');
    if (!octets.length) throw new Error('Photo vide');
    if (octets.length > TAILLE_MAX) throw new Error('Photo trop volumineuse');
    return verrou_(function () {
      const ix = indexPhotos_();
      if (ix[m0.id]) return { photo: ix[m0.id] }; // déjà reçue (renvoi après coupure réseau)
      const ext = /pdf/.test(m0.type || '') ? '.pdf' : '.jpg';
      const f = sous_(PHOTOS).createFile(Utilities.newBlob(octets, m0.type || 'image/jpeg', m0.id + ext));
      const m = { id: m0.id };
      CHAMPS_PHOTO.forEach(function (c) { if (m0[c] !== undefined) m[c] = m0[c]; });
      m.fichierId = f.getId(); m.par = r; m.jour = jour_(); m.recu = Date.now();
      ix[m.id] = m; ecrireIndex_(ix);
      return { photo: m };
    });
  },
  majPhoto: function (q, r) {
    const n = q.meta || {};
    return verrou_(function () {
      const ix = indexPhotos_();
      const m = ix[n.id];
      if (!m) throw new Error('Photo introuvable (supprimée ?)');
      const change = CHAMPS_PHOTO.filter(function (c) {
        return n[c] !== undefined && JSON.stringify(n[c]) !== JSON.stringify(m[c]);
      });
      if (!peutToucher_(m, r)) {
        const autres = change.filter(function (c) { return c !== 'transmisLe'; });
        if (autres.length) throw new Error(REFUS_PHOTO);
      }
      change.forEach(function (c) { m[c] = n[c]; });
      if (change.length) { m.modifiePar = r; m.modifieLe = Date.now(); ecrireIndex_(ix); }
      return { photo: m };
    });
  },
  supprimerPhoto: function (q, r) {
    return verrou_(function () {
      const ix = indexPhotos_();
      const m = ix[q.id];
      if (!m) return {};
      if (!peutToucher_(m, r)) throw new Error(REFUS_PHOTO);
      try { DriveApp.getFileById(m.fichierId).setTrashed(true); } catch (e) {}
      delete ix[q.id]; ecrireIndex_(ix);
      return {};
    });
  }
};
