// Datas, textos e normalização. Funções puras.
const p2 = (n) => String(n).padStart(2, "0");

export const isoLocal = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const hojeISO = () => isoLocal(new Date());

/** Soma `n` dias a uma data AAAA-MM-DD (no fuso local). */
export function somaDias(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  return isoLocal(new Date(y, m - 1, d + n));
}

/** AAAA-MM-DD -> DD/MM/AAAA, sem passar por Date (evita voltar um dia no fuso do Brasil). */
export function fmtData(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v ? String(v) : "—";
}

export function fmtDataHora(v) {
  const d = v instanceof Date ? v : new Date(v);
  if (!v || isNaN(d)) return "—";
  return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

export const fmtHora = (d = new Date()) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
export const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;

/** Minúsculas, sem acentos e sem pontuação: para comparar nomes de bairro. */
export const norm = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
