import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, push, set, update, remove, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// 🧱 Bezpečnější createElement
function h(el, attrs = {}, children = []) {
  const e = document.createElement(el);
  Object.entries(attrs || {}).forEach(([k, v]) => {
    if (k === "class") e.className = v;
    else if (k === "style") e.style.cssText = v;
    else e.setAttribute(k, v);
  });
  if (!Array.isArray(children)) children = [children];
  children.filter(Boolean).forEach(c => {
    if (typeof c === "string") e.appendChild(document.createTextNode(c));
    else if (c instanceof Node) e.appendChild(c);
  });
  return e;
}

function fmtCountdown(ts) {
  const t = new Date(ts).getTime() - Date.now();
  if (isNaN(t)) return "--:--:--";
  if (t <= 0) return "Právě se hraje";
  const d = Math.floor(t / 86400000),
    h = Math.floor((t % 86400000) / 3600000),
    m = Math.floor((t % 3600000) / 60000),
    s = Math.floor((t % 60000) / 1000);
  return (d > 0 ? d + " d " : "") + String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}

// 🧩 Tvorba karty
function card(match) {
  const id = "t" + Math.random().toString(36).slice(2, 8);
  const card = h("a", { href: match.streamUrl || "#", class: "card", target: "_blank" });
  const thumb = h("div", { class: "thumb" });
  const bg = h("div", { class: "bg", style: `background-image:url('${match.bg || ""}')` });
  const content = h("div", { class: "content" });

  const rowTop = h("div", { class: "row teams" }, [
    h("img", { class: "flag", src: match.logo1 || "", alt: "" }),
    match.leagueLogo ? h("img", { class: "league", src: match.leagueLogo, alt: "" }) : null,
    h("img", { class: "flag", src: match.logo2 || "", alt: "" })
  ]);

  const name = h("div", { class: "name" }, [`${match.team1 || ""} vs ${match.team2 || ""}`]);
  const meta = h("div", { class: "meta" }, [`Start: ${new Date(match.startISO).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`]);
  const badge = h("div", { class: "badge" }, [h("span", { class: "dot" }), " ", h("span", { id: id }, "--:--:--")]);

  [rowTop, name, meta, badge].forEach(c => content.appendChild(c));
  thumb.appendChild(bg);
  thumb.appendChild(content);
  card.appendChild(thumb);

  setInterval(() => {
    const el = document.getElementById(id);
    if (el) el.textContent = fmtCountdown(match.startISO);
  }, 1000);

  return card;
}

// 🌍 Veřejná stránka
export function mountPublic() {
  const featuredWrap = document.getElementById("featured-grid");
  const allWrap = document.getElementById("all-grid");

  onValue(ref(db, "matches"), snap => {
    featuredWrap.innerHTML = "";
    allWrap.innerHTML = "";

    const data = snap.val();
    if (!data) return;

    Object.entries(data).forEach(([key, match]) => {
      if (!match || typeof match !== "object") return;
      if (match.categories?.featured) featuredWrap.appendChild(card(match));
      if (match.categories?.all) allWrap.appendChild(card(match));
    });
  });
}

// 👮 Admin sekce
async function isAdmin(uid) {
  const s = await get(ref(db, `admins/${uid}`));
  return !!s.val();
}

export function mountAdmin() {
  const loginEl = document.getElementById("login");
  const appWrap = document.getElementById("admin-app");
  const email = document.getElementById("admin-email");
  const pass = document.getElementById("admin-pass");
  const btnLogin = document.getElementById("btn-login");
  const btnLogout = document.getElementById("btn-logout");

  btnLogin.onclick = async () => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email.value.trim(), pass.value);
      const ok = await isAdmin(cred.user.uid);
      if (!ok) {
        await signOut(auth);
        alert("Tento účet není admin.");
        return;
      }
      loginEl.classList.add("hidden");
      appWrap.classList.remove("hidden");
      initAdmin();
    } catch (e) {
      alert("Přihlášení selhalo: " + e.message);
    }
  };

  btnLogout.onclick = async () => {
    await signOut(auth);
    appWrap.classList.add("hidden");
    loginEl.classList.remove("hidden");
  };

  onAuthStateChanged(auth, async user => {
    if (user && (await isAdmin(user.uid))) {
      loginEl.classList.add("hidden");
      appWrap.classList.remove("hidden");
      initAdmin();
    } else {
      appWrap.classList.add("hidden");
      loginEl.classList.remove("hidden");
    }
  });
}

function initAdmin() {
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

  const listWrap = document.getElementById("admin-list");

  function clearForm() {
    Object.values(form).forEach(f => {
      if (f.type !== "hidden" && f.type !== "checkbox") f.value = "";
      if (f.type === "checkbox") f.checked = false;
    });
    form.catAll.checked = true;
  }

  function readForm() {
    const dateRaw = form.startISO.value;
    if (!dateRaw) throw new Error("Zadej datum a čas!");
    const d = new Date(dateRaw);
    if (isNaN(d)) throw new Error("Neplatný formát data.");
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

  function fillForm(m) {
    form.id.value = m.id || "";
    form.team1.value = m.team1 || "";
    form.team2.value = m.team2 || "";
    form.logo1.value = m.logo1 || "";
    form.logo2.value = m.logo2 || "";
    form.leagueLogo.value = m.leagueLogo || "";
    form.bg.value = m.bg || "";
    form.startISO.value = m.startISO ? new Date(m.startISO).toISOString().slice(0, 16) : "";
    form.channel.value = m.channel || "";
    form.streamUrl.value = m.streamUrl || "";
    form.catFeatured.checked = !!m.categories?.featured;
    form.catAll.checked = !!m.categories?.all;
  }

  document.getElementById("btn-save").onclick = async () => {
    try {
      const data = readForm();
      if (!data.team1 || !data.team2) throw new Error("Vyplň názvy týmů.");
      if (form.id.value) {
        await update(ref(db, "matches/" + form.id.value), data);
        alert("Zápas aktualizován.");
      } else {
        const newRef = push(ref(db, "matches"));
        await set(newRef, data);
        alert("Zápas uložen.");
      }
      clearForm();
    } catch (e) {
      alert("Chyba: " + e.message);
    }
  };

  document.getElementById("btn-new").onclick = clearForm;

  onValue(ref(db, "matches"), snap => {
    listWrap.innerHTML = "";
    const data = snap.val();
    if (!data) return;
    Object.entries(data).forEach(([k, m]) => {
      if (!m) return;
      const item = h("div", { class: "card" }, [
        h("div", { class: "thumb" }, [
          h("div", { class: "bg", style: `background-image:url('${m.bg || ""}')` }),
          h("div", { class: "content" }, [
            h("div", { class: "row teams" }, [
              h("img", { class: "flag", src: m.logo1 || "" }),
              m.leagueLogo ? h("img", { class: "league", src: m.leagueLogo }) : null,
              h("img", { class: "flag", src: m.logo2 || "" })
            ]),
            h("div", { class: "name" }, `${m.team1} vs ${m.team2}`),
            h("div", { class: "meta" }, `Start: ${new Date(m.startISO).toLocaleString()}`),
            h("div", { class: "badge" }, [h("span", { class: "dot" }), " ", fmtCountdown(m.startISO)])
          ])
        ]),
        h("div", { class: "actions" }, [
          h("button", { class: "button edit", onclick: () => fillForm({ id: k, ...m }) }, "Upravit"),
          h("button", { class: "button delete", onclick: async () => { if (confirm("Smazat?")) await remove(ref(db, "matches/" + k)); } }, "Smazat")
        ])
      ]);
      listWrap.appendChild(item);
    });
  });
}
