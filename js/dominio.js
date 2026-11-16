// Regras do domínio (funções puras, testadas em tests/). `D` é o conteúdo de data/dados.json.
import { norm, somaDias } from "./format.js";

export const TIPOS = {
  CRAS: { cls: "cras", rot: "CRAS" },
  CREAS: { cls: "creas", rot: "CREAS" },
  "Centro de Convivência": { cls: "cc", rot: "Centro" },
  UBS: { cls: "ubs", rot: "UBS" },
};

export const EQUIPES = ["Saúde da Família (ESF)", "eMulti", "CAPS", "Assistência Social (CRAS/CREAS)", "Dispositivo comunitário", "Outro"];
export const SITUACOES_PTS = { construcao: "Em construção", acompanhamento: "Em acompanhamento", concluido: "Concluído" };
export const SITUACOES_MAT = ["Em andamento", "Aguardando retorno", "Concluído"];

export const crasKey = (u) => u.nome.replace(/^CRAS\s+/i, "").toUpperCase();
export const regiao = (u) => u.nome.toUpperCase().replace(/^(CRAS|CREAS)\s+/, "").split(" ")[0];

const cache = new WeakMap();

/** Catálogo único de dispositivos (CRAS, CREAS e centros de convivência). */
export function devices(D) {
  if (cache.has(D)) return cache.get(D);
  const out = [];
  D.unidades.forEach((u) =>
    out.push({ id: "u:" + u.nome, tipo: u.tipo, nome: u.nome, end: u.endereco, tel: u.telefone, email: u.email, cras: u.tipo === "CRAS" ? crasKey(u) : null, regiao: regiao(u), bairro: "" }),
  );
  D.centros.forEach((c) =>
    out.push({
      id: "c:" + c.id,
      tipo: "Centro de Convivência",
      nome: c.nome,
      end: c.endereco + (c.bairro ? " — " + c.bairro : ""),
      tel: c.telefone,
      email: c.email,
      cras: c.cras,
      regiao: c.cras.split(" ")[0],
      bairro: c.bairro,
      info: [c.grupos, c.publico, c.parceria && "parceria " + c.parceria].filter(Boolean).join(" · "),
    }),
  );
  cache.set(D, out);
  return out;
}

export const devById = (D, id) => devices(D).find((d) => d.id === id) || null;

/** CRAS do bairro, CREAS da mesma região e centros de convivência dos CRAS do bairro. */
export function territorio(D, b) {
  const dv = devices(D);
  const cras = dv.filter((d) => d.tipo === "CRAS" && b.cras.includes(d.cras));
  const regs = [...new Set(cras.map((d) => d.regiao))];
  return {
    cras,
    creas: dv.filter((d) => d.tipo === "CREAS" && regs.includes(d.regiao)),
    centros: dv.filter((d) => d.tipo === "Centro de Convivência" && b.cras.includes(d.cras)),
  };
}

/** Bairros que combinam com a busca: igualdade exata, senão contém (mín. 3 letras). Pode devolver vários. */
export function buscarBairros(D, q) {
  const n = norm(q);
  if (!n) return [];
  const exatos = D.bairros.filter((b) => norm(b.nome) === n);
  if (exatos.length) return exatos;
  return n.length >= 3 ? D.bairros.filter((b) => norm(b.nome).includes(n)) : [];
}

export const bairroExato = (D, q) => D.bairros.find((b) => norm(b.nome) === norm(q)) || null;

/** Situação de uma ação do PTS: feita | sem (sem prazo) | atrasada | semana (vence em até 7 dias) | ok. */
export function acaoStatus(a, hoje) {
  if (a.feita) return "feita";
  if (!a.prazo) return "sem";
  if (a.prazo < hoje) return "atrasada";
  if (a.prazo <= somaDias(hoje, 7)) return "semana";
  return "ok";
}

/** Próxima ação pendente: a de menor prazo; ações sem prazo vêm por último. */
export function proximaAcao(c) {
  const pend = (c.acoes || []).filter((a) => !a.feita && (a.acao || a.prazo));
  return pend.sort((a, b) => (a.prazo || "9999").localeCompare(b.prazo || "9999"))[0] || null;
}

/** Quantidade de ações pendentes vencidas ou com prazo em até 7 dias. */
export const contarPrazos = (casos, hoje) =>
  casos.flatMap((c) => c.acoes || []).filter((a) => ["atrasada", "semana"].includes(acaoStatus(a, hoje))).length;

/** Resumo de prazos de um caso: "atrasada" > "semana" > "ok" > "" (sem ações pendentes). */
export function prazoDoCaso(c, hoje) {
  const st = (c.acoes || []).map((a) => acaoStatus(a, hoje));
  if (st.includes("atrasada")) return "atrasada";
  if (st.includes("semana")) return "semana";
  if (st.includes("ok")) return "ok";
  return "";
}

// Mesma lógica de scripts/geocode.py (mantenha as duas em sincronia).
export const limpaEndereco = (e) =>
  String(e || "")
    .replace(/\(.*?\)/g, "")
    .replace(/ponto de refer[eê]ncia:.*/i, "")
    .replace(/Teresina\s*[–-]\s*Piau[ií]\.?/gi, "")
    .replace(/\bs\/?n\b[º°]?/gi, "")
    .replace(/n[ºª°]\s*/gi, "")
    .replace(/\bCEP\s*[\d.-]+/gi, "")
    .replace(/\s+/g, " ")
    .replace(/,\s*,/g, ",")
    .replace(/^[ ,.-]+|[ ,.-]+$/g, "");

export function bairroDoEndereco(e) {
  const l = limpaEndereco(e);
  const tracos = l.split(/\s[–-]\s?|-\s/).map((s) => s.replace(/^[ ,.]+|[ ,.]+$/g, "")).filter(Boolean);
  let cand = "";
  if (tracos.length >= 2) cand = tracos[tracos.length - 1];
  else {
    const p = l.split(",").map((s) => s.replace(/^[ ,.]+|[ ,.]+$/g, "")).filter(Boolean);
    cand = p.length >= 2 ? p[p.length - 1] : "";
  }
  cand = cand.replace(/^\d+\s*/, "");
  for (let i = 0; i < 2; i++) cand = cand.replace(/^(Bairro|Conj\.?|Conjunto)\s+/i, "");
  return cand.replace(/^[ ,.]+|[ ,.]+$/g, "");
}

export const ruaDoEndereco = (e) => limpaEndereco(e).split(",")[0].split(" – ")[0].split(" - ")[0].trim();

/** Consultas para posicionar um dispositivo, da mais precisa à mais aproximada. */
export function consultasEndereco(d) {
  const b = d.bairro || bairroDoEndereco(d.end);
  const q = [{ q: limpaEndereco(d.end) + ", Teresina, Piauí", aprox: false }];
  if (b && ruaDoEndereco(d.end)) q.push({ q: `${ruaDoEndereco(d.end)}, ${b}, Teresina, Piauí`, aprox: false });
  if (d.tipo !== "Centro de Convivência") q.push({ q: `${d.nome}, Teresina, Piauí`, aprox: false });
  if (b) q.push({ q: `${b}, Teresina, Piauí`, aprox: true });
  return q;
}
