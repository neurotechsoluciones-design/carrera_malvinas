/* ═══════════════════════════════════════════════════════════════
   CARRERA HÉROES DE MALVINAS — script.js
   Versión 2.0 — Mapa interactivo + Glassmorphism cards
═══════════════════════════════════════════════════════════════ */

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ─────────────────────────────────────────────
   1. CUENTA REGRESIVA
───────────────────────────────────────────── */
const countdownDate = new Date("2026-04-12T09:00:00-03:00").getTime();

function updateCountdown() {
  const now = new Date().getTime();
  const difference = countdownDate - now;

  const daysEl = document.getElementById("days");
  const hoursEl = document.getElementById("hours");
  const minutesEl = document.getElementById("minutes");
  const secondsEl = document.getElementById("seconds");

  if (!daysEl || !hoursEl || !minutesEl || !secondsEl) return;

  if (difference <= 0) {
    daysEl.textContent = "00";
    hoursEl.textContent = "00";
    minutesEl.textContent = "00";
    secondsEl.textContent = "00";
    return;
  }

  const days = Math.floor(difference / (1000 * 60 * 60 * 24));
  const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((difference / (1000 * 60)) % 60);
  const seconds = Math.floor((difference / 1000) % 60);

  daysEl.textContent = String(days).padStart(2, "0");
  hoursEl.textContent = String(hours).padStart(2, "0");
  minutesEl.textContent = String(minutes).padStart(2, "0");
  secondsEl.textContent = String(seconds).padStart(2, "0");
}

updateCountdown();
setInterval(updateCountdown, 1000);

/* ─────────────────────────────────────────────
   2. DATOS DE RECORRIDOS
   Las coordenadas se leen directamente de los archivos GPX en assets/gpx/.
   Para actualizar un recorrido: reemplazá el archivo GPX, sin tocar este código.
───────────────────────────────────────────── */
const CENTER = [-34.6158, -68.3559]; // Punto de largada real (5K/10K)

const routes = {
  "1k": {
    title: "Recorrido 1K",
    description: "Circuito participativo y accesible, pensado para acompañar el espíritu comunitario del evento.",
    surface: "Urbano",
    start: "Zona central del evento",
    gpx: "assets/gpx/carrera-malvinas-1k.gpx",
    color: "#4dbdf5",
    // coords y elevation se cargan dinámicamente desde el GPX
    coords: null,
    elevation: null,
    distance: "—",
    elevUp: "—",
    elevDown: "—"
  },
  "5k": {
    title: "Recorrido 5K",
    description: "Circuito equilibrado para quienes quieren vivir la carrera con intensidad y buena experiencia de ritmo.",
    surface: "Urbano",
    start: "Zona central del evento",
    gpx: "assets/gpx/carrera-malvinas-5k.gpx",
    color: "#74d2ff",
    coords: null,
    elevation: null,
    distance: "—",
    elevUp: "—",
    elevDown: "—"
  },
  "10k": {
    title: "Recorrido 10K",
    description: "Circuito pensado para corredores que buscan una propuesta más exigente y competitiva.",
    surface: "Urbano",
    start: "Zona central del evento",
    gpx: "assets/gpx/carrera-malvinas-10k.gpx",
    color: "#c9efff",
    coords: null,
    elevation: null,
    distance: "—",
    elevUp: "—",
    elevDown: "—"
  }
};

/* ─────────────────────────────────────────────
   PARSER GPX → extrae coordenadas y elevación
───────────────────────────────────────────── */
function parseGpx(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");
  const ns = "http://www.topografix.com/GPX/1/1";

  // Intentar trkpt primero, luego rtept
  let points = Array.from(doc.getElementsByTagNameNS(ns, "trkpt"));
  if (points.length === 0) {
    points = Array.from(doc.getElementsByTagNameNS(ns, "rtept"));
  }
  // Fallback sin namespace
  if (points.length === 0) {
    points = Array.from(doc.querySelectorAll("trkpt, rtept"));
  }

  if (points.length === 0) return null;

  const coords = points.map(pt => [
    parseFloat(pt.getAttribute("lat")),
    parseFloat(pt.getAttribute("lon"))
  ]);

  const elevEls = points.map(pt => {
    const e = pt.getElementsByTagNameNS(ns, "ele")[0]
      || pt.querySelector("ele");
    return e ? parseFloat(e.textContent) : null;
  });

  const hasRealEle = elevEls.some(e => e !== null && e !== 0);
  const elevation = hasRealEle ? elevEls.filter(e => e !== null) : null;

  // Calcular distancia total (Haversine)
  let totalKm = 0;
  for (let i = 1; i < coords.length; i++) {
    totalKm += haversine(coords[i - 1], coords[i]);
  }

  // Calcular desnivel si hay elevación real
  let elevUp = 0, elevDown = 0;
  if (elevation && elevation.length > 1) {
    for (let i = 1; i < elevation.length; i++) {
      const diff = elevation[i] - elevation[i - 1];
      if (diff > 0) elevUp += diff;
      else elevDown += Math.abs(diff);
    }
  }

  return { coords, elevation, totalKm, elevUp, elevDown };
}

