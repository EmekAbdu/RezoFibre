import re,sys
P='REZO_FIBRE.html'
s=open(P,encoding='utf-8').read()
def R(a,b,cnt=1):
    global s
    n=s.count(a)
    if n!=cnt: sys.exit(f"MATCH {n}!={cnt}: {a[:80]!r}")
    s=s.replace(a,b)

# --- CSS
R("nav .l{font-size:9.5px;font-weight:600;white-space:nowrap}",
  "nav .l{font-size:9.5px;font-weight:600;white-space:nowrap}\n"
  ".connexion{position:fixed;inset:0;background:#eef2f7;z-index:300;display:none;align-items:center;justify-content:center;padding:16px}\n"
  ".connexion.on{display:flex}\n"
  ".connexion .boite{max-width:420px;width:100%;background:#fff;border:1px solid var(--trait);border-radius:14px;padding:22px 18px;text-align:center}\n"
  ".vign .par{font-size:10.5px;color:var(--gris)}\n"
  "#dosChemin a{color:var(--bleu);text-decoration:none;font-weight:600}")

# --- nav
R("""  <button data-tab="ach" onclick="App.aller('ach')"><span class="i">📷</span><span class="l">Photo</span></button>""",
  """  <button data-tab="ach" onclick="App.aller('ach')"><span class="i">📷</span><span class="l">Photo</span></button>
  <button data-tab="dos" onclick="App.aller('dos')"><span class="i">🗂️</span><span class="l">Dossiers</span></button>
  <button data-tab="arc" data-lecteur="1" onclick="App.aller('arc')"><span class="i">📁</span><span class="l">Archive</span></button>""")

# --- section dossiers
R("""<!-- ==================== ADMIN ==================== -->""",
"""<!-- ==================== DOSSIERS ==================== -->
<section id="scr-dos" class="screen">
  <div class="carte">
    <h2>Dossiers de l'entreprise</h2>
    <p class="lead" id="dosChemin"></p>
    <div id="dosActions"></div>
    <input type="file" id="fDos" multiple style="display:none" onchange="App.ajouterFichiers(event)">
  </div>
  <div class="recherche"><input id="rechDos" placeholder="🔍 Rechercher un document…" oninput="App.rendreDossiers()"></div>
  <div id="listeDossiers"></div>
</section>

<!-- ==================== ADMIN ==================== -->""")

# --- carte acces dans l'admin
R("""    <div class="carte">
      <h2>Données</h2>""",
"""    <div class="carte">
      <h2>Accès et partage</h2>
      <p class="lead">Abdou administre l'application. Ridha consulte tout et gère la rubrique Photo : il peut effacer ses photos le jour même de la prise, ensuite il doit passer par vous. Ces règles sont appliquées par le serveur.</p>
      <div class="btn-row">
        <button class="btn btn-p" onclick="App.partagerAccesRidha()">📲 Envoyer son accès à Ridha</button>
        <button class="btn btn-f" onclick="App.synchroniser()">↻ Synchroniser</button>
      </div>
      <div style="margin-top:8px"><button class="btn btn-f" onclick="App.deconnecter()">Déconnecter cet appareil</button></div>
    </div>

    <div class="carte">
      <h2>Données</h2>""")

# --- ecran de connexion
R("""<div id="toast"></div>""",
"""<div id="connexion" class="connexion"><div class="boite">
  <div style="font-size:34px">🔐</div>
  <h2 style="justify-content:center;margin:8px 0">Connexion à REZO FIBRE</h2>
  <p class="lead">Ouvrez le lien d'accès personnel que vous avez reçu, ou collez-le ici.</p>
  <div class="champ"><input id="cxCle" placeholder="Lien ou clé d'accès" autocomplete="off"></div>
  <button class="btn btn-p" onclick="App.validerCle()">Se connecter</button>
  <p class="lead" id="cxMsg" style="margin-top:12px;color:var(--alerte)"></p>
</div></div>
<div id="toast"></div>""")

# --- lead Photo
R("""Transmission au suivi comptable : <b>contact@rezofibre.fr</b>.</p>""",
  """Transmission au suivi comptable : <b>contact@rezofibre.fr</b>. Les photos sont partagées entre Abdou et Ridha ; Ridha peut effacer les siennes <b>le jour même</b>, ensuite il passe par Abdou.</p>""")

# --- version
R('const VERSION="1.4";','const VERSION="1.5";')

# --- stockage local renomme
R("function achatMettre(o){\n  return magasin","function localMettre(o){\n  return magasin")
R("function achatTous(){\n  return magasin","function localTous(){\n  return magasin")
R("function achatLire(id){\n  return magasin","function localLire(id){\n  return magasin")
R("function achatEffacer(id){\n  return magasin","function localEffacer(id){\n  return magasin")

# --- bloc serveur
bloc=open('outils/bloc_serveur.js',encoding='utf-8').read()
R("/* =============== installation sur l'ecran d'accueil =================",
  bloc+"\n/* =============== installation sur l'ecran d'accueil =================")

