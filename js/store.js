// Persistência no navegador (localStorage). Prefixo próprio ("terv2:") para não colidir
// com outros sites publicados na mesma origem do GitHub Pages.
const P = "terv2:";

export const store = {
  get(k, d) {
    try {
      const v = JSON.parse(localStorage.getItem(P + k));
      return v ?? d;
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(P + k, JSON.stringify(v));
      return true;
    } catch {
      return false;
    }
  },
  del(k) {
    try {
      localStorage.removeItem(P + k);
    } catch {}
  },
  /** Bytes (aprox.) ocupados por este sistema. */
  uso() {
    let n = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k.startsWith(P)) n += k.length + (localStorage.getItem(k) || "").length;
      }
    } catch {}
    return n * 2;
  },
  limpar() {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(P))
        .forEach((k) => localStorage.removeItem(k));
    } catch {}
  },
};

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const avisar = () => dispatchEvent(new Event("ter:mudou"));

/** Garante ids nas ações (backups da versão anterior não tinham). */
const normCaso = (c) => ({ situacao: "construcao", devs: [], acoes: [], obs: "", demanda: "", objetivos: "", bairro: "", codigo: "", ...c, acoes: (c.acoes || []).map((a) => ({ id: a.id || uid(), acao: "", resp: "", prazo: "", feita: false, ...a })) });

export const pts = {
  list() {
    return store.get("pts", []).map(normCaso);
  },
  get(id) {
    return this.list().find((c) => c.id === id) || null;
  },
  /** Cria um caso novo (código "Caso N" sem repetir). Não o torna atual. */
  novo(extra = {}) {
    const lista = this.list();
    let n = lista.length + 1;
    while (lista.some((c) => c.codigo === "Caso " + n)) n++;
    const agora = new Date().toISOString();
    const c = normCaso({ id: uid(), codigo: "Caso " + n, criado: agora, atualizado: agora, ...extra });
    return this.salvar(c) ? c : null;
  },
  salvar(c) {
    const lista = this.list();
    const i = lista.findIndex((x) => x.id === c.id);
    const novo = { ...c, atualizado: new Date().toISOString() };
    if (i >= 0) lista[i] = novo;
    else lista.unshift(novo);
    const ok = store.set("pts", lista);
    if (ok) avisar();
    return ok;
  },
  remover(id) {
    store.set("pts", this.list().filter((c) => c.id !== id));
    if (this.atualId() === id) store.del("cur");
    avisar();
  },
  /** Mescla casos importados (mesmo id substitui; os novos entram no começo). Não altera datas. */
  mesclar(novos) {
    const atuais = store.get("pts", []);
    const idx = new Map(atuais.map((c, i) => [c.id, i]));
    const fora = [];
    for (const n of novos) idx.has(n.id) ? (atuais[idx.get(n.id)] = n) : fora.push(n);
    const ok = store.set("pts", [...fora, ...atuais]);
    if (ok) avisar();
    return ok;
  },
  atualId() {
    const id = store.get("cur", null);
    return this.list().some((c) => c.id === id) ? id : null;
  },
  atual() {
    return this.get(this.atualId());
  },
  definirAtual(id) {
    store.set("cur", id);
    avisar();
  },
  /** Adiciona/remove um recurso do caso atual (criando o caso se não houver). Devolve {caso, noPTS} ou null. */
  alternarRecurso(devId, bairro = "") {
    let c = this.atual();
    if (!c) {
      c = this.novo({ bairro });
      if (!c) return null;
      this.definirAtual(c.id);
    }
    const tem = c.devs.includes(devId);
    c.devs = tem ? c.devs.filter((x) => x !== devId) : [...c.devs, devId];
    if (!c.bairro && bairro) c.bairro = bairro;
    return this.salvar(c) ? { caso: c, noPTS: !tem } : null;
  },
};

export const mat = {
  list() {
    return store.get("mat", []);
  },
  salvarLista(l) {
    const ok = store.set("mat", l);
    if (ok) avisar();
    return ok;
  },
  adicionar(m) {
    return this.salvarLista([{ id: uid(), ...m }, ...this.list()]);
  },
  mesclar(novos) {
    const atuais = this.list();
    const idx = new Map(atuais.map((m, i) => [m.id, i]));
    const fora = [];
    for (const n of novos) idx.has(n.id) ? (atuais[idx.get(n.id)] = n) : fora.push(n);
    return this.salvarLista([...fora, ...atuais]);
  },
  alterar(id, campos) {
    return this.salvarLista(this.list().map((m) => (m.id === id ? { ...m, ...campos } : m)));
  },
  remover(id) {
    this.salvarLista(this.list().filter((m) => m.id !== id));
  },
};

export const ubsStore = {
  get: () => store.get("ubs", null),
  set: (u) => store.set("ubs", u),
  del: () => {
    store.del("ubs");
    avisar();
  },
};

/** Cache de coordenadas: data/coords.json (publicado) + o que este navegador já consultou. */
const memoCoords = new Map();
export const coords = {
  async carregar() {
    try {
      const r = await fetch("data/coords.json");
      if (r.ok) Object.entries(await r.json()).forEach(([k, v]) => memoCoords.set(k, v));
    } catch {}
    Object.entries(store.get("coords", {})).forEach(([k, v]) => memoCoords.set(k, v));
  },
  get: (id) => memoCoords.get(id),
  set(id, v) {
    memoCoords.set(id, v);
    const local = store.get("coords", {});
    local[id] = v;
    store.set("coords", local);
  },
};
