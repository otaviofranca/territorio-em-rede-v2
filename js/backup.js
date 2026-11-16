// Formato do backup e validação da importação. Funções puras.
// Um arquivo importado é entrada não confiável: só campos conhecidos, com tipo e tamanho
// verificados, chegam ao armazenamento.
const ID = /^[A-Za-z0-9_-]{1,64}$/;

const texto = (max) => (v) => (typeof v === "string" && v.length <= max ? v : undefined);
const bool = (v) => (typeof v === "boolean" ? v : undefined);
const umDe = (...o) => (v) => (o.includes(v) ? v : undefined);
const lista = (maxItens, maxTexto) => (v) => (Array.isArray(v) && v.length <= maxItens && v.every((x) => typeof x === "string" && x.length <= maxTexto) ? v : undefined);
const idOuNulo = (v) => (v === null || v === "" ? null : typeof v === "string" && ID.test(v) ? v : undefined);
const data = (v) => (v === "" || (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) ? v : undefined);
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

const acoes = (v) => {
  if (!Array.isArray(v) || v.length > 200) return undefined;
  const out = [];
  for (const a of v) {
    if (!a || typeof a !== "object") return undefined;
    const id = a.id === undefined ? undefined : typeof a.id === "string" && ID.test(a.id) ? a.id : null;
    if (id === null) return undefined;
    const r = { acao: texto(500)(a.acao ?? ""), resp: texto(200)(a.resp ?? ""), prazo: data(a.prazo ?? ""), feita: bool(a.feita ?? false) };
    if (Object.values(r).includes(undefined)) return undefined;
    out.push(id ? { id, ...r } : r);
  }
  return out;
};

const ESQUEMAS = {
  pts: {
    obrigatorios: ["id"],
    campos: {
      id: (v) => (typeof v === "string" && ID.test(v) ? v : undefined),
      codigo: texto(100),
      bairro: texto(200),
      demanda: texto(5000),
      objetivos: texto(5000),
      obs: texto(5000),
      situacao: umDe("construcao", "acompanhamento", "concluido"),
      devs: lista(300, 200),
      acoes,
      criado: texto(40),
      atualizado: texto(40),
      demo: bool,
    },
  },
  mat: {
    obrigatorios: ["id"],
    campos: {
      id: (v) => (typeof v === "string" && ID.test(v) ? v : undefined),
      data: data,
      casoId: idOuNulo,
      caso: texto(100),
      eq: lista(20, 100),
      enc: texto(5000),
      st: texto(40),
      demo: bool,
    },
  },
};

function limpar(bruto, { obrigatorios, campos }) {
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return null;
  const out = {};
  for (const [campo, valida] of Object.entries(campos)) {
    if (bruto[campo] === undefined) continue;
    const v = valida(bruto[campo]);
    if (v === undefined) return null;
    out[campo] = v;
  }
  return obrigatorios.every((c) => out[c] !== undefined && out[c] !== "") ? out : null;
}

function limparUbs(u) {
  if (u == null) return null;
  if (typeof u !== "object" || !Array.isArray(u.pts) || !Array.isArray(u.polys) || u.pts.length > 5000 || u.polys.length > 2000) return undefined;
  const base = (x) => x && typeof x === "object" && texto(200)(x.nome) !== undefined && texto(400)(x.desc ?? "") !== undefined;
  const pts = [],
    polys = [];
  for (const p of u.pts) {
    if (!base(p) || num(p.lat) === undefined || num(p.lng) === undefined) return undefined;
    pts.push({ nome: p.nome, desc: p.desc ?? "", lat: p.lat, lng: p.lng });
  }
  for (const p of u.polys) {
    if (!base(p) || !Array.isArray(p.ring) || p.ring.length > 20000) return undefined;
    if (!p.ring.every((a) => Array.isArray(a) && a.length === 2 && num(a[0]) !== undefined && num(a[1]) !== undefined)) return undefined;
    polys.push({ nome: p.nome, desc: p.desc ?? "", ring: p.ring.map((a) => [a[0], a[1]]) });
  }
  return { pts, polys };
}

/** Lê o texto de um backup. Devolve {pts, mat, ubs, rejeitados} ou lança Error. */
export function validarBackup(txt) {
  let bruto;
  try {
    bruto = JSON.parse(txt);
  } catch {
    throw new Error("O arquivo não é um JSON válido.");
  }
  if (!bruto || typeof bruto !== "object" || !["pts", "mat", "ubs"].some((k) => bruto[k] != null)) {
    throw new Error("O arquivo não parece ser um backup do Território em Rede.");
  }
  const r = { rejeitados: 0, ubs: null };
  for (const [nome, esquema] of Object.entries(ESQUEMAS)) {
    r[nome] = [];
    for (const item of Array.isArray(bruto[nome]) ? bruto[nome] : []) {
      const l = limpar(item, esquema);
      if (l) r[nome].push(l);
      else r.rejeitados++;
    }
  }
  const ubs = limparUbs(bruto.ubs);
  if (ubs === undefined) {
    r.rejeitados++;
  } else r.ubs = ubs;
  return r;
}

export function montarBackup({ pts, mat, ubs }) {
  return JSON.stringify({ sistema: "Território em Rede", versao: 2, geradoEm: new Date().toISOString(), pts, mat, ubs }, null, 2);
}
