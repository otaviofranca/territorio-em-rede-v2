// Ponto de entrada.
import { carregarDados } from "./data.js";
import { coords, pts } from "./store.js";
import { iniciar } from "./router.js";
import { $, h } from "./dom.js";
import { vazio } from "./ui.js";

const app = $("#app");

function atualizarBadge() {
  const n = pts.list().length;
  const b = $("#badge-pts");
  b.textContent = n;
  b.hidden = !n;
}
addEventListener("ter:mudou", atualizarBadge);

const fecharMenu = () => {
  app.classList.remove("open");
  $("#burger").setAttribute("aria-expanded", "false");
};
$("#burger").addEventListener("click", () => {
  const aberto = app.classList.toggle("open");
  $("#burger").setAttribute("aria-expanded", String(aberto));
});
$("#veil").addEventListener("click", fecharMenu);
addEventListener("keydown", (e) => e.key === "Escape" && fecharMenu());
addEventListener("hashchange", fecharMenu);

try {
  await carregarDados();
  await coords.carregar();
} catch (e) {
  console.error(e);
  $("#main").innerHTML = h`<div class="pn">${vazio({
    icone: "alert",
    titulo: "Não foi possível carregar os dados",
    texto: "Se você abriu o arquivo direto do computador, publique no GitHub Pages ou rode um servidor local (python -m http.server).",
    acao: h`<button class="btn btn-s" id="recarregar">Tentar novamente</button>`,
  })}</div>`;
  $("#recarregar").addEventListener("click", () => location.reload());
  throw e;
}

atualizarBadge();
iniciar();
