import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, push, set, onValue, remove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// 🧭 COUNTDOWN
function updateCountdown(element, date) {
  function tick() {
    const now = Date.now();
    const t = new Date(date).getTime() - now;
    if (isNaN(t)) return element.textContent = "--:--:--";
    if (t <= 0) return element.textContent = "Právě se hraje";
    const h = Math.floor((t / 1000 / 60 / 60) % 24);
    const m = Math.floor((t / 1000 / 60) % 60);
    const s = Math.floor((t / 1000) % 60);
    element.textContent = `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  }
  tick();
  setInterval(tick, 1000);
}

// 🏠 VEŘEJNÁ STRÁNKA
export function mountPublic() {
  const featured = document.getElementById("featured-grid");
  const all = document.getElementById("all-grid");

  onValue(ref(db, "matches"), snap => {
    featured.innerHTML = "";
    all.innerHTML = "";

    const data = snap.val();
    if (!data) return;

    Object.entries(data).forEach(([id, m]) => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="thumb" style="background-image:url('${m.bg || ""}');background-size:cover;background-position:center;">
          <div class="content">
            <div class="teams">
              <img src="${m.logo1 || ""}" class="flag">
              <img src="${m.leagueLogo || ""}" class="league">
              <img src="${m.logo2 || ""}" class="flag">
            </div>
            <div class="name">${m.team1} vs ${m.team2}</div>
            <div class="meta">Start: ${new Date(m.startISO).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</div>
            <div class="badge"><span class="dot"></span> <span id="cd-${id}"></span></div>
          </div>
        </div>
      `;
      if (m.categories?.featured) featured.appendChild(card);
      if (m.categories?.all) all.appendChild(card);
      const cde = card.querySelector(`#cd-${id}`);
      updateCountdown(cde, m.startISO);
    });
  });
}

// 🔐 ADMIN PANEL
export function mountAdmin() {
  const loginBox = document.getElementById("login");
  const appBox = document.getElementById("admin-app");

  const email = document.getElementById("admin-email");
  const pass = document.getElementById("admin-pass");
  const btnLogin = document.getElementById("btn-login");
  const btnLogout = document.getElementById("btn-logout");

  btnLogin.onclick = async () => {
    try {
      await signInWithEmailAndPassword(auth, email.value, pass.value);
    } catch (e) {
      alert("Chyba: " + e.message);
    }
  };

  btnLogout.onclick = async () => {
    await signOut(auth);
  };

  onAuthStateChanged(auth, user => {
    if (user) {
      loginBox.style.display = "none";
      appBox.style.display = "block";
      loadAdmin();
    } else {
      appBox.style.display = "none";
      loginBox.style.display = "block";
    }
  });
}

// 🧱 ADMIN FUNKCE
function loadAdmin() {
  const list = document.getElementById("admin-list");
  const save = document.getElementById("btn-save");
  const form = {
    team1: document.getElementById("team1"),
    team2: document.getElementById("team2"),
    logo1: document.getElementById("logo1"),
    logo2: document.getElementById("logo2"),
    leagueLogo: document.getElementById("leagueLogo"),
    bg: document.getElementById("bg"),
    startISO: document.getElementById("startISO"),
    streamUrl: document.getElementById("streamUrl"),
    catFeatured: document.getElementById("cat-featured"),
    catAll: document.getElementById("cat-all")
  };

  save.onclick = async () => {
    const data = {
      team1: form.team1.value,
      team2: form.team2.value,
      logo1: form.logo1.value,
      logo2: form.logo2.value,
      leagueLogo: form.leagueLogo.value,
      bg: form.bg.value,
      startISO: new Date(form.startISO.value).toISOString(),
      streamUrl: form.streamUrl.value,
      categories: {
        featured: form.catFeatured.checked,
        all: form.catAll.checked
      }
    };
    await set(push(ref(db, "matches")), data);
    alert("✅ Zápas uložen");
  };

  onValue(ref(db, "matches"), snap => {
    list.innerHTML = "";
    const data = snap.val();
    if (!data) return;

    Object.entries(data).forEach(([id, m]) => {
      const div = document.createElement("div");
      div.className = "card";
      div.innerHTML = `
        <div class="thumb" style="background-image:url('${m.bg || ""}')">
          <div class="content">
            <div class="name">${m.team1} vs ${m.team2}</div>
            <div class="meta">${new Date(m.startISO).toLocaleString()}</div>
            <button class="button delete" id="del-${id}">Smazat</button>
          </div>
        </div>
      `;
      list.appendChild(div);
      div.querySelector(`#del-${id}`).onclick = async () => {
        if (confirm("Smazat zápas?")) await remove(ref(db, "matches/" + id));
      };
    });
  });
}
