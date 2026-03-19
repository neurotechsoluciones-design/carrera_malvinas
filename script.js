/* ═══════════════════════════════════════════════════════════════
   CARRERA HÉROES DE MALVINAS — script.js v3.1
   Countdown → 17 mayo 2026 08:30 ART
═══════════════════════════════════════════════════════════════ */

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ─── 1. CUENTA REGRESIVA ─── */
const countdownDate = new Date("2026-05-17T08:30:00-03:00").getTime();

function updateCountdown() {
  const now = Date.now();
  const diff = countdownDate - now;
  const daysEl = document.getElementById("days");
  const hoursEl = document.getElementById("hours");
  const minutesEl = document.getElementById("minutes");
  const secondsEl = document.getElementById("seconds");
  if (!daysEl) return;
  if (diff <= 0) {
    [daysEl, hoursEl, minutesEl, secondsEl].forEach(el => el && (el.textContent = "00"));
    return;
  }
  daysEl.textContent    = String(Math.floor(diff / 86400000)).padStart(2, "0");
  hoursEl.textContent   = String(Math.floor((diff / 3600000) % 24)).padStart(2, "0");
  minutesEl.textContent = String(Math.floor((diff / 60000) % 60)).padStart(2, "0");
  secondsEl.textContent = String(Math.floor((diff / 1000) % 60)).padStart(2, "0");
}
updateCountdown();
setInterval(updateCountdown, 1000);

/* ─── 2. DATOS DE RECORRIDOS ─── */
const CENTER = [-34.6158, -68.3559];

function genElevation(points, baseAlt, variance) {
  return Array.from({ length: points }, (_, i) => {
    const t = i / (points - 1);
    const wave = Math.sin(t * Math.PI * 3) * variance * 0.4;
    const noise = (Math.random() - 0.5) * variance * 0.3;
    return Math.round(baseAlt + wave + noise);
  });
}

const routes = {
  "1k": {
    title: "Recorrido 1K",
    description: "Circuito participativo y accesible, pensado para acompañar el espíritu comunitario del evento.",
    surface: "Urbano",
    start: "Pista de Atletismo, Polideportivo N° 1",
    gpx: "assets/gpx/carrera-malvinas-1k.gpx",
    color: "#4dbdf5",
    coords: null, elevation: null,
    distance: "—", elevUp: "—", elevDown: "—",
    fallbackElevation: genElevation(12, 692, 8)
  },
  "5k": {
    title: "Recorrido 5K",
    description: "Circuito equilibrado para quienes quieren vivir la carrera con intensidad y buena experiencia de ritmo.",
    surface: "Urbano",
    start: "Pista de Atletismo, Polideportivo N° 1",
    gpx: "assets/gpx/carrera-malvinas-5k.gpx",
    color: "#74d2ff",
    coords: null, elevation: null,
    distance: "—", elevUp: "—", elevDown: "—",
    fallbackElevation: genElevation(20, 691, 14)
  },
  "10k": {
    title: "Recorrido 10K",
    description: "Circuito pensado para corredores que buscan una propuesta más exigente y competitiva.",
    surface: "Urbano",
    start: "Pista de Atletismo, Polideportivo N° 1",
    gpx: "assets/gpx/carrera-malvinas-10k.gpx",
    color: "#c9efff",
    coords: null, elevation: null,
    distance: "—", elevUp: "—", elevDown: "—",
    fallbackElevation: genElevation(28, 690, 22)
  }
};

