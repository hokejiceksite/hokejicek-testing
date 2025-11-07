import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, push, set, update, remove, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

function h(el, attrs = {}, children = []) {
  const e = document.createElement(el);
  Object.entries(attrs || {}).forEach(([k, v]) => {
    if (k === "class") e.className = v;
    else if (k === "style") e.style.cssText = v;
    else e.setAttribute(k, v);
  });
  
  // Ošetření vstupu – children může být string, element, nebo pole
  if (!Array.isArray(children)) children = [children];
  
  children.forEach(c => {
    if (typeof c === "string") e.appendChild(document.createTextNode(c));
    else if (c instanceof Node) e.appendChild(c);
  });
  
  return e;
}


function fmtCountdown(ts) {
  const t = new Date(ts).getTime() - Date.now();
  if (t<=0) return "Právě se hraje";
  const d=Math.floor(t/86400000),h=Math.floor((t%86400000)/3600000),m=Math.floor((t%3600000)/60000),s=Math.floor((t%60000)/1000);
  return (d>0?d+" d ":"")+String(h).padStart(2,"0")+":"+String(m).padStart(2,"0")+":"+String(s).padStart(2,"0");
}

function card(match) {
  const id = "t"+Math.random().toString(36).slice(2,8);
  const link = match.streamUrl||"#";
  const card = h("a",{href:link,class:"card",target:match.streamUrl?"_blank":"_self",rel:"noopener"});
  const thumb = h("div",{class:"thumb"});
  const bg = h("div",{class:"bg",style:`background-image:url('${match.bg||""}')`});
  const content = h("div",{class:"content"});
  const rowTop = h("div",{class:"row teams"},[
    h("img",{class:"flag",src:match.logo1||"",alt:""}),
    match.leagueLogo?h("img",{class:"league",src:match.leagueLogo,alt:""}):null,
    h("img",{class:"flag",src:match.logo2||"",alt:""})
  ]);
  const name = h("div",{class:"name"},[`${match.team1||""} vs ${match.team2||""}`]);
  const meta = h("div",{class:"meta"},[`Start: ${new Date(match.startISO).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}`]);
  const badge = h("div",{class:"badge"},[h("span",{class:"dot"})," ",h("span",{id:id},"--:--:--")]);
  content.appendChild(rowTop);
  content.appendChild(name);
  content.appendChild(meta);
  content.appendChild(badge);
  thumb.appendChild(bg);
  thumb.appendChild(content);
  card.appendChild(thumb);
  const int=setInterval(()=>{const el=document.getElementById(id); if(!el){clearInterval(int);return;} el.textContent=fmtCountdown(match.startISO);},1000);
  return card;
}

export function mountPublic() {
  const featuredWrap = document.getElementById("featured-grid");
  const allWrap = document.getElementById("all-grid");
  onValue(ref(db,"matches"), snap=>{
    const data = snap.val();
    featuredWrap.innerHTML="";
    allWrap.innerHTML="";
    if(!data) return;
    const list = Object.entries(data)
      .filter(([_,v])=>v && typeof v==="object")
      .map(([k,v])=>({id:k,...v}))
      .sort((a,b)=>new Date(a.startISO)-new Date(b.startISO));
    list.forEach(m=>{
      if(m.categories&&m.categories.featured) featuredWrap.appendChild(card(m));
      if(m.categories&&m.categories.all) allWrap.appendChild(card(m));
    });
  });
}

async function isAdmin(uid){
  const s = await get(ref(db,`admins/${uid}`));
  return !!s.val();
}

export function mountAdmin() {
  const loginEl = document.getElementById("login");
  const appWrap = document.getElementById("admin-app");
  const inputEmail = document.getElementById("admin-email");
  const inputPass = document.getElementById("admin-pass");
  const btnSignIn = document.getElementById("btn-login");
  const btnSignOut = document.getElementById("btn-logout");

  btnSignIn.onclick = async ()=>{
    try{
      const cred = await signInWithEmailAndPassword(auth, inputEmail.value.trim(), inputPass.value);
      const ok = await isAdmin(cred.user.uid);
      if(!ok){ await signOut(auth); alert("Účet nemá práva admin."); return; }
      loginEl.classList.add("hidden");
      appWrap.classList.remove("hidden");
      initAdminApp();
    }catch(e){ alert("Přihlášení selhalo: "+e.message); }
  };

  btnSignOut.onclick = async ()=>{
    await signOut(auth);
    appWrap.classList.add("hidden");
    loginEl.classList.remove("hidden");
  };

  onAuthStateChanged(auth, async user=>{
    if(user){
      const ok = await isAdmin(user.uid);
      if(ok){ loginEl.classList.add("hidden"); appWrap.classList.remove("hidden"); initAdminApp(); }
      else { await signOut(auth); }
    } else { appWrap.classList.add("hidden"); loginEl.classList.remove("hidden"); }
  });
}

