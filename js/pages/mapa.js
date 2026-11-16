import { h, acoes, $ } from "../dom.js";
import { D } from "../data.js";
import { pts, ubsStore, coords } from "../store.js";
import { devices, devById, TIPOS } from "../dominio.js";
import { coordDe } from "../geo.js";
import { cabecalho, painel, msg, toast } from "../ui.js";

const COR = { CRAS: "#0b4f8a", CREAS: "#b3261e", "Centro de Convivência": "#2e7d32", UBS: "#a86a00" };
const ROTULO = { CRAS: "CRAS", CREAS: "CREAS", "Centro de Convivência": "Centros de convivência", UBS: "UBS" };

let promessaLeaflet = null;
function carregarLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  promessaLeaflet ??= new Promise((ok, falha) => {
    const s = document.createElement("script");
    s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
    s.crossOrigin = "";
    s.onload = () => ok(window.L);
    s.onerror = () => {
      promessaLeaflet = null;
      falha(new Error("Leaflet"));
    };
    document.head.append(s);
  });
  return promessaLeaflet;
}

export async function render(el, ctx) {
  const dv = devices(D);
  const ubs = ubsStore.get();
  const contagem = { CRAS: 0, CREAS: 0, "Centro de Convivência": 0, UBS: ubs ? ubs.pts.length + ubs.polys.length : 0 };
  dv.forEach((d) => contagem[d.tipo]++);

  el.innerHTML = h`
    ${cabecalho({ trilha: [{ r: "Território", href: "#/localizar" }], titulo: "Mapa do território", desc: "Unidades de saúde e dispositivos comunitários de Teresina. Clique num ponto para ver o endereço e adicioná-lo ao PTS." })}
    ${painel({
      corpo: h`<div class="stack">
        <div class="chips" role="group" aria-label="Camadas do mapa">${Object.keys(COR).map((t) => h`<label class="chip"><input type="checkbox" class="ly" value="${t}" checked><span class="tag ${TIPOS[t].cls} t">${ROTULO[t]} (${contagem[t]})</span></label>`)}</div>
        <div class="mapbox" id="map" role="region" aria-label="Mapa interativo"></div>
        <p class="help" style="margin:0" data-st>Carregando o mapa…</p>
      </div>`,
    })}`;

  const st = $("[data-st]", el);
  let L;
  try {
    L = await carregarLeaflet();
  } catch {
    st.remove();
    $("#map", el).remove();
    $(".stack", el).insertAdjacentHTML("beforeend", msg({ tipo: "warn", titulo: "Não foi possível carregar o mapa", corpo: "Verifique a conexão com a internet (o mapa usa Leaflet e OpenStreetMap) e recarregue a página." }).toString());
    return;
  }
  if (!ctx.ativo()) return;

  acoes(el, {
    rec: (b) => {
      const d = devById(D, b.dataset.id);
      const r = pts.alternarRecurso(d.id, d.bairro || "");
      if (!r) return toast("Não foi possível salvar no navegador.", "bad");
      toast(r.noPTS ? `${d.nome} adicionado ao PTS “${r.caso.codigo}”.` : `${d.nome} removido do PTS “${r.caso.codigo}”.`);
    },
  });

  const map = L.map($("#map", el)).setView([-5.0892, -42.8019], 12);
  ctx.aoSair(() => map.remove());
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
  const grupos = {};
  Object.keys(COR).forEach((t) => (grupos[t] = L.layerGroup().addTo(map)));
  el.querySelectorAll(".ly").forEach((c) => c.addEventListener("change", () => (c.checked ? grupos[c.value].addTo(map) : map.removeLayer(grupos[c.value]))));

  // UBS importadas (KML): trunca a descrição ANTES de escapar
  if (ubs) {
    ubs.polys.forEach((p) => L.polygon(p.ring.map((a) => [a[1], a[0]]), { color: COR.UBS, weight: 2, fillOpacity: 0.1 }).bindPopup(h`<b>${p.nome}</b><br>${p.desc.slice(0, 300)}`.toString()).addTo(grupos.UBS));
    ubs.pts.forEach((u) => L.circleMarker([u.lat, u.lng], { radius: 7, color: "#fff", weight: 1, fillColor: COR.UBS, fillOpacity: 1 }).bindPopup(h`<b>${u.nome}</b> (UBS)<br>${u.desc.slice(0, 300)}`.toString()).addTo(grupos.UBS));
  }

  let posicionados = 0;
  function marcar(d, c) {
    const aprox = c.aprox ? h`<br><em>Posição aproximada (pelo bairro).</em>` : "";
    const pop = h`<b>${d.nome}</b><br>${d.tipo}<br>${d.end}${d.tel ? h`<br>${d.tel}` : ""}${aprox}<br><button class="btn btn-s btn-sm" data-act="rec" data-id="${d.id}">Adicionar/remover do PTS</button>`;
    L.circleMarker([c.lat, c.lng], { radius: 8, color: "#fff", weight: 1, fillColor: COR[d.tipo], fillOpacity: c.aprox ? 0.6 : 1 }).bindPopup(pop.toString()).addTo(grupos[d.tipo]);
    posicionados++;
  }

  const fila = [];
  for (const d of dv) {
    const c = coords.get(d.id);
    if (c && !c.fail) marcar(d, c);
    else if (!c) fila.push(d);
  }
  const semPosicao = () => dv.length - posicionados;
  st.textContent = fila.length ? `${posicionados} de ${dv.length} posicionados. Buscando os demais no OpenStreetMap…` : `${posicionados} de ${dv.length} dispositivos posicionados.${semPosicao() ? ` ${semPosicao()} sem posição (endereço não localizado).` : ""}`;

  for (const d of fila) {
    if (!ctx.ativo()) return;
    try {
      const c = await coordDe(d, coords);
      if (!ctx.ativo()) return;
      if (c) marcar(d, c);
      st.textContent = `${posicionados} de ${dv.length} posicionados. Buscando os demais no OpenStreetMap…`;
    } catch {
      if (ctx.ativo()) st.textContent = `${posicionados} de ${dv.length} posicionados. Sem resposta do serviço de endereços; os demais aparecem quando houver conexão.`;
      return;
    }
  }
  if (ctx.ativo()) st.textContent = `${posicionados} de ${dv.length} dispositivos posicionados.${semPosicao() ? ` ${semPosicao()} sem posição (endereço não localizado).` : ""}`;
}