/* ─── PARSER GPX ─── */
function parseGpx(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");
  const ns = "http://www.topografix.com/GPX/1/1";
  let points = Array.from(doc.getElementsByTagNameNS(ns, "trkpt"));
  if (!points.length) points = Array.from(doc.getElementsByTagNameNS(ns, "rtept"));
  if (!points.length) points = Array.from(doc.querySelectorAll("trkpt, rtept"));
  if (!points.length) return null;

  const coords = points.map(pt => [parseFloat(pt.getAttribute("lat")), parseFloat(pt.getAttribute("lon"))]);
  const elevEls = points.map(pt => {
    const e = pt.getElementsByTagNameNS(ns, "ele")[0] || pt.querySelector("ele");
    return e ? parseFloat(e.textContent) : null;
  });
  const hasRealEle = elevEls.some(e => e !== null && e !== 0);
  const elevation = hasRealEle ? elevEls.filter(e => e !== null) : null;

  let totalKm = 0;
  for (let i = 1; i < coords.length; i++) totalKm += haversine(coords[i-1], coords[i]);

  let elevUp = 0, elevDown = 0;
  if (elevation && elevation.length > 1) {
    for (let i = 1; i < elevation.length; i++) {
      const d = elevation[i] - elevation[i-1];
      if (d > 0) elevUp += d; else elevDown += Math.abs(d);
    }
  }
  return { coords, elevation, totalKm, elevUp, elevDown };
}

function haversine([lat1, lon1], [lat2, lon2]) {
  const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLon = (lon2-lon1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function fetchAndParseGpx(key) {
  const route = routes[key];
  if (route.coords !== null) return true;
  try {
    const res = await fetch(route.gpx);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = parseGpx(await res.text());
    if (!data || data.coords.length < 2) throw new Error("Sin puntos válidos");
    route.coords = data.coords;
    route.elevation = data.elevation;
    route.distance = data.totalKm.toFixed(1) + " km";
    route.elevUp   = data.elevUp > 0   ? `+${Math.round(data.elevUp)} m`   : "—";
    route.elevDown = data.elevDown > 0  ? `−${Math.round(data.elevDown)} m` : "—";
    return true;
  } catch (err) {
    console.warn(`GPX ${key}: ${err.message}`);
    route.coords = [];
    route.elevation = null;
    route.distance = "GPX no disponible";
    return false;
  }
}

/* ─── 3. MAPA LEAFLET ─── */
let map = null, currentPolyline = null, currentMarkers = [], animationFrame = null;
let elevationChart = null, activeRouteKey = "1k";

function initMap() {
  const mapEl = document.getElementById("routeMap");
  if (!mapEl || typeof L === "undefined") return;
  map = L.map("routeMap", { center: CENTER, zoom: 14, zoomControl: true, scrollWheelZoom: false });
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    maxZoom: 19, subdomains: "abcd",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
  }).addTo(map);
  loadRoute("1k");
}

async function loadRoute(key) {
  if (!map) return;
  activeRouteKey = key;
  const route = routes[key];
  if (currentPolyline) { map.removeLayer(currentPolyline); currentPolyline = null; }
  currentMarkers.forEach(m => map.removeLayer(m));
  currentMarkers = [];
  if (animationFrame) { cancelAnimationFrame(animationFrame); animationFrame = null; }

  showMapLoading(true);
  await fetchAndParseGpx(key);
  showMapLoading(false);

  const coords = route.coords;
  if (!coords || coords.length < 2) {
    updateElevationChart(route); return;
  }

  if (prefersReducedMotion) {
    currentPolyline = L.polyline(coords, { color: route.color, weight: 4, opacity: 0.92, lineJoin: "round", lineCap: "round" }).addTo(map);
    addKmMarkers(coords, route.color);
    addStartEndMarkers(coords, route.color);
    map.fitBounds(currentPolyline.getBounds(), { padding: [30, 30] });
  } else {
    const tempLine = L.polyline(coords);
    map.fitBounds(tempLine.getBounds(), { padding: [30, 30] });
    animatePolyline(coords, route.color, () => { addKmMarkers(coords, route.color); addStartEndMarkers(coords, route.color); });
  }
  updateElevationChart(route);
}

function showMapLoading(on) {
  const wrap = document.getElementById("routeMap");
  if (!wrap) return;
  let s = document.getElementById("mapSpinner");
  if (on) {
    if (!s) {
      s = document.createElement("div"); s.id = "mapSpinner";
      s.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(4,9,18,0.6);border-radius:22px;z-index:500;color:#4dbdf5;font-size:0.8rem;letter-spacing:0.14em;text-transform:uppercase;gap:10px;";
      s.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>Cargando recorrido…';
      wrap.parentElement.style.position = "relative";
      wrap.parentElement.appendChild(s);
    }
    s.style.display = "flex";
  } else { if (s) s.style.display = "none"; }
}

