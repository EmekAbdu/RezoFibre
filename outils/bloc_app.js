/* ---------- connexion au serveur ---------- */
ecranConnexion(msg){
  const z=document.getElementById("connexion");
  document.getElementById("cxMsg").textContent=msg||"";
  z.classList.add("on");
},
validerCle(){
  const v=(document.getElementById("cxCle").value||"").trim();
  const m=v.match(/cle=([A-Za-z0-9]+)/);
  const cle=m?m[1]:v.replace(/[^A-Za-z0-9]/g,"");
  if(cle.length<20){ document.getElementById("cxMsg").textContent="Clé incomplète : collez le lien reçu en entier."; return; }
  lsSet(CLE_ACCES,cle);
  document.getElementById("cxMsg").textContent="Vérification…";
  App.connecter(true);
},
connecter(manuel){
  return Srv.appel("moi").then(j=>{
    document.getElementById("connexion").classList.remove("on");
    document.getElementById("cxCle").value="";
    ROLE=j.role; lsSet(CLE_ROLE,ROLE); appliquerRole();
    if(manuel) toast(ROLE==="admin"?"Connecté : Abdou — administrateur":"Connecté : Ridha — consultation et photos");
    return syncDonnees().catch(()=>{}).then(()=>{
      majEntete();
      const e=lecteur()&&ONGLETS_ECRITURE.indexOf(ecran)>=0?"acc":ecran;
      if(e!=="new") App.aller(e);
      achatTous().catch(()=>{});
    });
  }).catch(e=>{
    if(e.horsLigne&&lsGet(CLE_ROLE)){ toast("Hors connexion — données de l'appareil"); return; }
    if(e.horsLigne){ App.ecranConnexion("Pas de connexion au serveur. Vérifiez internet puis réessayez."); return; }
    App.ecranConnexion(e.message);
  });
},
deconnecter(){
  ouvrir('<h3>Déconnecter cet appareil ?</h3>'+
    '<div class="note warn">L\'application oubliera la clé d\'accès de ce téléphone. Il faudra rouvrir le lien reçu pour se reconnecter. '+
    'Les photos non encore envoyées au serveur restent sur l\'appareil.</div>'+
    '<div class="btn-row"><button class="btn btn-d" onclick="App.confirmerDeconnexion()">Déconnecter</button>'+
    '<button class="btn btn-f" onclick="App.fermer()">Annuler</button></div>');
},
confirmerDeconnexion(){
  lsSet(CLE_ACCES,null); lsSet(CLE_ROLE,null); ROLE=null; admin=false; appliquerRole(); fermer();
  App.aller("acc"); App.ecranConnexion("");
},
partagerAccesRidha(){
  Srv.appel("lienRidha").then(j=>{
    const txt="Accès à l'application REZO FIBRE (personnel, ne pas transférer) : "+j.lien;
    if(navigator.share){ navigator.share({title:"Application REZO FIBRE",text:txt}).catch(()=>{}); return; }
    ouvrir('<h3>Lien d\'accès de Ridha</h3>'+
      '<div class="note warn">Ce lien est sa clé personnelle : envoyez-le uniquement à Ridha.</div>'+
      '<div class="champ"><input id="lienR" readonly value="'+esc(j.lien)+'" onclick="this.select()"></div>'+
      '<div class="btn-row"><a class="btn btn-p" href="https://wa.me/?text='+encodeURIComponent(txt)+'" target="_blank">WhatsApp</a>'+
      '<button class="btn btn-f" onclick="App.fermer()">Fermer</button></div>');
  }).catch(e=>toast(e.message));
},
synchroniser(){
  toast("Synchronisation…");
  syncDonnees().then(()=>achatTous()).then(()=>{ App._dosArbre=null; App.aller(ecran==="new"?"acc":ecran); toast("À jour"); })
    .catch(e=>toast(e.message));
},
verrouPiece(p){
  if(peutToucher(p)) return;
  const sh=document.getElementById("ovSheet");
  sh.querySelectorAll("input").forEach(i=>{ i.disabled=true; });
  sh.querySelectorAll("button").forEach(b=>{
    const oc=b.getAttribute("onclick")||"";
    if(/enregistrerAchat|supprimerAchat|choisirRubrique/.test(oc)) b.style.display="none";
  });
  const n=document.createElement("div");
  n.className="note warn";
  n.innerHTML="🔒 Photo "+(p.par==="admin"?"ajoutée par Abdou":"prise le "+esc(frDate(p.jour||p.date)))+
    " : vous ne pouvez plus la modifier ni l'effacer. Pour toute correction, <b>passez par Abdou</b>.";
  sh.insertBefore(n,sh.children[2]||null);
},

