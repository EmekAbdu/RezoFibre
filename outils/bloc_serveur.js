/* =============== serveur partage (Google Drive d'Abdou, via Apps Script) =================
   Chaque appareil se connecte avec une cle personnelle. Le serveur connait deux roles :
   - admin (Abdou) : lit et modifie tout ;
   - ridha (Ridha) : consulte tout ; dans la rubrique Photo, il ajoute, modifie et efface
     ses photos le jour meme de la prise. Le lendemain, il doit passer par l'administrateur.
   Les droits sont controles par le serveur : l'application ne fait qu'en refleter l'effet. */
const API="__API_URL__";
const CLE_ACCES="rezofibreCle", CLE_ROLE="rezofibreRole", CLE_SALE="rezofibreSale", CLE_DOS="rezofibreDossiers";
const ONGLETS_ECRITURE=["new","dev","bcm","avo","cli","adm"];
const TUILES_LECTEUR=["ach","dos","arc","ban","aid"];
let ROLE=null, JOUR_SRV="";
function lsGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
function lsSet(k,v){ try{ if(v===null) localStorage.removeItem(k); else localStorage.setItem(k,v); }catch(e){} }
function lecteur(){ return ROLE==="ridha"; }
function jourParis(){
  try{ return new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()); }
  catch(e){ return auj(); }
}
function nomRole(r){ return r==="admin"?"Abdou":(r==="ridha"?"Ridha":""); }
const Srv={
  cle(){ return lsGet(CLE_ACCES)||""; },
  appel(action,o){
    if(!Srv.cle()) return Promise.reject(Object.assign(new Error("Non connecté"),{horsLigne:true}));
    const corps=Object.assign({},o||{},{action:action,cle:Srv.cle()});
    return fetch(API,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},
                      body:JSON.stringify(corps),redirect:"follow"})
      .catch(()=>{ throw Object.assign(new Error("Pas de connexion au serveur"),{horsLigne:true}); })
      .then(r=>{ if(!r.ok) throw Object.assign(new Error("Serveur indisponible ("+r.status+")"),{horsLigne:true}); return r.json(); })
      .then(j=>{
        if(j.jour) JOUR_SRV=j.jour;
        if(j.code===401){ Srv.cleRefusee(); throw Object.assign(new Error(j.err),{refus:true}); }
        if(j.role&&j.role!==ROLE){ ROLE=j.role; lsSet(CLE_ROLE,ROLE); appliquerRole(); }
        if(!j.ok) throw Object.assign(new Error(j.err||"Erreur du serveur"),{refus:true});
        return j;
      });
  },
  cleRefusee(){
    lsSet(CLE_ACCES,null); lsSet(CLE_ROLE,null); ROLE=null; appliquerRole();
    App.ecranConnexion("Cette clé d'accès n'est pas (ou plus) valable.");
  }
};
function b64DeBlob(b){
  return new Promise((ok,ko)=>{ const r=new FileReader();
    r.onload=()=>ok(String(r.result).split(",")[1]||""); r.onerror=()=>ko(r.error); r.readAsDataURL(b); });
}
function blobDeB64(b64,type){
  const s=atob(b64||""); const u=new Uint8Array(s.length);
  for(let i=0;i<s.length;i++) u[i]=s.charCodeAt(i);
  return new Blob([u],{type:type||"application/octet-stream"});
}
function vignetteDe(b){
  return new Promise(ok=>{
    if(!b||!/^image\//.test(b.type)||typeof createImageBitmap!=="function"){ ok(""); return; }
    createImageBitmap(b).then(bmp=>{
      const M=260, e=Math.min(1,M/Math.max(bmp.width,bmp.height));
      const c=document.createElement("canvas"); c.width=Math.round(bmp.width*e); c.height=Math.round(bmp.height*e);
      c.getContext("2d").drawImage(bmp,0,0,c.width,c.height);
      ok(c.toDataURL("image/jpeg",0.6));
    }).catch(()=>ok(""));
  });
}

/* ---- donnees de facturation : le serveur fait foi ---- */
let PUSH_T=null;
function pousser(){
  if(ROLE!=="admin") return;
  lsSet(CLE_SALE,"1");
  clearTimeout(PUSH_T);
  PUSH_T=setTimeout(()=>{
    const txt=JSON.stringify(D);
    Srv.appel("enregistrerDonnees",{donnees:txt})
      .then(()=>{ if(JSON.stringify(D)===txt) lsSet(CLE_SALE,null); })
      .catch(e=>{ if(!e.horsLigne) toast("Serveur : "+e.message); });
  },1500);
}
function syncDonnees(){
  return Srv.appel("donnees").then(j=>{
    if(ROLE==="admin"&&(!j.donnees||lsGet(CLE_SALE))){ pousser(); return; }
    if(!j.donnees) return;
    try{ D=JSON.parse(j.donnees); }catch(e){ return; }
    completer();
    if(!F||lecteur()||!D.brouillon) F=D.brouillon?JSON.parse(JSON.stringify(D.brouillon)):factureNeuve();
  });
}

/* ---- rubrique Photo : cache local (IndexedDB) + serveur partage ---- */
const CHAMPS_P=["nom","fournisseur","date","montant","note","rubrique","auto","confiance","type","taille","cree","transmisLe","vignette"];
function metaDe(p){ const m={id:p.id}; CHAMPS_P.forEach(c=>{ if(p[c]!==undefined) m[c]=p[c]; }); return m; }
let FILE_P=Promise.resolve();
function enFile(t){ const p=FILE_P.then(t,t); FILE_P=p.catch(()=>{}); return p; }
/* Ridha : ses propres photos, le jour meme seulement. Une photo pas encore envoyee reste a lui. */
function peutToucher(p){
  if(!ROLE||ROLE==="admin") return true;
  if(!p||p.sync!=="ok") return true;
  return p.par==="ridha"&&p.jour===(JOUR_SRV||jourParis());
}
function fusionner(p,m){ Object.assign(p,m||{}); p.sync="ok"; return localMettre(p).then(()=>p); }
function envoyerPiece(id){
  return enFile(()=>localLire(id).then(p=>{
    if(!p||!ROLE) return p;
    if(p.sync==="ok") return Srv.appel("majPhoto",{meta:metaDe(p)}).then(j=>fusionner(p,j.photo));
    if(p.auto==="encours"&&Date.now()-(p.cree||0)<180000) return p;   // lecture automatique en cours : envoi apres
    if(!p.blob) return p;
    return (p.vignette?Promise.resolve(p.vignette):vignetteDe(p.blob)).then(v=>{
      p.vignette=v;
      return b64DeBlob(p.blob).then(b64=>Srv.appel("ajouterPhoto",{meta:metaDe(p),b64:b64}))
        .then(j=>fusionner(p,j.photo));
    });
  }));
}
function achatMettre(o){
  if(o.sync!=="ok") o.sync="attente";
  return localMettre(o).then(()=>{
    if(!ROLE) return o;
    return envoyerPiece(o.id).then(p=>p||o).catch(e=>{
      if(e.refus){ return achatTous().then(()=>{ throw e; }); }
      return o;                                   // hors connexion : renvoi automatique plus tard
    });
  });
}
function achatTous(){
  return localTous().then(loc=>{
    if(!ROLE) return loc;
    return Srv.appel("photos").then(j=>{
      const srv={}; (j.photos||[]).forEach(m=>{ srv[m.id]=m; });
      const ops=[], res=[], attente=[];
      loc.forEach(p=>{
        if(srv[p.id]){
          const n=Object.assign({},p,srv[p.id],{sync:"ok"}); delete srv[p.id];
          if(p.sync!=="ok"||JSON.stringify(metaDe(p))!==JSON.stringify(metaDe(n))||p.par!==n.par||p.jour!==n.jour) ops.push(localMettre(n));
          res.push(n);
        } else if(p.sync==="ok"){ ops.push(localEffacer(p.id)); }  // effacee par ailleurs
        else { res.push(p); if(p.auto!=="encours"||Date.now()-(p.cree||0)>=180000) attente.push(p.id); }
      });
      Object.keys(srv).forEach(k=>{ const n=Object.assign({blob:null},srv[k],{sync:"ok"}); ops.push(localMettre(n)); res.push(n); });
      return Promise.all(ops).then(()=>{
        if(attente.length) Promise.all(attente.map(id=>envoyerPiece(id).catch(()=>null)))
          .then(r=>{ if(r.some(x=>x&&x.sync==="ok")&&(ecran==="ach"||ecran==="arc")) setTimeout(()=>{ if(ecran==="ach") App.listeAchats(); else App.listeArchive(); },50); });
        return res;
      });
    }).catch(()=>loc);
  });
}
function achatLire(id){
  return localLire(id).then(p=>{
    if(!p||p.blob||p.sync!=="ok"||!ROLE) return p;
    return Srv.appel("photo",{id:id}).then(j=>{ p.blob=blobDeB64(j.b64,j.type||p.type); return localMettre(p).then(()=>p); })
      .catch(()=>p);
  });
}
function achatEffacer(id){
  return localLire(id).then(p=>{
    if(!p) return true;
    if(!ROLE||p.sync!=="ok") return localEffacer(id);
    return enFile(()=>Srv.appel("supprimerPhoto",{id:id})).then(()=>localEffacer(id));
  });
}

/* ---- role : ce que l'ecran montre ---- */
function appliquerRole(){
  document.body.classList.toggle("lecteur",lecteur());
  document.querySelectorAll("nav button").forEach(b=>{
    const t=b.dataset.tab;
    let cache=false;
    if(lecteur()&&ONGLETS_ECRITURE.indexOf(t)>=0) cache=true;
    if(!lecteur()&&b.dataset.lecteur==="1") cache=true;
    b.style.display=cache?"none":"";
  });
  if(lecteur()) admin=false;
  if(typeof App!=="undefined"&&D) majEntete();
}
