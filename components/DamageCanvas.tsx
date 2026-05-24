
import React, { useRef, useState } from 'react';
import { DamagePoint, AspectRatio } from '../types';
import { Maximize2, CheckCircle2, Camera, RectangleHorizontal, RectangleVertical, ImagePlus } from 'lucide-react';

interface DamageCanvasProps {
  images: string[];
  ratios: AspectRatio[];
  damages: DamagePoint[];
  onAddDamage: (x: number, y: number, imageIndex: number) => void;
  onRemoveDamage: (id: string) => void;
  onUpdateImage: (index: number, base64: string) => void;
  onUpdateRatio: (index: number, ratio: AspectRatio) => void;
}

const VIEW_LABELS = [
  'Dianteira', 
  'Traseira', 
  'Lateral Motorista', 
  'Lateral Comandante', 
  'Superior'
];

export const DamageCanvas: React.FC<DamageCanvasProps> = ({ 
  images = [], 
  ratios = [],
  damages, 
  onAddDamage, 
  onRemoveDamage,
  onUpdateImage,
  onUpdateRatio
}) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const zoomContainerRef = useRef<HTMLDivElement>(null);

  // Garante que temos as 5 vistas (mesmo que vazias) e seus ratios
  const fullImages = [...images, ...Array(5).fill('')].slice(0, 5);
  const fullRatios = [...ratios, ...Array(5).fill('landscape')].slice(0, 5) as AspectRatio[];

  const handleZoomClick = (e: React.MouseEvent) => {
    if (!zoomContainerRef.current || expandedIndex === null) return;
    const rect = zoomContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onAddDamage(x, y, expandedIndex);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onUpdateImage(index, reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleRatio = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newRatio = fullRatios[index] === 'landscape' ? 'portrait' : 'landscape';
    onUpdateRatio(index, newRatio);
  };

  const MiniView = ({ index, className = "" }: { index: number, className?: string }) => {
    const img = fullImages[index];
    const ratio = fullRatios[index];
    const viewDamages = damages.filter(d => d.imageIndex === index);
    
    const containerAspectClass = ratio === 'landscape' ? 'aspect-video' : 'aspect-[3/4]';
    
    return (
      <div 
        onClick={() => img && setExpandedIndex(index)}
        className={`relative ${containerAspectClass} bg-gray-50 border-2 border-dashed rounded-lg overflow-hidden group transition-all shadow-sm ${img ? 'cursor-pointer hover:border-blue-500 hover:ring-2 hover:ring-blue-100 border-solid' : 'cursor-default border-gray-300'} ${className}`}
      >
        {img ? (
          <>
            <img src={img} className="w-full h-full object-contain" alt={VIEW_LABELS[index]} referrerPolicy="no-referrer" />
            {viewDamages.map(d => (
              <div 
                key={d.id}
                className="absolute w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-white shadow-md -translate-x-1/2 -translate-y-1/2 z-10"
                style={{ left: `${d.x}%`, top: `${d.y}%` }}
              />
            ))}
            <div className="absolute top-1 left-1 bg-black/60 text-white text-[8px] px-1.5 rounded-sm font-bold uppercase z-10">
              {VIEW_LABELS[index]}
            </div>
            {viewDamages.length > 0 && (
              <div className="absolute bottom-1 right-1 bg-red-600 text-white text-[8px] px-1.5 rounded-sm font-bold z-10">
                {viewDamages.length}
              </div>
            )}
            
            <div className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none">
              <Maximize2 className="w-6 h-6 text-blue-600 drop-shadow-md" />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2 p-4 text-gray-400">
             <ImagePlus className="w-5 h-5 opacity-40" />
             <span className="text-[10px] font-black uppercase text-center tracking-widest">{VIEW_LABELS[index]}</span>
             <p className="text-[8px] font-bold text-gray-300 text-center leading-tight">CLIQUE NA CÂMERA<br/>PARA ADICIONAR</p>
          </div>
        )}

        {/* Controles: Upload e Proporção */}
        <div className="absolute top-1 right-1 flex flex-col gap-1.5 z-20 no-print">
            {/* Toggle Ratio */}
            <button 
                onClick={(e) => toggleRatio(index, e)}
                className="bg-white/95 hover:bg-blue-600 hover:text-white text-gray-600 p-1.5 rounded-lg shadow-md border border-gray-100 transition-all active:scale-90"
                title={ratio === 'landscape' ? "Alterar para Vertical" : "Alterar para Horizontal"}
            >
                {ratio === 'landscape' ? <RectangleVertical className="w-4 h-4" /> : <RectangleHorizontal className="w-4 h-4" />}
            </button>

            {/* Upload Camera */}
            <label 
              onClick={(e) => e.stopPropagation()} 
              className="bg-blue-600 text-white p-1.5 rounded-lg shadow-md cursor-pointer hover:bg-blue-700 transition-all active:scale-90"
              title={`Adicionar foto: ${VIEW_LABELS[index]}`}
            >
              <Camera className="w-4 h-4" />
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, index)} />
            </label>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* GRID DAS 5 IMAGENS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 print:grid-cols-3 gap-6 items-center">
        {/* LADO ESQUERDO */}
        <div className="flex flex-col gap-4">
          <MiniView index={0} /> {/* Dianteira */}
          <MiniView index={2} /> {/* Lateral Motorista */}
        </div>

        {/* CENTRO */}
        <div className="flex flex-col justify-center">
          <div className="p-2 bg-gray-50/50 rounded-2xl border border-gray-100 shadow-inner">
            <MiniView index={4} className="sm:scale-105" /> {/* Superior */}
          </div>
        </div>

        {/* LADO DIREITO */}
        <div className="flex flex-col gap-4">
          <MiniView index={1} /> {/* Traseira */}
          <MiniView index={3} /> {/* Lateral Comandante */}
        </div>
      </div>

      {/* MODO AMPLIADO */}
      {expandedIndex !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/90 backdrop-blur-sm no-print">
          <div className="bg-white w-full max-w-5xl rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-gray-800 flex items-center gap-2 uppercase tracking-wide">
                  <Maximize2 className="w-4 h-4 text-blue-600" />
                  Mapeando: {VIEW_LABELS[expandedIndex]}
                </h4>
                <p className="text-xs text-gray-500">
                  Toque na imagem para marcar o local da avaria
                </p>
              </div>
              <button 
                onClick={() => setExpandedIndex(null)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-green-100"
              >
                <CheckCircle2 className="w-4 h-4" /> Finalizar
              </button>
            </div>

            <div className="flex-1 overflow-auto bg-gray-100 flex items-center justify-center p-4 sm:p-8">
              <div 
                ref={zoomContainerRef}
                onClick={handleZoomClick}
                className="relative bg-white shadow-2xl rounded-lg overflow-hidden cursor-crosshair transition-all"
                style={{ 
                    width: '100%', 
                    maxWidth: fullRatios[expandedIndex] === 'landscape' ? '800px' : '500px', 
                    aspectRatio: fullRatios[expandedIndex] === 'landscape' ? '16/9' : '3/4' 
                }}
              >
                <img 
                  src={fullImages[expandedIndex]} 
                  className="w-full h-full object-contain pointer-events-none select-none"
                  alt="Zoom"
                  referrerPolicy="no-referrer"
                />
                {damages.filter(d => d.imageIndex === expandedIndex).map(damage => (
                  <button
                    key={damage.id}
                    className="absolute -translate-x-1/2 -translate-y-1/2 z-20 group outline-none"
                    style={{ left: `${damage.x}%`, top: `${damage.y}%` }}
                    onClick={(e) => { e.stopPropagation(); onRemoveDamage(damage.id); }}
                    aria-label="Remover avaria"
                  >
                    <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping"></span>
                    <div className="relative inline-flex items-center justify-center w-8 h-8 bg-red-600 rounded-full border-4 border-white shadow-xl cursor-pointer hover:bg-red-700 hover:scale-110 transition-all">
                      <span className="text-white font-bold text-sm">!</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