function initAdminApp(){
  const form = {
    id: document.getElementById("m-id"),
    team1: document.getElementById("team1"),
    team2: document.getElementById("team2"),
    logo1: document.getElementById("logo1"),
    logo2: document.getElementById("logo2"),
    leagueLogo: document.getElementById("leagueLogo"),
    bg: document.getElementById("bg"),
    startISO: document.getElementById("startISO"),
    channel: document.getElementById("channel"),
    streamUrl: document.getElementById("streamUrl"),
    catFeatured: document.getElementById("cat-featured"),
    catAll: document.getElementById("cat-all")
  };

  function clearForm(){
    form.id.value="";
    form.team1.value=""; form.team2.value="";
    form.logo1.value=""; form.logo2.value="";
    form.leagueLogo.value=""; form.bg.value="";
    form.startISO.value=""; form.channel.value=""; form.streamUrl.value="";
    form.catFeatured.checked=false; form.catAll.checked=true;
  }

  function readForm(){
    const rawDate = form.startISO.value;
    if(!rawDate) throw new Error("Zadej platný datum a čas.");
    const d = new Date(rawDate);
    if(isNaN(d.getTime())) throw new Error("Neplatný formát data.");
    return {
      team1: form.team1.value.trim(),
      team2: form.team2.value.trim(),
      logo1: form.logo1.value.trim(),
      logo2: form.logo2.value.trim(),
      leagueLogo: form.leagueLogo.value.trim(),
      bg: form.bg.value.trim(),
      startISO: d.toISOString(),
      channel: form.channel.value.trim(),
      streamUrl: form.streamUrl.value.trim(),
      categories: { featured: form.catFeatured.checked, all: form.catAll.checked },
      createdAt: Date.now()
    };
  }

  function fillForm(m){
    form.id.value=m.id||"";
    form.team1.value=m.team1||"";
    form.team2.value=m.team2||"";
    form.logo1.value=m.logo1||"";
    form.logo2.value=m.logo2||"";
    form.leagueLogo.value=m.leagueLogo||"";
    form.bg.value=m.bg||"";
    form.startISO.value=m.startISO?new Date(m.startISO).toISOString().slice(0,16):"";
    form.channel.value=m.channel||"";
    form.streamUrl.value=m.streamUrl||"";
    form.catFeatured.checked=!!(m.categories&&m.categories.featured);
    form.catAll.checked=!!(m.categories&&m.categories.all);
  }

  document.getElementById("btn-save").onclick = async ()=>{
    try{
      const data=readForm();
      if(!data.team1||!data.team2) { alert("Vyplň názvy týmů."); return; }
      if(form.id.value){
        await update(ref(db,"matches/"+form.id.value),data);
        alert("Zápas aktualizován.");
      } else {
        const newRef = push(ref(db,"matches"));
        await set(newRef,data);
        alert("Zápas uložen.");
      }
      clearForm();
    }catch(e){ alert("Chyba: "+e.message); }
  };

  document.getElementById("btn-new").onclick=()=>clearForm();

  const listWrap = document.getElementById("admin-list");
  onValue(ref(db,"matches"), snap=>{
    const data = snap.val();
    listWrap.innerHTML="";
    if(!data) return;
    const list = Object.entries(data)
      .filter(([_,v])=>v && typeof v==="object")
      .map(([k,v])=>({id:k,...v}))
      .sort((a,b)=>new Date(a.startISO)-new Date(b.startISO));
    list.forEach(m=>{
      const item=h("div",{class:"card"});
      const thumb=h("div",{class:"thumb"});
      const bg=h("div",{class:"bg",style:`background-image:url('${m.bg||""}')`});
      const content=h("div",{class:"content"});
      const row=h("div",{class:"row teams"},[
        h("img",{class:"flag",src:m.logo1||"",alt:""}),
        m.leagueLogo?h("img",{class:"league",src:m.leagueLogo,alt:""}):null,
        h("img",{class:"flag",src:m.logo2||"",alt:""})
      ]);
      const name=h("div",{class:"name"},[`${m.team1} vs ${m.team2}`]);
      const meta=h("div",{class:"meta"},[`Start: ${new Date(m.startISO).toLocaleString()}`]);
      const badge=h("div",{class:"badge"},[h("span",{class:"dot"})," ",fmtCountdown(m.startISO)]);
      const actions=h("div",{class:"actions"},[
        (()=>{const b=h("button",{class:"button edit"},"Upravit");b.onclick=()=>fillForm(m);return b;})(),
        (()=>{const b=h("button",{class:"button delete"},"Smazat");b.onclick=async()=>{if(confirm("Smazat zápas?")) await remove(ref(db,"matches/"+m.id));};return b;})()
      ]);
      content.appendChild(row);content.appendChild(name);content.appendChild(meta);content.appendChild(badge);
      thumb.appendChild(bg);thumb.appendChild(content);
      item.appendChild(thumb);
      item.appendChild(h("div",{style:"padding:10px"},[actions]));
      listWrap.appendChild(item);
    });
  });
}
