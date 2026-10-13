# GeoFly QGIS

> **English summary:** QGIS plugin for photogrammetric UAV flight planning with selected-polygon grids, camera/GSD calculations, optional DEM/DTM terrain following, waypoint layers and DJI Fly KMZ export for enabled/validated profiles. For DJI Fly, create a placeholder waypoint mission first and replace its KMZ with the GeoFly export while keeping the exact original filename.

**GeoFly QGIS** é um complemento para planejamento de missões fotogramétricas diretamente no QGIS.

Ele gera linhas de voo e waypoints a partir de um polígono selecionado, calcula parâmetros fotogramétricos por perfil de câmera, pode acompanhar o relevo usando um MDE/MDT carregado no projeto e exporta missões em **KMZ compatível com DJI Fly** para os perfis de exportação habilitados.

## Perfis DJI Fly nativos

A partir da v1.2.1, o GeoFly QGIS possui um exportador específico baseado em arquivos KMZ produzidos pelo próprio DJI Fly para **DJI Mini 5 Pro**, **DJI Mini 3 Pro**, **DJI Lito X1** e **DJI Lito 1**. Esses modelos usam `wpmz/template.kml` e `wpmz/waylines.wpml`, namespace `http://www.uav.com/wpmz/1.0.2` e `droneEnumValue=68`.

O perfil do **DJI Mini 4 Pro não foi alterado**, pois já foi validado em campo no GeoFly. Os novos perfis devem ser testados primeiro em missão curta e área aberta.


## Autor

**Pítolas Armini B. da Silva**  
Contato: **arminipitolas@gmail.com**

## Principais recursos

- Planejamento a partir de **uma feição poligonal selecionada** no QGIS.
- Definição do **Home Point** no mapa ou pelo centroide.
- Configuração de:
  - altitude de voo AGL;
  - sobreposição frontal;
  - sobreposição lateral;
  - direção das linhas de voo;
  - velocidade;
  - inclinação do gimbal.
- Voo simples ou **voo cruzado (+90°)**.
- Cálculo de **pegada da câmera, espaçamento entre linhas, espaçamento entre fotos e GSD estimado**.
- Perfis disponíveis no seletor:
  - DJI Mini 5 Pro — 12 MP / 50 MP;
  - DJI Mini 4 Pro — 12 MP / 48 MP;
  - DJI Mini 3 Pro — 12 MP / 48 MP;
  - DJI Lito X1 — 12 MP / 48 MP.
- Acompanhamento de terreno usando **qualquer raster MDE/MDT carregado no QGIS**.
- Criação de camadas temporárias no grupo **GeoFly**:
  - Linhas de voo;
  - Waypoints;
  - Home.
- Waypoints com atributos de conferência de relevo, incluindo `ground_msl`, `execute_h` e `agl_check`.
- Divisão automática de missões DJI quando necessário pelo limite de waypoints configurado no plugin.
- Exportação de **KMZ DJI Fly** para os perfis de exportação habilitados.

## Acompanhamento de relevo

Quando a opção de acompanhamento de terreno está ativada, o GeoFly consulta a elevação do raster no Home Point e em cada waypoint.

Para missões DJI em modo `relativeToStartPoint`, a altura de execução é calculada por:

```text
executeHeight = AGL_alvo + (cota_terreno_waypoint - cota_terreno_home)
```

O campo `agl_check` permite verificar se a altura resultante permanece coerente com a AGL planejada.

> **Atenção:** um MDT/DTM representa o terreno, enquanto um MDS/DSM pode incluir edificações e vegetação. O piloto é responsável por escolher a superfície adequada e verificar obstáculos reais.

## Instalação pelo arquivo ZIP

1. Abra o QGIS.
2. Vá em **Complementos → Gerenciar e Instalar Complementos**.
3. Abra **Instalar a partir de ZIP**.
4. Selecione o arquivo de distribuição do GeoFly QGIS.
5. Confirme a instalação e ative **GeoFly QGIS**.

Após a publicação no repositório oficial do QGIS, o complemento poderá ser instalado diretamente pela guia **Todos** do Gerenciador de Complementos.

## Fluxo básico de uso

1. Carregue ou crie uma camada poligonal.
2. Selecione **uma única feição** correspondente à área da missão.
3. Abra o painel **GeoFly QGIS**.
4. Clique em **Usar polígono selecionado**.
5. Defina o Home Point.
6. Escolha o drone e o modo de câmera.
7. Ajuste altitude, overlaps, direção, velocidade e gimbal.
8. Se necessário, ative **Manter AGL constante usando raster** e escolha o MDE/MDT.
9. Clique em **Gerar missão**.
10. Confira as linhas, os waypoints, as altitudes e os atributos gerados.
11. Clique em **Exportar KMZ DJI** quando a exportação estiver habilitada para o perfil selecionado.

