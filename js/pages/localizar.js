import { h, ico, acoes, $ } from "../dom.js";
import { D } from "../data.js";
import { pts, ubsStore } from "../store.js";
import { buscarBairros, territorio, devById } from "../dominio.js";
import { geocode, ubsPara, ubsPorBairro } from "../geo.js";
import { cabecalho, painel, tag, tagTipo, msg, vazio, confirmar, toast } from "../ui.js";
import { navegar } from "../router.js";

const CHAVE_AVISO = "terv2:end-ok";
const avisoVisto = () => {
  try {
    return sessionStorage.getItem(CHAVE_AVISO) === "1";
  } catch {
    return false;
  }
};
const marcarAvisoVisto = () => {
  try {
    sessionStorage.setItem(CHAVE_AVISO, "1");
  } catch {}
};

export function render(el, ctx) {
  const ubs = ubsStore.get();
  /** Estado da busca: null | {carregando} | {aviso} | {escolha:[bairros]} | {b, r, cand} */
  let atual = null;

  el.innerHTML = h`
    ${cabecalho({ trilha: [{ r: "Território", href: "#/localizar" }], titulo: "Localizar o território", desc: "Busque pelo bairro ou por um endereço para ver os serviços de referência do usuário." })}
    ${painel({
      corpo: h`
        <div class="grid g2">
          <form class="f" data-form="bairro" novalidate><label for="qb">Por bairro</label><div class="inline"><input id="qb" list="lb" placeholder="Digite o bairro" autocomplete="off"><button class="btn btn-p" type="submit">${ico("search")}Buscar</button></div><datalist id="lb">${D.bairros.map((b) => h`<option value="${b.nome}"></option>`)}</datalist></form>
          <form class="f" data-form="end" novalidate><label for="qe">Por endereço (rua, número, bairro)</label><div class="inline"><input id="qe" placeholder="Ex.: Rua Salitre, 7286, Cidade Jardim" autocomplete="off"><button class="btn btn-s" type="submit">${ico("search")}Buscar</button></div></form>
        </div>
        <p class="help" style="margin:.8rem 0 0">A busca por endereço envia o texto digitado ao OpenStreetMap (serviço externo) e precisa de internet. <strong>Use apenas endereços fictícios ou aproximados.</strong></p>`,
    })}
    <div class="split mt"><div data-res aria-live="polite"></div><aside class="aside" data-aside aria-label="PTS em construção"></aside></div>`;

  const res = $("[data-res]", el);

  /* ---------- resultado ---------- */
  const botaoRec = (d, casoAtual) => {
    const no = !!casoAtual?.devs.includes(d.id);
    return no
      ? h`<button class="btn btn-p btn-sm" data-act="rec" data-id="${d.id}" aria-pressed="true" title="Clique para remover do PTS">${ico("check")}No PTS</button>`
      : h`<button class="btn btn-s btn-sm" data-act="rec" data-id="${d.id}" aria-pressed="false">${ico("plus")}PTS</button>`;
  };
  const dev = (d, c) => h`<div class="dev"><div><b>${d.nome}</b> ${tagTipo(d.tipo)}<small>${d.end}${d.tel ? " · " + d.tel : ""}</small>${d.info ? h`<small>${d.info}</small>` : ""}</div>${botaoRec(d, c)}</div>`;
  const grupo = (titulo, arr, c) => (arr.length ? h`<h3 class="sec-t">${ico("pin")}${titulo} <small>${arr.length}</small></h3>${arr.map((d) => dev(d, c))}` : "");

  function ubsMsg(b, r) {
    let corpo;
    if (r) {
      const u = ubsPara(ubs, r.lat, r.lng);
      corpo = u
        ? u.oficial
          ? h`<b>${u.nome}</b> ${tag("área de abrangência")}`
          : h`<b>${u.nome}</b> ${tag(`mais próxima (${u.km.toFixed(1)} km), não é área oficial`)}`
        : h`Importe o KML das UBS em <a href="#/dados">Dados</a> para identificar a unidade de referência.`;
    } else {
      const l = ubsPorBairro(ubs, b);
      corpo = l.length
        ? h`${l.map((u, i) => h`${i ? ", " : ""}<b>${u.nome}</b>`)} ${tag("possível, confirmar")}`
        : h`Informe o endereço, ou importe o KML das UBS em <a href="#/dados">Dados</a>, para identificar a unidade de referência.`;
    }
    return msg({ titulo: "Unidade de saúde de referência", corpo });
  }

  function desenharRes() {
    const c = pts.atual();
    if (!atual) {
      res.innerHTML = painel({ corpo: vazio({ icone: "search", titulo: "Busque um bairro ou endereço", texto: "O resultado mostra o CRAS, o CREAS e os centros de convivência de referência, e permite reunir os recursos num PTS." }) });
    } else if (atual.carregando) {
      res.innerHTML = msg({ corpo: "Buscando o endereço no OpenStreetMap…" });
    } else if (atual.aviso) {
      res.innerHTML = msg({ tipo: "warn", corpo: atual.aviso });
    } else if (atual.escolha) {
      res.innerHTML = painel({
        titulo: "Mais de um bairro encontrado",
        icone: "pin",
        desc: "Escolha o bairro correto:",
        corpo: h`<div class="acts">${atual.escolha.map((b) => h`<button class="btn btn-s" data-act="pick" data-n="${b.nome}">${b.nome}</button>`)}</div>`,
      });
    } else {
      const { b, r, cand } = atual;
      const alerta = !b ? msg({ tipo: "warn", corpo: `Endereço localizado, mas não foi possível identificar o bairro automaticamente${cand?.length ? ` (o OpenStreetMap indicou: ${cand.join(", ")})` : ""}. Use a busca por bairro.` }) : "";
      if (!b) {
        res.innerHTML = h`${alerta}<div class="mt">${r ? painel({ corpo: ubsMsg(null, r) }) : ""}</div>`;
      } else {
        const t = territorio(D, b);
        res.innerHTML = h`<section class="pn">
          <header class="pn-h res-h"><div><h2>${b.nome}</h2><div class="tags" style="margin-top:.4rem">${tag(b.regional || "regional n/d", "n")}${b.cras.map((x) => h`<span class="tag cras t">CRAS ${x}</span>`)}</div></div>
            <div class="kp"><div><b>${b.populacao.toLocaleString("pt-BR")}</b><span>habitantes (Censo 2010)</span></div><div><b>${b.familias.toLocaleString("pt-BR")}</b><span>famílias no CadÚnico</span></div></div></header>
          <div class="pn-b">
            ${ubsMsg(b, r)}
            ${grupo("CRAS de referência", t.cras, c)}${grupo("CREAS da região", t.creas, c)}${grupo("Centros de convivência (SCFV) do CRAS", t.centros, c)}
            ${t.centros.length ? "" : h`<p class="muted" style="margin:1rem 0 0">Nenhum centro de convivência cadastrado para o CRAS deste bairro na lista atual.</p>`}
            ${b.localidades.length ? h`<h3 class="sec-t">${ico("pin")}Localidades e habitações populares <small>${b.localidades.length}</small></h3><div class="chips2">${b.localidades.map((l) => h`<span>${l.nome}</span>`)}</div>` : ""}
          </div></section>`;
      }
    }
    desenharAside();
  }

  /* ---------- painel lateral: PTS em construção ---------- */
  function desenharAside() {
    const casos = pts.list();
    const c = pts.atual();
    const sel = c ? c.devs.map((i) => devById(D, i)).filter(Boolean) : [];
    $("[data-aside]", el).innerHTML = painel({
      titulo: "PTS em construção",
      icone: "clip",
      corpo: h`
        ${casos.length ? h`<div class="f"><label for="sel-caso">Caso atual</label><select id="sel-caso">${casos.map((x) => h`<option value="${x.id}" ${c?.id === x.id ? "selected" : ""}>${x.codigo || "Sem código"}${x.bairro ? " · " + x.bairro : ""}</option>`)}<option value="__novo">+ Novo caso</option></select></div>` : ""}
        <div class="mini"><div><strong>${sel.length}</strong>recursos</div><div><strong>${c ? c.acoes.length : 0}</strong>ações</div></div>
        ${sel.length ? h`<ul class="sel">${sel.map((d) => h`<li>${d.nome} ${tagTipo(d.tipo)}</li>`)}</ul>` : h`<p class="muted" style="margin:0">${casos.length ? "Nenhum recurso neste caso ainda. " : "Ainda não há caso de PTS. "}Clique em “+ PTS” para reunir os recursos deste território${casos.length ? "" : " (um caso é criado automaticamente)"}.</p>`}
        ${c ? h`<a class="btn btn-p btn-w" href="#/pts/${c.id}">${ico("clip")}Abrir o PTS</a>` : h`<button class="btn btn-s btn-w" data-act="novo-caso">${ico("plus")}Novo caso</button>`}`,
    });
  }

  /* ---------- buscas ---------- */
  function buscarBairro(q) {
    const bs = buscarBairros(D, q);
    atual = bs.length === 0 ? { aviso: "Bairro não encontrado na base. Confira o nome ou escolha um da lista." } : bs.length === 1 ? { b: bs[0], r: null } : { escolha: bs };
    desenharRes();
  }

  async function buscarEndereco(q) {
    if (!avisoVisto()) {
      const ok = await confirmar({
        titulo: "Enviar o endereço ao OpenStreetMap?",
        texto: "Para localizar o endereço, o texto digitado é enviado ao serviço público do OpenStreetMap (Nominatim), fora deste sistema. Use apenas endereços fictícios ou aproximados, nunca o endereço real de um usuário.",
        botao: "Entendi, buscar",
      });
      if (!ok) return;
      marcarAvisoVisto();
    }
    atual = { carregando: true };
    desenharRes();
    try {
      const r = await geocode(q + ", Teresina, Piauí");
      if (!ctx.ativo()) return;
      if (!r) atual = { aviso: "Endereço não encontrado. Tente só a rua e o bairro." };
      else {
        const a = r.addr || {};
        const cand = [a.suburb, a.neighbourhood, a.city_district, a.quarter, a.residential].filter(Boolean);
        let b = null;
        for (const x of cand) {
          const bs = buscarBairros(D, x);
          if (bs.length === 1) {
            b = bs[0];
            break;
          }
        }
        atual = { b, r, cand };
      }
    } catch (e) {
      if (!ctx.ativo()) return;
      atual = { aviso: `Falha na busca (${e.name === "AbortError" ? "tempo esgotado" : e.message}). Verifique a internet e tente de novo.` };
    }
    desenharRes();
  }

  /* ---------- eventos ---------- */
  $('[data-form="bairro"]', el).addEventListener("submit", (e) => {
    e.preventDefault();
    const q = $("#qb", el).value.trim();
    if (q) buscarBairro(q);
  });
  $('[data-form="end"]', el).addEventListener("submit", (e) => {
    e.preventDefault();
    const q = $("#qe", el).value.trim();
    if (q) buscarEndereco(q);
  });

  el.addEventListener("change", (e) => {
    if (e.target.id !== "sel-caso") return;
    if (e.target.value === "__novo") {
      const c = pts.novo({ bairro: atual?.b?.nome || "" });
      if (!c) return toast("Não foi possível salvar no navegador.", "bad");
      pts.definirAtual(c.id);
      toast(`Caso “${c.codigo}” criado.`);
    } else pts.definirAtual(e.target.value);
    desenharRes();
  });

  acoes(el, {
    pick: (b) => buscarBairro(b.dataset.n),
    rec: (b) => {
      const r = pts.alternarRecurso(b.dataset.id, atual?.b?.nome || "");
      if (!r) return toast("Não foi possível salvar no navegador.", "bad");
      const d = devById(D, b.dataset.id);
      toast(r.noPTS ? `${d.nome} adicionado ao PTS “${r.caso.codigo}”.` : `${d.nome} removido do PTS “${r.caso.codigo}”.`);
      desenharRes();
      el.querySelector(`[data-act="rec"][data-id="${CSS.escape(b.dataset.id)}"]`)?.focus();
    },
    "novo-caso": () => {
      const c = pts.novo({ bairro: atual?.b?.nome || "" });
      if (!c) return toast("Não foi possível salvar no navegador.", "bad");
      pts.definirAtual(c.id);
      navegar("pts/" + c.id);
    },
  });

  desenharRes();
}
