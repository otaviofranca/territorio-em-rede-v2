// Utilitários de DOM. O template `h` escapa automaticamente todo valor interpolado
// (exceto outro `h`/`raw`, ou listas deles): é a defesa principal contra XSS.
const ENT = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" };

export const esc = (v) => String(v ?? "").replace(/[&<>"'`]/g, (c) => ENT[c]);

export class Html {
  constructor(t) {
    this.t = t;
  }
  toString() {
    return this.t;
  }
}

const ser = (v) => (v == null || v === false ? "" : v instanceof Html ? v.t : Array.isArray(v) ? v.map(ser).join("") : esc(v));

export const h = (p, ...v) => new Html(p.reduce((a, s, i) => a + ser(v[i - 1]) + s));
export const raw = (t) => new Html(String(t));
export const ico = (n) => new Html(`<svg class="ico" aria-hidden="true"><use href="#i-${n}"/></svg>`);

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// Liga cliques em [data-act] dentro de `raiz` aos manipuladores do mapa (sem onclick inline).
// Chamar de novo para a mesma raiz (tela que se redesenha) SUBSTITUI os manipuladores, em vez
// de acumular ouvintes (o que faria cada clique disparar a ação várias vezes).
const ligados = new WeakMap();
export function acoes(raiz, mapa) {
  const jaLigado = ligados.has(raiz);
  ligados.set(raiz, mapa);
  if (jaLigado) return;
  raiz.addEventListener("click", (e) => {
    const a = e.target.closest("[data-act]");
    if (!a || !raiz.contains(a)) return;
    const f = ligados.get(raiz)[a.dataset.act];
    if (f) {
      e.preventDefault();
      f(a, e);
    }
  });
}
