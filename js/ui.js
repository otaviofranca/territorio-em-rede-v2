// Componentes de interface reutilizáveis.
import { h, ico, $ } from "./dom.js";
import { TIPOS } from "./dominio.js";

export function toast(texto, tipo = "ok") {
  const d = document.createElement("div");
  d.className = "msg " + tipo;
  if (tipo === "bad") d.setAttribute("role", "alert");
  const ic = { ok: "check", bad: "alert", warn: "alert", info: "info" }[tipo] || "check";
  d.innerHTML = h`<i>${ico(ic)}</i><div>${texto}</div>`;
  const area = $("#toasts");
  area.append(d);
  while (area.children.length > 3) area.firstElementChild.remove(); // no máximo 3 avisos empilhados
  setTimeout(() => d.remove(), tipo === "bad" ? 7000 : 3500);
}

/** Confirmação acessível com <dialog> nativo (foco preso, Esc cancela). */
export function confirmar({ titulo, texto, botao = "Confirmar", perigo = false }) {
  const d = $("#dlg");
  if (d.open) return Promise.resolve(false); // já há uma confirmação aberta
  $("#dlg-t").textContent = titulo;
  $("#dlg-p").textContent = texto;
  const ok = $("#dlg-ok");
  ok.textContent = botao;
  ok.className = "btn " + (perigo ? "btn-bad" : "btn-p");
  d.returnValue = "";
  d.showModal();
  $("[value=no]", d).focus();
  return new Promise((res) => d.addEventListener("close", () => res(d.returnValue === "yes"), { once: true }));
}

/** Trilha + título + descrição + ações da página. `trilha` = [{r, href}]. */
export function cabecalho({ trilha = [], titulo, desc, acoes, extra }) {
  const itens = [{ r: "Início", href: "#/inicio" }, ...trilha];
  return h`
    <nav aria-label="Você está aqui"><ol class="crumb">${itens.map((i) => h`<li><a href="${i.href}">${i.r}</a></li>`)}<li><span aria-current="page">${titulo}</span></li></ol></nav>
    <header class="ph">
      <div><h1>${titulo}</h1>${desc ? h`<p>${desc}</p>` : ""}${extra || ""}</div>
      ${acoes ? h`<div class="acts">${acoes}</div>` : ""}
    </header>`;
}

export function painel({ titulo, icone, desc, acoes, corpo, semRecuo = false, id = "", cls = "" }) {
  return h`<section class="pn ${cls}" ${id ? h`id="${id}"` : ""}>
    ${titulo ? h`<header class="pn-h"><h2>${icone ? ico(icone) : ""}${titulo}</h2>${acoes || ""}${desc ? h`<p>${desc}</p>` : ""}</header>` : ""}
    ${semRecuo ? corpo : h`<div class="pn-b">${corpo}</div>`}
  </section>`;
}

export const tag = (texto, tom = "") => h`<span class="tag ${tom}">${texto}</span>`;

export function tagTipo(tipo) {
  const t = TIPOS[tipo];
  return t ? h`<span class="tag ${t.cls} t">${t.rot}</span>` : tag(tipo);
}

export function msg({ tipo = "", titulo, corpo, icone }) {
  const ic = icone || { ok: "check", warn: "alert", bad: "alert" }[tipo] || "info";
  return h`<div class="msg ${tipo}"><i>${ico(ic)}</i><div>${titulo ? h`<strong>${titulo}</strong>` : ""}${corpo || ""}</div></div>`;
}

export function vazio({ icone = "folder", titulo, texto, acao }) {
  return h`<div class="empty">${ico(icone)}<strong>${titulo}</strong>${texto ? h`<span>${texto}</span>` : ""}${acao || ""}</div>`;
}

/** Tabela que vira lista empilhada no celular (cada célula leva o rótulo da coluna). */
export function tabela({ colunas, linhas, legenda }) {
  return h`<div class="tw"><table class="tb rt">
    ${legenda ? h`<caption class="sr">${legenda}</caption>` : ""}
    <thead><tr>${colunas.map((c) => h`<th scope="col">${c.r || h`<span class="sr">Ações</span>`}</th>`)}</tr></thead>
    <tbody>${linhas.map((cels) => h`<tr>${cels.map((cel, i) => h`<td data-l="${colunas[i].r || ""}" class="${colunas[i].cls || ""}">${cel}</td>`)}</tr>`)}</tbody>
  </table></div>`;
}

/** Contagem de recursos por tipo, como etiquetas. */
export function tagsRecursos(devs) {
  const ordem = ["CRAS", "CREAS", "Centro de Convivência"];
  const por = new Map();
  devs.forEach((d) => por.set(d.tipo, (por.get(d.tipo) || 0) + 1));
  const itens = ordem.filter((t) => por.has(t));
  return itens.length ? h`<span class="tags">${itens.map((t) => h`<span class="tag ${TIPOS[t].cls} t">${por.get(t)} ${TIPOS[t].rot}</span>`)}</span>` : h`<span class="muted">—</span>`;
}