# IMPORTANTE — como usar o KMZ exportado no DJI Fly

O **DJI Fly não possui um botão genérico de importação de missões KMZ**. Portanto, após exportar a missão no GeoFly QGIS, é necessário **substituir o KMZ de uma missão criada previamente no próprio DJI Fly**.

## Procedimento recomendado

1. No **DJI Fly**, crie uma missão de waypoints simples, com pelo menos dois pontos, e **salve-a**. Essa missão funciona como um espaço reservado (*placeholder*).
2. Feche completamente o DJI Fly antes de substituir o arquivo.
3. Faça uma cópia de segurança do KMZ original dessa missão.
4. Localize o arquivo `.kmz` correspondente à missão salva.
5. Renomeie o KMZ exportado pelo GeoFly para **exatamente o mesmo nome do KMZ original**.
6. Substitua o KMZ original pelo arquivo exportado pelo GeoFly, mantendo a mesma pasta e o mesmo nome.
7. Abra novamente o DJI Fly.
8. Abra a missão substituída e **revise toda a rota, altitudes, waypoints, ações de câmera e Home Point antes de executar o voo**.

### DJI RC / RC 2 e dispositivos Android

Em controladores/dispositivos Android, as missões costumam ficar em uma estrutura semelhante a:

```text
Android/data/dji.go.v5/files/waypoint/<UUID>/<UUID>.kmz
```

O caminho pode variar conforme versão do DJI Fly, controlador e sistema operacional. Em versões recentes do Android, pode ser necessário conectar o controlador a um computador para acessar `Android/data`.

### iPhone / iPad

Em dispositivos iOS, a missão pode ser encontrada na área de arquivos do DJI Fly, normalmente em uma estrutura semelhante a:

```text
DJI Fly/wayline_mission/<UUID>/<UUID>.kmz
```

> **Regra essencial:** o arquivo exportado pelo GeoFly deve assumir **o mesmo nome do KMZ que foi criado pelo DJI Fly** e substituir esse arquivo dentro da mesma pasta da missão.

## Compatibilidade de exportação

A geração e execução de KMZ do plugin foi **validada em campo com DJI Mini 4 Pro / DJI Fly** durante o desenvolvimento do GeoFly QGIS.

Os demais perfis de drones/câmeras podem estar disponíveis para **planejamento fotogramétrico**, mas a exportação pode permanecer bloqueada quando ainda não houver validação específica do modelo.

## Segurança e responsabilidade

O GeoFly QGIS é uma ferramenta de planejamento. Antes de qualquer voo real:

- confira visualmente toda a missão no QGIS e no DJI Fly;
- confira Home Point, altitude, sentido das linhas e retorno;
- verifique obstáculos, edificações, árvores, cabos, torres e demais riscos;
- valide se o raster usado representa adequadamente o terreno/superfície;
- confirme autonomia de bateria e limites operacionais do equipamento;
- observe a legislação aeronáutica e as regras aplicáveis à operação;
- faça testes controlados antes de utilizar novas configurações em áreas complexas.

O autor e o projeto GeoFly não são afiliados nem endossados pela DJI.

## Requisitos

- QGIS **3.34 ou superior** dentro da série QGIS 3.x suportada pelo plugin.
- Python/PyQGIS fornecido pelo próprio QGIS.
- Para acompanhamento de terreno: raster MDE/MDT carregado no projeto.

## Relatar problemas

Erros, sugestões e pedidos de melhoria podem ser registrados em:

**https://github.com/pitolas/GeoFly-QGIS/issues**

Ao relatar um problema, informe, quando possível:

- versão do QGIS;
- versão do GeoFly QGIS;
- sistema operacional;
- modelo do drone;
- modo de câmera;
- parâmetros da missão;
- mensagem de erro;
- um arquivo de exemplo que reproduza o problema, desde que não contenha dados sensíveis.

## Licença

GeoFly QGIS é distribuído sob a licença **GNU General Public License v2.0**.

## Perfis de exportação DJI Fly

- **DJI Mini 4 Pro:** perfil validado em campo no GeoFly QGIS.
- **DJI Mini 5 Pro:** exportação experimental; validar com missão curta antes do uso operacional.
- **DJI Lito X1:** exportação experimental; validar com missão curta antes do uso operacional.
- **DJI Mini 3 Pro:** formato nativo DJI Fly confirmado por KMZ de referência; execução GeoFly ainda deve ser validada com missão curta antes do uso operacional.

Os perfis experimentais exibem um aviso de confirmação antes de gerar o KMZ. O perfil do Mini 4 Pro não foi alterado.

