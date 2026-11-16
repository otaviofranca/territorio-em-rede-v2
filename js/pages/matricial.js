import { h, ico, acoes, $ } from "../dom.js";
import { pts, mat } from "../store.js";
import { hojeISO, fmtData, plural } from "../format.js";
import { EQUIPES, SITUACOES_MAT } from "../dominio.js";
import { cabecalho, painel, tag, tabela, vazio, confirmar, toast } from "../ui.js";

const TOM = { "Em andamento": "warn", "Aguardando retorno": "", Concluído: "ok" };

export function render(el) {
  const casos = pts.list();
  let filtro = "";

  el.innerHTML = h`
    ${cabecalho({ titulo: "Apoio matricial", desc: "Registre as articulações entre equipes e serviços e acompanhe o que foi combinado." })}
    ${painel({
      titulo: "Novo registro",
      icone: "plus",
      corpo: h`<form data-form novalidate>
        <div class="grid">
          <div class="f"><label for="m-data">Data <span class="req">*</span></label><input id="m-data" name="data" type="date" value="${hojeISO()}" required></div>
          <div class="f"><label for="m-caso">Caso do PTS</label><select id="m-caso" name="caso"><option value="">— sem vínculo —</option>${casos.map((c) => h`<option value="${c.id}">${c.codigo || "Sem código"}${c.bairro ? " · " + c.bairro : ""}</option>`)}</select>${casos.length ? "" : h`<p class="help">Crie um caso em <a href="#/pts">PTS</a> para vincular o registro.</p>`}</div>
          <div class="f"><label for="m-st">Situação</label><select id="m-st" name="st">${SITUACOES_MAT.map((s) => h`<option>${s}</option>`)}</select></div>
        </div>
        <p class="lbl" style="margin:1.1rem 0 .3rem" id="lb-eq">Equipes e serviços envolvidos</p>
        <div class="opts opts-s" role="group" aria-labelledby="lb-eq">${EQUIPES.map((e) => h`<label class="opt"><input type="checkbox" name="eq" value="${e}"><span class="nm">${e}</span></label>`)}</div>
        <div class="f mt"><label for="m-enc">Combinado / encaminhamento</label><textarea id="m-enc" name="enc" maxlength="5000"></textarea></div>
        <p class="err" data-err role="alert"></p>
        <div class="acts mt"><button class="btn btn-p" type="submit">${ico("save")}Registrar</button></div>
      </form>`,
    })}
    ${painel({
      titulo: "Registros",
      icone: "folder",
      acoes: h`<span class="cnt" data-cnt></span>`,
      semRecuo: true,
      corpo: h`<div class="pn-b" style="border-bottom:1px solid var(--line-2)"><div class="grid g3"><div class="f"><label for="m-f">Filtrar por situação</label><select id="m-f"><option value="">Todas</option>${SITUACOES_MAT.map((s) => h`<option>${s}</option>`)}</select></div></div></div><div data-lista></div>`,
    })}`;

  const form = $("[data-form]", el);
  const lista = $("[data-lista]", el);

  function desenhar() {
    const regs = mat.list().filter((m) => !filtro || m.st === filtro);
    $("[data-cnt]", el).textContent = plural(regs.length, "registro", "registros");
    const caso = (m) => {
      if (m.casoId) {
        const c = casos.find((x) => x.id === m.casoId);
        return c ? h`<a class="strong" href="#/pts/${c.id}">${c.codigo || "Sem código"}</a>` : h`<span class="muted">(caso excluído)</span>`;
      }
      return m.caso || "—";
    };
    lista.innerHTML = regs.length
      ? tabela({
          legenda: "Registros de apoio matricial",
          colunas: [{ r: "Data" }, { r: "Caso" }, { r: "Envolvidos" }, { r: "Combinado" }, { r: "Situação" }, { cls: "ac" }],
          linhas: regs.map((m) => [
            fmtData(m.data),
            caso(m),
            (m.eq || []).join(", ") || "—",
            m.enc || "—",
            h`<select class="sel-inline" data-st="${m.id}" aria-label="Situação do registro">${SITUACOES_MAT.map((s) => h`<option ${m.st === s ? "selected" : ""}>${s}</option>`)}</select>`,
            h`<button class="btn btn-t btn-sm" data-act="rm" data-id="${m.id}" aria-label="Excluir registro">${ico("trash")}</button>`,
          ]),
        })
      : vazio({
          icone: "users",
          titulo: filtro ? "Nenhum registro com essa situação" : "Nenhum registro de apoio matricial",
          texto: filtro ? "Mude o filtro para ver os demais." : "Registre a primeira articulação entre equipes para acompanhá-la aqui.",
        });
  }
  desenhar();

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const eq = [...form.querySelectorAll("[name=eq]:checked")].map((i) => i.value);
    const enc = form.enc.value.trim();
    const err = $("[data-err]", el);
    if (!form.data.value) {
      err.textContent = "Informe a data.";
      return form.data.focus();
    }
    if (!eq.length && !enc) {
      err.textContent = "Marque ao menos uma equipe/serviço ou descreva o combinado.";
      return;
    }
    err.textContent = "";
    if (!mat.adicionar({ data: form.data.value, casoId: form.caso.value || null, eq, enc, st: form.st.value })) return toast("Não foi possível salvar: o armazenamento do navegador está cheio.", "bad");
    toast("Registro adicionado.");
    render(el);
  });

  $("#m-f", el).addEventListener("change", (e) => {
    filtro = e.target.value;
    desenhar();
  });
  lista.addEventListener("change", (e) => {
    const id = e.target.dataset.st;
    if (id && !mat.alterar(id, { st: e.target.value })) toast("Não foi possível salvar.", "bad");
  });

  acoes(el, {
    rm: async (b) => {
      const ok = await confirmar({ titulo: "Excluir este registro?", texto: "O registro de apoio matricial será apagado definitivamente.", botao: "Excluir", perigo: true });
      if (!ok) return;
      mat.remover(b.dataset.id);
      toast("Registro excluído.");
      desenhar();
    },
  });
}
