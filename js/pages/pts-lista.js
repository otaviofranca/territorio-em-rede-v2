import { h, ico, acoes, $ } from "../dom.js";
import { D } from "../data.js";
import { pts } from "../store.js";
import { hojeISO, fmtDataHora, norm, plural } from "../format.js";
import { devById, prazoDoCaso, SITUACOES_PTS } from "../dominio.js";
import { cabecalho, painel, tag, tabela, tagsRecursos, vazio, toast } from "../ui.js";
import { navegar } from "../router.js";
import { semearDemo } from "../demo.js";
import { tagPrazo } from "./inicio.js";

const TOM = { construcao: "warn", acompanhamento: "", concluido: "ok" };

export function render(el) {
  const todos = pts.list().sort((a, b) => (b.atualizado || "").localeCompare(a.atualizado || ""));
  const hoje = hojeISO();

  el.innerHTML = h`
    ${cabecalho({
      titulo: "Projetos Terapêuticos Singulares",
      desc: "Casos em construção ou acompanhamento. Cada PTS reúne os recursos do território e as ações combinadas com a equipe.",
      acoes: h`<button class="btn btn-p" data-act="novo">${ico("plus")}Novo caso</button>`,
    })}
    ${painel({
      titulo: "Casos",
      icone: "folder",
      acoes: h`<span class="cnt" data-cnt></span>`,
      semRecuo: true,
      corpo: h`
        <div class="pn-b" style="border-bottom:1px solid var(--line-2)"><div class="grid g3">
          <div class="f"><label for="f-q">Buscar</label><input id="f-q" type="search" placeholder="Código ou bairro" autocomplete="off"></div>
          <div class="f"><label for="f-s">Situação</label><select id="f-s"><option value="">Todas</option>${Object.entries(SITUACOES_PTS).map(([v, r]) => h`<option value="${v}">${r}</option>`)}</select></div>
        </div></div>
        <div data-lista></div>`,
    })}`;

  const lista = $("[data-lista]", el);
  const q = $("#f-q", el),
    s = $("#f-s", el);

  function atualizar() {
    const b = norm(q.value);
    const casos = todos.filter((c) => (!b || norm(c.codigo + " " + c.bairro).includes(b)) && (!s.value || c.situacao === s.value));
    $("[data-cnt]", el).textContent = plural(casos.length, "caso", "casos");
    lista.innerHTML = casos.length
      ? tabela({
          legenda: "Lista de casos de PTS",
          colunas: [{ r: "Caso" }, { r: "Bairro" }, { r: "Recursos" }, { r: "Ações" }, { r: "Atualizado" }, { r: "Situação" }, { cls: "ac" }],
          linhas: casos.map((c) => {
            const feitas = c.acoes.filter((a) => a.feita).length;
            return [
              h`<a class="strong" href="#/pts/${c.id}">${c.codigo || "Sem código"}</a>${c.demo ? h` <span class="tag n">exemplo</span>` : ""}`,
              c.bairro || "—",
              tagsRecursos(c.devs.map((id) => devById(D, id)).filter(Boolean)),
              c.acoes.length ? `${feitas}/${c.acoes.length} feitas` : "—",
              fmtDataHora(c.atualizado),
              h`<span class="tags">${tag(SITUACOES_PTS[c.situacao] || "—", TOM[c.situacao])}${c.situacao !== "concluido" && prazoDoCaso(c, hoje) ? tagPrazo(prazoDoCaso(c, hoje)) : ""}</span>`,
              h`<a class="btn btn-t btn-sm" href="#/pts/${c.id}">Abrir${ico("arrow")}</a>`,
            ];
          }),
        })
      : vazio({
          icone: todos.length ? "search" : "clip",
          titulo: todos.length ? "Nenhum caso encontrado" : "Nenhum caso de PTS ainda",
          texto: todos.length ? "Ajuste a busca ou o filtro." : "Crie o primeiro caso ou carregue um exemplo fictício.",
          acao: todos.length ? "" : h`<div class="acts" style="justify-content:center;margin-top:.6rem"><button class="btn btn-p" data-act="novo">Novo caso</button><button class="btn btn-s" data-act="demo">Carregar exemplo fictício</button></div>`,
        });
  }
  q.addEventListener("input", atualizar);
  s.addEventListener("change", atualizar);
  atualizar();

  acoes(el, {
    novo: () => {
      const c = pts.novo();
      if (!c) return toast("Não foi possível salvar no navegador.", "bad");
      pts.definirAtual(c.id);
      navegar("pts/" + c.id);
    },
    demo: () => {
      const r = semearDemo(D);
      if (!r) return toast(r === false ? "Os exemplos já foram carregados." : "Não foi possível salvar no navegador.", r === false ? "warn" : "bad");
      toast("Exemplo fictício carregado.");
      render(el);
    },
  });
}
