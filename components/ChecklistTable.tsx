
import React, { useState } from 'react';
import { ChecklistItem, ItemStatus } from '../types';
import { CheckSquare, Camera } from 'lucide-react';

interface ChecklistTableProps {
  items: ChecklistItem[];
  lastItems?: { label: string; status: string; observation?: string }[];
  onStatusChange: (id: string, status: ItemStatus) => void;
  onObservationChange: (id: string, obs: string) => void;
  onSaveToGeneralNotes: (id: string) => void;
  onAddPhoto: (id: string, e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const ChecklistTable: React.FC<ChecklistTableProps> = ({ 
  items, 
  lastItems,
  onStatusChange, 
  onObservationChange,
  onSaveToGeneralNotes,
  onAddPhoto
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
      <div className="divide-y divide-gray-100">
          {/* Header opcional para alinhamento visual */}
          <div className="bg-gray-100 px-2 py-1 grid grid-cols-[38%_12%_auto_1fr] gap-2 text-[9px] font-bold text-gray-500 uppercase tracking-wider">
            <div>Item</div>
            <div className="text-center">Anterior</div>
            <div className="w-[68px]">Status</div>
            <div>Observação / Evidência</div>
          </div>

          {items.map((item, index) => {
            const lastData = lastItems?.find(li => li.label === item.label);
            const isExpanded = expandedId === item.id;

            return (
            <div 
              key={`${item.id}-${index}`} 
              className={`px-2 py-1 grid grid-cols-[38%_12%_auto_1fr] gap-2 items-center group transition-colors ${
                index % 2 === 0 ? 'bg-white' : 'bg-gray-50/80'
              } hover:bg-blue-50/30`}
            >
              {/* Coluna 1: Label */}
              <div className="min-w-0">
                <span 
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  className={`font-semibold text-gray-700 text-[10px] leading-tight block cursor-pointer transition-all ${isExpanded ? 'whitespace-normal' : 'truncate'}`} 
                  title={item.label}
                >
                  {item.label}
                </span>
              </div>

              {/* Coluna Histórico: Status Anterior */}
              <div className="flex justify-center">
                {lastData ? (
                  <div 
                    className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase flex items-center gap-1 ${
                      lastData.status === 'SN' || lastData.status === 'OK' 
                        ? 'bg-green-50 text-green-600 border border-green-100' 
                        : 'bg-red-50 text-red-600 border border-red-100'
                    }`}
                    title={lastData.observation ? `Anterior: ${lastData.observation}` : `Anterior: ${lastData.status}`}
                  >
                    {lastData.status === 'SN' || lastData.status === 'OK' ? 'OK' : 'CN'}
                  </div>
                ) : (
                  <span className="text-[8px] text-gray-300 font-bold">-</span>
                )}
              </div>
              
              {/* Coluna 2: Botões (Tamanho fixo para alinhamento perfeito) */}
              <div className="flex items-center gap-1 w-[68px]">
                <button
                  onClick={() => onStatusChange(item.id, 'OK')}
                  className={`flex-1 h-5 flex items-center justify-center rounded border text-[9px] font-bold transition-all uppercase shadow-sm ${
                    item.status === 'OK' 
                      ? 'bg-green-600 text-white border-green-600' 
                      : 'bg-white text-gray-300 border-gray-200 hover:border-gray-300 hover:text-gray-400'
                  }`}
                >
                  OK
                </button>
                <button
                  onClick={() => onStatusChange(item.id, 'CN')}
                  className={`flex-1 h-5 flex items-center justify-center rounded border text-[9px] font-bold transition-all uppercase shadow-sm ${
                    item.status === 'CN' 
                      ? 'bg-red-600 text-white border-red-600' 
                      : 'bg-white text-gray-300 border-gray-200 hover:border-gray-300 hover:text-gray-400'
                  }`}
                >
                  CN
                </button>
              </div>

              {/* Coluna 3: Input de Observação e Ações */}
              <div className="flex items-center gap-1 min-w-0 relative">
                {/* Input para edição (Escondido na impressão por segurança de renderização) */}
                <input
                  type="text"
                  placeholder=""
                  value={item.observation || ''}
                  onChange={(e) => onObservationChange(item.id, e.target.value)}
                  className="w-full h-5 text-[10px] border-b border-transparent focus:border-blue-500 hover:border-gray-200 outline-none bg-transparent font-medium text-gray-600 placeholder:text-gray-300 transition-colors no-print"
                />
                
                {/* Texto estático para impressão (Garante visibilidade no PDF) */}
                <span className="hidden print:block text-[9px] text-gray-600 italic truncate w-full">
                  {item.observation || ''}
                </span>
                
                {/* Botão de Foto */}
                <label className={`cursor-pointer p-0.5 transition-colors no-print ${
                  (item.photos && item.photos.length > 0) ? 'text-blue-600 hover:text-blue-800' : 'text-gray-300 hover:text-blue-500 opacity-0 group-hover:opacity-100'
                }`} title="Adicionar foto de evidência">
                  <Camera className="w-3 h-3" />
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => onAddPhoto(item.id, e)} />
                </label>

                {/* Botão de Mover para Notas Gerais */}
                <button 
                  onClick={() => onSaveToGeneralNotes(item.id)}
                  title="Mover para notas gerais"
                  className="text-gray-300 hover:text-blue-600 p-0.5 opacity-0 group-hover:opacity-100 transition-all no-print"
                >
                  <CheckSquare className="w-3 h-3" />
                </button>
              </div>
            </div>
            );
          })}
      </div>
    </div>
  );
};
