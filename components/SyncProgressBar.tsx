import React, { useEffect, useState, useRef } from 'react';
import { 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Database, 
  Server, 
  X, 
  Zap, 
  ChevronDown, 
  ChevronUp, 
  Info,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { SyncProgressInfo } from '../types';

interface SyncProgressBarProps {
  info: SyncProgressInfo;
  onClose?: () => void;
  onRetry?: () => void;
}

export const SyncProgressBar: React.FC<SyncProgressBarProps> = ({ info, onClose, onRetry }) => {
  // Por padrão, a barra é minimalista (isExpanded = false)
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [elapsed, setElapsed] = useState<number>(0);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Cronômetro de alta precisão em tempo real enquanto sincroniza
  useEffect(() => {
    if (info.isActive && info.status === 'syncing') {
      startTimeRef.current = performance.now();
      setElapsed(0);

      const intervalId = window.setInterval(() => {
        if (startTimeRef.current) {
          const now = performance.now();
          setElapsed((now - startTimeRef.current) / 1000);
        }
      }, 50);

      timerRef.current = intervalId;

      return () => {
        window.clearInterval(intervalId);
      };
    } else if (info.status === 'completed' && info.totalTime !== undefined) {
      setElapsed(info.totalTime);
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
    }
  }, [info.isActive, info.status, info.totalTime]);

  // Fechamento suave no modo minimalista após conclusão (se o usuário não estiver com hover ou no modo expandido)
  useEffect(() => {
    if (info.status === 'completed' && !isHovered && !isExpanded && onClose) {
      const dismissTimeout = window.setTimeout(() => {
        onClose();
      }, 5000);

      return () => {
        window.clearTimeout(dismissTimeout);
      };
    }
  }, [info.status, isHovered, isExpanded, onClose]);

  if (!info.isActive) return null;

  const displayTotalTime = info.totalTime !== undefined ? info.totalTime.toFixed(2) : elapsed.toFixed(2);
  const displaySystemTime = info.systemTime !== undefined ? info.systemTime.toFixed(2) : null;
  const displayDataTime = info.dataTime !== undefined ? info.dataTime.toFixed(2) : null;

  return (
    <>
      {/* 1. Linha ultra-fina no topo do viewport para feedback imediato */}
      <div className="fixed top-0 left-0 right-0 h-1 z-[450] bg-gray-950/40 pointer-events-none">
        <div 
          className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 transition-all duration-200 shadow-[0_0_10px_rgba(59,130,246,0.8)]"
          style={{ width: `${Math.min(100, Math.max(0, info.progress))}%` }}
        />
      </div>

      {/* 2. BARRA DE SINCRONIZAÇÃO */}
      {!isExpanded ? (
        /* ========================================================
           MODO PADRÃO: BARRA MINIMALISTA (Compacta e discreta)
           ======================================================== */
        <div 
          className="fixed top-3 left-1/2 -translate-x-1/2 z-[440] max-w-[96vw] transition-all animate-in fade-in slide-in-from-top-2 duration-200 pointer-events-auto"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div className="bg-gray-950/95 backdrop-blur-md border border-gray-800 text-white rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.5)] px-3 py-1.5 flex items-center gap-2 sm:gap-3 transition-all hover:border-gray-700">
            {/* Ícone de status */}
            <div className="shrink-0 flex items-center justify-center">
              {info.status === 'completed' ? (
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              ) : info.status === 'error' ? (
                <div className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center">
                  <AlertCircle className="w-3.5 h-3.5" />
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                </div>
              )}
            </div>

            {/* Texto compacto da etapa */}
            <div className="min-w-0 flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-gray-200 truncate max-w-[130px] sm:max-w-[220px] md:max-w-[300px]">
                {info.status === 'completed' 
                  ? 'Sincronização Concluída' 
                  : (info.currentStep || info.title || 'Sincronizando...')}
              </span>
            </div>

            {/* Mini barra de progresso e porcentagem */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="w-10 sm:w-16 h-1.5 bg-gray-900 rounded-full overflow-hidden border border-gray-800">
                <div 
                  className={`h-full transition-all duration-200 ${
                    info.status === 'completed'
                      ? 'bg-emerald-400'
                      : info.status === 'error'
                      ? 'bg-rose-500'
                      : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, info.progress))}%` }}
                />
              </div>
              <span className="text-[10px] font-mono font-extrabold text-gray-300">
                {Math.round(info.progress)}%
              </span>
            </div>

            {/* Badge de tempo exato */}
            <div className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold flex items-center gap-1 shrink-0 border ${
              info.status === 'completed'
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60'
                : info.status === 'error'
                ? 'bg-rose-950/80 text-rose-300 border-rose-800/60'
                : 'bg-gray-900 text-blue-300 border-blue-900/60'
            }`}>
              <Clock className="w-2.5 h-2.5 text-current" />
              <span>{displayTotalTime}s</span>
            </div>

            {/* Botão para alternar e exibir informações completas */}
            <button
              onClick={() => setIsExpanded(true)}
              className="px-2 py-0.5 rounded-full bg-blue-950/70 hover:bg-blue-900/80 text-blue-300 border border-blue-800/50 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-xs shrink-0"
              title="Exibir informações completas de carregamento do sistema e dados"
            >
              <Info className="w-3 h-3 text-blue-400" />
              <span className="hidden xs:inline">Detalhes</span>
              <ChevronDown className="w-3 h-3 text-blue-400" />
            </button>

            {/* Botão de Fechar */}
            {onClose && (
              <button
                onClick={onClose}
                className="w-5 h-5 rounded-full bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="Fechar"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      ) : (
        /* ========================================================
           MODO EXPANDIDO: INFORMAÇÕES COMPLETAS (Visão Detalhada)
           ======================================================== */
        <div 
          className="fixed top-16 left-1/2 -translate-x-1/2 z-[440] w-[95%] max-w-xl mx-auto transition-all animate-in fade-in zoom-in-95 duration-200 pointer-events-auto"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div className="bg-gray-950/98 backdrop-blur-xl border border-gray-800 text-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] p-4 sm:p-5 relative overflow-hidden">
            {/* Efeito de brilho ambiente */}
            <div 
              className={`absolute -top-12 -right-12 w-36 h-36 rounded-full blur-3xl pointer-events-none transition-colors duration-500 ${
                info.status === 'completed' 
                  ? 'bg-emerald-500/20' 
                  : info.status === 'error' 
                  ? 'bg-rose-500/20' 
                  : 'bg-blue-500/20'
              }`} 
            />

            {/* Cabeçalho com Ícone, Título e Controles */}
            <div className="flex items-center justify-between gap-3 mb-3 relative z-10">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
                  info.status === 'completed'
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                    : info.status === 'error'
                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                    : 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                }`}>
                  {info.status === 'completed' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : info.status === 'error' ? (
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                  ) : (
                    <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white truncate">
                    {info.title || 'Sincronização de Dados & Sistema'}
                  </h4>
                  <p className="text-[10px] text-gray-400 font-medium truncate">
                    {info.status === 'completed' 
                      ? 'Sincronização finalizada com êxito' 
                      : info.status === 'error' 
                      ? 'Aviso na sincronização' 
                      : 'Carregamento de dados em tempo real'}
                  </p>
                </div>
              </div>

              {/* Botões de Ação do Cabeçalho */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Badge de Cronômetro Exato */}
                <div className={`px-2.5 py-1 rounded-xl text-[11px] font-mono font-bold flex items-center gap-1.5 border shadow-inner ${
                  info.status === 'completed'
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/50'
                    : info.status === 'error'
                    ? 'bg-rose-950/80 text-rose-300 border-rose-700/50'
                    : 'bg-gray-900 text-blue-300 border-blue-500/40'
                }`}>
                  <Clock className="w-3 h-3 text-current" />
                  <span>{displayTotalTime}s</span>
                </div>

                {/* Alternar para modo minimalista */}
                <button
                  onClick={() => setIsExpanded(false)}
                  className="px-2 py-1 rounded-xl bg-gray-900 hover:bg-gray-800 text-gray-300 hover:text-white flex items-center gap-1 transition-colors cursor-pointer border border-gray-800 text-[10px] font-bold"
                  title="Recolher para barra minimalista"
                >
                  <Minimize2 className="w-3.5 h-3.5 text-blue-400" />
                  <span className="hidden sm:inline">Minimalista</span>
                </button>

                {onClose && (
                  <button
                    onClick={onClose}
                    className="w-7 h-7 rounded-xl bg-gray-900/80 hover:bg-gray-800 text-gray-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-gray-800"
                    title="Fechar painel"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Barra de Progresso Visual Completa */}
            <div className="space-y-1.5 mb-3 relative z-10">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-gray-400">
                <span className="flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-400" /> Progresso da Sincronização
                </span>
                <span className="font-mono text-white text-[11px] font-extrabold">{Math.round(info.progress)}%</span>
              </div>

              <div className="w-full bg-gray-900/90 rounded-full h-2.5 p-0.5 border border-gray-800 overflow-hidden relative shadow-inner">
                <div 
                  className={`h-full rounded-full transition-all duration-300 ease-out relative overflow-hidden ${
                    info.status === 'completed'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                      : info.status === 'error'
                      ? 'bg-gradient-to-r from-rose-500 to-amber-500'
                      : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, info.progress))}%` }}
                >
                  {info.status === 'syncing' && (
                    <div className="absolute inset-0 bg-white/25 animate-pulse" />
                  )}
                </div>
              </div>
            </div>

            {/* Etapa Atual em Execução */}
            <div className="mb-3 p-2 rounded-xl bg-gray-900/70 border border-gray-800/80 text-[11px] font-medium text-gray-300 flex items-center gap-2 relative z-10">
              <div className={`w-2 h-2 rounded-full shrink-0 ${info.status === 'completed' ? 'bg-emerald-400' : 'bg-blue-400 animate-ping'}`} />
              <span className="truncate">{info.currentStep || 'Aguardando processamento...'}</span>
            </div>

            {/* Painel de Métricas Exatas de Tempo (Sistema vs Dados vs Total) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 relative z-10">
              {/* 1. Tempo de Carregamento Completo do Sistema */}
              <div className="bg-gray-900/90 border border-gray-800 rounded-xl p-2.5 flex flex-col justify-between">
                <div className="flex items-center gap-1.5 text-gray-400 text-[9px] font-black uppercase tracking-wider mb-1">
                  <Server className="w-3 h-3 text-indigo-400" />
                  <span>Carregamento Sistema</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs sm:text-sm font-mono font-black text-indigo-300">
                    {displaySystemTime ? `${displaySystemTime}s` : (info.status === 'syncing' ? '...' : `${displayTotalTime}s`)}
                  </span>
                  <span className="text-[8px] font-bold text-gray-500 uppercase">Config/Usuários</span>
                </div>
              </div>

              {/* 2. Tempo de Carregamento de Dados */}
              <div className="bg-gray-900/90 border border-gray-800 rounded-xl p-2.5 flex flex-col justify-between">
                <div className="flex items-center gap-1.5 text-gray-400 text-[9px] font-black uppercase tracking-wider mb-1">
                  <Database className="w-3 h-3 text-cyan-400" />
                  <span>Carregamento Dados</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs sm:text-sm font-mono font-black text-cyan-300">
                    {displayDataTime ? `${displayDataTime}s` : (info.status === 'syncing' ? '...' : `${displayTotalTime}s`)}
                  </span>
                  <span className="text-[8px] font-bold text-gray-500 uppercase">Logs/Justificativas</span>
                </div>
              </div>

              {/* 3. Tempo Total Exato */}
              <div className="bg-gray-900/90 border border-gray-800 rounded-xl p-2.5 flex flex-col justify-between">
                <div className="flex items-center gap-1.5 text-gray-400 text-[9px] font-black uppercase tracking-wider mb-1">
                  <Clock className="w-3 h-3 text-emerald-400" />
                  <span>Tempo Exato Total</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs sm:text-sm font-mono font-black text-emerald-400">
                    {displayTotalTime}s
                  </span>
                  <span className="text-[8px] font-bold text-emerald-500/80 uppercase">
                    {info.status === 'completed' ? 'Finalizado' : 'Em Curso'}
                  </span>
                </div>
              </div>
            </div>

            {/* Detalhes de Entidades Sincronizadas */}
            {info.details && (info.details.vehiclesCount !== undefined || info.details.logsCount !== undefined) && (
              <div className="mt-2.5 pt-2 border-t border-gray-800/80 flex flex-wrap items-center justify-between gap-2 text-[9px] font-bold text-gray-400 relative z-10">
                <div className="flex items-center gap-3">
                  {info.details.vehiclesCount !== undefined && (
                    <span>🚒 {info.details.vehiclesCount} Viaturas</span>
                  )}
                  {info.details.stationsCount !== undefined && (
                    <span>🏢 {info.details.stationsCount} Postos</span>
                  )}
                  {info.details.usersCount !== undefined && (
                    <span>👤 {info.details.usersCount} Usuários</span>
                  )}
                  {info.details.logsCount !== undefined && (
                    <span>📋 {info.details.logsCount} Conferências</span>
                  )}
                </div>
                <span className="text-emerald-400 font-bold">Banco de Dados Ativo</span>
              </div>
            )}

            {/* Rodapé do painel com botão para recolher */}
            <div className="mt-3 pt-2 border-t border-gray-800/60 flex items-center justify-between relative z-10">
              <span className="text-[9px] text-gray-500 font-medium">
                Padrão minimalista ativo ao iniciar novas sincronizações.
              </span>
              <button
                onClick={() => setIsExpanded(false)}
                className="text-[10px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>Recolher para barra minimalista</span>
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
