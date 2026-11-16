import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { h, raw, esc } from "../js/dom.js";
import { norm, somaDias, fmtData, isoLocal } from "../js/format.js";
import { buscarBairros, bairroExato, territorio, devices, acaoStatus, proximaAcao, contarPrazos, prazoDoCaso, limpaEndereco, bairroDoEndereco, consultasEndereco } from "../js/dominio.js";
import { inRing, hav, ubsPara } from "../js/geo.js";
import { validarBackup, montarBackup } from "../js/backup.js";

const D = JSON.parse(readFileSync(new URL("../data/dados.json", import.meta.url), "utf8"));
const COORDS = JSON.parse(readFileSync(new URL("../data/coords.json", import.meta.url), "utf8"));

/* ---------- escape (XSS) ---------- */
test("h escapa valores e preserva outro h", () => {
  const ataque = `<img src=x onerror="alert(1)">'\``;
  assert.ok(!h`<p>${ataque}</p>`.toString().includes("<img"));
  assert.equal(h`<b>${h`<i>${"<"}</i>`}</b>`.toString(), "<b><i>&lt;</i></b>");
  assert.equal(h`${[h`<a>`, "<b>"]}`.toString(), "<a>&lt;b&gt;");
  assert.equal(h`${null}${false}${undefined}`.toString(), "");
  assert.equal(raw("<x>").toString(), "<x>");
  assert.equal(esc(`"&'`), "&quot;&amp;&#39;");
});

/* ---------- formatos ---------- */
test("datas e normalização", () => {
  assert.equal(somaDias("2026-11-30", 1), "2026-12-01");
  assert.equal(somaDias("2026-03-01", -1), "2026-02-28");
  assert.equal(fmtData("2026-11-16"), "16/11/2026");
  assert.equal(fmtData(""), "—");
  assert.equal(isoLocal(new Date(2026, 0, 5)), "2026-01-05");
  assert.equal(norm("  Piçarreira   I! "), "picarreira i");
});

/* ---------- base de dados ---------- */
test("integridade de data/dados.json", () => {
  const cras = new Set(D.unidades.filter((u) => u.tipo === "CRAS").map((u) => u.nome.replace(/^CRAS\s+/i, "").toUpperCase()));
  for (const b of D.bairros) {
    assert.ok(b.cras.length, `bairro sem CRAS: ${b.nome}`);
    b.cras.forEach((c) => assert.ok(cras.has(c), `CRAS inexistente ${c} em ${b.nome}`));
  }
  D.centros.forEach((c) => assert.ok(cras.has(c.cras), `centro ${c.nome} com CRAS inexistente`));
});

test("coords.json cobre todos os dispositivos e fica na região de Teresina", () => {
  for (const d of devices(D)) {
    const c = COORDS[d.id];
    assert.ok(c && !c.fail, `sem posição: ${d.id}`);
    assert.ok(c.lat < -4.8 && c.lat > -5.4 && c.lng > -43.1 && c.lng < -42.5, `fora da região: ${d.id}`);
  }
});

test("buscarBairros: exato, parcial e ambiguidade", () => {
  assert.equal(buscarBairros(D, "acarape")[0].nome, "Acarape");
  assert.equal(buscarBairros(D, "ACARAPE").length, 1);
  assert.ok(buscarBairros(D, "parque").length > 1, "busca parcial pode devolver vários");
  assert.equal(buscarBairros(D, "jardim")[0].nome, "Cidade Jardim");
  assert.deepEqual(buscarBairros(D, "xx"), []);
  assert.deepEqual(buscarBairros(D, ""), []);
  assert.equal(bairroExato(D, "Acarape").nome, "Acarape");
  assert.equal(bairroExato(D, "jardim"), null);
});

test("territorio: CRAS, CREAS da região e centros do CRAS", () => {
  const t = territorio(D, bairroExato(D, "Acarape"));
  assert.deepEqual(t.cras.map((d) => d.nome), ["CRAS Norte II"]);
  assert.deepEqual(t.creas.map((d) => d.nome), ["CREAS NORTE"]);
  assert.equal(t.centros.length, 3);
});

/* ---------- ações e prazos ---------- */
test("acaoStatus e contagens", () => {
  const hoje = "2026-11-16";
  assert.equal(acaoStatus({ feita: true, prazo: "2020-01-01" }, hoje), "feita");
  assert.equal(acaoStatus({ prazo: "" }, hoje), "sem");
  assert.equal(acaoStatus({ prazo: "2026-11-15" }, hoje), "atrasada");
  assert.equal(acaoStatus({ prazo: "2026-11-16" }, hoje), "semana");
  assert.equal(acaoStatus({ prazo: "2026-11-23" }, hoje), "semana");
  assert.equal(acaoStatus({ prazo: "2026-11-24" }, hoje), "ok");
  const c1 = { acoes: [{ acao: "a", prazo: "2026-11-20" }, { acao: "b", prazo: "2026-11-10", feita: true }] };
  const c2 = { acoes: [{ acao: "c", prazo: "2026-11-01" }, { acao: "d", prazo: "2027-01-01" }, { acao: "e", prazo: "" }] };
  assert.equal(contarPrazos([c1, c2], hoje), 2);
  assert.equal(proximaAcao(c2).acao, "c");
  assert.equal(proximaAcao({ acoes: [{ acao: "x", feita: true }] }), null);
  assert.equal(proximaAcao({ acoes: [{ acao: "sem prazo" }, { acao: "com prazo", prazo: "2026-12-01" }] }).acao, "com prazo");
  assert.equal(prazoDoCaso(c2, hoje), "atrasada");
  assert.equal(prazoDoCaso(c1, hoje), "semana");
  assert.equal(prazoDoCaso({ acoes: [] }, hoje), "");
});

