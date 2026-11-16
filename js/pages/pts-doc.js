import { h, ico, acoes } from "../dom.js";
import { D } from "../data.js";
import { pts } from "../store.js";
import { fmtData, fmtDataHora } from "../format.js";
import { bairroExato, devById, SITUACOES_PTS } from "../dominio.js";
import { cabecalho, vazio } from "../ui.js";

const quebras = (t) => String(t).split("\n").map((l, i) => (i ? h`<br>${l}` : l));

export function render(el, ctx, id) {
  const c = pts.get(id);
  if (!c) {
    el.innerHTML = h`<div class="pn">${vazio({ icone: "search", titulo: "Caso não encontrado", texto: "Ele pode ter sido excluído.", acao: h`<a class="btn btn-p" href="#/pts">Voltar aos casos</a>` })}</div>`;
    return;
  }
  const b = bairroExato(D, c.bairro);
  const recursos = c.devs.map((i) => devById(D, i)).filter(Boolean);
  const secao = (t, txt) => h`<h2>${t}</h2><p>${txt ? quebras(txt) : h`<em>Nenhum registro.</em>`}</p>`;

  el.innerHTML = h`
    <div class="noprint">${cabecalho({
      trilha: [{ r: "PTS", href: "#/pts" }, { r: c.codigo || "Caso", href: `#/pts/${c.id}` }],
      titulo: "Documento do PTS",
      desc: "Folha A4 pronta para imprimir ou salvar em PDF.",
      acoes: h`<button class="btn btn-p" data-act="imprimir">${ico("print")}Imprimir / PDF</button><a class="btn btn-s" href="#/pts/${c.id}">Voltar ao PTS</a>`,
    })}</div>
    <article class="sheet">
      <header>
        <svg class="logo" viewBox="0 0 36 36" aria-hidden="true"><rect width="36" height="36" rx="10" fill="currentColor"/><path d="M18 11 11 24M18 11l7 13M11 24h14" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none"/><g fill="#fff"><circle cx="18" cy="11" r="3.2"/><circle cx="11" cy="24" r="3.2"/><circle cx="25" cy="24" r="3.2"/></g></svg>
        <div><strong>Território em Rede</strong><span>Apoio matricial e territorial · Teresina-PI</span></div>
      </header>
      <h1>Projeto Terapêutico Singular</h1>
      <p class="sub">Documento de apoio à reflexão da equipe</p>
      <table><tbody>
        <tr><th>Caso</th><td>${c.codigo || "—"}</td><th>Bairro</th><td>${c.bairro || "—"}</td></tr>
        <tr><th>Situação</th><td>${SITUACOES_PTS[c.situacao] || "—"}</td><th>CRAS</th><td>${b ? b.cras.join(", ") : "—"}</td></tr>
        <tr><th>Criado em</th><td>${fmtDataHora(c.criado)}</td><th>Atualizado</th><td>${fmtDataHora(c.atualizado)}</td></tr>
      </tbody></table>
      ${secao("1. Situação / demanda", c.demanda)}
      ${secao("2. Objetivos do cuidado", c.objetivos)}
      <h2>3. Recursos do território</h2>
      ${recursos.length ? h`<ul>${recursos.map((d) => h`<li><strong>${d.nome}</strong> (${d.tipo}) — ${d.end}${d.tel ? " · " + d.tel : ""}</li>`)}</ul>` : h`<p><em>Nenhum recurso selecionado.</em></p>`}
      <h2>4. Ações combinadas</h2>
      ${c.acoes.length ? h`<table><thead><tr><th>Ação</th><th>Responsável</th><th>Prazo</th><th>Feita</th></tr></thead><tbody>${c.acoes.map((a) => h`<tr><td>${a.acao || "—"}</td><td>${a.resp || "—"}</td><td>${fmtData(a.prazo)}</td><td>${a.feita ? "Sim" : "Não"}</td></tr>`)}</tbody></table>` : h`<p><em>Nenhuma ação combinada.</em></p>`}
      ${secao("5. Observações", c.obs)}
      <div class="sig"><div>Profissional de referência</div><div>Coordenação / equipe</div></div>
      <footer>Documento gerado pelo Território em Rede em ${fmtDataHora(new Date())} · apoio à reflexão da equipe; não prescreve condutas</footer>
    </article>`;

  acoes(el, { imprimir: () => window.print() });
}