function haversine([lat1, lon1], [lat2, lon2]) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* Cargar GPX desde el servidor y poblar la ruta */
async function fetchAndParseGpx(key) {
  const route = routes[key];
  if (route.coords !== null) return true; // ya cargado

  try {
    const res = await fetch(route.gpx);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const data = parseGpx(xml);
    if (!data || data.coords.length < 2) throw new Error("GPX sin puntos válidos");

    route.coords = data.coords;
    route.elevation = data.elevation;
    route.distance = data.totalKm.toFixed(1) + " km";
    route.elevUp = data.elevUp > 0 ? `+${Math.round(data.elevUp)} m` : "—";
    route.elevDown = data.elevDown > 0 ? `−${Math.round(data.elevDown)} m` : "—";
    return true;
  } catch (err) {
    console.warn(`GPX ${key} no disponible: ${err.message}`);
    // Fallback: mostrar mensaje en el mapa
    route.coords = [];
    route.elevation = null;
    route.distance = "GPX no disponible";
    return false;
  }
}

/* ─────────────────────────────────────────────
   3. MAPA LEAFLET
───────────────────────────────────────────── */
let map = null;
let currentPolyline = null;
let currentMarkers = [];
let animationFrame = null;
let elevationChart = null;
let activeRouteKey = "1k";

function initMap() {
  const mapEl = document.getElementById("routeMap");
  if (!mapEl || typeof L === "undefined") return;

  // Inicializar mapa con tiles Stadia Smooth Dark
  map = L.map("routeMap", {
    center: CENTER,
    zoom: 15,
    zoomControl: true,
    attributionControl: true,
    scrollWheelZoom: false
  });

  // Tiles oscuros de Stadia (sin API key para uso público)
  L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    {
      maxZoom: 19,
      subdomains: "abcd",
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
    }
  ).addTo(map);

  // Cargar el recorrido inicial
  loadRoute("1k");
}

async function loadRoute(key) {
  if (!map) return;
  activeRouteKey = key;
  const route = routes[key];

  // Limpiar capa anterior
  if (currentPolyline) { map.removeLayer(currentPolyline); currentPolyline = null; }
  currentMarkers.forEach((m) => map.removeLayer(m));
  currentMarkers = [];
  if (animationFrame) { cancelAnimationFrame(animationFrame); animationFrame = null; }

  // Mostrar spinner mientras carga el GPX
  showMapLoading(true);

  const ok = await fetchAndParseGpx(key);
  showMapLoading(false);

  const coords = route.coords;

  if (!ok || !coords || coords.length < 2) {
    // Mostrar mensaje de error en el panel de info
    if (routeDistanceEl) routeDistanceEl.textContent = "GPX no disponible";
    return;
  }

  if (prefersReducedMotion) {
    currentPolyline = L.polyline(coords, {
      color: route.color, weight: 4, opacity: 0.92,
      lineJoin: "round", lineCap: "round"
    }).addTo(map);
    addKmMarkers(coords, route.color);
    addStartEndMarkers(coords, route.color);
    map.fitBounds(currentPolyline.getBounds(), { padding: [30, 30] });
  } else {
    animatePolyline(coords, route.color, () => {
      addKmMarkers(coords, route.color);
      addStartEndMarkers(coords, route.color);
    });
    const tempLine = L.polyline(coords);
    map.fitBounds(tempLine.getBounds(), { padding: [30, 30] });
  }

  updateElevationChart(route);
}

function showMapLoading(on) {
  const wrap = document.getElementById("routeMap");
  if (!wrap) return;
  let spinner = document.getElementById("mapSpinner");
  if (on) {
    if (!spinner) {
      spinner = document.createElement("div");
      spinner.id = "mapSpinner";
      spinner.style.cssText =
        "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;" +
        "background:rgba(4,9,18,0.55);border-radius:22px;z-index:500;color:#4dbdf5;" +
        "font-size:0.82rem;letter-spacing:0.14em;text-transform:uppercase;";
      spinner.textContent = "Cargando recorrido…";
      wrap.parentElement.style.position = "relative";
      wrap.parentElement.appendChild(spinner);
    }
    spinner.style.display = "flex";
  } else {
    if (spinner) spinner.style.display = "none";
  }
}

