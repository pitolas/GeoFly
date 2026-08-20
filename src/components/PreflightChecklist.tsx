import React, { useState } from 'react';
import {
  ShieldCheck,
  Wind,
  Sun,
  Activity,
  CheckSquare,
  Square,
  AlertTriangle,
  FileCheck2
} from 'lucide-react';

interface ChecklistItem {
  id: string;
  category: 'Documentos & Autorização' | 'Aeronave & Baterias' | 'Condições Meteorológicas' | 'Área & Segurança';
  text: string;
  checked: boolean;
}

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: 'doc-sarpas', category: 'Documentos & Autorização', text: 'Solicitação de voo aprovada no SARPAS / DECEA', checked: false },
  { id: 'doc-sisant', category: 'Documentos & Autorização', text: 'Certificado de Cadastro SISANT / ANAC em dia e afixado no drone', checked: false },
  { id: 'doc-seguro', category: 'Documentos & Autorização', text: 'Seguro RETA obrigatório válido para operações comerciais', checked: false },
  { id: 'drone-props', category: 'Aeronave & Baterias', text: 'Hélices inspecionadas sem trincas, lascas ou folgas no encaixe', checked: false },
  { id: 'drone-battery', category: 'Aeronave & Baterias', text: 'Baterias do drone e do controle 100% carregadas e balanceadas', checked: false },
  { id: 'drone-sd', category: 'Aeronave & Baterias', text: 'Cartão MicroSD de alta velocidade (U3/V30) formatado e com espaço livre', checked: false },
  { id: 'drone-gimbal', category: 'Aeronave & Baterias', text: 'Lente limpa e trava de gimbal removida antes da inicialização', checked: false },
  { id: 'drone-compass', category: 'Aeronave & Baterias', text: 'Bússola e IMU calibradas longe de estruturas metálicas e concreto armado', checked: false },
  { id: 'met-wind', category: 'Condições Meteorológicas', text: 'Vento sustentado abaixo de 10 m/s (36 km/h) e sem rajadas severas', checked: false },
  { id: 'met-kp', category: 'Condições Meteorológicas', text: 'Índice KP Solar abaixo de 4 (sem tempestades geomagnéticas afetando GPS)', checked: false },
  { id: 'safe-people', category: 'Área & Segurança', text: 'Área de decolagem isolada e sem pessoas não envolvidas na operação', checked: false },
  { id: 'safe-obst', category: 'Área & Segurança', text: 'Obstáculos (torres, fiação elétrica, árvores altas) identificados na rota', checked: false },
  { id: 'safe-rth', category: 'Área & Segurança', text: 'Altitude de RTH (Retorno Automático) configurada acima do ponto mais alto', checked: false }
];

export const PreflightChecklist: React.FC = () => {
  const [items, setItems] = useState<ChecklistItem[]>(DEFAULT_CHECKLIST);

  const toggleItem = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
  };

  const checkAll = () => {
    setItems((prev) => prev.map((item) => ({ ...item, checked: true })));
  };

  const resetAll = () => {
    setItems((prev) => prev.map((item) => ({ ...item, checked: false })));
  };

  const completedCount = items.filter((i) => i.checked).length;
  const totalCount = items.length;
  const pct = Math.round((completedCount / totalCount) * 100);

  const categories = Array.from(new Set(items.map((i) => i.category)));

  return (
    <div className="flex flex-col gap-4">
      {/* Weather & Space Safety Cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400">Atividade Solar / GPS</span>
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <span className="text-sm font-bold text-emerald-400">KP 1.8 (Excelente)</span>
          <span className="text-[10px] text-slate-500">Constelação GNSS estável sem interferência ionosférica</span>
        </div>

        <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400">Iluminação Solar</span>
            <Sun className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <span className="text-sm font-bold text-amber-400">Ângulo Solar 58°</span>
          <span className="text-[10px] text-slate-500">Horário ideal para aerofotogrametria (sombras mínimas)</span>
        </div>
      </div>

      {/* Checklist Header */}
      <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Checklist Pré-Voo & Segurança (ANAC / DECEA)
            </h3>
          </div>
          <span className="text-xs font-bold font-mono text-cyan-400">
            {completedCount}/{totalCount} ({pct}%)
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
          <div
            className={`h-full transition-all duration-200 ${
              pct === 100 ? 'bg-emerald-500' : 'bg-cyan-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="flex items-center justify-between pt-1">
          <button
            onClick={checkAll}
            className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold"
          >
            Marcar Todos
          </button>
          <button
            onClick={resetAll}
            className="text-[11px] text-slate-500 hover:text-slate-300"
          >
            Desmarcar Todos
          </button>
        </div>
      </div>

      {/* Categorized Checklist Items */}
      <div className="flex flex-col gap-3">
        {categories.map((cat) => {
          const categoryItems = items.filter((i) => i.category === cat);
          return (
            <div key={cat} className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
                {cat}
              </span>
              <div className="bg-slate-950/50 rounded-xl border border-slate-800 divide-y divide-slate-800/60 overflow-hidden">
                {categoryItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => toggleItem(item.id)}
                    className="p-2.5 flex items-start gap-2.5 hover:bg-slate-900/60 cursor-pointer transition-colors"
                  >
                    <button className="mt-0.5 shrink-0 text-cyan-400">
                      {item.checked ? (
                        <CheckSquare className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-600" />
                      )}
                    </button>
                    <span
                      className={`text-xs select-none transition-colors ${
                        item.checked ? 'text-slate-400 line-through' : 'text-slate-200'
                      }`}
                    >
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
