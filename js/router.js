// Roteador por hash (#/pts/ID). Só os caminhos da lista são aceitos; o resto cai em "não encontrada".
// Cada navegação renderiza num contêiner novo, com um contexto (ctx): respostas atrasadas de uma
// página anterior (consultas de endereço, mapa) não escrevem na página atual.
import { h, $, $$ } from "./dom.js";
import { vazio } from "./ui.js";

const PAGINAS = {
  inicio: () => import("./pages/inicio.js"),
  localizar: () => import("./pages/localizar.js"),
  mapa: () => import("./pages/mapa.js"),
  ptsLista: () => import("./pages/pts-lista.js"),
  ptsCaso: () => import("./pages/pts-caso.js"),
  ptsDoc: () => import("./pages/pts-doc.js"),
  matricial: () => import("./pages/matricial.js"),
  dados: () => import("./pages/dados.js"),
};
const SECAO = { inicio: "inicio", localizar: "localizar", mapa: "mapa", ptsLista: "pts", ptsCaso: "pts", ptsDoc: "pts", matricial: "matricial", dados: "dados" };

const ID = "([A-Za-z0-9_-]{1,64})";
const ROTAS = [
  [/^$|^inicio$/, "inicio"],
  [/^localizar$/, "localizar"],
  [/^mapa$/, "mapa"],
  [/^pts$/, "ptsLista"],
  [new RegExp(`^pts/${ID}$`), "ptsCaso"],
  [new RegExp(`^pts/${ID}/documento$`), "ptsDoc"],
  [/^matricial$/, "matricial"],
  [/^dados$/, "dados"],
];

export const navegar = (caminho) => {
  location.hash = "#/" + caminho;
};
const caminhoAtual = () => location.hash.replace(/^#\/?/, "").replace(/\/+$/, "");

let atual = null;

function criarCtx() {
  let saiu = false;
  const limpar = [];
  return {
    ativo: () => !saiu,
    aoSair(fn) {
      if (saiu) fn();
      else limpar.push(fn);
    },
    sair() {
      saiu = true;
      limpar.splice(0).forEach((f) => {
        try {
          f();
        } catch (e) {
          console.error(e);
        }
      });
    },
  };
}

async function renderizar() {
  if (location.hash === "#main") return; // link "Ir para o conteúdo"
  atual?.sair();
  const ctx = (atual = criarCtx());
  const main = $("#main");
  const alvo = document.createElement("div");
  main.replaceChildren(alvo);
  window.scrollTo(0, 0);

  const caminho = caminhoAtual();
  const rota = ROTAS.find(([p]) => p.test(caminho));
  const nome = rota ? rota[1] : null;

  $$("#menu a").forEach((a) => (a.dataset.v === SECAO[nome] ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  $("#app").classList.remove("open");

  if (!rota) {
    alvo.innerHTML = h`<div class="pn">${vazio({ icone: "search", titulo: "Página não encontrada", texto: "O endereço acessado não existe no sistema.", acao: h`<a class="btn btn-p" href="#/inicio">Ir para o painel</a>` })}</div>`;
    document.title = "Página não encontrada · Território em Rede";
    return;
  }

  try {
    const pagina = await PAGINAS[nome]();
    if (!ctx.ativo()) return;
    await pagina.render(alvo, ctx, ...caminho.match(rota[0]).slice(1));
  } catch (erro) {
    console.error(erro);
    if (!ctx.ativo()) return;
    alvo.innerHTML = h`<div class="pn">${vazio({ icone: "alert", titulo: "Não foi possível carregar esta página", texto: "Verifique a conexão e tente de novo.", acao: h`<button class="btn btn-s" data-recarregar>Tentar novamente</button>` })}</div>`;
    $("[data-recarregar]", alvo)?.addEventListener("click", renderizar);
  }
  if (ctx.ativo()) {
    const t = $("h1", alvo)?.textContent.trim();
    document.title = t ? `${t} · Território em Rede` : "Território em Rede";
    main.focus({ preventScroll: true });
  }
}

export const recarregar = renderizar;
addEventListener("hashchange", renderizar);
export const iniciar = renderizar;