/* ---------- endereços ---------- */
test("limpaEndereco / bairroDoEndereco / consultasEndereco", () => {
  assert.equal(bairroDoEndereco("Rua Bernardo da Paz, S/N, Extrema (próximo à UPA)"), "Extrema");
  assert.equal(bairroDoEndereco("Rua 05, nº 9211 – Conj. Jatobá II – Angelim II"), "Angelim II");
  assert.equal(bairroDoEndereco("Rua Dr. José Auto de Abreu, Nº 3660 Bairro Morada do Sol"), "Morada do Sol");
  assert.equal(bairroDoEndereco("Conjunto Taquari, QD Casa 31 - Bairro Vale Quem Tem"), "Vale Quem Tem");
  assert.ok(!limpaEndereco("Povoado Santa Luz, S/N, Teresina – Piauí. Ponto de referência: UBS X").includes("Piauí"));
  const q = consultasEndereco({ tipo: "CRAS", nome: "CRAS Norte V", end: "Rua Ministro Sérgio Mota, S/N, Parque Stael, (próximo à praça)", bairro: "" });
  assert.equal(q[0].q, "Rua Ministro Sérgio Mota, Parque Stael, Teresina, Piauí");
  assert.equal(q.at(-1).aprox, true);
});

/* ---------- geometria e UBS ---------- */
test("inRing, hav e ubsPara", () => {
  const quad = [[0, 0], [2, 0], [2, 2], [0, 2]];
  assert.equal(inRing(1, 1, quad), true);
  assert.equal(inRing(3, 1, quad), false);
  assert.ok(Math.abs(hav(-5.0892, -42.8019, -5.0892, -42.7019) - 11.1) < 0.2);
  const ubs = { polys: [{ nome: "UBS Área", ring: quad }], pts: [{ nome: "UBS Longe", lat: 10, lng: 10 }, { nome: "UBS Perto", lat: 5, lng: 5 }] };
  assert.deepEqual(ubsPara(ubs, 1, 1), { nome: "UBS Área", oficial: true });
  const p = ubsPara(ubs, 4.5, 4.5);
  assert.equal(p.nome, "UBS Perto");
  assert.equal(p.oficial, false);
  assert.equal(ubsPara(null, 0, 0), null);
});

/* ---------- backup ---------- */
test("validarBackup aceita dados válidos e rejeita entrada maliciosa", () => {
  const ok = { sistema: "x", pts: [{ id: "a1", codigo: "Caso 1", bairro: "Acarape", situacao: "construcao", devs: ["u:CRAS Norte II"], acoes: [{ id: "z", acao: "Visita", resp: "ESF", prazo: "2026-11-20", feita: false }] }], mat: [{ id: "m1", data: "2026-11-01", casoId: "a1", eq: ["CAPS"], enc: "ok", st: "Em andamento" }], ubs: { pts: [{ nome: "UBS 1", desc: "", lat: -5, lng: -42 }], polys: [] } };
  const r = validarBackup(JSON.stringify(ok));
  assert.equal(r.pts.length, 1);
  assert.equal(r.mat.length, 1);
  assert.equal(r.ubs.pts.length, 1);
  assert.equal(r.rejeitados, 0);

  const ruim = {
    pts: [
      { id: "../etc", codigo: "x" }, // id inválido
      { id: "b", codigo: 123 }, // tipo errado
      { id: "c", situacao: "hack" }, // valor fora da lista
      { id: "d", codigo: "x".repeat(101) }, // grande demais
      { id: "e", acoes: [{ prazo: "ontem" }] }, // data inválida
      { id: "f", codigo: "ok", __proto__x: 1, extra: "<script>" }, // campo desconhecido é descartado
    ],
    mat: [{ id: "m", casoId: "../x" }],
    ubs: { pts: [{ nome: "x", lat: "a", lng: 1 }], polys: [] },
  };
  const r2 = validarBackup(JSON.stringify(ruim));
  assert.equal(r2.pts.length, 1);
  assert.equal(r2.pts[0].id, "f");
  assert.ok(!("extra" in r2.pts[0]));
  assert.equal(r2.mat.length, 0);
  assert.equal(r2.ubs, null);
  assert.equal(r2.rejeitados, 7);

  assert.throws(() => validarBackup("não é json"), /JSON/);
  assert.throws(() => validarBackup("[]"), /backup/);
  assert.throws(() => validarBackup('{"outra":1}'), /backup/);
});

test("backup de ida e volta e compatibilidade com a versão anterior", () => {
  const dados = { pts: [{ id: "a", codigo: "C", devs: [], acoes: [] }], mat: [], ubs: null };
  const r = validarBackup(montarBackup(dados));
  assert.equal(r.pts[0].id, "a");
  // backup da versão 1: ações sem id e matricial com texto do caso
  const v1 = { pts: [{ id: "x1", codigo: "Caso 1", bairro: "Acarape", demanda: "", objetivos: "", devs: [], acoes: [{ acao: "A", resp: "B", prazo: "" }], obs: "", criado: "2026-01-01T00:00:00Z" }], mat: [{ id: "m1", data: "2026-05-01", caso: "Caso 1", eq: ["CAPS"], enc: "x", st: "Concluído" }], ubs: null };
  const r1 = validarBackup(JSON.stringify(v1));
  assert.equal(r1.pts.length, 1);
  assert.equal(r1.mat.length, 1);
  assert.equal(r1.mat[0].caso, "Caso 1");
});
