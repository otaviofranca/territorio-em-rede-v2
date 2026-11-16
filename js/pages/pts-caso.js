import { h, ico, acoes, $ } from "../dom.js";
import { D } from "../data.js";
import { pts, uid } from "../store.js";
import { hojeISO, fmtHora, norm } from "../format.js";
import { bairroExato, territorio, devices, devById, acaoStatus, SITUACOES_PTS } from "../dominio.js";
import { cabecalho, painel, tag, tagTipo, msg, vazio, confirmar, toast } from "../ui.js";
import { navegar } from "../router.js";

const TOM = { construcao: "warn", acompanhamento: "", concluido: "ok" };
const statusAcao = (st) => ({ feita: tag("Feita", "ok"), sem: tag("Sem prazo", "n"), atrasada: tag("Atrasada", "bad"), semana: tag("Até 7 dias", "warn"), ok: tag("No prazo", "ok") })[st];

export function render(el, ctx, id) {
  const c = pts.get(id);
  if (!c) {
    el.innerHTML = h`<div class="pn">${vazio({ icone: "search", titulo: "Caso não encontrado", texto: "Ele pode ter sido excluído.", acao: h`<a class="btn btn-p" href="#/pts">Voltar aos casos</a>` })}</div>`;
    return;
  }
  pts.definirAtual(id);

  /* ---------- salvamento automático ---------- */
  let sujo = false,
    removido = false,
    salvoEm = null,
    timer = null;
  const rotuloSalvo = () => (sujo ? "Salvando…" : salvoEm ? `Salvo às ${fmtHora(salvoEm)}` : "Salvo");
  const mostrarSalvo = () => {
    const s = $("[data-salvo]", el);
    if (s) s.textContent = rotuloSalvo();
  };
  function flush() {
    clearTimeout(timer);
    if (!sujo || removido) return true;
    const ok = pts.salvar(c);
    if (ok) {
      sujo = false;
      salvoEm = new Date();
    } else toast("Não foi possível salvar: o armazenamento do navegador está cheio. Faça um backup e libere espaço em Dados.", "bad");
    mostrarSalvo();
    return ok;
  }
  function sujar() {
    sujo = true;
    clearTimeout(timer);
    timer = setTimeout(flush, 400);
    mostrarSalvo();
  }
  ctx.aoSair(flush);
  addEventListener("pagehide", flush);
  ctx.aoSair(() => removeEventListener("pagehide", flush));

  /* ---------- partes da tela ---------- */
  const cab = () =>
    cabecalho({
      trilha: [{ r: "PTS", href: "#/pts" }],
      titulo: `${c.codigo || "Sem código"}${c.bairro ? " · " + c.bairro : ""}`,
      desc: "Projeto Terapêutico Singular. Escolha os recursos do território e combine as ações com a equipe.",
      extra: h`<div class="tags" style="margin-top:.6rem">${tag(SITUACOES_PTS[c.situacao], TOM[c.situacao])}<span class="tag n" data-salvo>${rotuloSalvo()}</span></div>`,
      acoes: h`<a class="btn btn-s" href="#/pts/${c.id}/documento">${ico("print")}Ver documento</a><button class="btn btn-d" data-act="excluir">${ico("trash")}Excluir</button>`,
    });

  function recursos() {
    const b = bairroExato(D, c.bairro);
    const t = b ? territorio(D, b) : { cras: [], creas: [], centros: [] };
    const terr = [...t.cras, ...t.creas, ...t.centros];
    const noTerr = new Set(terr.map((d) => d.id));
    const outros = devices(D).filter((d) => !noTerr.has(d.id));
    const chk = (d) => h`<label class="opt"><input type="checkbox" data-dev="${d.id}" ${c.devs.includes(d.id) ? "checked" : ""}><span class="nm">${d.nome}</span>${tagTipo(d.tipo)}</label>`;
    const abrir = !terr.length || outros.some((d) => c.devs.includes(d.id));
    return painel({
      titulo: "Recursos do território",
      icone: "pin",
      desc: b ? `Dispositivos do território de ${b.nome}. Marque os que farão parte do PTS.` : "Os recursos aparecem quando o bairro de residência é informado.",
      corpo: h`
        ${terr.length ? h`<div class="opts">${terr.map(chk)}</div>` : msg({ titulo: "Informe um bairro da lista", corpo: "Escolha o bairro de residência em “Dados do caso” para ver os CRAS, CREAS e centros de convivência do território." })}
        <details class="mt" ${abrir ? "open" : ""}><summary>Outros dispositivos da cidade (${outros.length})</summary><div class="opts mt">${outros.map(chk)}</div></details>`,
    });
  }

  function tabelaAcoes() {
    const hoje = hojeISO();
    return painel({
      titulo: "Ações combinadas",
      icone: "check",
      acoes: h`<button class="btn btn-s btn-sm" data-act="add-acao">${ico("plus")}Ação</button>`,
      semRecuo: true,
      corpo: c.acoes.length
        ? h`<div class="tw"><table class="tb rt">
            <thead><tr><th>Feita</th><th>Ação</th><th>Responsável</th><th>Prazo</th><th>Situação</th><th><span class="sr">Remover</span></th></tr></thead>
            <tbody>${c.acoes.map(
              (a, i) => h`<tr>
                <td data-l="Feita"><input type="checkbox" class="chk-a" data-a="${i}:feita" ${a.feita ? "checked" : ""} aria-label="Ação feita"></td>
                <td data-l="Ação"><input data-a="${i}:acao" value="${a.acao}" maxlength="500" aria-label="Ação"></td>
                <td data-l="Responsável"><input data-a="${i}:resp" value="${a.resp}" maxlength="200" aria-label="Responsável"></td>
                <td data-l="Prazo"><input type="date" data-a="${i}:prazo" value="${a.prazo}" aria-label="Prazo"></td>
                <td data-l="Situação" data-st>${statusAcao(acaoStatus(a, hoje))}</td>
                <td class="ac"><button class="btn btn-t btn-sm" data-act="rm-acao" data-i="${i}" aria-label="Remover ação">${ico("trash")}</button></td>
              </tr>`,
            )}</tbody></table></div>`
        : h`<div class="pn-b"><p class="muted" style="margin:0">Nenhuma ação combinada ainda. Use “+ Ação” para registrar a primeira.</p></div>`,
    });
  }

  function aside() {
    const sel = c.devs.map((i) => devById(D, i)).filter(Boolean);
    const hoje = hojeISO();
    const nPrazo = c.acoes.filter((a) => ["atrasada", "semana"].includes(acaoStatus(a, hoje))).length;
    return painel({
      titulo: "Resumo",
      corpo: h`
        <div class="mini"><div><strong>${sel.length}</strong>recursos</div><div><strong>${c.acoes.length}</strong>ações</div><div><strong>${nPrazo}</strong>vencidas ou ≤ 7 dias</div></div>
        ${sel.length ? h`<ul class="sel">${sel.map((d) => h`<li>${d.nome} ${tagTipo(d.tipo)}</li>`)}</ul>` : msg({ corpo: "Nenhum recurso do território selecionado ainda." })}
        <button class="btn btn-p btn-w" data-act="salvar">${ico("save")}Salvar PTS</button>
        <p class="help" style="margin:0">Apoio à reflexão da equipe. Não substitui o julgamento clínico nem prescreve condutas.</p>`,
    });
  }

  /* ---------- montagem ---------- */
  el.innerHTML = h`
    <div data-cab>${cab()}</div>
    <div class="split">
      <div class="stack">
        ${painel({
          titulo: "Dados do caso",
          icone: "clip",
          corpo: h`
            <div class="grid">
              <div class="f"><label for="f-codigo">Código ou apelido fictício <span class="req">*</span></label><input id="f-codigo" data-f="codigo" value="${c.codigo}" maxlength="100" autocomplete="off"><p class="help">Não use nome real (LGPD).</p></div>
              <div class="f"><label for="f-bairro">Bairro de residência</label><input id="f-bairro" data-f="bairro" list="lista-bairros" value="${c.bairro}" maxlength="200" autocomplete="off"><datalist id="lista-bairros">${D.bairros.map((b) => h`<option value="${b.nome}"></option>`)}</datalist><p class="help" data-bhelp></p></div>
              <div class="f"><label for="f-situacao">Situação do PTS</label><select id="f-situacao" data-f="situacao">${Object.entries(SITUACOES_PTS).map(([v, r]) => h`<option value="${v}" ${c.situacao === v ? "selected" : ""}>${r}</option>`)}</select></div>
            </div>
            <div class="f"><label for="f-demanda">Situação / demanda</label><textarea id="f-demanda" data-f="demanda" maxlength="5000">${c.demanda}</textarea></div>
            <div class="f"><label for="f-objetivos">Objetivos do cuidado</label><textarea id="f-objetivos" data-f="objetivos" maxlength="5000">${c.objetivos}</textarea></div>`,
        })}
        <div data-recursos>${recursos()}</div>
        <div data-acoes>${tabelaAcoes()}</div>
        ${painel({ titulo: "Observações", corpo: h`<div class="f"><label class="sr" for="f-obs">Observações</label><textarea id="f-obs" data-f="obs" maxlength="5000" placeholder="Anotações da equipe…">${c.obs}</textarea></div>` })}
      </div>
      <aside class="aside" aria-label="Resumo do PTS" data-aside>${aside()}</aside>
    </div>`;

  const ajudaBairro = () => {
    const el2 = $("[data-bhelp]", el);
    el2.textContent = !c.bairro ? "" : bairroExato(D, c.bairro) ? "Bairro encontrado na base." : "Bairro não encontrado na base: escolha um da lista.";
  };
  const redesenhar = () => {
    $("[data-recursos]", el).innerHTML = recursos();
    $("[data-aside]", el).innerHTML = aside();
  };
  ajudaBairro();

  /* ---------- eventos ---------- */
  el.addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.f) {
      c[t.dataset.f] = t.value;
      sujar();
      if (t.dataset.f === "bairro") {
        ajudaBairro();
        redesenhar();
      }
    } else if (t.dataset.a && t.type !== "checkbox") {
      const [i, campo] = t.dataset.a.split(":");
      c.acoes[+i][campo] = t.value;
      sujar();
    }
  });

  el.addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.f === "codigo" || t.dataset.f === "bairro" || t.dataset.f === "situacao") {
      $("[data-cab]", el).innerHTML = cab();
      mostrarSalvo();
    }
    if (t.dataset.dev) {
      c.devs = t.checked ? [...new Set([...c.devs, t.dataset.dev])] : c.devs.filter((x) => x !== t.dataset.dev);
      sujar();
      $("[data-aside]", el).innerHTML = aside();
    }
    if (t.dataset.a && (t.type === "checkbox" || t.type === "date")) {
      const [i, campo] = t.dataset.a.split(":");
      c.acoes[+i][campo] = t.type === "checkbox" ? t.checked : t.value;
      sujar();
      $("[data-st]", t.closest("tr")).innerHTML = statusAcao(acaoStatus(c.acoes[+i], hojeISO()));
      $("[data-aside]", el).innerHTML = aside();
    }
  });

  acoes(el, {
    "add-acao": () => {
      c.acoes.push({ id: uid(), acao: "", resp: "", prazo: "", feita: false });
      sujar();
      $("[data-acoes]", el).innerHTML = tabelaAcoes();
      $("[data-aside]", el).innerHTML = aside();
      el.querySelector(`[data-a="${c.acoes.length - 1}:acao"]`)?.focus();
    },
    "rm-acao": (b) => {
      c.acoes.splice(+b.dataset.i, 1);
      sujar();
      $("[data-acoes]", el).innerHTML = tabelaAcoes();
      $("[data-aside]", el).innerHTML = aside();
    },
    salvar: () => {
      sujo = true;
      if (flush()) toast("PTS salvo.");
    },
    excluir: async () => {
      const ok = await confirmar({ titulo: "Excluir este caso?", texto: `O caso “${c.codigo || "sem código"}” e todas as suas ações serão apagados definitivamente. Esta ação não pode ser desfeita.`, botao: "Excluir caso", perigo: true });
      if (!ok) return;
      removido = true;
      pts.remover(c.id);
      toast("Caso excluído.");
      navegar("pts");
    },
  });
}
