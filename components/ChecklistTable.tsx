
import React from 'react';
import { ChecklistItem, ItemStatus } from '../types';
import { CheckSquare, Camera } from 'lucide-react';

interface ChecklistTableProps {
  items: ChecklistItem[];
  onStatusChange: (id: string, status: ItemStatus) => void;
  onObservationChange: (id: string, obs: string) => void;
  onSaveToGeneralNotes: (id: string) => void;
  onAddPhoto: (id: string, e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const ChecklistTable: React.FC<ChecklistTableProps> = ({ 
  items, 
  onStatusChange, 
  onObservationChange,
  onSaveToGeneralNotes,
  onAddPhoto
}) => {
  return (
    <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
      <div className="divide-y divide-gray-100">
          {/* Header opcional para alinhamento visual */}
          <div className="bg-gray-100 px-2 py-1 grid grid-cols-[45%_auto_1fr] gap-2 text-[9px] font-bold text-gray-500 uppercase tracking-wider">
            <div>Item</div>
            <div className="w-[68px]">Status</div>
            <div>Observação / Evidência</div>
          </div>

          {items.map((item, index) => (
            <div 
              key={item.id} 
              className={`px-2 py-0.5 grid grid-cols-[45%_auto_1fr] gap-2 items-center group transition-colors ${
                index % 2 === 0 ? 'bg-white' : 'bg-gray-50/80'
              } hover:bg-blue-50/30`}
            >
              {/* Coluna 1: Label */}
              <div className="min-w-0">
                <span className="font-semibold text-gray-700 text-[10px] leading-tight block truncate" title={item.label}>
                  {item.label}
                </span>
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
          ))}
      </div>
    </div>
  );
};
