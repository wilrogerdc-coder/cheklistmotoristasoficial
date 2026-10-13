import React, { useMemo, useState } from "react";
import { LogEntry, AppSettings, Justification, Vehicle, MaintenanceAlert } from "../types";
import { 
  Shield, 
  MapPin, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Activity, 
  BarChart2, 
  TrendingUp, 
  ChevronRight,
  RefreshCw,
  Search,
  Check,
  List,
  Grid,
  Bell,
  Settings,
  Plus,
  Trash2,
  Calendar,
  X,
  FileText,
  Filter,
  Sparkles,
  Zap,
  Database
} from "lucide-react";

interface FleetDashboardProps {
  logs: LogEntry[];
  settings: AppSettings;
  justifications: Justification[];
  onRefresh: (options?: { forceAll?: boolean; targetMonth?: string; scope?: 'CURRENT_MONTH' | 'LAST_MONTH' | 'ALL' }) => void;
  isLoading?: boolean;
  lastSyncTime?: string;
  lastSyncDuration?: string;
  onOpenSyncInfo?: () => void;
  onUpdateVehicles?: (updatedVehicles: Vehicle[]) => void;
  onViewReport?: (prefix: string) => void;
  onViewWeekly?: (prefix: string) => void;
  onViewMirror?: (prefix: string) => void;
  recentSuccessMessage?: string | null;
  lastCompletedPrefix?: string | null;
  onClearSuccessMessage?: () => void;
}

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export const FleetDashboard: React.FC<FleetDashboardProps> = ({
  logs,
  settings,
  justifications,
  onRefresh,
  isLoading,
  lastSyncTime,
  lastSyncDuration,
  onOpenSyncInfo,
  onUpdateVehicles,
  onViewReport,
  onViewWeekly,
  onViewMirror,
  recentSuccessMessage,
  lastCompletedPrefix,
  onClearSuccessMessage
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterType, setFilterType] = useState<'ALL' | 'OK' | 'PENDENTE' | 'JUSTIFICATION' | 'CN'>('ALL');
  const [stationFilter, setStationFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [periodScope, setPeriodScope] = useState<'CURRENT_MONTH' | 'LAST_MONTH' | 'ALL'>('CURRENT_MONTH');
  const [selectedVehicleForAlerts, setSelectedVehicleForAlerts] = useState<Vehicle | null>(null);
  const [selectedVehicleForReport, setSelectedVehicleForReport] = useState<Vehicle | null>(null);
  
  // Alert creation state
  const [newAlert, setNewAlert] = useState<Partial<MaintenanceAlert>>({
    type: 'KM',
    description: '',
    status: 'ACTIVE'
  });

  // Helpers
  const normalizeText = (text: string) => String(text || "").trim().toUpperCase().replace(/[-\s]/g, "");
  
  const today = useMemo(() => {
    const d = new Date();
    return {
      day: d.getDate(),
      month: d.getMonth() + 1,
      year: d.getFullYear(),
      iso: d.toISOString().split("T")[0],
      pt: d.toLocaleDateString("pt-BR")
    };
  }, []);

  const parseDateToComps = (dateStr: string) => {
    if (!dateStr) return null;
    const s = String(dateStr).trim();
    if (s.includes("-")) {
      const parts = s.split("T")[0].split("-");
      if (parts.length === 3) return { y: parseInt(parts[0]), m: parseInt(parts[1]), d: parseInt(parts[2]) };
    } else if (s.includes("/")) {
      const parts = s.split("/");
      if (parts.length >= 3) return { y: parseInt(parts[2]), m: parseInt(parts[1]), d: parseInt(parts[0]) };
    }
    return null;
  };

  const lastMonthInfo = useMemo(() => {
    const d = new Date(today.year, today.month - 2, 1);
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      name: MONTH_NAMES[d.getMonth()]
    };
  }, [today]);

  const daysInLastMonth = useMemo(() => {
    return new Date(lastMonthInfo.year, lastMonthInfo.month, 0).getDate();
  }, [lastMonthInfo]);

  const isToday = (dateStr: string) => {
    const comps = parseDateToComps(dateStr);
    if (!comps) return false;
    return comps.y === today.year && comps.m === today.month && comps.d === today.day;
  };

  const isCurrentMonth = (dateStr: string) => {
    const comps = parseDateToComps(dateStr);
    if (!comps) return false;
    return comps.y === today.year && comps.m === today.month;
  };

  // Pre-indexação de alta performance em O(N) para carregamento e filtragem instantâneos
  const { logsByVehicle, justificationsByVehicle, currentMonthLogsCount, totalLogsCount } = useMemo(() => {
    const logsMap = new Map<string, Array<{
      log: LogEntry;
      y: number;
      m: number;
      d: number;
      kmNum: number;
      isToday: boolean;
      isCurrentMonth: boolean;
      isLastMonth: boolean;
      hasNovelty: boolean;
    }>>();

    let curCount = 0;

    for (let i = 0; i < logs.length; i++) {
      const l = logs[i];
      const comps = parseDateToComps(l.date);
      if (!comps) continue;
      const prefixNorm = normalizeText(l.prefix);
      const kmNum = parseInt(l.km, 10);
      const isTodayLog = comps.y === today.year && comps.m === today.month && comps.d === today.day;
      const isCurMonth = comps.y === today.year && comps.m === today.month;
      const isLastMonth = comps.y === lastMonthInfo.year && comps.m === lastMonthInfo.month;
      
      if (isCurMonth) curCount++;

      let arr = logsMap.get(prefixNorm);
      if (!arr) {
        arr = [];
        logsMap.set(prefixNorm, arr);
      }
      arr.push({
        log: l,
        y: comps.y,
        m: comps.m,
        d: comps.d,
        kmNum: isNaN(kmNum) ? 0 : kmNum,
        isToday: isTodayLog,
        isCurrentMonth: isCurMonth,
        isLastMonth: isLastMonth,
        hasNovelty: l.itemsStatus?.includes("CN") || false
      });
    }

    const justMap = new Map<string, Array<{ y: number; m: number; d: number }>>();
    for (let i = 0; i < justifications.length; i++) {
      const j = justifications[i];
      const prefixNorm = normalizeText(j.vehicleType || j.station);
      const comps = parseDateToComps(j.date || (j as any).dateRef);
      if (!comps) continue;
      let arr = justMap.get(prefixNorm);
      if (!arr) {
        arr = [];
        justMap.set(prefixNorm, arr);
      }
      arr.push(comps);
    }

    return {
      logsByVehicle: logsMap,
      justificationsByVehicle: justMap,
      currentMonthLogsCount: curCount,
      totalLogsCount: logs.length
    };
  }, [logs, justifications, today, lastMonthInfo]);

  // Cálculo ágil de KM rodado no período
  const getKmDriven = (prefixNorm: string, targetYear: number, targetMonth: number) => {
    const vLogs = logsByVehicle.get(prefixNorm);
    if (!vLogs || vLogs.length === 0) return 0;

    const monthLogs = vLogs.filter(l => l.y === targetYear && l.m === targetMonth);
    if (monthLogs.length === 0) return 0;

    const maxKm = Math.max(...monthLogs.map(l => l.kmNum));
    const logsBefore = vLogs.filter(l => l.y < targetYear || (l.y === targetYear && l.m < targetMonth));

    if (logsBefore.length > 0) {
      const lastKmBefore = Math.max(...logsBefore.map(l => l.kmNum));
      return Math.max(0, maxKm - lastKmBefore);
    } else {
      const minKm = Math.min(...monthLogs.map(l => l.kmNum));
      return Math.max(0, maxKm - minKm);
    }
  };

  const stationsData = useMemo(() => {
    const stationMap: Record<string, { id?: string, name: string, vehicles: any[] }> = {};
    
    if (settings.stations) {
      settings.stations.forEach(s => {
        stationMap[normalizeText(s.name)] = { id: s.id, name: s.name, vehicles: [] };
      });
    }
    
    const unassignedStationKey = "SEM_POSTO";
    stationMap[unassignedStationKey] = { name: "Sem Posto Definido", vehicles: [] };

    const normSearch = normalizeText(searchQuery);

    settings.vehicles?.forEach(v => {
      const vehiclePrefix = normalizeText(v.prefix);
      const vehiclePlate = normalizeText(v.plate);
      const vehicleType = normalizeText(v.type || (v as any).model || "");
      const stationKey = v.station ? normalizeText(v.station) : unassignedStationKey;

      // Filtro de busca instantâneo (Placa, Prefixo ou Tipo)
      if (normSearch) {
        const matchPrefix = vehiclePrefix.includes(normSearch);
        const matchPlate = vehiclePlate.includes(normSearch);
        const matchType = vehicleType.includes(normSearch);
        if (!matchPrefix && !matchPlate && !matchType) return;
      }
      
      if (!stationMap[stationKey]) {
        stationMap[stationKey] = { name: v.station || "Outros", vehicles: [] };
      }

      const vLogs = logsByVehicle.get(vehiclePrefix) || [];
      const logTodayEntry = vLogs.find(l => l.isToday);
      const logToday = logTodayEntry?.log;
      const currentKm = logToday ? logTodayEntry.kmNum : (vLogs.length > 0 ? Math.max(...vLogs.map(l => l.kmNum)) : 0);
      const hasNovelty = logTodayEntry?.hasNovelty || false;
      const vJusts = justificationsByVehicle.get(vehiclePrefix) || [];

      let pendingDays = 0;
      let statusVehicle: "CONFERIDA" | "PENDENTE" = "PENDENTE";
      let periodSummary = "";

      // Manter a contagem de KM do mês atual e anterior exatamente como já é feito
      const kmCurrentMonth = getKmDriven(vehiclePrefix, today.year, today.month);
      const kmLastMonth = getKmDriven(vehiclePrefix, lastMonthInfo.year, lastMonthInfo.month);

      if (periodScope === 'CURRENT_MONTH') {
        const logDaysSet = new Set(vLogs.filter(l => l.isCurrentMonth).map(l => l.d));
        const justDaysSet = new Set(
          vJusts.filter(j => j.y === today.year && j.m === today.month).map(j => j.d)
        );

        for (let d = 1; d <= today.day; d++) {
          if (!logDaysSet.has(d) && !justDaysSet.has(d)) {
            pendingDays++;
          }
        }
        statusVehicle = !!logToday ? "CONFERIDA" : "PENDENTE";
        periodSummary = `${logDaysSet.size} conferências em ${today.day} dias (Mês Atual)`;
      } else if (periodScope === 'LAST_MONTH') {
        const lastMonthLogs = vLogs.filter(l => l.y === lastMonthInfo.year && l.m === lastMonthInfo.month);
        const lastMonthLogDaysSet = new Set(lastMonthLogs.map(l => l.d));
        const lastMonthJustDaysSet = new Set(
          vJusts.filter(j => j.y === lastMonthInfo.year && j.m === lastMonthInfo.month).map(j => j.d)
        );

        for (let d = 1; d <= daysInLastMonth; d++) {
          if (!lastMonthLogDaysSet.has(d) && !lastMonthJustDaysSet.has(d)) {
            pendingDays++;
          }
        }
        statusVehicle = (pendingDays === 0 && lastMonthLogDaysSet.size > 0) ? "CONFERIDA" : "PENDENTE";
        periodSummary = `${lastMonthLogDaysSet.size} de ${daysInLastMonth} dias conferidos (${lastMonthInfo.name})`;
      } else {
        // Todo o Histórico
        const logDaysSet = new Set(vLogs.filter(l => l.isCurrentMonth).map(l => l.d));
        const justDaysSet = new Set(
          vJusts.filter(j => j.y === today.year && j.m === today.month).map(j => j.d)
        );

        for (let d = 1; d <= today.day; d++) {
          if (!logDaysSet.has(d) && !justDaysSet.has(d)) {
            pendingDays++;
          }
        }
        statusVehicle = !!logToday ? "CONFERIDA" : "PENDENTE";
        periodSummary = `${vLogs.length} checklists no histórico total`;
      }

      // Filtro de Posto
      if (stationFilter !== 'ALL' && v.station !== stationFilter) return;

      // Filtro de Status
      if (filterType === 'OK' && statusVehicle !== 'CONFERIDA') return;
      if (filterType === 'PENDENTE' && statusVehicle !== 'PENDENTE') return;
      if (filterType === 'JUSTIFICATION' && pendingDays === 0) return;
      if (filterType === 'CN' && (!hasNovelty || statusVehicle !== 'CONFERIDA')) return;

      const activeAlerts = v.alerts?.filter(a => {
        if (a.status !== 'ACTIVE') return false;
        if (a.type === 'KM' && a.targetKm && currentKm > 0) {
          return (a.targetKm - currentKm) <= (a.warnKmBefore || 0);
        }
        if (a.type === 'DATE' && a.targetDate) {
           const target = new Date(a.targetDate);
           const diff = (target.getTime() - new Date().getTime()) / (1000 * 3600 * 24);
           return diff <= (a.warnDaysBefore || 0);
        }
        return false;
      }) || [];

      stationMap[stationKey].vehicles.push({
        ...v,
        logToday,
        pendingDays,
        currentKm,
        statusToday: statusVehicle,
        hasNovelty,
        activeAlertsCount: activeAlerts.length,
        hasAlerts: activeAlerts.length > 0,
        kmCurrentMonth,
        kmLastMonth,
        periodSummary,
        monthLogsCount: vLogs.filter(l => l.isCurrentMonth).length
      });
    });

    return Object.values(stationMap).filter(s => s.vehicles.length > 0).sort((a, b) => {
      const nameA = a.name.toUpperCase();
      const nameB = b.name.toUpperCase();
      if (nameA === "PB") return -1;
      if (nameB === "PB") return 1;
      return nameA.localeCompare(nameB);
    });
  }, [
    settings, 
    logsByVehicle, 
    justificationsByVehicle, 
    today, 
    lastMonthInfo, 
    daysInLastMonth,
    periodScope,
    searchQuery, 
    stationFilter, 
    filterType
  ]);

  const stats = useMemo(() => {
    const allRawVehicles = settings.vehicles || [];
    const filteredVehicles = allRawVehicles.filter(v => stationFilter === 'ALL' || v.station === stationFilter);
    
    let totalKmLastMonth = 0;
    let totalKmCurrentMonth = 0;

    const processedAll = filteredVehicles.map(v => {
      const prefix = normalizeText(v.prefix);
      const vLogs = logsByVehicle.get(prefix) || [];
      const logTodayEntry = vLogs.find(l => l.isToday);
      const vJusts = justificationsByVehicle.get(prefix) || [];

      let pendingDays = 0;
      let statusVehicle: "CONFERIDA" | "PENDENTE" = "PENDENTE";

      if (periodScope === 'CURRENT_MONTH') {
        const logDaysSet = new Set(vLogs.filter(l => l.isCurrentMonth).map(l => l.d));
        const justDaysSet = new Set(
          vJusts.filter(j => j.y === today.year && j.m === today.month).map(j => j.d)
        );

        for (let d = 1; d <= today.day; d++) {
          if (!logDaysSet.has(d) && !justDaysSet.has(d)) pendingDays++;
        }
        statusVehicle = !!logTodayEntry ? "CONFERIDA" : "PENDENTE";
      } else if (periodScope === 'LAST_MONTH') {
        const lastMonthLogs = vLogs.filter(l => l.y === lastMonthInfo.year && l.m === lastMonthInfo.month);
        const lastMonthLogDaysSet = new Set(lastMonthLogs.map(l => l.d));
        const lastMonthJustDaysSet = new Set(
          vJusts.filter(j => j.y === lastMonthInfo.year && j.m === lastMonthInfo.month).map(j => j.d)
        );

        for (let d = 1; d <= daysInLastMonth; d++) {
          if (!lastMonthLogDaysSet.has(d) && !lastMonthJustDaysSet.has(d)) pendingDays++;
        }
        statusVehicle = (pendingDays === 0 && lastMonthLogDaysSet.size > 0) ? "CONFERIDA" : "PENDENTE";
      } else {
        // Todo o Histórico
        const logDaysSet = new Set(vLogs.filter(l => l.isCurrentMonth).map(l => l.d));
        const justDaysSet = new Set(
          vJusts.filter(j => j.y === today.year && j.m === today.month).map(j => j.d)
        );

        for (let d = 1; d <= today.day; d++) {
          if (!logDaysSet.has(d) && !justDaysSet.has(d)) pendingDays++;
        }
        statusVehicle = !!logTodayEntry ? "CONFERIDA" : "PENDENTE";
      }

      totalKmLastMonth += getKmDriven(prefix, lastMonthInfo.year, lastMonthInfo.month);
      totalKmCurrentMonth += getKmDriven(prefix, today.year, today.month);

      return { 
        ...v, 
        statusToday: statusVehicle,
        hasNovelty: logTodayEntry?.hasNovelty || false,
        pendingDays
      };
    });

    return {
      total: processedAll.length,
      ok: processedAll.filter(v => v.statusToday === "CONFERIDA" && !v.hasNovelty).length,
      cn: processedAll.filter(v => v.statusToday === "CONFERIDA" && v.hasNovelty).length,
      done: processedAll.filter(v => v.statusToday === "CONFERIDA").length,
      pending: processedAll.filter(v => v.statusToday === "PENDENTE").length,
      justification: processedAll.filter(v => v.pendingDays > 0).length,
      compliance: processedAll.length > 0 ? Math.round(((processedAll.filter(v => v.statusToday === "CONFERIDA").length) / processedAll.length) * 100) : 0,
      kmLastMonth: totalKmLastMonth,
      kmCurrentMonth: totalKmCurrentMonth
    };
  }, [settings, stationFilter, logsByVehicle, justificationsByVehicle, today, lastMonthInfo, daysInLastMonth, periodScope]);

  const handleAddAlert = () => {
    if (!selectedVehicleForAlerts || !newAlert.description) return;
    const alert: MaintenanceAlert = {
      id: crypto.randomUUID(),
      type: newAlert.type as any,
      description: newAlert.description,
      targetKm: newAlert.targetKm,
      warnKmBefore: newAlert.warnKmBefore,
      targetDate: newAlert.targetDate,
      warnDaysBefore: newAlert.warnDaysBefore,
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };
    
    const updatedVehicles = (settings.vehicles || []).map(v => 
      v.id === selectedVehicleForAlerts.id ? { ...v, alerts: [...(v.alerts || []), alert] } : v
    );
    onUpdateVehicles?.(updatedVehicles);
    setSelectedVehicleForAlerts(updatedVehicles.find(v => v.id === selectedVehicleForAlerts.id) || null);
    setNewAlert({ type: 'KM', description: '', status: 'ACTIVE' });
  };

  const handleDeleteAlert = (alertId: string) => {
    if (!selectedVehicleForAlerts) return;
    const updatedVehicles = (settings.vehicles || []).map(v => 
      v.id === selectedVehicleForAlerts.id ? { ...v, alerts: (v.alerts || []).filter(a => a.id !== alertId) } : v
    );
    onUpdateVehicles?.(updatedVehicles);
    setSelectedVehicleForAlerts(updatedVehicles.find(v => v.id === selectedVehicleForAlerts.id) || null);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Banner de Feedback Ágil de Conferência Realizada */}
      {recentSuccessMessage && (
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-[2rem] p-5 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-600/20">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-black uppercase text-emerald-950 tracking-tight">
                  Conferência Finalizada com Sucesso!
                </h4>
                {lastCompletedPrefix && (
                  <span className="bg-emerald-600 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-lg shadow-xs">
                    Viatura {lastCompletedPrefix}
                  </span>
                )}
              </div>
              <p className="text-xs text-emerald-800 font-bold mt-0.5">
                {recentSuccessMessage}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            {lastCompletedPrefix && onViewMirror && (
              <button
                onClick={() => onViewMirror(lastCompletedPrefix)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 shadow hover:shadow-md transition-all cursor-pointer active:scale-95"
              >
                <FileText className="w-4 h-4" />
                <span>Ver Espelho / PDF</span>
              </button>
            )}
            {onClearSuccessMessage && (
              <button
                onClick={onClearSuccessMessage}
                className="p-2 text-emerald-600 hover:text-emerald-950 hover:bg-emerald-100 rounded-xl transition-colors cursor-pointer"
                title="Dispensar aviso"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Header Dashboard */}
      <div className="bg-white border rounded-[2.5rem] p-6 md:p-8 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 bg-blue-50 rounded-full blur-3xl opacity-60"></div>
        
        {/* Barra Superior com Título e Ações Ágeis */}
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-4 rounded-3xl text-white shadow-xl shadow-blue-500/20">
              <BarChart2 className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-black uppercase text-gray-900 tracking-tight">
                  Dashboard de Prontidão
                </h2>
                <span className="bg-blue-50 text-blue-700 text-[10px] font-black uppercase px-2.5 py-1 rounded-xl border border-blue-100 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Mês Atual: {MONTH_NAMES[today.month - 1]}/{today.year}
                </span>
              </div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1 flex items-center gap-2 flex-wrap">
                <span>Referência: {today.pt}</span>
                <span>•</span>
                <span className="text-gray-600">{currentMonthLogsCount} conferências registradas neste mês</span>
              </p>
            </div>
          </div>

          {/* Controles de Filtragem Rápida e Botão de Atualização Ágil */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-start lg:justify-end">
             {/* Campo de Busca Rápida */}
             <div className="relative flex-1 sm:w-56">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar viatura ou placa..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-gray-100 pl-9 pr-8 py-2.5 rounded-2xl text-xs font-bold uppercase placeholder:text-gray-400 border border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                    title="Limpar busca"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
             </div>

             {/* Seletor de Modo Grid/Lista */}
             <div className="flex bg-gray-100 p-1 rounded-2xl border border-gray-200">
                <button 
                  onClick={() => setViewMode('grid')} 
                  title="Visualização em Grade"
                  className={`p-2 rounded-xl transition-all cursor-pointer ${viewMode === 'grid' ? 'bg-white shadow-md text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setViewMode('list')} 
                  title="Visualização em Lista"
                  className={`p-2 rounded-xl transition-all cursor-pointer ${viewMode === 'list' ? 'bg-white shadow-md text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <List className="w-4 h-4" />
                </button>
             </div>

             {/* Seletor de Posto */}
             <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-2xl border border-gray-200">
               <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">POSTO:</span>
               <select 
                 value={stationFilter}
                 onChange={(e) => setStationFilter(e.target.value)}
                 className="bg-white border-none rounded-xl text-[10px] font-black uppercase py-1.5 px-3 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer"
               >
                 <option value="ALL">TODOS OS POSTOS</option>
                 {[...(settings.stations || [])].sort((a,b) => {
                   const nameA = a.name.toUpperCase();
                   const nameB = b.name.toUpperCase();
                   if (nameA === 'PB') return -1;
                   if (nameB === 'PB') return 1;
                   return nameA.localeCompare(nameB);
                 }).map((s, idx) => (
                   <option key={`${s.id}-${idx}`} value={s.name}>{s.name.toUpperCase()}</option>
                 ))}
                 <option value="">SEM POSTO</option>
               </select>
             </div>

             {/* Botão de Atualização Ágil com Feedback de Sincronização */}
             <div className="flex flex-col items-end">
               <div className="flex items-center gap-2">
                 <button
                   onClick={() => onRefresh(periodScope === 'ALL' ? { forceAll: true, scope: 'ALL' } : { scope: periodScope })}
                   disabled={isLoading}
                   className="bg-gray-900 hover:bg-black text-white px-5 py-2.5 rounded-2xl text-xs font-black uppercase flex items-center gap-2 shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50 cursor-pointer group"
                   title="Atualização rápida em tempo real (últimos 3 meses ou histórico)"
                 >
                   <RefreshCw className={`w-4 h-4 text-emerald-400 group-hover:text-emerald-300 transition-colors ${isLoading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                   <span>{isLoading ? 'Sincronizando...' : (periodScope === 'ALL' ? 'Atualizar Histórico' : 'Atualizar Dados (3 Meses)')}</span>
                 </button>
                 {periodScope !== 'ALL' && (
                   <button
                     onClick={() => {
                       setPeriodScope('ALL');
                       onRefresh({ forceAll: true, scope: 'ALL' });
                     }}
                     disabled={isLoading}
                     className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-3 py-2.5 rounded-2xl text-[10px] font-black uppercase flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
                     title="Carregar todo o histórico do banco de dados"
                   >
                     <Database className="w-3.5 h-3.5 text-amber-600" />
                     <span className="hidden sm:inline">Histórico Completo</span>
                   </button>
                 )}
               </div>
               {lastSyncTime ? (
                 <button 
                   onClick={() => {
                     if (onOpenSyncInfo) onOpenSyncInfo();
                   }}
                   className="text-[9px] font-bold text-gray-400 mt-1 flex items-center gap-1 hover:text-blue-500 transition-colors cursor-pointer text-left"
                   title="Clique para ver métricas e barra de sincronização"
                 >
                   <Clock className="w-2.5 h-2.5 text-blue-500" /> Sincronizado às {lastSyncTime} {lastSyncDuration ? `• Carregado em ${lastSyncDuration}` : ''} {periodScope === 'ALL' ? '• Histórico Completo' : '• 3 Meses'}
                 </button>
               ) : (
                 <span className="text-[9px] font-bold text-emerald-600 mt-1 flex items-center gap-1">
                   <Zap className="w-2.5 h-2.5" /> Modo Ágil (3 Meses) ativo
                 </span>
               )}
             </div>
          </div>
        </div>

        {/* Barra de Filtro de Período Ágil */}
        <div className="mt-6 pt-5 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider flex items-center gap-1">
              <Filter className="w-3 h-3 text-blue-500" /> Período em Foco:
            </span>
            <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
              <button
                onClick={() => {
                  setPeriodScope('CURRENT_MONTH');
                  onRefresh({ scope: 'CURRENT_MONTH' });
                }}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                  periodScope === 'CURRENT_MONTH'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Mês Atual ({MONTH_NAMES[today.month - 1]})
              </button>
              <button
                onClick={() => {
                  setPeriodScope('LAST_MONTH');
                  onRefresh({ scope: 'LAST_MONTH' });
                }}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                  periodScope === 'LAST_MONTH'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Mês Anterior ({lastMonthInfo.name})
              </button>
              <button
                onClick={() => {
                  setPeriodScope('ALL');
                  onRefresh({ forceAll: true, scope: 'ALL' });
                }}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                  periodScope === 'ALL'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Todo o Histórico
              </button>
            </div>
          </div>

          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tight flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Registros Carregados: <strong className="text-gray-700">{totalLogsCount}</strong></span>
          </div>
        </div>

        {/* Quick Stats Grid - Interactive */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-6">
          <div 
            onClick={() => setFilterType('ALL')}
            className={`cursor-pointer p-6 rounded-3xl border-2 transition-all ${filterType === 'ALL' ? 'bg-blue-50 border-blue-500 shadow-md scale-105' : 'bg-white border-gray-100 hover:border-blue-200'}`}
          >
            <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Frota Total</p>
            <div className="flex items-end justify-between mt-1">
              <p className="text-3xl font-black text-blue-900">{stats.total}</p>
              <Shield className="w-4 h-4 text-blue-400" />
            </div>
          </div>

          <div 
            onClick={() => setFilterType('ALL')}
            className="hidden lg:block p-6 rounded-3xl border-2 bg-gray-50 border-gray-100 opacity-60"
          >
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Prontidão Hoje</p>
            <div className="flex items-end justify-center mt-1">
              <p className="text-3xl font-black text-gray-900">{stats.compliance}%</p>
            </div>
          </div>
          
          <div 
            onClick={() => setFilterType('OK')}
            className={`cursor-pointer p-6 rounded-3xl border-2 transition-all ${filterType === 'OK' ? 'bg-green-50 border-green-500 shadow-md scale-105' : 'bg-white border-gray-100 hover:border-green-200'}`}
          >
            <p className="text-[10px] font-black text-green-500 uppercase tracking-widest">Conferidas</p>
            <div className="flex items-end justify-between mt-1">
              <p className="text-3xl font-black text-green-900">{stats.done}</p>
              <CheckCircle className="w-4 h-4 text-green-400" />
            </div>
          </div>

          <div 
            onClick={() => setFilterType('PENDENTE')}
            className={`cursor-pointer p-6 rounded-3xl border-2 transition-all ${filterType === 'PENDENTE' ? 'bg-red-50 border-red-500 shadow-md scale-105' : 'bg-white border-gray-100 hover:border-red-200'}`}
          >
            <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">Pendentes</p>
            <div className="flex items-end justify-between mt-1">
              <p className="text-3xl font-black text-red-900">{stats.pending}</p>
              <Clock className="w-4 h-4 text-red-400" />
            </div>
          </div>

          <div 
            onClick={() => setFilterType('JUSTIFICATION')}
            className={`cursor-pointer p-6 rounded-3xl border-2 transition-all ${filterType === 'JUSTIFICATION' ? 'bg-indigo-50 border-indigo-500 shadow-md scale-105' : 'bg-white border-gray-100 hover:border-indigo-200'}`}
          >
            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Justificativas</p>
            <div className="flex items-end justify-between mt-1">
              <p className="text-3xl font-black text-indigo-900">{stats.justification}</p>
              <Activity className="w-4 h-4 text-indigo-400" />
            </div>
          </div>

          <div 
            className="p-6 rounded-3xl border-2 bg-rose-50 border-rose-100"
          >
            <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Km (Mês Atual)</p>
            <div className="flex items-end justify-between mt-1">
              <p className="text-2xl font-black text-rose-900">{stats.kmCurrentMonth.toLocaleString()}</p>
              <TrendingUp className="w-4 h-4 text-rose-400" />
            </div>
          </div>

          <div 
            className="p-6 rounded-3xl border-2 bg-amber-50 border-amber-100"
          >
            <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Km (Mês Ant.)</p>
            <div className="flex items-end justify-between mt-1">
              <p className="text-2xl font-black text-amber-900">{stats.kmLastMonth.toLocaleString()}</p>
              <TrendingUp className="w-4 h-4 text-amber-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Stations Breakdown */}
      <div className="space-y-10">
        {stationsData.map((station, sIdx) => (
          <div key={`${station.id || station.name}-${sIdx}`} className="animate-in slide-in-from-bottom-4 duration-700" style={{ animationDelay: `${sIdx * 100}ms` }}>
            <div className="flex items-center gap-3 mb-4 px-4">
              <div className="bg-gray-100 p-2 rounded-xl text-gray-400">
                <MapPin className="w-5 h-5 transition-transform hover:rotate-12" />
              </div>
              <h3 className="text-lg font-black uppercase text-gray-800 tracking-tight">
                {station.name}
              </h3>
              <div className="h-[2px] flex-1 bg-gray-100 ml-2"></div>
              <span className="text-[10px] font-black uppercase text-gray-400 px-3 py-1 bg-white border rounded-full shadow-sm">
                Showing {station.vehicles.length}
              </span>
            </div>

            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {station.vehicles.map((v, vIdx) => {
                  const isConferida = v.statusToday === "CONFERIDA";
                  return (
                    <div 
                      key={`${v.id || v.prefix}-${vIdx}`} 
                      className={`border-2 rounded-[2rem] p-6 transition-all hover:shadow-xl relative group ${
                        isConferida
                          ? "bg-emerald-100/95 border-emerald-400 text-emerald-950 shadow-sm hover:border-emerald-600"
                          : "bg-red-100/95 border-red-400 text-red-950 shadow-sm hover:border-red-600"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-5">
                        <div>
                          <span className="text-[9px] font-black uppercase tracking-widest block mb-1 opacity-70">Viatura</span>
                          <h4 
                            onClick={() => setSelectedVehicleForReport(v)}
                            className="text-2xl font-black uppercase tracking-tighter flex items-center gap-2 cursor-pointer hover:underline transition-all text-gray-900"
                          >
                            {v.prefix}
                          </h4>
                          <span className="text-[10px] font-bold uppercase opacity-80">{v.plate || v.type}</span>
                        </div>
                        <div className="flex flex-col gap-2">
                          <div className={`p-2.5 rounded-xl text-white shadow-md ${
                            isConferida 
                              ? "bg-emerald-700 shadow-emerald-200" 
                              : "bg-red-600 shadow-red-200"
                          }`}>
                            {isConferida ? <Check className="w-4 h-4 stroke-[3]" /> : <Clock className="w-4 h-4 stroke-[3]" />}
                          </div>
                          <button 
                            onClick={() => setSelectedVehicleForAlerts(v)}
                            className={`p-2 rounded-xl transition-all cursor-pointer ${v.hasAlerts ? 'bg-red-500 text-white shadow-xs' : 'bg-white/80 text-gray-600 hover:bg-white'}`}
                          >
                            <Bell className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-[10px] font-black uppercase border-b border-black/10 pb-2.5">
                          <span className="opacity-70">
                            {periodScope === 'LAST_MONTH' ? lastMonthInfo.name : (periodScope === 'ALL' ? 'Histórico' : 'Hoje')}
                          </span>
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase shadow-xs flex items-center gap-1 ${
                            isConferida 
                              ? (v.hasNovelty ? 'bg-emerald-800 text-white' : 'bg-emerald-700 text-white')
                              : 'bg-red-700 text-white'
                          }`}>
                            {isConferida ? (v.hasNovelty ? "CONFERIDA C/N" : "CONFERIDA") : "PENDENTE"}
                          </span>
                        </div>

                        <div className="flex justify-between items-center bg-white/90 backdrop-blur-xs p-2.5 rounded-2xl border border-black/5 shadow-xs">
                           <div className="flex flex-col">
                              <span className="text-[9px] font-black text-gray-500 uppercase">Km Atual</span>
                              <span className="text-sm font-black text-gray-900">{v.currentKm || '---'}</span>
                           </div>
                           <div className="text-right flex flex-col">
                              <span className="text-[9px] font-black text-gray-500 uppercase">
                                {periodScope === 'LAST_MONTH' ? 'Pend. Mês Ant.' : 'Pendências'}
                              </span>
                              <span className={`text-sm font-black ${v.pendingDays > 0 ? 'text-red-700' : 'text-emerald-800'}`}>
                                {v.pendingDays} D
                              </span>
                           </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className={`p-2 rounded-xl bg-white/90 backdrop-blur-xs border border-black/5 shadow-xs ${periodScope === 'CURRENT_MONTH' ? 'ring-2 ring-blue-500/40' : ''}`}>
                            <span className="text-[8px] font-black text-gray-500 uppercase block">KM Mês Atual</span>
                            <span className="text-[12px] font-black text-blue-700">+{v.kmCurrentMonth.toLocaleString()}</span>
                          </div>
                          <div className={`p-2 rounded-xl bg-white/90 backdrop-blur-xs border border-black/5 shadow-xs ${periodScope === 'LAST_MONTH' ? 'ring-2 ring-amber-500/40' : ''}`}>
                            <span className="text-[8px] font-black text-gray-500 uppercase block">KM Mês Ant.</span>
                            <span className="text-[12px] font-black text-gray-800">{v.kmLastMonth.toLocaleString()}</span>
                          </div>
                        </div>

                        {v.periodSummary && (
                          <div className="text-[9px] font-bold opacity-75 text-center pt-1">
                            {v.periodSummary}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white border rounded-[2rem] overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Viatura</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Placa</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Status</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Km Atual</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Km Mês / Ant.</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Pendências</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Alertas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {station.vehicles.map((v, vIdx) => {
                      const isConferida = v.statusToday === 'CONFERIDA';
                      return (
                        <tr key={`${v.id || v.prefix}-${vIdx}`} className={`transition-colors border-b ${
                          isConferida 
                            ? 'bg-emerald-100/70 hover:bg-emerald-200/80 border-emerald-200 text-emerald-950' 
                            : 'bg-red-100/70 hover:bg-red-200/80 border-red-200 text-red-950'
                        }`}>
                          <td className="px-6 py-4 font-black uppercase text-gray-900 cursor-pointer hover:underline" onClick={() => setSelectedVehicleForReport(v)}>{v.prefix}</td>
                          <td className="px-6 py-4 font-mono text-xs font-bold">{v.plate}</td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase shadow-xs ${
                              isConferida ? (v.hasNovelty ? 'bg-emerald-800 text-white' : 'bg-emerald-700 text-white') : 'bg-red-700 text-white'
                            }`}>
                              {v.statusToday}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm font-black">{v.currentKm || '---'}</td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-[11px] font-black text-blue-700">+{v.kmCurrentMonth.toLocaleString()}</span>
                              <span className="text-[9px] font-bold opacity-75">ANT: {v.kmLastMonth.toLocaleString()}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`font-black text-sm ${v.pendingDays > 0 ? 'text-red-700' : 'text-emerald-800'}`}>
                              {v.pendingDays} dias
                            </span>
                          </td>
                          <td className="px-6 py-4">
                             <button 
                               onClick={() => setSelectedVehicleForAlerts(v)}
                               className={`p-2 rounded-xl transition-all cursor-pointer ${v.hasAlerts ? 'bg-red-600 text-white' : 'bg-white/80 text-gray-600 hover:bg-white'}`}
                             >
                               <Bell className="w-4 h-4" />
                             </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Alerts Modal */}
      {selectedVehicleForAlerts && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in duration-300">
            <div className="bg-gray-900 p-8 text-white flex justify-between items-center">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Manutenção e Alertas</p>
                <h3 className="text-2xl font-black uppercase tracking-tighter mt-1">{selectedVehicleForAlerts.prefix}</h3>
              </div>
              <button 
                onClick={() => setSelectedVehicleForAlerts(null)}
                className="bg-white/10 hover:bg-white/20 p-3 rounded-2xl transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8 space-y-8">
              {/* Form specifically for alerts */}
              <div className="bg-gray-50 p-6 rounded-3xl border border-gray-200">
                <h4 className="text-xs font-black uppercase text-gray-900 mb-4 flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Programar Novo Alerta
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Tipo de Gatilho</label>
                    <select 
                      value={newAlert.type} 
                      onChange={e => setNewAlert({ ...newAlert, type: e.target.value as any })}
                      className="w-full bg-white border-2 border-gray-200 rounded-2xl p-3 text-xs font-black uppercase outline-none focus:border-blue-600"
                    >
                      <option value="KM">Por Odômetro (KM)</option>
                      <option value="DATE">Por Data Específica</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Descrição do Serviço</label>
                    <input 
                      type="text" 
                      placeholder="EX: TROCA DE ÓLEO"
                      value={newAlert.description}
                      onChange={e => setNewAlert({ ...newAlert, description: e.target.value.toUpperCase() })}
                      className="w-full bg-white border-2 border-gray-200 rounded-2xl p-3 text-xs font-black uppercase outline-none focus:border-blue-600"
                    />
                  </div>
                  
                  {newAlert.type === 'KM' ? (
                    <>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Km do Objetivo</label>
                        <input 
                          type="number" 
                          placeholder="EX: 100000"
                          value={newAlert.targetKm || ''}
                          onChange={e => setNewAlert({ ...newAlert, targetKm: parseInt(e.target.value) })}
                          className="w-full bg-white border-2 border-gray-200 rounded-2xl p-3 text-xs font-black uppercase outline-none focus:border-blue-600"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Avisar faltantes (Km)</label>
                        <input 
                          type="number" 
                          placeholder="EX: 500"
                          value={newAlert.warnKmBefore || ''}
                          onChange={e => setNewAlert({ ...newAlert, warnKmBefore: parseInt(e.target.value) })}
                          className="w-full bg-white border-2 border-gray-200 rounded-2xl p-3 text-xs font-black uppercase outline-none focus:border-blue-600"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Data Específica</label>
                        <input 
                          type="date" 
                          value={newAlert.targetDate || ''}
                          onChange={e => setNewAlert({ ...newAlert, targetDate: e.target.value })}
                          className="w-full bg-white border-2 border-gray-200 rounded-2xl p-3 text-xs font-black outline-none focus:border-blue-600"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Dias de antecedência</label>
                        <input 
                          type="number" 
                          placeholder="EX: 7"
                          value={newAlert.warnDaysBefore || ''}
                          onChange={e => setNewAlert({ ...newAlert, warnDaysBefore: parseInt(e.target.value) })}
                          className="w-full bg-white border-2 border-gray-200 rounded-2xl p-3 text-xs font-black outline-none focus:border-blue-600"
                        />
                      </div>
                    </>
                  )}
                </div>
                <button 
                  onClick={handleAddAlert}
                  className="w-full bg-blue-600 text-white rounded-2xl py-4 mt-6 text-xs font-black uppercase shadow-xl active:scale-95 transition-all"
                >
                  Salvar Programação
                </button>
              </div>

              {/* List of current alerts */}
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase text-gray-400 tracking-widest flex items-center gap-2">
                  <Bell className="w-4 h-4" /> Alertas Programados
                </h4>
                <div className="grid grid-cols-1 gap-4">
                  {(selectedVehicleForAlerts.alerts || []).length === 0 ? (
                    <p className="text-center py-10 text-gray-400 text-xs font-bold uppercase tracking-widest bg-gray-50 rounded-3xl border-2 border-dashed">Nenhuma manutenção agendada</p>
                  ) : (
                    (selectedVehicleForAlerts.alerts || []).map((alert, aIdx) => (
                      <div key={`${alert.id}-${aIdx}`} className="bg-white border-2 border-gray-100 p-6 rounded-3xl flex items-center justify-between group hover:border-blue-200 transition-all">
                        <div className="flex gap-4 items-center">
                           <div className={`p-3 rounded-2xl ${alert.type === 'KM' ? 'bg-blue-50 text-blue-600' : 'bg-indigo-50 text-indigo-600'}`}>
                             {alert.type === 'KM' ? <TrendingUp className="w-5 h-5" /> : <Calendar className="w-5 h-5" />}
                           </div>
                           <div>
                              <h5 className="text-xs font-black uppercase text-gray-900">{alert.description}</h5>
                              <p className="text-[10px] font-bold text-gray-400 uppercase mt-0.5 tracking-tight">
                                {alert.type === 'KM' ? `Limite: ${alert.targetKm} Km (Aviso: ${alert.warnKmBefore} Km antes)` : `Vencimento: ${alert.targetDate} (Aviso: ${alert.warnDaysBefore} dias antes)`}
                              </p>
                           </div>
                        </div>
                        <button 
                          onClick={() => handleDeleteAlert(alert.id)}
                          className="bg-red-50 text-red-400 hover:bg-red-500 hover:text-white p-2.5 rounded-xl transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Seleção de Relatórios */}
      {selectedVehicleForReport && (
        <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md space-y-8 border-t-4 border-red-600 animate-in fade-in zoom-in duration-300">
            <div className="flex justify-between items-start">
               <div className="space-y-1">
                  <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Relatórios: {selectedVehicleForReport.prefix}</h2>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-red-600">Selecione o documento para visualização</p>
               </div>
               <button onClick={() => setSelectedVehicleForReport(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors"><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <button 
                onClick={() => {
                  onViewReport?.(selectedVehicleForReport.prefix);
                  setSelectedVehicleForReport(null);
                }}
                className="group flex items-center gap-4 p-4 border-2 border-gray-100 rounded-2xl hover:border-red-600 hover:bg-red-50 transition-all text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center group-hover:bg-red-200 transition-colors">
                  <FileText className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="font-black text-sm uppercase tracking-tight text-gray-900">Ficha de Controle Diário</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Check-list diário detalhado</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 ml-auto group-hover:text-red-600 transition-colors" />
              </button>

              <button 
                onClick={() => {
                  onViewWeekly?.(selectedVehicleForReport.prefix);
                  setSelectedVehicleForReport(null);
                }}
                className="group flex items-center gap-4 p-4 border-2 border-gray-100 rounded-2xl hover:border-blue-600 hover:bg-blue-50 transition-all text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                  <Calendar className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-black text-sm uppercase tracking-tight text-gray-900">Ficha Mensal / Semanal</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Resumo periódico de conferências</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 ml-auto group-hover:text-blue-600 transition-colors" />
              </button>

              <button 
                onClick={() => {
                  onViewMirror?.(selectedVehicleForReport.prefix);
                  setSelectedVehicleForReport(null);
                }}
                className="group flex items-center gap-4 p-4 border-2 border-gray-100 rounded-2xl hover:border-amber-600 hover:bg-amber-50 transition-all text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center group-hover:bg-amber-200 transition-colors">
                  <Shield className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-black text-sm uppercase tracking-tight text-gray-900">Espelho do Relatório</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Última conferência digital</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 ml-auto group-hover:text-amber-600 transition-colors" />
              </button>
            </div>
            
            <p className="text-[9px] text-center font-bold text-gray-400 uppercase tracking-widest italic">
              * Escolha uma das opções acima para visualizar o documento oficial.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
