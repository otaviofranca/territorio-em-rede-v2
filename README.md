# Território em Rede

Site estático de **apoio matricial e territorial** para Teresina-PI. A pessoa informa o bairro (ou um
endereço fictício) e vê o CRAS, o CREAS, os centros de convivência e a unidade de saúde de referência;
reúne esses recursos num **PTS** (Projeto Terapêutico Singular), registra o **apoio matricial** e imprime
o documento. Funciona no GitHub Pages, sem servidor e sem etapa de build.

> **Protótipo.** Os casos e registros ficam **só no navegador** de quem usa (sem login e sem banco
> compartilhado). Use apenas **dados fictícios** (LGPD). A base territorial é de março/2020: confirme com
> a gestão antes de qualquer uso real.

## O que tem

| Tela | O que faz |
| --- | --- |
| **Painel geral** | Indicadores da base, ações vencidas ou com prazo em 7 dias, casos de PTS em andamento. |
| **Localizar** | Busca por bairro ou endereço; CRAS, CREAS e centros do território; UBS de referência (se o KML foi importado); botão “+ PTS” e painel lateral do caso atual. |
| **Mapa** | CRAS, CREAS, centros e UBS no OpenStreetMap, com filtro por camada e botão de adicionar ao PTS. |
| **PTS** | Lista de casos e editor com salvamento automático: dados, recursos do território, ações (prazo e situação) e observações; documento A4 para imprimir/PDF. |
| **Apoio matricial** | Registro de articulações entre equipes, vinculado ao caso do PTS, com filtro e alteração de situação. |
| **Dados e backup** | Importar KML das UBS, exportar/restaurar backup validado, carregar/remover exemplo fictício, apagar tudo. |

## Rodar localmente

Os módulos ES precisam de um servidor HTTP (não abre por `file://`):

```bash
python -m http.server 5173      # depois abra http://localhost:5173
```

## Publicar no GitHub Pages

Repositório → **Settings → Pages → Deploy from a branch → `main` / `(root)`**.

## Testes

```bash
node --test tests/*.test.mjs    # regras de negócio, escape de HTML, validação de backup, integridade dos dados
```

## Estrutura

```
index.html            casca do app (cabeçalho, menu lateral, rodapé, diálogo)
css/style.css         estilos (tokens, componentes, impressão)
js/main.js            ponto de entrada
js/router.js          rotas por hash (#/pts/ID), contexto por navegação
js/dom.js             template `h` com escape automático, delegação de eventos
js/dominio.js         regras puras: território, prazos, endereços
js/geo.js             Nominatim, KML, UBS por polígono/distância
js/backup.js          esquema e validação do backup (entrada não confiável)
js/store.js           persistência (localStorage, prefixo "terv2:")
js/ui.js              componentes (painel, tabela, tags, toast, confirmação)
js/pages/             uma tela por rota
data/dados.json       bairros, CRAS/CREAS, centros de convivência
data/coords.json      latitude/longitude dos dispositivos (ver abaixo)
scripts/              build_json.py (gera dados.json), geocode.py (gera coords.json)
tests/                testes unitários (node:test)
```

## Dados e posições no mapa

- `data/dados.json` vem da Base Territorial CRAS/SEMCASPI (2020) e das listas da SEMCASPI. O script
  `scripts/build_json.py` o gera a partir de CSVs que **não estão** neste repositório.
- `data/coords.json` foi gerado com `python scripts/geocode.py` (Nominatim/OpenStreetMap). **9 dos 36
  pontos estão posicionados só pelo bairro** (`"aprox": true`) e aparecem no mapa com cor mais clara e
  aviso no popup; confira e corrija à mão o que estiver fora do lugar.

## Privacidade

- A busca por **endereço** envia o texto ao OpenStreetMap (serviço externo). O sistema pede confirmação
  na primeira vez em cada sessão. **Nunca digite o endereço real de um usuário.**
- Nada é enviado a servidor próprio: casos, registros e UBS importadas ficam no `localStorage`.
- Todo HTML é montado com escape automático e não há `onclick` inline.

## Créditos

A estrutura de navegação e organização das telas (menu lateral agrupado, trilha de navegação, painéis,
painel lateral fixo, folha A4) foi **inspirada no SGTR** (CAPS AD), de **Victor Kauan**. O código e o
CSS deste repositório foram escritos de forma independente e a identidade visual é própria.
