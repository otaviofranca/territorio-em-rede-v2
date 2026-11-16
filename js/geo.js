// Geocodificação (Nominatim/OSM), KML das UBS e cálculo de unidade de referência.
import { norm } from "./format.js";
import { consultasEndereco } from "./dominio.js";

/* ---------- geometria ---------- */
export const inRing = (lng, lat, r) => {
  let dentro = false;
  for (let a = 0, b = r.length - 1; a < r.length; b = a++) {
    const [xi, yi] = r[a],
      [xj, yj] = r[b];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
};

/** Distância em km (haversine). */
export const hav = (lat1, lng1, lat2, lng2) => {
  const R = 6371,
    t = (x) => (x * Math.PI) / 180,
    dl = t(lat2 - lat1),
    dn = t(lng2 - lng1),
    a = Math.sin(dl / 2) ** 2 + Math.cos(t(lat1)) * Math.cos(t(lat2)) * Math.sin(dn / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

/** UBS de referência: área (polígono) que contém o ponto; senão a mais próxima (aviso: não é área oficial). */
export function ubsPara(ubs, lat, lng) {
  if (!ubs) return null;
  const p = ubs.polys.find((p) => inRing(lng, lat, p.ring));
  if (p) return { nome: p.nome, oficial: true };
  if (ubs.pts.length) {
    const n = ubs.pts.map((u) => ({ u, d: hav(lat, lng, u.lat, u.lng) })).sort((a, b) => a.d - b.d)[0];
    return { nome: n.u.nome, oficial: false, km: n.d };
  }
  return null;
}

export const ubsPorBairro = (ubs, b) => (ubs ? [...ubs.pts, ...ubs.polys].filter((u) => norm(u.nome + " " + u.desc).includes(norm(b.nome))) : []);

/* ---------- KML ---------- */
const LIM = { pts: 5000, polys: 2000, anel: 20000 };

/** Lê um KML do Google My Maps. Mantém só o necessário (coordenadas arredondadas, descrição curta). */
export function parseKML(txt) {
  const x = new DOMParser().parseFromString(txt, "text/xml");
  if (x.querySelector("parsererror")) throw new Error("O arquivo não é um KML válido.");
  const r5 = (n) => Math.round(n * 1e5) / 1e5;
  const anel = (s) =>
    s
      .trim()
      .split(/\s+/)
      .map((t) => t.split(",").map(Number))
      .filter((a) => a.length >= 2 && a.every((n) => Number.isFinite(n)))
      .map((a) => [r5(a[0]), r5(a[1])]);
  const pts = [],
    polys = [];
  for (const p of x.querySelectorAll("Placemark")) {
    const nome = (p.querySelector("name")?.textContent || "").trim().slice(0, 200);
    const desc = (p.querySelector("description")?.textContent || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400);
    for (const c of p.querySelectorAll("Point coordinates")) {
      const a = anel(c.textContent)[0];
      if (a && pts.length < LIM.pts) pts.push({ nome, desc, lng: a[0], lat: a[1] });
    }
    for (const pg of p.querySelectorAll("Polygon")) {
      const c = pg.querySelector("outerBoundaryIs coordinates");
      const ring = c ? anel(c.textContent) : [];
      if (ring.length >= 3 && ring.length <= LIM.anel && polys.length < LIM.polys) polys.push({ nome, desc, ring });
    }
  }
  return { pts, polys };
}

/* ---------- Nominatim ---------- */
let ultimo = 0;

/** Uma consulta por segundo (política de uso do Nominatim). Devolve {lat,lng,addr} ou null. Lança em falha de rede. */
export async function geocode(q) {
  const espera = Math.max(0, 1100 - (Date.now() - ultimo));
  await new Promise((r) => setTimeout(r, espera));
  ultimo = Date.now();
  const u =
    "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&addressdetails=1&viewbox=-43.1,-4.8,-42.5,-5.4&q=" +
    encodeURIComponent(q);
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(u, { headers: { "Accept-Language": "pt-BR" }, signal: ctl.signal });
    if (!r.ok) throw new Error("serviço de endereços respondeu " + r.status);
    const j = await r.json();
    return j[0] ? { lat: +j[0].lat, lng: +j[0].lon, addr: j[0].address || {} } : null;
  } finally {
    clearTimeout(t);
  }
}

/** Posição de um dispositivo: usa o cache (coords.json + navegador) e só consulta o OSM se faltar. */
export async function coordDe(d, cache) {
  const c = cache.get(d.id);
  if (c) return c.fail ? null : c;
  for (const { q, aprox } of consultasEndereco(d)) {
    const r = await geocode(q);
    if (r) {
      const v = aprox ? { lat: r.lat, lng: r.lng, aprox: true } : { lat: r.lat, lng: r.lng };
      cache.set(d.id, v);
      return v;
    }
  }
  cache.set(d.id, { fail: true });
  return null;
}
