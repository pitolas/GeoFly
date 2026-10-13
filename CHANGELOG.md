# Changelog

## 1.2.1

- Analisado KMZ nativo gerado pelo DJI Fly para DJI Mini 3 Pro.
- Confirmado `droneEnumValue=68`, `droneSubEnumValue=0`, namespace `http://www.uav.com/wpmz/1.0.2`, pasta `wpmz/` e ausência de `payloadInfo`.
- Mini 3 Pro passa a usar o mesmo exportador nativo DJI Fly 1.0.2 utilizado por Mini 5 Pro, Lito X1 e Lito 1.
- Perfil do Mini 4 Pro permanece inalterado e continua sendo o perfil validado em campo.
- Nenhuma alteração na lógica de malha, GSD, relevo, waypoints ou ações de fotografia.

## 1.2.0 — 2026-10-13

- Analisados KMZ nativos gerados pelo DJI Fly para DJI Mini 5 Pro, DJI Lito X1 e DJI Lito 1.
- Os três modelos usam o mesmo envelope nativo: `wpmz/template.kml` + `wpmz/waylines.wpml`, namespace `http://www.uav.com/wpmz/1.0.2`, `droneEnumValue=68`, `droneSubEnumValue=0` e sem `payloadInfo` no `missionConfig`.
- Exportador específico nativo adicionado para Mini 5 Pro, Lito X1 e Lito 1.
- DJI Lito 1 adicionado ao seletor com modos 12 MP e 48 MP.
- Mini 4 Pro permanece exatamente no perfil legado já validado em campo; sua exportação não foi alterada.
- Mini 3 Pro permanece experimental no perfil anterior, pois ainda não foi fornecido um KMZ nativo desse modelo.
- Mantida confirmação de segurança antes da exportação dos perfis ainda não validados em voo pelo GeoFly.

## 1.1.0

- Exportação DJI Fly experimental habilitada para DJI Mini 5 Pro.
- Exportação DJI Fly experimental habilitada para DJI Lito X1.
- Exportação DJI Fly experimental habilitada para DJI Mini 3 Pro.
- Mini 4 Pro permanece com o mesmo perfil de exportação já validado em campo.
- Perfis experimentais exibem confirmação antes da geração do KMZ.
- Nenhuma alteração na malha, GSD, relevo, divisão de waypoints, gimbal ou lógica de voo do perfil Mini 4 Pro.

## 1.0.1 — 2026-10-10

- Correção de segurança para publicação no repositório oficial do QGIS.
- Removida a importação não utilizada `xml.sax.saxutils.escape`, sinalizada pelo Bandit.
- Nenhuma alteração funcional no planejamento de voo, acompanhamento de terreno, cálculos, interface ou exportação KMZ DJI Fly.

## 1.0.0 — 2026-10-10

Primeira versão pública estável preparada para distribuição pelo repositório oficial de plugins do QGIS.

- Planejamento a partir de polígono selecionado.
- Home Point no mapa ou centroide.
- Altitude AGL, overlaps, direção, velocidade e gimbal configuráveis.
- Voo simples e voo cruzado.
- Perfis DJI Mini 5 Pro, Mini 4 Pro, Mini 3 Pro e Lito X1.
- Modos de resolução de câmera conforme os perfis disponíveis.
- Cálculo de pegada, espaçamento e GSD.
- Acompanhamento de terreno por raster MDE/MDT.
- Camadas temporárias de linhas de voo, waypoints e Home.
- Exportação KMZ DJI Fly validada em campo para DJI Mini 4 Pro.
- Documentação do procedimento de substituição do KMZ de uma missão previamente criada no DJI Fly.
