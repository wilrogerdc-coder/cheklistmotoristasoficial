
import React from 'react';

interface FooterProps {
  signatureName?: string;
  signatureRank?: string;
  date?: string;
  onSignatureNameChange?: (value: string) => void;
  onSignatureRankChange?: (value: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ 
  signatureName = '', 
  signatureRank = '', 
  date = '',
  onSignatureNameChange, 
  onSignatureRankChange 
}) => {
  // Formata a data para exibição (DD/MM/AAAA)
  const formattedDate = date ? date.split('-').reverse().join('/') : '';

  return (
    <footer className="mt-2 border-t pt-2 pb-1 print:mt-1 print:pt-1">
      <div className="flex flex-col items-center gap-2">
        {/* Exibição da Data no Rodapé */}
        {formattedDate && (
          <div className="text-center">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Data da Inspeção: </span>
            <span className="text-[10px] font-black text-gray-700">{formattedDate}</span>
          </div>
        )}

        <div className="w-full max-w-xs flex flex-col items-center">
          {/* Parte de Cima (Nome) - Simula a linha de assinatura com border-b */}
          <input 
            type="text" 
            value={signatureName}
            onChange={(e) => onSignatureNameChange?.(e.target.value)}
            placeholder="NOME COMPLETO"
            className="w-full text-center bg-transparent outline-none uppercase font-bold text-xs text-gray-800 placeholder:text-gray-300 border-b border-gray-800 pb-0.5 mb-0.5 focus:border-blue-500 transition-colors h-5"
          />
          
          {/* Parte de Baixo (Graduação / RE) */}
          <input 
            type="text" 
            value={signatureRank}
            onChange={(e) => onSignatureRankChange?.(e.target.value)}
            placeholder="GRADUAÇÃO / RE"
            className="w-full text-center bg-transparent outline-none uppercase text-[10px] font-bold text-gray-500 placeholder:text-gray-300 h-4"
          />
        </div>
      </div>
    </footer>
  );
};
