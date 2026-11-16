// Dados de demonstração (totalmente fictícios), marcados com demo:true para poderem ser removidos.
import { pts, mat } from "./store.js";
import { territorio } from "./dominio.js";
import { hojeISO, somaDias } from "./format.js";

export const temDemo = () => pts.list().some((c) => c.demo) || mat.list().some((m) => m.demo);

/** Cria dois casos e dois registros matriciais fictícios. Devolve false se já existirem. */
export function semearDemo(D) {
  if (temDemo()) return false;
  const hoje = hojeISO();
  const ok = D.bairros.filter((b) => {
    const t = territorio(D, b);
    return t.cras.length && t.centros.length;
  });
  const b1 = D.bairros.find((b) => b.nome === "Acarape") || ok[0];
  const b2 = D.bairros.find((b) => b.nome === "Cidade Jardim" && territorio(D, b).cras.length) || ok.find((b) => b !== b1) || b1;
  const t1 = territorio(D, b1),
    t2 = territorio(D, b2);
  const a = (acao, resp, prazo, feita = false) => ({ id: Math.random().toString(36).slice(2, 9), acao, resp, prazo, feita });

  const c1 = pts.novo({
    codigo: "Exemplo A",
    bairro: b1.nome,
    situacao: "acompanhamento",
    demo: true,
    demanda: "Caso fictício: vínculo familiar fragilizado e ausência de renda fixa.",
    objetivos: "Ampliar a rede de apoio e garantir acesso a benefícios.",
    devs: [t1.cras[0]?.id, t1.centros[0]?.id].filter(Boolean),
    acoes: [a("Visita domiciliar", "ESF / ACS", somaDias(hoje, 3)), a("Inclusão no CadÚnico", t1.cras[0]?.nome || "CRAS", somaDias(hoje, 14)), a("Primeiro contato com o centro de convivência", "Equipe de referência", somaDias(hoje, -5), true)],
  });
  const c2 = pts.novo({
    codigo: "Exemplo B",
    bairro: b2.nome,
    situacao: "construcao",
    demo: true,
    demanda: "Caso fictício: pessoa idosa em isolamento social.",
    objetivos: "Inserir em grupo de convivência no território.",
    devs: [t2.cras[0]?.id, t2.creas[0]?.id, t2.centros[0]?.id].filter(Boolean),
    acoes: [a("Reunião com o CRAS", t2.cras[0]?.nome || "CRAS", somaDias(hoje, 5)), a("Contato com a família", "Equipe de referência", somaDias(hoje, -2))],
  });
  if (!c1 || !c2) return null;
  mat.salvarLista([
    { id: "demo-m1", demo: true, data: somaDias(hoje, -4), casoId: c1.id, eq: ["Saúde da Família (ESF)", "CAPS"], enc: "Discutir plano de cuidado compartilhado.", st: "Em andamento" },
    { id: "demo-m2", demo: true, data: somaDias(hoje, -11), casoId: c2.id, eq: ["Assistência Social (CRAS/CREAS)", "eMulti"], enc: "Visita conjunta ao domicílio.", st: "Concluído" },
    ...mat.list(),
  ]);
  pts.definirAtual(c1.id);
  return true;
}

export function removerDemo() {
  const ids = pts.list().filter((c) => c.demo).map((c) => c.id);
  ids.forEach((id) => pts.remover(id));
  mat.salvarLista(mat.list().filter((m) => !m.demo));
  return ids.length;
}
