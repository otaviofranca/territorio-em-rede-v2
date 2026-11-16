import csv, json, re, os
D=os.path.join(os.path.dirname(__file__),"..","data")
SRC=os.path.join(os.path.dirname(__file__),"..","..","territorio","data")
rd=lambda n:list(csv.DictReader(open(os.path.join(SRC,n),encoding="utf-8")))
up=lambda s:re.sub(r"\s+"," ",(s or "").strip()).upper()
bairros={}
JUNK=("Aglomerado","Localidades não identificadas","Loteamento","OBSERVAÇÕES","Perfil dos Bairros")
FIX={"PARQUE BRASIL (Cidade Industrial)– O bairro Parque Brasil":"Parque Brasil","RURAL NORTE Densidade: 40 a 49 hab/km² (Plano Diretor de Transporte Rural, 2017)":"Zona Rural Norte","RURAL SUL Densidade: > 39 hab/km² (Plano Diretor de Transporte Rural, 2017)":"Zona Rural Sul"}
for r in rd("bairros.csv"):
    k=r["bairro"].strip()
    k=FIX.get(k,k)
    if k.startswith(JUNK): continue
    b=bairros.setdefault(k,dict(nome=k,cras=[],regional=r["regional"].strip(),populacao=0,familias=0,descricao=r["descricao"]))
    c=up(r["cras"])
    if c and c not in b["cras"]: b["cras"].append(c)
    b["populacao"]+=float(r["populacao_2010"] or 0); b["familias"]+=float(r["familias_cadunico"] or 0)
locs={}
for r in rd("localidades.csv"):
    locs.setdefault(r["bairro"].strip(),[]).append(dict(nome=r["localidade"],fonte=r["fonte"],familias=float(r["familias_cadunico"] or 0)))
for k,b in bairros.items(): b["localidades"]=locs.get(k,[]); b["populacao"]=int(b["populacao"]); b["familias"]=int(b["familias"])
cras=[dict(r,id=up(r["nome"]).replace("CRAS ","")) for r in rd("cras_creas.csv")]
cen=[dict(r,id=i) for i,r in enumerate(rd("centros_convivencia.csv"))]
for c in cen: c["cras"]=up(c["cras"]).replace("CRAS ","")
out=dict(bairros=sorted(bairros.values(),key=lambda x:x["nome"]),unidades=cras,centros=cen)
json.dump(out,open(os.path.join(D,"dados.json"),"w",encoding="utf-8"),ensure_ascii=False,indent=1)
print({k:len(v) for k,v in out.items()})
