// Base territorial (data/dados.json), carregada uma vez na inicialização.
export let D = null;

export async function carregarDados() {
  const r = await fetch("data/dados.json");
  if (!r.ok) throw new Error("data/dados.json respondeu " + r.status);
  D = await r.json();
  return D;
}
