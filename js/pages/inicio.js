import { h, ico, acoes } from "../dom.js";
import { D } from "../data.js";
import { pts } from "../store.js";
import { hojeISO, fmtData } from "../format.js";
import { contarPrazos, proximaAcao, prazoDoCaso, devById } from "../dominio.js";
import { cabecalho, painel, tag, tabela, tagsRecursos, vazio, toast } from "../ui.js";
import { semearDemo } from "../demo.js";

export const tagPrazo = (st) =>
  ({ atrasada: tag("Ação atrasada", "bad"), semana: tag("Prazo em 7 dias", "warn"), ok: tag("Em dia", "ok"), "": tag("Sem ações pendentes", "n") })[st];

export function render(el) {
  const casos = pts.list();
  const hoje = hojeISO();
  const nPrazo = contarPrazos(casos, hoje);
  const ativos = casos.filter((c) => c.situacao !== "concluido").sort((a, b) => (b.atualizado || "").localeCompare(a.atualizado || ""));
  const nCras = D.unidades.filter((u) => u.tipo === "CRAS").length;
  const nCreas = D.unidades.filter((u) => u.tipo === "CREAS").length;

  const etapas = [
    ["Localizar", "Bairro ou endereço do usuário, com CRAS, CREAS e centros de referência.", "#/localizar"],
    ["Mapa", "Unidades de saúde e dispositivos comunitários num só lugar.", "#/mapa"],
    ["PTS", "Escolha os recursos do território e combine as ações.", "#/pts"],
    ["Apoio matricial", "Registre as articulações entre equipes e serviços.", "#/matricial"],
  ];

  el.innerHTML = h`
    ${cabecalho({
      titulo: "Painel geral",
      desc: "Visão consolidada do território e dos casos acompanhados pela equipe.",
      acoes: h`<a class="btn btn-p" href="#/localizar">${ico("search")}Localizar território</a>`,
    })}
    <dl class="kpis" aria-label="Indicadores">
      ${[["Bairros na base", D.bairros.length], ["CRAS", nCras], ["CREAS", nCreas], ["Centros de convivência", D.centros.length]].map(([r, v]) => h`<div class="kpi"><dt>${r}</dt><dd>${v}</dd></div>`)}
      <div class="kpi ${nPrazo ? "hot" : ""}"><dt>Ações vencidas ou com prazo em 7 dias</dt><dd>${nPrazo}</dd></div>
    </dl>
    ${painel({
      titulo: "Como funciona",
      icone: "arrow",
      corpo: h`<ol class="steps">${etapas.map(([t, d, href], i) => h`<li data-n="${i + 1}"><strong>${t}</strong><span>${d}</span><br><a href="${href}">Abrir</a></li>`)}</ol>`,
    })}
    ${painel({
      titulo: "Casos de PTS em andamento",
      icone: "hourglass",
      acoes: casos.length ? h`<a href="#/pts">Ver todos</a>` : "",
      semRecuo: true,
      corpo: ativos.length
        ? tabela({
            legenda: "Casos de PTS em andamento",
            colunas: [{ r: "Caso" }, { r: "Bairro" }, { r: "Recursos" }, { r: "Próxima ação" }, { r: "Situação" }, { cls: "ac" }],
            linhas: ativos.slice(0, 6).map((c) => {
              const pa = proximaAcao(c);
              return [
                h`<a class="strong" href="#/pts/${c.id}">${c.codigo || "Sem código"}</a>`,
                c.bairro || "—",
                tagsRecursos(c.devs.map((id) => devById(D, id)).filter(Boolean)),
                pa ? h`${pa.acao || "Sem descrição"}${pa.prazo ? ` · ${fmtData(pa.prazo)}` : ""}` : "—",
                tagPrazo(prazoDoCaso(c, hoje)),
                h`<a class="btn btn-t btn-sm" href="#/pts/${c.id}">Abrir${ico("arrow")}</a>`,
              ];
            }),
          })
        : vazio({
            icone: "clip",
            titulo: casos.length ? "Nenhum caso em andamento" : "Nenhum caso de PTS ainda",
            texto: "Crie um caso a partir de um território localizado, ou carregue um exemplo fictício para conhecer o sistema.",
            acao: h`<div class="acts" style="justify-content:center;margin-top:.6rem"><a class="btn btn-p" href="#/localizar">Localizar território</a><button class="btn btn-s" data-act="demo">Carregar exemplo fictício</button></div>`,
          }),
    })}`;

  acoes(el, {
    demo: () => {
      const r = semearDemo(D);
      if (!r) return toast(r === false ? "Os exemplos já foram carregados." : "Não foi possível salvar no navegador.", r === false ? "warn" : "bad");
      toast("Exemplo fictício carregado.");
      render(el);
    },
  });
}
