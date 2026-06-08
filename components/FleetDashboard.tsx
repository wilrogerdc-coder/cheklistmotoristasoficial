import React, { useMemo, useState } from "react";
import { LogEntry, AppSettings, Justification, Vehicle, MaintenanceAlert, User } from "../types";
import { FIXED_GOOGLE_SHEET_URL } from "../constants";
import { 
  Shield, 
  MapPin, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Activity, 
  BarChart2,
  BarChart,
  PieChart,
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
  X
} from "lucide-react";

interface FleetDashboardProps {
  logs: LogEntry[];
  settings: AppSettings;
  justifications: Justification[];
  onRefresh: () => void;
  isLoading?: boolean;
  onUpdateVehicles?: (updatedVehicles: Vehicle[]) => void;
  onVehicleReportClick?: (prefix: string) => void;
  onSaveAuditLog?: (action: string, details: string) => void;
}

export const FleetDashboard: React.FC<FleetDashboardProps> = ({
  logs,
  settings,
  justifications,
  onRefresh,
  isLoading,
  onUpdateVehicles,
  onVehicleReportClick,
  onSaveAuditLog
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterType, setFilterType] = useState<'ALL' | 'OK' | 'PENDENTE' | 'JUSTIFICATION' | 'CN'>('ALL');
  const [stationFilter, setStationFilter] = useState<string>('ALL');
  const [selectedVehicleForAlerts, setSelectedVehicleForAlerts] = useState<Vehicle | null>(null);
  const [secureAction, setSecureAction] = useState<{ type: 'COMPLETE' | 'DELETE', alertId: string } | null>(null);
  const [authData, setAuthData] = useState({ username: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  
  // Alert creation state
  const [newAlert, setNewAlert] = useState<Partial<MaintenanceAlert>>({
    type: 'KM',
    description: '',
    status: 'ACTIVE'
  });

  // Helpers
  const normalizeText = (text: string) => String(text || "").trim().toUpperCase().replace(/[-\s]/g, "");

  const getAlertStatus = (alert: MaintenanceAlert, currentKm: number) => {
    if (alert.status !== 'ACTIVE') return 'none';

    if (alert.type === 'KM' && alert.targetKm) {
      if (currentKm >= alert.targetKm) return 'critical';
      if (currentKm > 0 && (alert.targetKm - currentKm) <= (alert.warnKmBefore || 0)) return 'warning';
    }

    if (alert.type === 'DATE' && alert.targetDate) {
      const today = new Date();
      today.setHours(0,0,0,0);
      const target = new Date(alert.targetDate);
      target.setHours(0,0,0,0);

      if (today.getTime() >= target.getTime()) return 'critical';

      const diffDays = Math.ceil((target.getTime() - today.getTime()) / (1000 * 3600 * 24));
      if (diffDays <= (alert.warnDaysBefore || 0)) return 'warning';
    }

    return 'none';
  };
  
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

  // Group vehicles by Station
  const stationsData = useMemo(() => {
    const stationMap: Record<string, { name: string, vehicles: any[] }> = {};
    
    if (settings.stations) {
      settings.stations.forEach(s => {
        stationMap[normalizeText(s.name)] = { name: s.name, vehicles: [] };
      });
    }
    
    const unassignedStationKey = "SEM_POSTO";
    stationMap[unassignedStationKey] = { name: "Sem Posto Definido", vehicles: [] };

    settings.vehicles?.forEach(v => {
      const vehiclePrefix = normalizeText(v.prefix);
      const stationKey = v.station ? normalizeText(v.station) : unassignedStationKey;
      
      if (!stationMap[stationKey]) {
        stationMap[stationKey] = { name: v.station || "Outros", vehicles: [] };
      }

      const logToday = logs.find(l => normalizeText(l.prefix) === vehiclePrefix && isToday(l.date));
      const currentKm = logToday ? parseInt(logToday.km) : 0;
      const hasNovelty = logToday?.itemsStatus?.includes("CN");
      
      let pendingDays = 0;
      const logsThisMonth = logs.filter(l => normalizeText(l.prefix) === vehiclePrefix && isCurrentMonth(l.date));
      const logDaysSet = new Set(logsThisMonth.map(l => parseDateToComps(l.date)?.d).filter(Boolean));
      
      const justificationsThisMonth = justifications.filter(j => {
        const jPrefix = normalizeText(j.vehicleType || j.station);
        const jDate = (j.date || (j as any).dateRef || "");
        return jPrefix === vehiclePrefix && isCurrentMonth(jDate);
      });
      const justDaysSet = new Set(justificationsThisMonth.map(j => parseDateToComps(j.date || (j as any).dateRef)?.d).filter(Boolean));

      for (let d = 1; d <= today.day; d++) {
        if (!logDaysSet.has(d) && !justDaysSet.has(d)) {
          pendingDays++;
        }
      }

      const statusToday = !!logToday ? "CONFERIDA" : "PENDENTE";

      const vehicleAlerts = (v.alerts || []).map(a => ({
        ...a,
        level: getAlertStatus(a, currentKm)
      })).filter(a => a.level !== 'none');

      const isCritical = vehicleAlerts.some(a => a.level === 'critical');
      const isWarning = vehicleAlerts.some(a => a.level === 'warning');

      // Station filter logic
      if (stationFilter !== 'ALL' && v.station !== stationFilter) return;

      // Filter logic
      if (filterType === 'OK' && (statusToday !== 'CONFERIDA' || hasNovelty)) return;
      if (filterType === 'CN' && (statusToday !== 'CONFERIDA' || !hasNovelty)) return;
      if (filterType === 'PENDENTE' && statusToday !== 'PENDENTE') return;
      if (filterType === 'JUSTIFICATION' && pendingDays === 0) return;

      stationMap[stationKey].vehicles.push({
        ...v,
        logToday,
        pendingDays,
        currentKm,
        statusToday,
        hasNovelty,
        activeAlerts: vehicleAlerts,
        activeAlertsCount: vehicleAlerts.length,
        hasAlerts: vehicleAlerts.length > 0,
        isCritical,
        isWarning
      });
    });

    return Object.values(stationMap)
      .filter(s => s.vehicles.length > 0)
      .sort((a, b) => {
        const order = settings.stationOrder || [];
        const idxA = order.indexOf(a.name);
        const idxB = order.indexOf(b.name);
        if (idxA === -1 && idxB === -1) return a.name.localeCompare(b.name);
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
      });
  }, [logs, settings, justifications, today, filterType, stationFilter]);

  const criticalAlertsSummary = useMemo(() => {
    const alertsList: { vehiclePrefix: string, alert: MaintenanceAlert, level: 'warning' | 'critical' }[] = [];
    
    settings.vehicles?.forEach(v => {
      const vehiclePrefix = normalizeText(v.prefix);
      
      // Encontrar o KM mais recente para esta viatura (mesmo que não seja de hoje)
      const vehicleLogs = logs.filter(l => normalizeText(l.prefix) === vehiclePrefix).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const currentKm = vehicleLogs.length > 0 ? parseInt(vehicleLogs[0].km) : 0;
      
      const vAlerts = (v.alerts || [])
        .map(a => ({
          alert: a,
          level: getAlertStatus(a, currentKm)
        }))
        .filter(a => a.level !== 'none') as { alert: MaintenanceAlert, level: 'warning' | 'critical' }[];
      
      vAlerts.forEach(va => {
        alertsList.push({ vehiclePrefix: v.prefix, ...va });
      });
    });
    
    return alertsList.sort((a, b) => {
      if (a.level === b.level) return 0;
      return a.level === 'critical' ? -1 : 1;
    });
  }, [settings.vehicles, logs, today]);

  const stats = useMemo(() => {
    const allRawVehicles = settings.vehicles || [];
    const filteredVehicles = allRawVehicles.filter(v => stationFilter === 'ALL' || v.station === stationFilter);
    
    const processedAll = filteredVehicles.map(v => {
      const prefix = normalizeText(v.prefix);
      const logToday = logs.find(l => normalizeText(l.prefix) === prefix && isToday(l.date));
      let pendingDays = 0;
      const logsThisMonth = logs.filter(l => normalizeText(l.prefix) === prefix && isCurrentMonth(l.date));
      const logDaysSet = new Set(logsThisMonth.map(l => parseDateToComps(l.date)?.d).filter(Boolean));
      const justs = justifications.filter(j => normalizeText(j.vehicleType || j.station) === prefix && isCurrentMonth(j.date || (j as any).dateRef || ""));
      const justDaysSet = new Set(justs.map(j => parseDateToComps(j.date || (j as any).dateRef)?.d).filter(Boolean));
      for (let d = 1; d <= today.day; d++) {
        if (!logDaysSet.has(d) && !justDaysSet.has(d)) pendingDays++;
      }
      return { 
        ...v, 
        statusToday: !!logToday ? "CONFERIDA" : "PENDENTE",
        hasNovelty: logToday?.itemsStatus?.includes("CN"),
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
      compliance: processedAll.length > 0 ? Math.round(((processedAll.filter(v => v.statusToday === "CONFERIDA").length) / processedAll.length) * 100) : 0
    };
  }, [logs, settings, justifications, today, stationFilter]);

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

  const handleConfirmSecureAction = async () => {
    if (!secureAction || !selectedVehicleForAlerts) return;
    
    setIsVerifying(true);
    setAuthError('');

    let validatedUsers = settings.users || [];
    const targetUrl = settings.googleSheetUrl?.trim() || FIXED_GOOGLE_SHEET_URL;

    // Sincronização obrigatória antes da validação
    if (targetUrl) {
      try {
        const res = await fetch(`${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=getUsers&_t=${Date.now()}`).then(r => r.ok ? r.json() : null);
        if (Array.isArray(res) && res.length > 0) {
          validatedUsers = res;
          // Note: Here we don't update global settings state as we don't have onUpdateSettings, 
          // but we use the fresh list for validation.
        }
      } catch (err) {
        console.warn("Falha na sincronização obrigatória durante ação segura:", err);
      }
    }

    // Validate user credentials
    const user = validatedUsers.find(u => 
      u && u.username && u.username.toLowerCase() === authData.username.toLowerCase() && 
      u.password && u.password.toString() === authData.password
    );

    if (!user) {
      setAuthError('Usuário ou senha inválidos');
      setIsVerifying(false);
      return;
    }

    // Check if user has permission
    const isMaster = user.username.toLowerCase() === 'cavalieri';
    const { type, alertId } = secureAction;
    const alertDesc = selectedVehicleForAlerts.alerts?.find(a => a.id === alertId)?.description || 'Alerta';

    // Se for o mestre, ignora as restrições de permissões individuais
    if (!isMaster && !user.permissions.admin) {
      if (type === 'DELETE' && !user.permissions.deleteMaintenance) {
        setAuthError('Usuário sem permissão para EXCLUIR alertas');
        setIsVerifying(false);
        return;
      }
      if (type === 'COMPLETE' && !user.permissions.completeMaintenance) {
        setAuthError('Usuário sem permissão para CONCLUIR manutenções');
        setIsVerifying(false);
        return;
      }
    }

    let updatedVehicles: Vehicle[] = [];
    let auditDesc = "";
    let auditDetails = "";

    if (type === 'DELETE') {
      updatedVehicles = (settings.vehicles || []).map(v => 
        v.id === selectedVehicleForAlerts.id ? { ...v, alerts: (v.alerts || []).filter(a => a.id !== alertId) } : v
      );
      auditDesc = "ALERTA_EXCLUIDO";
      auditDetails = `Alerta "${alertDesc}" excluído da viatura ${selectedVehicleForAlerts.prefix} por ${user.name}`;
    } else if (type === 'COMPLETE') {
      updatedVehicles = (settings.vehicles || []).map(v => 
        v.id === selectedVehicleForAlerts.id ? { 
          ...v, 
          alerts: (v.alerts || []).map(a => 
            a.id === alertId ? { 
              ...a, 
              status: 'DONE', 
              completedAt: new Date().toISOString(), 
              completedBy: `${user.rank || ''} ${user.name}`.trim() 
            } : a
          ) 
        } : v
      );
      auditDesc = "MANUTENCAO_CONCLUIDA";
      auditDetails = `Manutenção "${alertDesc}" marcada como CONCLUÍDA na viatura ${selectedVehicleForAlerts.prefix} por ${user.name}`;
    }

    onUpdateVehicles?.(updatedVehicles);
    if (auditDesc) {
      onSaveAuditLog?.(auditDesc, auditDetails);
    }
    setSelectedVehicleForAlerts(updatedVehicles.find(v => v.id === selectedVehicleForAlerts.id) || null);
    setSecureAction(null);
    setAuthData({ username: '', password: '' });
    setAuthError('');
    setIsVerifying(false);
  };

  const handleDeleteAlert = (alertId: string) => {
    setSecureAction({ type: 'DELETE', alertId });
    setAuthError('');
  };

  const handleCompleteAlert = (alertId: string) => {
    setSecureAction({ type: 'COMPLETE', alertId });
    setAuthError('');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header Dashboard */}
      <div className="bg-white border rounded-[2.5rem] p-8 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-blue-50 rounded-full blur-3xl opacity-50"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-4 rounded-3xl text-white shadow-xl">
              <BarChart2 className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase text-gray-900 tracking-tight">
                Dashboard de Prontidão
              </h2>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
                Referência: {today.pt} | Monitoramento em Tempo Real
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <div className="flex bg-gray-100 p-1 rounded-2xl border border-gray-200">
                <button 
                  onClick={() => setViewMode('grid')} 
                  className={`p-2 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white shadow-md text-blue-600' : 'text-gray-400'}`}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setViewMode('list')} 
                  className={`p-2 rounded-xl transition-all ${viewMode === 'list' ? 'bg-white shadow-md text-blue-600' : 'text-gray-400'}`}
                >
                  <List className="w-4 h-4" />
                </button>
             </div>

             <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-2xl border border-gray-200">
               <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">POSTO:</span>
               <select 
                 value={stationFilter}
                 onChange={(e) => setStationFilter(e.target.value)}
                 className="bg-white border-none rounded-xl text-[10px] font-black uppercase py-1.5 px-3 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
               >
                 <option value="ALL">TODOS OS POSTOS</option>
                 {(settings.stations || []).map(s => (
                   <option key={s.id} value={s.name}>{s.name.toUpperCase()}</option>
                 ))}
                 <option value="">SEM POSTO</option>
               </select>
             </div>

             <button
              onClick={onRefresh}
              disabled={isLoading}
              className="bg-gray-900 hover:bg-black text-white px-8 py-3.5 rounded-2xl text-xs font-black uppercase flex items-center gap-2 shadow-xl transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Sincronizar
            </button>
          </div>
        </div>
      </div>

      {/* Quick Stats Grid - Interactive */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-10">
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
            onClick={() => setFilterType('ALL')} // Show all conferidas logic would be ALL or specific
            className="hidden lg:block p-6 rounded-3xl border-2 bg-gray-50 border-gray-100 opacity-60"
          >
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Resumo de Hoje</p>
            <div className="flex items-end justify-center mt-1">
              <p className="text-3xl font-black text-gray-900">{stats.compliance}%</p>
            </div>
          </div>
          
          <div 
            onClick={() => setFilterType('OK')} // Simplified as conferidas (OK)
            className={`cursor-pointer p-6 rounded-3xl border-2 transition-all ${filterType === 'OK' ? 'bg-green-50 border-green-500 shadow-md scale-105' : 'bg-white border-gray-100 hover:border-green-200'}`}
          >
            <p className="text-[10px] font-black text-green-500 uppercase tracking-widest">Conferidas (OK)</p>
            <div className="flex items-end justify-between mt-1">
              <p className="text-3xl font-black text-green-900">{stats.ok}</p>
              <CheckCircle className="w-4 h-4 text-green-400" />
            </div>
          </div>

          <div 
            onClick={() => setFilterType('CN')}
            className={`cursor-pointer p-6 rounded-3xl border-2 transition-all ${filterType === 'CN' ? 'bg-orange-50 border-orange-500 shadow-md scale-105' : 'bg-white border-gray-100 hover:border-orange-200'}`}
          >
            <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Conferidas (CN)</p>
            <div className="flex items-end justify-between mt-1">
              <p className="text-3xl font-black text-orange-900">{stats.cn}</p>
              <AlertTriangle className="w-4 h-4 text-orange-400" />
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
      </div>

      {/* Optional Charts Section */}
      {(settings.dashboardCharts || []).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {settings.dashboardCharts?.includes('status_dist') && (
            <div className="bg-white border rounded-[2rem] p-6 shadow-sm">
              <h4 className="text-[10px] font-black uppercase text-gray-400 mb-4 flex items-center gap-2">
                <PieChart className="w-4 h-4" /> Distribuição de Status
              </h4>
              <div className="space-y-3">
                {[
                  { label: 'OK', count: stats.ok, color: 'bg-green-500' },
                  { label: 'CN', count: stats.cn, color: 'bg-orange-500' },
                  { label: 'Pendente', count: stats.pending, color: 'bg-red-500' }
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${item.color}`} />
                    <span className="text-[10px] font-black uppercase text-gray-600 flex-1">{item.label}</span>
                    <span className="text-[10px] font-black text-gray-900">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {settings.dashboardCharts?.includes('conformity_gauge') && (
            <div className="bg-white border rounded-[2rem] p-6 shadow-sm flex flex-col items-center justify-center text-center">
              <h4 className="text-[10px] font-black uppercase text-gray-400 mb-4 w-full text-left">
                <TrendingUp className="w-4 h-4 inline mr-2" /> Nível de Conformidade
              </h4>
              <div className="relative w-32 h-32 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-gray-100" />
                  <circle 
                    cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="12" fill="transparent" 
                    strokeDasharray={364.4}
                    strokeDashoffset={364.4 - (364.4 * stats.compliance) / 100}
                    className="text-blue-600 transition-all duration-1000" 
                  />
                </svg>
                <span className="absolute text-2xl font-black text-gray-900">{stats.compliance}%</span>
              </div>
              <p className="text-[9px] font-bold text-gray-400 uppercase mt-4">Frota Operacional Hoje</p>
            </div>
          )}

          {settings.dashboardCharts?.includes('top_vehicles') && (
            <div className="bg-white border rounded-[2rem] p-6 shadow-sm">
              <h4 className="text-[10px] font-black uppercase text-gray-400 mb-4 flex items-center gap-2">
                <BarChart className="w-4 h-4" /> Top Pendências (Frota)
              </h4>
              <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2">
                {stationsData.flatMap(s => s.vehicles)
                  .filter(v => v.pendingDays > 0)
                  .sort((a,b) => b.pendingDays - a.pendingDays)
                  .slice(0, 5)
                  .map(v => (
                    <div key={v.prefix} className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-gray-600">{v.prefix}</span>
                      <span className="text-[10px] font-black text-red-600">{v.pendingDays} dias</span>
                    </div>
                  ))
                }
                {stationsData.flatMap(s => s.vehicles).filter(v => v.pendingDays > 0).length === 0 && (
                  <p className="text-[10px] text-gray-300 font-bold uppercase text-center py-4">Tudo em dia</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Critical Alerts Summary Section */}
      {criticalAlertsSummary.length > 0 && (
        <div className="bg-white border-2 border-red-100 rounded-[2.5rem] p-8 shadow-sm animate-in slide-in-from-top-4 duration-700">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-red-600 rounded-2xl text-white shadow-lg shadow-red-100">
              <Bell className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <h3 className="text-xl font-black uppercase text-gray-900 tracking-tight">Alertas de Manutenção</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Veículos com serviços pendentes ou próximos do vencimento</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {criticalAlertsSummary.map((item, idx) => (
              <div 
                key={`${item.vehiclePrefix}-${item.alert.id}`} 
                onClick={() => {
                  const v = settings.vehicles?.find(v => v.prefix === item.vehiclePrefix);
                  if (v) setSelectedVehicleForAlerts(v);
                }}
                className={`flex items-center justify-between p-5 rounded-3xl border-2 cursor-pointer transition-all hover:scale-[1.02] shadow-sm ${
                  item.level === 'critical' ? 'bg-red-50 border-red-200 hover:shadow-red-50' : 'bg-orange-50 border-orange-200 hover:shadow-orange-50'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2.5 rounded-xl ${item.level === 'critical' ? 'bg-red-600' : 'bg-orange-500'} text-white`}>
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-[10px] font-black uppercase text-gray-400 leading-none mb-1">{item.vehiclePrefix}</p>
                    <h4 className="text-xs font-black uppercase text-gray-900 truncate">{item.alert.description}</h4>
                  </div>
                </div>
                <div className="flex flex-col items-end shrink-0 ml-4">
                  <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${
                    item.level === 'critical' ? 'bg-red-200 text-red-700' : 'bg-orange-200 text-orange-700'
                  }`}>
                    {item.level === 'critical' ? 'VENCIDO' : 'PRÓXIMO'}
                  </span>
                  <p className="text-[10px] mt-1 font-bold text-gray-500">
                    {item.alert.type === 'KM' ? `${item.alert.targetKm} KM` : item.alert.targetDate}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stations Breakdown */}
      <div className="space-y-10">
        {stationsData.map((station, sIdx) => (
          <div key={station.name} className="animate-in slide-in-from-bottom-4 duration-700" style={{ animationDelay: `${sIdx * 100}ms` }}>
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
                {station.vehicles.map((v) => (
                  <div 
                    key={v.prefix} 
                    className={`bg-white border-2 rounded-[2rem] p-6 transition-all hover:shadow-xl relative group ${
                      v.statusToday === "CONFERIDA" ? (v.hasNovelty ? "border-orange-100" : "border-green-100") : "border-red-100"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Vatura</span>
                        <h4 
                          onClick={() => onVehicleReportClick?.(v.prefix)}
                          className="text-xl font-black text-gray-900 uppercase tracking-tighter flex items-center gap-2 cursor-pointer hover:text-blue-600 transition-colors"
                        >
                          {v.prefix}
                        </h4>
                      </div>
                      <div className="flex flex-col gap-2">
                        <div className={`p-2 rounded-xl text-white shadow-lg ${
                          v.statusToday === "CONFERIDA" ? (v.hasNovelty ? "bg-orange-500 shadow-orange-100" : "bg-green-600 shadow-green-100") : "bg-red-600 shadow-red-100"
                        }`}>
                          {v.statusToday === "CONFERIDA" ? <Check className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                        </div>
                        <button 
                          onClick={() => setSelectedVehicleForAlerts(v)}
                          className={`p-2 rounded-xl transition-all relative ${
                            v.isCritical ? 'bg-red-600 text-white shadow-lg shadow-red-100' : 
                            v.isWarning ? 'bg-orange-500 text-white shadow-lg shadow-orange-100' : 
                            'bg-gray-50 text-gray-400 hover:bg-gray-100'
                          }`}
                        >
                          <Bell className="w-4 h-4" />
                          {v.hasAlerts && (
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full flex items-center justify-center border border-gray-200">
                              <span className={`w-1.5 h-1.5 rounded-full ${v.isCritical ? 'bg-red-600' : 'bg-orange-500'}`}></span>
                            </span>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-[10px] font-bold uppercase border-b border-gray-50 pb-3">
                        <span className="text-gray-400">Hoje</span>
                        <span className={v.statusToday === "CONFERIDA" ? (v.hasNovelty ? "text-orange-600" : "text-green-600") : "text-red-600"}>
                          {v.statusToday === "CONFERIDA" ? "CONFERIDA" : "PENDENTE"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                         <div>
                            <span className="text-[9px] font-black text-gray-400 uppercase block">Km</span>
                            <span className="text-sm font-black text-gray-900">{v.currentKm || '---'}</span>
                         </div>
                         <div className="text-right">
                            <span className="text-[9px] font-black text-gray-400 uppercase block">Pendências</span>
                            <span className={`text-sm font-black ${v.pendingDays > 0 ? 'text-red-600' : 'text-green-600'}`}>{v.pendingDays} D</span>
                         </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white border rounded-[2rem] overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Viatura</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Placa</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Status Hoje</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Km Atual</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Justificativas</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Alertas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {station.vehicles.map(v => (
                      <tr key={v.prefix} className="hover:bg-gray-50 transition-colors">
                        <td 
                          onClick={() => onVehicleReportClick?.(v.prefix)}
                          className="px-6 py-4 font-black uppercase text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                        >
                          {v.prefix}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs">{v.plate}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                            v.statusToday === 'CONFERIDA' ? (v.hasNovelty ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700') : 'bg-red-100 text-red-700'
                          }`}>
                            {v.statusToday}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-gray-700">{v.currentKm || '---'}</td>
                        <td className="px-6 py-4">
                          <span className={`font-black text-sm ${v.pendingDays > 0 ? 'text-red-500' : 'text-green-500'}`}>
                            {v.pendingDays} dias
                          </span>
                        </td>
                        <td className="px-6 py-4">
                           <button 
                             onClick={() => setSelectedVehicleForAlerts(v)}
                             className={`p-2 rounded-xl transition-all flex items-center gap-2 ${
                               v.isCritical ? 'bg-red-100 text-red-700 border border-red-200' : 
                               v.isWarning ? 'bg-orange-100 text-orange-700 border border-orange-200' : 
                               'bg-gray-100 text-gray-400'
                             }`}
                           >
                             <Bell className="w-4 h-4" />
                             {v.hasAlerts && (
                               <span className="text-[10px] font-black">{v.activeAlertsCount}</span>
                             )}
                           </button>
                        </td>
                      </tr>
                    ))}
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
                <div className="flex gap-2 mt-2">
                  <span className="text-[10px] font-black uppercase bg-white/10 px-2 py-1 rounded-md">PLACA: {selectedVehicleForAlerts.plate}</span>
                  <span className="text-[10px] font-black uppercase bg-blue-600 px-2 py-1 rounded-md">KM ATUAL: {(settings.vehicles?.find(v => v.id === selectedVehicleForAlerts.id) as any)?.currentKm || '---'}</span>
                </div>
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
                    (selectedVehicleForAlerts.alerts || [])
                      .sort((a, b) => {
                        if (a.status === b.status) return 0;
                        return a.status === 'ACTIVE' ? -1 : 1;
                      })
                      .map(alert => {
                      const curKm = (settings.vehicles?.find(v => v.id === selectedVehicleForAlerts.id) as any)?.currentKm || 0;
                      const level = getAlertStatus(alert, curKm);
                      return (
                        <div key={alert.id} className={`bg-white border-2 p-6 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 group transition-all ${
                          alert.status === 'DONE' ? 'opacity-60 grayscale border-gray-100 bg-gray-50' :
                          level === 'critical' ? 'border-red-200 hover:shadow-red-50' : 
                          level === 'warning' ? 'border-orange-200 hover:shadow-orange-50' : 
                          'border-gray-100'
                        }`}>
                          <div className="flex gap-4 items-center flex-1">
                             <div className={`p-3 rounded-2xl ${
                               alert.status === 'DONE' ? 'bg-gray-200 text-gray-500' :
                               level === 'critical' ? 'bg-red-50 text-red-600' : 
                               level === 'warning' ? 'bg-orange-50 text-orange-600' : 
                               alert.type === 'KM' ? 'bg-blue-50 text-blue-600' : 'bg-indigo-50 text-indigo-600'
                             }`}>
                               {alert.status === 'DONE' ? <CheckCircle className="w-5 h-5" /> : alert.type === 'KM' ? <TrendingUp className="w-5 h-5" /> : <Calendar className="w-5 h-5" />}
                             </div>
                             <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <h5 className="text-xs font-black uppercase text-gray-900">{alert.description}</h5>
                                  {alert.status === 'DONE' ? (
                                    <span className="text-[9px] font-black uppercase bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">Concluído</span>
                                  ) : (
                                    <>
                                      {level === 'critical' && <span className="text-[9px] font-black uppercase bg-red-600 text-white px-2 py-0.5 rounded-full animate-pulse">Vencido</span>}
                                      {level === 'warning' && <span className="text-[9px] font-black uppercase bg-orange-500 text-white px-2 py-0.5 rounded-full">Alerta</span>}
                                    </>
                                  )}
                                </div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase mt-0.5 tracking-tight">
                                  {alert.type === 'KM' ? `Limite: ${alert.targetKm} Km` : `Vencimento: ${alert.targetDate}`}
                                </p>
                                {alert.status === 'DONE' && alert.completedAt && (
                                  <p className="text-[9px] font-black text-blue-600 uppercase mt-1">
                                    ✓ Concluído por {alert.completedBy} em {new Date(alert.completedAt).toLocaleDateString('pt-BR')}
                                  </p>
                                )}
                             </div>
                          </div>
                          
                          <div className="flex gap-2 justify-end">
                            {alert.status === 'ACTIVE' && (
                              <button 
                                onClick={() => handleCompleteAlert(alert.id)}
                                title="Marcar como concluído"
                                className="bg-green-50 text-green-600 hover:bg-green-600 hover:text-white p-2.5 rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase"
                              >
                                <Check className="w-4 h-4" />
                                <span>Concluir</span>
                              </button>
                            )}
                            <button 
                              onClick={() => handleDeleteAlert(alert.id)}
                              title="Excluir alerta"
                              className="bg-red-50 text-red-400 hover:bg-red-500 hover:text-white p-2.5 rounded-xl transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Secure Action Modal (Auth Required) */}
      {secureAction && (
        <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in duration-200">
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-red-600 rounded-2xl text-white">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase text-gray-900 leading-tight">Autenticação Necessária</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Valide sua identidade para continuar</p>
                </div>
              </div>

              <p className="text-xs font-bold text-gray-500 uppercase mb-6 leading-relaxed">
                Você está tentando <span className="text-red-600 font-black">{secureAction.type === 'DELETE' ? 'EXCLUIR' : 'CONCLUIR'}</span> um alerta de manutenção. Esta ação requer nome de usuário e senha de administrador.
              </p>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Usuário</label>
                  <input 
                    type="text" 
                    value={authData.username}
                    onChange={e => setAuthData({...authData, username: e.target.value})}
                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 text-sm font-bold outline-none focus:border-red-600 focus:bg-white transition-all"
                    placeholder="DIGITE SEU USUÁRIO"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Senha</label>
                  <input 
                    type="password" 
                    value={authData.password}
                    onChange={e => setAuthData({...authData, password: e.target.value})}
                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 text-sm font-bold outline-none focus:border-red-600 focus:bg-white transition-all"
                    placeholder="••••••••"
                  />
                </div>

                {authError && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 animate-in slide-in-from-top-1">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span className="text-[10px] font-black uppercase">{authError}</span>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setSecureAction(null)}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-2xl py-4 text-xs font-black uppercase transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleConfirmSecureAction}
                    disabled={isVerifying}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-2xl py-4 text-xs font-black uppercase shadow-lg shadow-red-100 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isVerifying ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Validando...
                      </>
                    ) : "Confirmar"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
