import { h, ico, acoes, $ } from "../dom.js";
import { D } from "../data.js";
import { pts, mat, store, ubsStore } from "../store.js";
import { hojeISO, plural } from "../format.js";
import { cabecalho, painel, msg, confirmar, toast, tag } from "../ui.js";
import { parseKML } from "../geo.js";
import { validarBackup, montarBackup } from "../backup.js";
import { semearDemo, removerDemo, temDemo } from "../demo.js";

const MAX_ARQ = 15 * 1024 * 1024;
const QUOTA = 5 * 1024 * 1024;

export function render(el) {
  const ubs = ubsStore.get();
  const uso = store.uso();
  const pct = Math.min(100, Math.round((uso / QUOTA) * 100));
  const demo = temDemo();

  el.innerHTML = h`
    ${cabecalho({ titulo: "Dados e backup", desc: "Importe as unidades de saúde, guarde uma cópia dos registros deste navegador e gerencie os dados de exemplo." })}

    ${painel({
      titulo: "Unidades de saúde (UBS)",
      icone: "pin",
      corpo: h`<div class="stack">
        ${ubs ? msg({ tipo: "ok", titulo: "UBS carregadas", corpo: `${plural(ubs.pts.length, "ponto", "pontos")} e ${plural(ubs.polys.length, "área", "áreas")} de abrangência.` }) : msg({ tipo: "warn", titulo: "UBS ainda não carregadas", corpo: "Importe o KML do mapa da rede de saúde para identificar a unidade de referência de cada território." })}
        <p class="help">No Google My Maps do mapa da rede de saúde: menu ⋮ → “Baixar KML”. Se o mapa tiver áreas (polígonos), o sistema identifica a UBS de referência pelo endereço; se tiver só pontos, mostra a mais próxima, avisando que não é área oficial.</p>
        <div class="f"><label for="kml">Arquivo KML</label><input id="kml" type="file" accept=".kml,.xml,.txt" class="file"></div>
        ${ubs ? h`<div class="acts"><button class="btn btn-d" data-act="rm-ubs">${ico("trash")}Remover UBS</button></div>` : ""}
      </div>`,
    })}

    ${painel({
      titulo: "Backup dos registros",
      icone: "db",
      corpo: h`<div class="stack">
        ${msg({ tipo: "bad", titulo: "Os registros ficam só neste navegador", corpo: "Não há login nem banco compartilhado. Faça backup antes de limpar o histórico do navegador e use apenas dados fictícios (LGPD)." })}
        <div class="acts"><button class="btn btn-p" data-act="exportar">${ico("download")}Baixar backup</button></div>
        <div class="f"><label for="bkp">Restaurar a partir de um backup (.json)</label><input id="bkp" type="file" accept="application/json,.json" class="file"><p class="help">Registros com o mesmo identificador substituem os atuais; os demais são mantidos. Registros inválidos são ignorados.</p></div>
        <div class="acts"><button class="btn btn-s" data-act="importar">${ico("upload")}Restaurar backup</button></div>
      </div>`,
    })}

    ${painel({
      titulo: "Dados de exemplo e limpeza",
      icone: "info",
      corpo: h`<div class="stack">
        <p style="margin:0">Carregue dois casos fictícios com ações e registros matriciais para conhecer o sistema${demo ? " (já carregados)" : ""}.</p>
        <div class="acts"><button class="btn btn-s" data-act="demo" ${demo ? "disabled" : ""}>${ico("plus")}Carregar exemplo fictício</button><button class="btn btn-s" data-act="rm-demo" ${demo ? "" : "disabled"}>Remover exemplos</button><button class="btn btn-d" data-act="limpar">${ico("trash")}Apagar todos os dados</button></div>
        <div><div class="meter" role="img" aria-label="Armazenamento usado: ${pct}%"><i style="width:${pct}%"></i></div><p class="help" style="margin:.4rem 0 0">Armazenamento do navegador usado por este sistema: ${(uso / 1024).toFixed(0)} KB de cerca de 5 MB. ${plural(pts.list().length, "caso", "casos")} de PTS e ${plural(mat.list().length, "registro", "registros")} matriciais.</p></div>
      </div>`,
    })}

    ${painel({
      titulo: "Fontes",
      icone: "folder",
      corpo: h`<p class="muted" style="margin:0">Base Territorial CRAS/SEMCASPI (março/2020; população do Censo 2010), listas de CRAS/CREAS e de Centros de Convivência da SEMCASPI, mapa da rede de saúde da FMS Teresina (via KML). Mapas e endereços: OpenStreetMap. A base de 2020 pode estar desatualizada: <strong>confirme com a gestão antes de uso real</strong>. Hoje: ${D.bairros.length} bairros, ${D.unidades.length} unidades (CRAS/CREAS) e ${D.centros.length} centros de convivência.</p>`,
    })}`;

  acoes(el, {
    "rm-ubs": async () => {
      if (!(await confirmar({ titulo: "Remover as UBS?", texto: "Os pontos e áreas importados serão apagados deste navegador. Você poderá importar o KML de novo.", botao: "Remover", perigo: true }))) return;
      ubsStore.del();
      toast("UBS removidas.");
      render(el);
    },
    exportar: () => {
      const url = URL.createObjectURL(new Blob([montarBackup({ pts: pts.list(), mat: mat.list(), ubs: ubsStore.get() })], { type: "application/json" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: `backup-territorio-${hojeISO()}.json` });
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast(`Backup gerado: ${plural(pts.list().length, "caso", "casos")} e ${plural(mat.list().length, "registro", "registros")}.`);
    },
    importar: async () => {
      const arq = $("#bkp", el).files[0];
      if (!arq) return toast("Selecione o arquivo de backup primeiro.", "bad");
      if (arq.size > MAX_ARQ) return toast("Arquivo grande demais para ser um backup.", "bad");
      let b;
      try {
        b = validarBackup(await arq.text());
      } catch (e) {
        return toast(e.message, "bad");
      }
      const total = b.pts.length + b.mat.length + (b.ubs ? 1 : 0);
      if (!total) return toast("Nenhum registro válido encontrado no arquivo.", "bad");
      const ok = await confirmar({
        titulo: "Restaurar este backup?",
        texto: `Serão gravados ${plural(b.pts.length, "caso", "casos")}, ${plural(b.mat.length, "registro matricial", "registros matriciais")}${b.ubs ? " e as UBS" : ""}.${b.rejeitados ? ` ${b.rejeitados} registro(s) inválido(s) serão ignorados.` : ""} Registros com o mesmo identificador serão substituídos.`,
        botao: "Restaurar",
      });
      if (!ok) return;
      const salvou = pts.mesclar(b.pts) && mat.mesclar(b.mat) && (!b.ubs || ubsStore.set(b.ubs));
      if (!salvou) return toast("Não foi possível salvar tudo: o armazenamento do navegador está cheio.", "bad");
      toast("Backup restaurado.");
      render(el);
    },
    demo: () => {
      const r = semearDemo(D);
      toast(r ? "Exemplo fictício carregado." : "Não foi possível carregar o exemplo.", r ? "ok" : "bad");
      render(el);
    },
    "rm-demo": () => {
      const n = removerDemo();
      toast(`Exemplos removidos (${plural(n, "caso", "casos")}).`);
      render(el);
    },
    limpar: async () => {
      if (!(await confirmar({ titulo: "Apagar todos os dados?", texto: "Todos os casos de PTS, registros matriciais, UBS importadas e posições em cache serão apagados deste navegador. Faça um backup antes. Esta ação não pode ser desfeita.", botao: "Apagar tudo", perigo: true }))) return;
      store.limpar();
      dispatchEvent(new Event("ter:mudou"));
      toast("Dados apagados deste navegador.");
      render(el);
    },
  });

  $("#kml", el).addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > MAX_ARQ) return toast("Arquivo grande demais.", "bad");
    try {
      const k = parseKML(await f.text());
      if (!k.pts.length && !k.polys.length) return toast("Nenhum ponto ou área encontrado no arquivo.", "bad");
      if (!ubsStore.set(k)) return toast("O arquivo é grande demais para o armazenamento do navegador. Exporte um KML só com a rede de saúde de interesse.", "bad");
      toast(`UBS importadas: ${plural(k.pts.length, "ponto", "pontos")} e ${plural(k.polys.length, "área", "áreas")}.`);
      render(el);
    } catch (err) {
      toast(err.message || "Não foi possível ler o arquivo.", "bad");
    }
  });
}
