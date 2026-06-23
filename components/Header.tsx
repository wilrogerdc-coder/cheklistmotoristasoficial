
import React from 'react';
import { Calendar } from 'lucide-react';

interface HeaderProps {
  title: string;
  date: string;
  onDateChange: (date: string) => void;
  logoUrl1?: string;
  logoUrl2?: string;
  bgColor?: string;
  vehicleType?: string;
  station?: string;
}

export const Header: React.FC<HeaderProps> = ({ 
  title, 
  date, 
  onDateChange, 
  logoUrl1, 
  logoUrl2, 
  bgColor,
  vehicleType,
  station 
}) => {
  const headerStyle = bgColor ? { backgroundColor: bgColor } : {};
  
  // Formata a data para exibição no PDF (DD/MM/AAAA)
  const formattedDate = date.split('-').reverse().join('/');
  
  return (
    <header 
      style={headerStyle}
      className={`p-3 print:p-4 shadow-md rounded-t-xl transition-colors ${!bgColor ? 'bg-red-700' : ''}`}
    >
      <div className="flex flex-col sm:flex-row print:flex-row items-start sm:items-center justify-between gap-3 print:gap-2">
        <div className="flex items-center gap-3 text-white">
          <div className="flex items-center gap-2">
            {logoUrl1 && (
              <div className="bg-white/10 p-1.5 rounded-lg flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 print:w-14 print:h-14">
                <img src={logoUrl1} alt="Logo 1" className="max-h-full max-w-full object-contain" referrerPolicy="no-referrer" />
              </div>
            )}

            {logoUrl2 && (
              <div className="bg-white/10 p-1.5 rounded-lg flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 print:w-14 print:h-14">
                <img src={logoUrl2} alt="Logo 2" className="max-h-full max-w-full object-contain" referrerPolicy="no-referrer" />
              </div>
            )}
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl print:text-xl font-bold leading-tight">{title}</h1>
            {(vehicleType || station) && (
              <div className="flex gap-2 mt-1">
                {station && <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-black uppercase">{station}</span>}
                {vehicleType && <span className="bg-black/20 px-2 py-0.5 rounded text-[10px] font-black uppercase text-white/80">{vehicleType}</span>}
              </div>
            )}
          </div>
        </div>

        {/* Input de data (escondido na impressão) */}
        <div className="text-left sm:text-right print:hidden bg-black/20 p-2 rounded-lg border border-white/20 min-w-[150px] flex items-center no-print">
          <div className="flex items-center gap-2 w-full">
            <Calendar className="w-3.5 h-3.5 text-white/40" />
            <input 
              type="date" 
              value={date} 
              onChange={(e) => onDateChange(e.target.value)}
              className="bg-transparent text-white text-sm font-bold outline-none border-b border-white/30 focus:border-white transition-colors cursor-pointer w-full text-center sm:text-right h-5"
            />
          </div>
        </div>

        {/* Exibição da data fixa apenas para o PDF */}
        <div className="hidden print:block text-right">
          <div className="text-[10px] uppercase font-bold text-white/70">Data da Inspeção</div>
          <div className="text-sm font-black text-white">{formattedDate}</div>
        </div>
      </div>
    </header>
  );
};
