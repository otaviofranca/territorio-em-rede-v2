"""Gera data/coords.json (lat/lng de CRAS, CREAS e centros) com o Nominatim/OpenStreetMap.

Rode no seu computador, com internet:  python scripts/geocode.py
- 1 consulta por segundo (política de uso do Nominatim), com novas tentativas em caso de erro 429/503.
- Grava o arquivo a cada item: se parar no meio, é só rodar de novo (os itens já resolvidos são mantidos).
- Ordem de tentativas: endereço completo -> rua (sem número) + bairro -> só o bairro.
  Posição só pelo bairro recebe "aprox": true e aparece no mapa avisada como aproximada.
- Itens que ficarem com {"fail": true} podem ser corrigidos à mão no coords.json.
"""
import json, re, time, urllib.request, urllib.parse, urllib.error, os

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DADOS = os.path.join(RAIZ, "data", "dados.json")
SAIDA = os.path.join(RAIZ, "data", "coords.json")
UA = "territorio-em-rede-v2 (prototipo academico)"


def limpa(e):
    e = re.sub(r"\(.*?\)", "", e or "")
    e = re.sub(r"ponto de refer[eê]ncia:.*", "", e, flags=re.I)
    e = re.sub(r"Teresina\s*[–-]\s*Piau[ií]\.?", "", e, flags=re.I)
    e = re.sub(r"\bs/?n\b[º°]?", "", e, flags=re.I)
    e = re.sub(r"n[ºª°]\s*", "", e, flags=re.I)
    e = re.sub(r"\bCEP\s*[\d.-]+", "", e, flags=re.I)
    e = re.sub(r"\s+", " ", e)
    return re.sub(r",\s*,", ",", e).strip(" ,-.")


def bairro_do_endereco(e):
    e = limpa(e)
    cand = ""
    partes_traco = [p.strip(" ,.") for p in re.split(r"\s[–-]\s?|-\s", e) if p.strip(" ,.")]
    if len(partes_traco) >= 2:
        cand = partes_traco[-1]
    else:
        partes = [p.strip(" .,") for p in e.split(",") if p.strip(" .,")]
        cand = partes[-1] if len(partes) >= 2 else ""
    cand = re.sub(r"^\d+\s*", "", cand)
    cand = re.sub(r"^(Bairro|Conj\.?|Conjunto)\s+", "", cand, flags=re.I)
    cand = re.sub(r"^(Bairro|Conj\.?|Conjunto)\s+", "", cand, flags=re.I)
    return cand.strip(" .,")


def rua(e):
    return limpa(e).split(",")[0].split(" – ")[0].split(" - ")[0].strip()


_ultimo = 0.0


def geo(q):
    global _ultimo
    for tentativa in range(4):
        espera = max(0.0, 1.1 - (time.time() - _ultimo))
        time.sleep(espera)
        _ultimo = time.time()
        u = ("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br"
             "&viewbox=-43.1,-4.8,-42.5,-5.4&bounded=1&q=" + urllib.parse.quote(q))
        try:
            r = urllib.request.Request(u, headers={"User-Agent": UA})
            j = json.load(urllib.request.urlopen(r, timeout=30))
            return {"lat": round(float(j[0]["lat"]), 6), "lng": round(float(j[0]["lon"]), 6)} if j else None
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, OSError) as ex:
            print("   erro", getattr(ex, "code", ex), "- tentativa", tentativa + 1)
            time.sleep(3 * (tentativa + 1))
    raise RuntimeError("serviço indisponível")


def resolver(end, bairro, nome=""):
    b = bairro or bairro_do_endereco(end)
    r = geo(limpa(end) + ", Teresina, Piauí")
    if r:
        return r
    if b and rua(end):
        r = geo(f"{rua(end)}, {b}, Teresina, Piauí")
        if r:
            return r
    if nome:
        r = geo(f"{nome}, Teresina, Piauí")
        if r:
            return r
    if b:
        r = geo(f"{b}, Teresina, Piauí")
        if r:
            return dict(r, aprox=True)
    return {"fail": True}


def main():
    d = json.load(open(DADOS, encoding="utf-8"))
    itens = [("u:" + u["nome"], u["endereco"], "", u["nome"]) for u in d["unidades"]]
    itens += [("c:%s" % c["id"], c["endereco"], c["bairro"], "") for c in d["centros"]]
    try:
        out = json.load(open(SAIDA, encoding="utf-8"))
    except (OSError, ValueError):
        out = {}
    for k, e, b, nome in itens:
        if k in out and not out[k].get("fail"):
            continue
        out[k] = resolver(e, b, nome)
        print(k, out[k])
        json.dump(out, open(SAIDA, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    ok = sum(1 for v in out.values() if not v.get("fail"))
    aprox = sum(1 for v in out.values() if v.get("aprox"))
    print(f"\n{ok}/{len(itens)} posicionados ({aprox} aproximados pelo bairro).")


if __name__ == "__main__":
    main()