# --- charger / completer / sauver
R("function charger(){\n  try{ const b=localStorage.getItem(CLE); if(b) D=JSON.parse(b); }catch(e){ D=null; }\n",
  "function charger(){\n  try{ const b=localStorage.getItem(CLE); if(b) D=JSON.parse(b); }catch(e){ D=null; }\n  completer();\n}\nfunction completer(){\n")
R("  tirerSlogan();\n  sauver();\n}","  tirerSlogan();\n  sauverLocal();\n}")
R("""function sauver(){ try{ localStorage.setItem(CLE,JSON.stringify(D)); }catch(e){ toast("Enregistrement impossible — mémoire du navigateur pleine"); } }""",
"""function sauverLocal(){ try{ localStorage.setItem(CLE,JSON.stringify(D)); }catch(e){ toast("Enregistrement impossible — mémoire du navigateur pleine"); } }
/* Ridha consulte : rien de ce qu'il change n'est garde, l'etat du serveur est retabli. */
function sauver(){
  if(lecteur()){
    try{ const b=localStorage.getItem(CLE); if(b){ D=JSON.parse(b); } }catch(e){}
    toast("Consultation seule — modification non enregistrée. Demandez à Abdou.");
    return;
  }
  sauverLocal(); pousser();
}""")

# --- navigation
R("""aller(t){
  ecran=t;""","""aller(t){
  if(lecteur()&&ONGLETS_ECRITURE.indexOf(t)>=0){ toast("Consultation seule : réservé à l'administrateur"); t="acc"; }
  ecran=t;""")
R("""  if(t==="adm") App.rendreAdmin();
},""","""  if(t==="adm") App.rendreAdmin();
  if(t==="dos") App.listeDossiers();
},""")

# --- tuiles
R("""  ["arc","📁","Archive","Documents émis, factures d'achat et administration"],""",
  """  ["arc","📁","Archive","Documents émis, factures d'achat et administration"],
  ["dos","🗂️","Dossiers","Les documents de l'entreprise, rangés par rubrique"],""")
R("""  const tuiles=admin?App.TUILES.concat([App.TUILE_ADMIN]):App.TUILES;""",
  """  const tuiles=lecteur()?App.TUILES.filter(t=>TUILES_LECTEUR.indexOf(t[0])>=0)
              :(admin?App.TUILES.concat([App.TUILE_ADMIN]):App.TUILES);""")
R("""  img.addEventListener("click",()=>{
    if(admin) return;""","""  img.addEventListener("click",()=>{
    if(admin||lecteur()) return;""")

# --- vignette
R("""  const u=URL.createObjectURL(p.blob);
  const img=/^image\\//.test(p.type)?'<img class="img" src="'+u+'" alt="">':'<div class="pdf">📄</div>';""",
"""  const u=p.blob?URL.createObjectURL(p.blob):(p.vignette||"");
  const img=(/^image\\//.test(p.type)&&u)?'<img class="img" src="'+u+'" alt="">':'<div class="pdf">'+(/pdf/.test(p.type||"")?"📄":"🖼️")+'</div>';""")
R("""    '<div class="d">'+(p.transmisLe?'<span style="color:var(--ok)">✓ transmise</span>':'<span style="color:var(--attente)">à transmettre</span>')+'</div>'+
    '</div></div>';""",
"""    '<div class="d">'+(p.transmisLe?'<span style="color:var(--ok)">✓ transmise</span>':'<span style="color:var(--attente)">à transmettre</span>')+'</div>'+
    (ROLE?'<div class="par">'+(p.sync==="ok"?'📷 '+esc(nomRole(p.par)||"—")+(peutToucher(p)?'':' · 🔒'):'⏳ envoi en attente')+'</div>':'')+
    '</div></div>';""")

# --- ouvrirAchat
R("""  achatLire(id).then(p=>{
    if(!p) return;
    const u=URL.createObjectURL(p.blob);
    const r=rubDe(p);""","""  achatLire(id).then(p=>{
    if(!p) return;
    const u=p.blob?URL.createObjectURL(p.blob):(p.vignette||"");
    const r=rubDe(p);""")
R("""      '<button class="btn btn-f" onclick="App.fermer()">Fermer</button></div>');
  });
},
choisirRubrique(r){""","""      '<button class="btn btn-f" onclick="App.fermer()">Fermer</button></div>');
    App.verrouPiece(p);
  });
},
choisirRubrique(r){""")
R("""    return achatMettre(p);
  }).then(()=>{ fermer(); if(ecran==="arc") App.listeArchive(); else App.listeAchats(); toast("Pièce enregistrée"); });""",
"""    return achatMettre(p);
  }).then(()=>{ fermer(); if(ecran==="arc") App.listeArchive(); else App.listeAchats(); toast("Pièce enregistrée"); })
    .catch(e=>{ fermer(); toast(e.message||"Enregistrement refusé"); });""")