function animatePolyline(coords, color, onComplete) {
  const totalSteps = 60;
  let step = 0;

  // Crear polyline vacía
  currentPolyline = L.polyline([], {
    color: color,
    weight: 4,
    opacity: 0.92,
    lineJoin: "round",
    lineCap: "round"
  }).addTo(map);

  function draw() {
    step++;
    const progress = step / totalSteps;
    const pointCount = Math.max(2, Math.floor(coords.length * progress));
    const interpolatedCoords = coords.slice(0, pointCount);

    // Interpolar el último punto para suavidad
    if (step < totalSteps && pointCount < coords.length) {
      const from = coords[pointCount - 1];
      const to = coords[pointCount];
      const t = (progress * coords.length) - (pointCount - 1);
      const interpLat = from[0] + (to[0] - from[0]) * t;
      const interpLng = from[1] + (to[1] - from[1]) * t;
      interpolatedCoords.push([interpLat, interpLng]);
    }

    currentPolyline.setLatLngs(interpolatedCoords);

    if (step < totalSteps) {
      animationFrame = requestAnimationFrame(draw);
    } else {
      currentPolyline.setLatLngs(coords);
      if (onComplete) onComplete();
    }
  }

  animationFrame = requestAnimationFrame(draw);
}

function addKmMarkers(coords, color) {
  if (coords.length < 2) return;

  // Calcular distancias acumuladas (aproximación en grados → km)
  let accumulated = 0;
  let nextKm = 1;

  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const curr = coords[i];
    const dLat = (curr[0] - prev[0]) * 111;
    const dLng = (curr[1] - prev[1]) * 111 * Math.cos((prev[0] * Math.PI) / 180);
    const segDist = Math.sqrt(dLat * dLat + dLng * dLng);
    accumulated += segDist;

    while (accumulated >= nextKm) {
      // Colocar marcador de km
      const kmIcon = L.divIcon({
        className: "km-marker",
        html: `<div class="km-marker-inner" style="border-color:${color}; color:${color}">${nextKm}km</div>`,
        iconSize: [40, 24],
        iconAnchor: [20, 12]
      });
      const marker = L.marker(curr, { icon: kmIcon }).addTo(map);
      currentMarkers.push(marker);
      nextKm++;
    }
  }
}

function addStartEndMarkers(coords, color) {
  if (coords.length < 2) return;

  const startIcon = L.divIcon({
    className: "start-marker",
    html: `<div class="route-marker-pin route-marker-start" style="background:${color}">Largada</div>`,
    iconSize: [64, 28],
    iconAnchor: [32, 14]
  });

  const endIcon = L.divIcon({
    className: "end-marker",
    html: `<div class="route-marker-pin route-marker-end">Meta</div>`,
    iconSize: [48, 28],
    iconAnchor: [24, 14]
  });

  const startMarker = L.marker(coords[0], { icon: startIcon }).addTo(map);
  const endMarker = L.marker(coords[coords.length - 1], { icon: endIcon }).addTo(map);
  currentMarkers.push(startMarker, endMarker);
}

