export interface SampleMission {
  id: string;
  name: string;
  category: 'Agro' | 'Topografia' | 'Corredor Linear' | 'Urbano';
  description: string;
  center: [number, number];
  polygon: [number, number][];
  gridType: 'single' | 'double' | 'corridor' | 'perimeter';
  targetAltitudeAgl: number;
  droneId: string;
  stripAngle: number;
  frontalOverlap: number;
  sideOverlap: number;
  corridorWidthM?: number;
}

export const SAMPLE_MISSIONS: SampleMission[] = [
  {
    id: 'agro-talhao-soja',
    name: 'Fazenda Santa Maria - Talhão 04 (Mapeamento Agrícola 16ha)',
    category: 'Agro',
    description: 'Levantamento de biomassa, falhas de plantio e altimetria com 75/70 de sobreposição em Ribeirão Preto - SP.',
    center: [-21.1767, -47.8103],
    polygon: [
      [-21.1740, -47.8130],
      [-21.1745, -47.8075],
      [-21.1788, -47.8070],
      [-21.1795, -47.8125]
    ],
    gridType: 'single',
    targetAltitudeAgl: 90,
    droneId: 'dji-mini-4-pro',
    stripAngle: 85,
    frontalOverlap: 75,
    sideOverlap: 70
  },
  {
    id: 'topo-relevo-ondulado',
    name: 'Topografia e Curvas de Nível - Relevo Acidentado (Minas Gerais)',
    category: 'Topografia',
    description: 'Mapeamento com acompanhamento de terreno SRTM para geração de MDT, MDS e curvas de nível de 1m.',
    center: [-19.9245, -43.9352],
    polygon: [
      [-19.9215, -43.9380],
      [-19.9220, -43.9320],
      [-19.9270, -43.9315],
      [-19.9280, -43.9370],
      [-19.9250, -43.9395]
    ],
    gridType: 'double',
    targetAltitudeAgl: 70,
    droneId: 'dji-mavic-3-enterprise',
    stripAngle: 45,
    frontalOverlap: 80,
    sideOverlap: 75
  },
  {
    id: 'corredor-rodovia',
    name: 'Projeto As-Built Rodovia BR-116 (Corredor Linear 2.5km)',
    category: 'Corredor Linear',
    description: 'Mapeamento de faixa de domínio rodoviária com 80m de largura para cálculo volumétrico de terraplenagem.',
    center: [-25.4382, -49.2733],
    polygon: [
      [-25.4330, -49.2800],
      [-25.4360, -49.2740],
      [-25.4410, -49.2680],
      [-25.4460, -49.2630]
    ],
    gridType: 'corridor',
    targetAltitudeAgl: 60,
    droneId: 'dji-phantom-4-pro-rtk',
    stripAngle: 120,
    frontalOverlap: 80,
    sideOverlap: 65,
    corridorWidthM: 70
  },
  {
    id: 'loteamento-urbano-3d',
    name: 'Loteamento Residencial Jardins (Malha Cruzada 3D)',
    category: 'Urbano',
    description: 'Grelha dupla cruzada com câmera a -65° para modelagem 3D, nuvem de pontos densa e cadastro imobiliário.',
    center: [-23.5505, -46.6333],
    polygon: [
      [-23.5480, -46.6360],
      [-23.5485, -46.6300],
      [-23.5535, -46.6295],
      [-23.5540, -46.6355]
    ],
    gridType: 'double',
    targetAltitudeAgl: 80,
    droneId: 'dji-air-3-wide',
    stripAngle: 0,
    frontalOverlap: 80,
    sideOverlap: 75
  }
];