function animatePolyline(coords, color, onComplete) {
  const totalSteps = 80; let step = 0;
  currentPolyline = L.polyline([], { color, weight: 4, opacity: 0.92, lineJoin: "round", lineCap: "round" }).addTo(map);
  function draw() {
    step++;
    const progress = step / totalSteps;
    const pointCount = Math.max(2, Math.floor(coords.length * progress));
    const pts = coords.slice(0, pointCount);
    if (step < totalSteps && pointCount < coords.length) {
      const from = coords[pointCount-1], to = coords[pointCount];
      const t = (progress * coords.length) - (pointCount - 1);
      pts.push([from[0] + (to[0]-from[0])*t, from[1] + (to[1]-from[1])*t]);
    }
    currentPolyline.setLatLngs(pts);
    if (step < totalSteps) { animationFrame = requestAnimationFrame(draw); }
    else { currentPolyline.setLatLngs(coords); if (onComplete) onComplete(); }
  }
  animationFrame = requestAnimationFrame(draw);
}

function addKmMarkers(coords, color) {
  let accumulated = 0, nextKm = 1;
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i-1], curr = coords[i];
    const dLat = (curr[0]-prev[0])*111;
    const dLng = (curr[1]-prev[1])*111*Math.cos(prev[0]*Math.PI/180);
    accumulated += Math.sqrt(dLat*dLat + dLng*dLng);
    while (accumulated >= nextKm) {
      const icon = L.divIcon({ className:"km-marker", html:`<div class="km-marker-inner" style="border-color:${color};color:${color}">${nextKm}km</div>`, iconSize:[40,24], iconAnchor:[20,12] });
      currentMarkers.push(L.marker(curr, {icon}).addTo(map));
      nextKm++;
    }
  }
}

function addStartEndMarkers(coords, color) {
  if (coords.length < 2) return;
  const startIcon = L.divIcon({ className:"start-marker", html:`<div class="route-marker-pin route-marker-start" style="background:${color}">Largada</div>`, iconSize:[64,28], iconAnchor:[32,14] });
  const endIcon   = L.divIcon({ className:"end-marker",   html:`<div class="route-marker-pin route-marker-end">Meta</div>`, iconSize:[48,28], iconAnchor:[24,14] });
  currentMarkers.push(L.marker(coords[0], {icon:startIcon}).addTo(map));
  currentMarkers.push(L.marker(coords[coords.length-1], {icon:endIcon}).addTo(map));
}

/* ─── 4. PERFIL DE ELEVACIÓN ─── */
function updateElevationChart(route) {
  const canvas = document.getElementById("elevationChart");
  if (!canvas || typeof Chart === "undefined") return;
  if (elevationChart) { elevationChart.destroy(); elevationChart = null; }

  const elevData = (route.elevation && route.elevation.length > 1)
    ? route.elevation
    : route.fallbackElevation;

  if (!elevData) return;

  const prev = canvas.parentElement.querySelector(".elev-no-data");
  if (prev) prev.remove();

  const step = Math.max(1, Math.floor(elevData.length / 30));
  const sampled = elevData.filter((_, i) => i % step === 0);
  const distStr = parseFloat(route.distance) || 0;
  const labels = sampled.map((_, i) => {
    if (i === 0) return "Inicio";
    if (i === sampled.length-1) return "Meta";
    const km = (i / (sampled.length-1)) * distStr;
    return `${km.toFixed(1)}km`;
  });

  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 0, 110);
  gradient.addColorStop(0, "rgba(77,189,245,0.38)");
  gradient.addColorStop(1, "rgba(77,189,245,0.02)");

  elevationChart = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Elevación (m)",
        data: sampled,
        borderColor: route.color,
        borderWidth: 2.2,
        backgroundColor: gradient,
        fill: true,
        tension: 0.42,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: route.color,
        pointHoverBorderColor: "#fff"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: prefersReducedMotion ? false : { duration: 800, easing: "easeInOutQuart" },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(4,9,18,0.90)",
          borderColor: "rgba(77,189,245,0.20)",
          borderWidth: 1,
          titleColor: "#cad5e2",
          bodyColor: "#4dbdf5",
          padding: 10,
          callbacks: { label: ctx => ` ${ctx.parsed.y} m s.n.m.` }
        }
      },
      scales: {
        x: { grid:{ color:"rgba(255,255,255,0.04)" }, ticks:{ color:"#7e8da3", font:{size:10}, maxTicksLimit:6 } },
        y: { grid:{ color:"rgba(255,255,255,0.04)" }, ticks:{ color:"#7e8da3", font:{size:10}, callback: v => `${v}m` } }
      }
    }
  });
}