/* ---------- rubriques : dossiers de l'entreprise ---------- */
_dosArbre:null,
_dosChemin:[],
ICONES_DOS:{"ADMINISTRATION":"🏛️","ASSURANCE":"🛡️","BANQUE":"🏦","CENTRE_DES_IMPOTS":"💶","COMPTABILITE":"📊",
  "CONTRAT_FOURNISSEURS":"🤝","COREL":"🎨","FACTURATION":"🧾","K-BIS":"📜","NET_ENTREPRISES":"🌐",
  "PERSONNEL":"👷","PORTAILPRO.GOUV":"🏢","TéléDSN":"📤","URSSAF":"🏛️","VEHICULE":"🚐"},
nomDos(s){ return String(s||"").replace(/_/g," "); },
compteDos(n){ return (n.fichiers||[]).length+(n.dossiers||[]).reduce((a,d)=>a+App.compteDos(d),0); },
listeDossiers(recharger){
  const z=document.getElementById("listeDossiers");
  if(!Srv.cle()){ z.innerHTML='<div class="vide">Connectez-vous pour consulter les dossiers.</div>'; return; }
  if(!App._dosArbre){ try{ const c=lsGet(CLE_DOS); if(c) App._dosArbre=JSON.parse(c); }catch(e){} }
  if(App._dosArbre) App.rendreDossiers();
  else z.innerHTML='<div class="vide">Chargement des dossiers…</div>';
  if(App._dosArbre&&!recharger&&App._dosFrais) return;
  Srv.appel("dossiers").then(j=>{
    App._dosArbre=j.arbre; App._dosFrais=true; lsSet(CLE_DOS,JSON.stringify(j.arbre));
    if(ecran==="dos") App.rendreDossiers();
  }).catch(e=>{
    if(!App._dosArbre) z.innerHTML='<div class="vide">Dossiers indisponibles : '+esc(e.message)+'</div>';
    else if(recharger) toast("Hors connexion — dernière liste connue");
  });
},
dosCourant(){
  let n=App._dosArbre; const ch=[];
  for(const id of App._dosChemin){
    const s=(n.dossiers||[]).filter(d=>d.id===id)[0]; if(!s) break; n=s; ch.push(s);
  }
  App._dosChemin=ch.map(d=>d.id);
  return {n:n,ch:ch};
},
rendreDossiers(){
  if(!App._dosArbre) return;
  const c=App.dosCourant(), n=c.n, ch=c.ch;
  const q=(document.getElementById("rechDos").value||"").toLowerCase().trim();
  document.getElementById("dosChemin").innerHTML=
    '<a href="javascript:void(0)" onclick="App.remonterDos(0)">🗂️ Rubriques</a>'+
    ch.map((d,i)=>' › <a href="javascript:void(0)" onclick="App.remonterDos('+(i+1)+')">'+esc(App.nomDos(d.nom))+'</a>').join("");
  document.getElementById("dosActions").innerHTML=
    (ch.length?'<button class="btn btn-f mini" onclick="App.remonterDos('+(ch.length-1)+')">← Retour</button> ':'')+
    (ROLE==="admin"&&ch.length?'<button class="btn btn-s mini" onclick="document.getElementById(\'fDos\').click()">＋ Ajouter un document ici</button> ':'')+
    '<button class="btn btn-f mini" onclick="App.listeDossiers(true)">↻ Actualiser</button>'+
    (lecteur()?'<p class="lead" style="margin:8px 0 0">Consultation seule. Pour ajouter ou retirer un document, demandez à Abdou.</p>':'');
  const z=document.getElementById("listeDossiers");
  const fic=(f,chemin)=>'<div class="item" onclick="App.ouvrirFichier(\''+f.id+'\')"><div>'+
      '<div class="n">'+(/pdf/.test(f.type)?"📄":(/image/.test(f.type)?"🖼️":"📎"))+' '+esc(f.nom)+'</div>'+
      '<div class="d">'+(chemin?esc(chemin)+' · ':'')+poids(f.taille||0)+' · '+frDate(new Date(f.maj).toISOString().slice(0,10))+'</div>'+
    '</div></div>';
  if(q){
    const res=[];
    const tour=(d,ch2)=>{ (d.fichiers||[]).forEach(f=>{ if(f.nom.toLowerCase().includes(q)) res.push([f,ch2]); });
      (d.dossiers||[]).forEach(s=>tour(s,(ch2?ch2+" › ":"")+App.nomDos(s.nom))); };
    tour(n,"");
    z.innerHTML=res.length?res.map(r=>fic(r[0],r[1])).join(""):'<div class="vide">Aucun document pour cette recherche.</div>';
    return;
  }
  const ds=(n.dossiers||[]).map(d=>{
    const nb=App.compteDos(d);
    return '<div class="tuile" onclick="App.ouvrirDos(\''+d.id+'\')"><span class="ic">'+
      (ch.length?"📁":(App.ICONES_DOS[d.nom]||"📁"))+'</span><div><div class="tt">'+esc(App.nomDos(d.nom))+'</div>'+
      '<div class="ss">'+nb+' document'+(nb>1?"s":"")+'</div></div></div>';
  }).join("");
  z.innerHTML=(ds?'<div class="tuiles" style="margin-top:0;margin-bottom:12px">'+ds+'</div>':'')+
    (n.fichiers||[]).map(f=>fic(f,"")).join("")+
    (!ds&&!(n.fichiers||[]).length?'<div class="vide">Rubrique vide.</div>':'');
},
ouvrirDos(id){ App._dosChemin.push(id); document.getElementById("rechDos").value=""; App.rendreDossiers(); window.scrollTo(0,0); },
remonterDos(i){ App._dosChemin=App._dosChemin.slice(0,i); App.rendreDossiers(); window.scrollTo(0,0); },
ouvrirFichier(id){
  toast("Ouverture…");
  Srv.appel("fichier",{id:id}).then(j=>{
    const b=blobDeB64(j.b64,j.type), u=URL.createObjectURL(b);
    const img=/^image\//.test(j.type);
    ouvrir('<h3>'+esc(j.nom)+'</h3>'+
      '<p class="lead">'+poids(b.size)+'</p>'+
      (img?'<img class="apercu" src="'+u+'">':'')+
      '<div class="btn-row"><a class="btn btn-p" href="'+u+'" target="_blank" rel="noopener">↗️ Ouvrir</a>'+
      '<a class="btn btn-s" href="'+u+'" download="'+esc(j.nom)+'">⬇️ Télécharger</a></div>'+
      (ROLE==="admin"?'<div class="btn-row" style="margin-top:8px"><button class="btn btn-d" onclick="App.supprimerFichier(\''+id+'\')">Supprimer ce document</button></div>':'')+
      '<div class="btn-row" style="margin-top:8px"><button class="btn btn-f" onclick="App.fermer()">Fermer</button></div>');
  }).catch(e=>toast(e.horsLigne?"Pas de connexion : document indisponible":e.message));
},
ajouterFichiers(ev){
  const l=Array.from(ev.target.files||[]); ev.target.value="";
  if(!l.length||ROLE!=="admin") return;
  const c=App.dosCourant();
  toast("Envoi de "+l.length+" document"+(l.length>1?"s":"")+"…");
  l.reduce((pr,f)=>pr.then(()=>b64DeBlob(f).then(b64=>Srv.appel("ajouterFichier",
      {dossier:c.n.id,nom:f.name,type:f.type||"application/octet-stream",b64:b64}))),Promise.resolve())
    .then(()=>{ toast("Document"+(l.length>1?"s":"")+" ajouté"+(l.length>1?"s":"")); App.listeDossiers(true); })
    .catch(e=>toast(e.message));
},
supprimerFichier(id){
  ouvrir('<h3>Supprimer ce document ?</h3>'+
    '<div class="note warn">Il part dans la corbeille de Google Drive (récupérable pendant 30 jours) et disparaît pour tout le monde.</div>'+
    '<div class="btn-row"><button class="btn btn-d" onclick="App.confirmerSupFichier(\''+id+'\')">Supprimer</button>'+
    '<button class="btn btn-f" onclick="App.fermer()">Annuler</button></div>');
},
confirmerSupFichier(id){
  Srv.appel("supprimerFichier",{id:id}).then(()=>{ fermer(); toast("Document supprimé"); App.listeDossiers(true); })
    .catch(e=>toast(e.message));
},