# --- suppressions
R("""  Promise.all(ids.map(id=>achatEffacer(id))).then(()=>{
    ids.forEach(id=>{ delete App._achatsSel[id]; });
    fermer();
    if(ecran==="arc") App.listeArchive(); else App.listeAchats();
    toast(ids.length>1?ids.length+" pièces supprimées":"Pièce supprimée");
  }).catch(()=>toast("Suppression impossible sur cet appareil"));""",
"""  Promise.all(ids.map(id=>achatEffacer(id).then(()=>({id:id,ok:true}),e=>({id:id,ok:false,m:e.message})))).then(rs=>{
    const ok=rs.filter(x=>x.ok), ko=rs.filter(x=>!x.ok);
    ok.forEach(x=>{ delete App._achatsSel[x.id]; });
    fermer();
    if(ecran==="arc") App.listeArchive(); else App.listeAchats();
    if(!ko.length) toast(ok.length>1?ok.length+" pièces supprimées":"Pièce supprimée");
    else toast((ok.length?ok.length+" supprimée"+(ok.length>1?"s":"")+" — ":"")+ko.length+" refusée"+(ko.length>1?"s":"")+" : "+ko[0].m);
  });""")
R("""  achatEffacer(id).then(()=>{ delete App._achatsSel[id]; fermer();
    if(ecran==="arc") App.listeArchive(); else App.listeAchats(); toast("Pièce supprimée"); });""",
"""  achatEffacer(id).then(()=>{ delete App._achatsSel[id]; fermer();
    if(ecran==="arc") App.listeArchive(); else App.listeAchats(); toast("Pièce supprimée"); })
    .catch(e=>{ fermer(); toast(e.message||"Suppression refusée"); });""")
R("""' de cet appareil.'+""","""(ROLE?' pour tout le monde (Abdou et Ridha).':' de cet appareil.')+""")
R("""La photo sera définitivement effacée de cet appareil.""","""La photo sera définitivement effacée'+(ROLE?' pour tout le monde':' de cet appareil')+'.""")

# --- transmission : les photos du serveur sont rapatriees avant l'envoi
R("""    if(!l.length){ toast("Aucune pièce à transmettre"); return; }
    const txt=App.recapAchats(l);""","""    if(!l.length){ toast("Aucune pièce à transmettre"); return; }
    return Promise.all(l.map(p=>p.blob?p:achatLire(p.id))).then(l2=>{
    l=l2.filter(p=>p&&p.blob);
    if(!l.length){ toast("Photos indisponibles sans connexion"); return; }
    const txt=App.recapAchats(l);""")
R("""    App._repli={l:l,txt:txt,suj:suj,marquer:marquer};
  });""","""    App._repli={l:l,txt:txt,suj:suj,marquer:marquer};
    });
  });""")

# --- overlays : Ridha ne voit pas les boutons de modification
R("""function ouvrir(html){ document.getElementById("ovSheet").innerHTML=html; document.getElementById("ov").classList.add("on"); }""",
"""function ouvrir(html){
  const sh=document.getElementById("ovSheet");
  sh.innerHTML=html;
  if(lecteur()) sh.querySelectorAll("button").forEach(b=>{
    if(/marquerPaye|marquerImpaye|rouvrirDansEditeur|creerAvoir|ficheIban|ficheClient|enregistrerIban|supprimerIban|defautIban|majSociete/
       .test(b.getAttribute("onclick")||"")) b.style.display="none";
  });
  document.getElementById("ov").classList.add("on");
}""")

# --- entete
R("""  document.getElementById("hRole").textContent = admin?"Administrateur":"Utilisateur";""",
  """  document.getElementById("hRole").textContent = admin?"Administrateur"
    :(ROLE==="admin"?"Abdou":(ROLE==="ridha"?"Ridha · consultation":"Hors ligne"));""")

# --- methodes App
blocA=open('outils/bloc_app.js',encoding='utf-8').read()
R("""/* ---------- factures d'achat ---------- */
capturer(photo){""",blocA+"""/* ---------- factures d'achat ---------- */
capturer(photo){""")

# --- demarrage
R("""charger();
if(!D.brouillon) F=factureNeuve();
majEntete();
App.aller("acc");
if(!D.reglages.accueilVu && !Object.keys(D.factures).length) setTimeout(()=>{""",
"""charger();
ROLE=lsGet(CLE_ROLE)||null;
(function(){ const h=(location.hash||"").match(/cle=([A-Za-z0-9]+)/);
  if(h){ lsSet(CLE_ACCES,h[1]); lsSet(CLE_ROLE,null); ROLE=null;
    try{ history.replaceState(null,"",location.pathname+location.search); }catch(e){} } })();
if(!D.brouillon) F=factureNeuve();
appliquerRole();
majEntete();
App.aller("acc");
if(!Srv.cle()) App.ecranConnexion(""); else App.connecter(!lsGet(CLE_ROLE));
if(ROLE==="admin" && !D.reglages.accueilVu && !Object.keys(D.factures).length) setTimeout(()=>{""")

open(P,'w',encoding='utf-8').write(s)
print("ok", len(s))