/* ─── 5. TABS DE RECORRIDO ─── */
const routeTabs = document.querySelectorAll(".route-tab");
const routeTitle       = document.getElementById("routeTitle");
const routeDescription = document.getElementById("routeDescription");
const routeSurface     = document.getElementById("routeSurface");
const routeStart       = document.getElementById("routeStart");
const routeDistanceEl  = document.getElementById("routeDistance");
const routeElevUpEl    = document.getElementById("routeElevUp");
const routeElevDownEl  = document.getElementById("routeElevDown");
const downloadGpxBtn   = document.getElementById("downloadGpx");

function updateRouteInfo(key) {
  const r = routes[key]; if (!r) return;
  if (routeTitle)       routeTitle.textContent       = r.title;
  if (routeDescription) routeDescription.textContent = r.description;
  if (routeSurface)     routeSurface.textContent     = r.surface;
  if (routeStart)       routeStart.textContent       = r.start;
  if (routeDistanceEl)  routeDistanceEl.textContent  = r.distance;
  if (routeElevUpEl)    routeElevUpEl.textContent    = r.elevUp;
  if (routeElevDownEl)  routeElevDownEl.textContent  = r.elevDown;
  if (downloadGpxBtn)   { downloadGpxBtn.href = r.gpx; downloadGpxBtn.download = `carrera-malvinas-${key}.gpx`; }
}

routeTabs.forEach(tab => {
  tab.addEventListener("click", function() {
    const key = this.dataset.route;
    routeTabs.forEach(t => t.classList.remove("active"));
    this.classList.add("active");
    updateRouteInfo(key);
    loadRoute(key);
  });
});

/* ─── 6. FULLSCREEN DEL MAPA ─── */
const mapFullscreenBtn = document.getElementById("mapFullscreenBtn");
const mapModal         = document.getElementById("mapModal");
const mapModalClose    = document.getElementById("mapModalClose");
let modalMap = null, modalPolyline = null;

function openMapModal() {
  if (!mapModal) return;
  mapModal.classList.add("active");
  document.body.style.overflow = "hidden";
  setTimeout(() => {
    if (!modalMap) {
      modalMap = L.map("mapModalContainer", { center: CENTER, zoom: 14, zoomControl: true, scrollWheelZoom: true });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        maxZoom:19, subdomains:"abcd",
        attribution:'&copy; OpenStreetMap contributors &copy; CARTO'
      }).addTo(modalMap);
    }
    const route = routes[activeRouteKey];
    if (modalPolyline) modalMap.removeLayer(modalPolyline);
    if (route.coords && route.coords.length > 1) {
      modalPolyline = L.polyline(route.coords, { color: route.color, weight: 5, opacity: 0.95, lineJoin:"round", lineCap:"round" }).addTo(modalMap);
      modalMap.fitBounds(modalPolyline.getBounds(), { padding: [40, 40] });
    }
    modalMap.invalidateSize();
  }, 80);
}

function closeMapModal() {
  if (!mapModal) return;
  mapModal.classList.remove("active");
  document.body.style.overflow = "";
}