function updateElevationChart(route) {
  const canvas = document.getElementById("elevationChart");
  if (!canvas || typeof Chart === "undefined") return;

  if (elevationChart) { elevationChart.destroy(); elevationChart = null; }

  // Si no hay elevación real, mostrar mensaje
  if (!route.elevation || route.elevation.length < 2) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const wrap = canvas.parentElement;
    let msg = wrap.querySelector(".elev-no-data");
    if (!msg) {
      msg = document.createElement("p");
      msg.className = "elev-no-data";
      msg.style.cssText = "margin:0;color:#7e8da3;font-size:0.78rem;text-align:center;padding:18px 0;";
      msg.textContent = "Perfil de elevación disponible cuando se cargue el GPX con altitud.";
      wrap.appendChild(msg);
    }
    return;
  }

  // Limpiar mensaje si había
  const msg = canvas.parentElement.querySelector(".elev-no-data");
  if (msg) msg.remove();

  const elevData = route.elevation;
  // Submuestrear a máx 30 puntos para claridad visual
  const step = Math.max(1, Math.floor(elevData.length / 30));
  const sampled = elevData.filter((_, i) => i % step === 0);
  const labels = sampled.map((_, i) => {
    const km = (i / (sampled.length - 1)) * parseFloat(route.distance);
    return i === 0 ? "Inicio" : i === sampled.length - 1 ? "Meta" : `${km.toFixed(1)}km`;
  });

  const gradient = canvas.getContext("2d").createLinearGradient(0, 0, 0, 120);
  gradient.addColorStop(0, "rgba(77,189,245,0.35)");
  gradient.addColorStop(1, "rgba(77,189,245,0.02)");

  elevationChart = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Elevación (m)",
        data: sampled,
        borderColor: route.color,
        borderWidth: 2,
        backgroundColor: gradient,
        fill: true,
        tension: 0.45,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: route.color
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: prefersReducedMotion ? false : { duration: 700 },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(4,9,18,0.88)",
          borderColor: "rgba(77,189,245,0.18)",
          borderWidth: 1,
          titleColor: "#cad5e2",
          bodyColor: "#4dbdf5",
          callbacks: { label: (ctx) => ` ${ctx.parsed.y} m s.n.m.` }
        }
      },
      scales: {
        x: {
          grid: { color: "rgba(255,255,255,0.04)" },
          ticks: { color: "#7e8da3", font: { size: 10 }, maxTicksLimit: 6 }
        },
        y: {
          grid: { color: "rgba(255,255,255,0.04)" },
          ticks: { color: "#7e8da3", font: { size: 10 }, callback: (v) => `${v}m` }
        }
      }
    }
  });
}

/* ─────────────────────────────────────────────
   5. TABS DE RECORRIDO
───────────────────────────────────────────── */
const routeTabs = document.querySelectorAll(".route-tab");
const routeTitle = document.getElementById("routeTitle");
const routeDescription = document.getElementById("routeDescription");
const routeSurface = document.getElementById("routeSurface");
const routeStart = document.getElementById("routeStart");
const routeDistanceEl = document.getElementById("routeDistance");
const routeElevUpEl = document.getElementById("routeElevUp");
const routeElevDownEl = document.getElementById("routeElevDown");
const downloadGpxBtn = document.getElementById("downloadGpx");

function updateRouteInfo(key) {
  const route = routes[key];
  if (!route) return;

  if (routeTitle) routeTitle.textContent = route.title;
  if (routeDescription) routeDescription.textContent = route.description;
  if (routeSurface) routeSurface.textContent = route.surface;
  if (routeStart) routeStart.textContent = route.start;
  if (routeDistanceEl) routeDistanceEl.textContent = route.distance;
  if (routeElevUpEl) routeElevUpEl.textContent = route.elevUp;
  if (routeElevDownEl) routeElevDownEl.textContent = route.elevDown;

  if (downloadGpxBtn) {
    downloadGpxBtn.href = route.gpx;
    downloadGpxBtn.download = `carrera-malvinas-${key}.gpx`;
  }
}

routeTabs.forEach((tab) => {
  tab.addEventListener("click", function () {
    const key = this.dataset.route;

    routeTabs.forEach((item) => item.classList.remove("active"));
    this.classList.add("active");

    updateRouteInfo(key);
    loadRoute(key);
  });
});

/* ─────────────────────────────────────────────
   6. FULLSCREEN DEL MAPA
───────────────────────────────────────────── */
const mapFullscreenBtn = document.getElementById("mapFullscreenBtn");
const mapModal = document.getElementById("mapModal");
const mapModalClose = document.getElementById("mapModalClose");
let modalMap = null;
let modalPolyline = null;
let modalMarkers = [];

function openMapModal() {
  if (!mapModal) return;
  mapModal.classList.add("active");
  document.body.style.overflow = "hidden";

  // Crear mapa dentro del modal si no existe
  setTimeout(() => {
    if (!modalMap) {
      const modalContainer = document.getElementById("mapModalContainer");
      if (!modalContainer) return;

      modalMap = L.map("mapModalContainer", {
        center: CENTER,
        zoom: 15,
        zoomControl: true,
        scrollWheelZoom: true
      });

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          maxZoom: 19,
          subdomains: "abcd",
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
        }
      ).addTo(modalMap);
    }

    const route = routes[activeRouteKey];
    if (modalPolyline) modalMap.removeLayer(modalPolyline);
    modalMarkers.forEach((m) => modalMap.removeLayer(m));
    modalMarkers = [];

    modalPolyline = L.polyline(route.coords, {
      color: route.color,
      weight: 5,
      opacity: 0.95,
      lineJoin: "round",
      lineCap: "round"
    }).addTo(modalMap);

    modalMap.fitBounds(modalPolyline.getBounds(), { padding: [40, 40] });
    modalMap.invalidateSize();
  }, 80);
}