if (mapFullscreenBtn) mapFullscreenBtn.addEventListener("click", openMapModal);
if (mapModalClose)    mapModalClose.addEventListener("click", closeMapModal);
if (mapModal)         mapModal.addEventListener("click", e => { if (e.target === mapModal) closeMapModal(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeMapModal(); });

/* ─── 7. FAQ ─── */
document.querySelectorAll(".faq-item").forEach(item => {
  const btn = item.querySelector(".faq-question");
  const ans = item.querySelector(".faq-answer");
  btn.addEventListener("click", () => {
    const isActive = item.classList.contains("active");
    document.querySelectorAll(".faq-item").forEach(o => {
      o.classList.remove("active");
      o.querySelector(".faq-answer").style.maxHeight = null;
    });
    if (!isActive) { item.classList.add("active"); ans.style.maxHeight = ans.scrollHeight + "px"; }
  });
});

/* ─── 8. MENÚ MÓVIL ─── */
const menuToggle = document.getElementById("menuToggle");
const mainNav    = document.getElementById("mainNav");
if (menuToggle && mainNav) {
  menuToggle.addEventListener("click", () => mainNav.classList.toggle("active"));
  mainNav.querySelectorAll("a").forEach(l => l.addEventListener("click", () => mainNav.classList.remove("active")));
}

/* ─── 9. HEADER SCROLL ─── */
const header = document.getElementById("siteHeader");
function handleHeaderState() {
  if (!header) return;
  header.classList.toggle("scrolled", window.scrollY > 24);
}
handleHeaderState();
window.addEventListener("scroll", handleHeaderState, { passive: true });

/* ─── 10. PARALLAX HERO ─── */
if (!prefersReducedMotion) {
  const heroParallax = document.getElementById("heroParallax");
  function handleParallax() {
    if (!heroParallax) return;
    heroParallax.style.transform = `translate3d(0,${window.scrollY * 0.18}px,0) scale(1.05)`;
  }
  handleParallax();
  window.addEventListener("scroll", handleParallax, { passive: true });
}

/* ─── 11. PARALLAX 3D EN CARDS GLASSMORPHISM ─── */
if (!prefersReducedMotion) {
  document.querySelectorAll(".distance-card-glass").forEach(card => {
    const bg = card.querySelector(".dcg-bg");
    if (!bg) return;
    card.addEventListener("mousemove", e => {
      const r = card.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width  - 0.5) * 12;
      const y = ((e.clientY - r.top)  / r.height - 0.5) * 12;
      bg.style.transform   = `translate(${x}px,${y}px) scale(1.08)`;
      card.style.transform = `translateY(-6px) rotateX(${-y*0.3}deg) rotateY(${x*0.3}deg)`;
    });
    card.addEventListener("mouseleave", () => {
      bg.style.transform   = "translate(0,0) scale(1.05)";
      card.style.transform = "translateY(0) rotateX(0) rotateY(0)";
    });
  });
}

/* ─── 12. REVEAL SCROLL ─── */
const revealItems = document.querySelectorAll(".reveal");
if (prefersReducedMotion) {
  revealItems.forEach(el => el.classList.add("is-visible"));
} else {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("is-visible"); obs.unobserve(e.target); } });
  }, { threshold: 0.10, rootMargin: "0px 0px -40px 0px" });
  revealItems.forEach(el => obs.observe(el));
}

/* ─── 13. ANIMACIÓN SPONSORS ─── */
if (!prefersReducedMotion) {
  const sponsorCards = document.querySelectorAll(".sponsor-logo-card");
  sponsorCards.forEach((card, i) => {
    card.style.transitionDelay = `${i * 80}ms`;
  });
}

/* ─── 14. INIT MAPA ─── */
function tryInitMap() {
  if (typeof L !== "undefined") initMap();
  else setTimeout(tryInitMap, 100);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", tryInitMap);
else tryInitMap();

/* ─── CSS inline para spinner animation ─── */
const style = document.createElement("style");
style.textContent = "@keyframes spin{to{transform:rotate(360deg)}}";
document.head.appendChild(style);