function closeMapModal() {
  if (!mapModal) return;
  mapModal.classList.remove("active");
  document.body.style.overflow = "";
}

if (mapFullscreenBtn) mapFullscreenBtn.addEventListener("click", openMapModal);
if (mapModalClose) mapModalClose.addEventListener("click", closeMapModal);
if (mapModal) {
  mapModal.addEventListener("click", (e) => {
    if (e.target === mapModal) closeMapModal();
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeMapModal();
});

/* ─────────────────────────────────────────────
   7. FAQ ACCORDION
───────────────────────────────────────────── */
const faqItems = document.querySelectorAll(".faq-item");

faqItems.forEach((item) => {
  const button = item.querySelector(".faq-question");
  const answer = item.querySelector(".faq-answer");

  button.addEventListener("click", () => {
    const isActive = item.classList.contains("active");

    faqItems.forEach((otherItem) => {
      otherItem.classList.remove("active");
      const otherAnswer = otherItem.querySelector(".faq-answer");
      otherAnswer.style.maxHeight = null;
    });

    if (!isActive) {
      item.classList.add("active");
      answer.style.maxHeight = answer.scrollHeight + "px";
    }
  });
});

/* ─────────────────────────────────────────────
   8. MENÚ MÓVIL
───────────────────────────────────────────── */
const menuToggle = document.getElementById("menuToggle");
const mainNav = document.getElementById("mainNav");

if (menuToggle && mainNav) {
  menuToggle.addEventListener("click", () => {
    mainNav.classList.toggle("active");
  });

  mainNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      mainNav.classList.remove("active");
    });
  });
}

/* ─────────────────────────────────────────────
   9. HEADER SCROLL
───────────────────────────────────────────── */
const header = document.getElementById("siteHeader");

function handleHeaderState() {
  if (!header) return;
  if (window.scrollY > 24) {
    header.classList.add("scrolled");
  } else {
    header.classList.remove("scrolled");
  }
}

handleHeaderState();
window.addEventListener("scroll", handleHeaderState, { passive: true });

/* ─────────────────────────────────────────────
   10. PARALLAX HERO
───────────────────────────────────────────── */
if (!prefersReducedMotion) {
  const heroParallax = document.getElementById("heroParallax");

  function handleParallax() {
    if (!heroParallax) return;
    const offset = window.scrollY * 0.18;
    heroParallax.style.transform = `translate3d(0, ${offset}px, 0) scale(1.05)`;
  }

  handleParallax();
  window.addEventListener("scroll", handleParallax, { passive: true });
}

/* ─────────────────────────────────────────────
   11. PARALLAX SUTIL EN CARDS GLASSMORPHISM
───────────────────────────────────────────── */
if (!prefersReducedMotion) {
  const glassCards = document.querySelectorAll(".distance-card-glass");

  glassCards.forEach((card) => {
    const bg = card.querySelector(".dcg-bg");
    if (!bg) return;

    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 12;
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * 12;
      bg.style.transform = `translate(${x}px, ${y}px) scale(1.08)`;
      card.style.transform = `translateY(-6px) rotateX(${-y * 0.3}deg) rotateY(${x * 0.3}deg)`;
    });

    card.addEventListener("mouseleave", () => {
      bg.style.transform = "translate(0,0) scale(1.05)";
      card.style.transform = "translateY(0) rotateX(0) rotateY(0)";
    });
  });
}

/* ─────────────────────────────────────────────
   12. REVEAL SCROLL (IntersectionObserver)
───────────────────────────────────────────── */
const revealItems = document.querySelectorAll(".reveal");

if (prefersReducedMotion) {
  revealItems.forEach((item) => item.classList.add("is-visible"));
} else {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.12,
      rootMargin: "0px 0px -40px 0px"
    }
  );

  revealItems.forEach((item) => revealObserver.observe(item));
}

/* ─────────────────────────────────────────────
   13. INIT — esperar a que Leaflet cargue
───────────────────────────────────────────── */
function tryInitMap() {
  if (typeof L !== "undefined") {
    initMap();
  } else {
    setTimeout(tryInitMap, 100);
  }
}

// Inicializar mapa al cargar la página
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", tryInitMap);
} else {
  tryInitMap();
}
