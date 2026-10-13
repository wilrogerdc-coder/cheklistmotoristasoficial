
import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { ChecklistTable } from './components/ChecklistTable';
import { DamageCanvas } from './components/DamageCanvas';
import { Settings } from './components/Settings';
import { 
  INITIAL_CHECKLIST_ITEMS, 
  INITIAL_VEHICLE_IMAGES,
  INITIAL_VEHICLE_RATIOS,
  FIXED_GOOGLE_SHEET_URL
} from './constants';
import { filterLogsLast30Days, filterLogsLast3Months, filterLogsBySelectedDates } from './services/dateFilterService';
import { 
  LogEntry,
  InspectionData, 
  ItemStatus, 
  DamagePoint,
  AppSettings,
  AspectRatio,
  User,
  Vehicle,
  Station,
  Justification,
  SyncProgressInfo
} from './types';
import { 
  initAuth, 
  saveGoogleSession,
  googleLogout, 
  getAccessToken,
  GoogleUser
} from './services/googleAuth';
import { GoogleLoginButton } from './components/GoogleLoginButton';
import { sheetsService } from './services/googleSheets';
import { compressImage } from './services/imageUtils';
import { FleetDashboard } from './components/FleetDashboard';
import { SyncProgressBar } from './components/SyncProgressBar';
import { 
  Printer, 
  Settings as SettingsIcon,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  Loader2,
  Map,
  EyeOff,
  Save,
  Upload,
  FileText,
  User as UserIcon,
  LogOut,
  Lock,
  ShieldCheck,
  X,
  Cloud,
  CloudOff,
  RefreshCw,
  BookOpen,
  Info,
  LayoutDashboard,
  Mail
} from 'lucide-react';

const getYouTubeEmbedUrl = (url?: string): string | null => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  if (match && match[2].length === 11) {
    const videoId = match[2];
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&showinfo=0&rel=0&disablekb=1&modestbranding=1&playsinline=1`;
  }
  return null;
};

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  const [showSplash, setShowSplash] = useState(true);
  const [view, setView] = useState<'checklist' | 'settings' | 'dashboard'>('checklist');
  const [activeTabInSettings, setActiveTabInSettings] = useState<'items' | 'images' | 'style' | 'about' | 'admin' | 'manual' | 'reports' | 'vehicles' | 'stations' | 'users' | 'report_editor' | 'cloud' | 'login'>('items');
  const [showDamageMap, setShowDamageMap] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'checking' | 'online' | 'offline'>('idle');
  const [selectedStationFilter, setSelectedStationFilter] = useState<string>('');
  const [googleUser, setGoogleUser] = useState<GoogleUser | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [printTimestamp, setPrintTimestamp] = useState<string>('');
  const allLogsCacheRef = useRef<LogEntry[] | null>((() => {
    try {
      const cached = localStorage.getItem('checkviatura_cached_logs');
      if (!cached) return null;
      const parsed = JSON.parse(cached);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  })());
  const [logs, setLogs] = useState<LogEntry[]>(() => {
    try {
      const cached = localStorage.getItem('checkviatura_cached_logs');
      if (!cached) return [];
      const parsed = JSON.parse(cached);
      return Array.isArray(parsed) ? filterLogsLast3Months(parsed) : [];
    } catch {
      return [];
    }
  });
  const [justifications, setJustifications] = useState<Justification[]>(() => {
    try {
      const cached = localStorage.getItem('checkviatura_cached_justifications');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => {
    return localStorage.getItem('checkviatura_last_sync') || '';
  });
  const [lastSyncDuration, setLastSyncDuration] = useState<string>(() => {
    return localStorage.getItem('checkviatura_last_sync_duration') || '';
  });
  const [syncProgress, setSyncProgress] = useState<SyncProgressInfo>({
    isActive: false,
    progress: 0,
    title: 'Sincronização de Dados & Sistema',
    currentStep: 'Aguardando sincronização...',
    status: 'idle'
  });
  const [isFetchingDashboardData, setIsFetchingDashboardData] = useState(false);
  const [reportConfig, setReportConfig] = useState<{ prefix: string; reportType?: any } | undefined>(undefined);
  const [lastChecklistData, setLastChecklistData] = useState<{ label: string; status: string; observation?: string }[] | undefined>(undefined);
  const [recentConferenceSuccess, setRecentConferenceSuccess] = useState<{ prefix: string; message: string } | null>(null);
  const checklistRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentUser && showLoginModal) {
      setShowLoginModal(false);
    }
  }, [currentUser, showLoginModal]);

  const handleViewReport = (prefix: string) => {
    const vehicle = settings.vehicles?.find(v => v.prefix === prefix);
    const reportType = vehicle?.type === 'MOTOCICLETA' ? 'daily_control_motos' : 'daily_control';
    setReportConfig({ prefix, reportType });
    setActiveTabInSettings('reports');
    setView('settings');
  };

  const handleViewWeekly = (prefix: string) => {
    const vehicle = settings.vehicles?.find(v => v.prefix === prefix);
    let reportType: any = 'weekly_leves';
    if (vehicle?.type === 'MOTOCICLETA') reportType = 'weekly_motos';
    else if (vehicle?.type === 'AB/AÉREA') reportType = 'weekly_ab';
    
    setReportConfig({ prefix, reportType });
    setActiveTabInSettings('reports');
    setView('settings');
  };

  const handleViewMirror = (prefix: string) => {
    setReportConfig({ prefix, reportType: 'analytical' });
    setActiveTabInSettings('reports');
    setView('settings');
  };

  const fetchDashboardData = async (options?: { forceAll?: boolean; targetMonth?: string; scope?: 'CURRENT_MONTH' | 'LAST_MONTH' | 'ALL' }) => {
    const rawUrl = settings.googleSheetUrl || FIXED_GOOGLE_SHEET_URL;
    const targetUrl = (rawUrl && rawUrl.startsWith('http')) ? rawUrl.trim() : FIXED_GOOGLE_SHEET_URL;
    if (!targetUrl) return;

    // Garantir que allLogsCacheRef tenha dados locais caso ainda não tenha inicializado
    if (!allLogsCacheRef.current || allLogsCacheRef.current.length === 0) {
      try {
        const cached = localStorage.getItem('checkviatura_cached_logs');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            allLogsCacheRef.current = parsed;
          }
        }
      } catch (e) {
        // ignora erro ao ler cache
      }
    }

    // Se já temos os logs em cache e foi solicitado um filtro específico ou tudo
    if (allLogsCacheRef.current && allLogsCacheRef.current.length > 0 && options) {
      if (options.forceAll || options.scope === 'ALL') {
        setLogs(allLogsCacheRef.current);
        return;
      }
      if (options.targetMonth) {
        setLogs(filterLogsBySelectedDates(allLogsCacheRef.current, { month: options.targetMonth }));
        return;
      }
      if (options.scope === 'CURRENT_MONTH' || options.scope === 'LAST_MONTH') {
        setLogs(filterLogsLast3Months(allLogsCacheRef.current));
        return;
      }
    }

    const startDataTime = performance.now();
    setIsFetchingDashboardData(true);
    setSyncProgress(prev => ({
      ...prev,
      isActive: true,
      progress: prev.status === 'syncing' ? Math.max(prev.progress, 40) : 25,
      title: options?.scope === 'ALL' ? 'Sincronizando Histórico Completo' : 'Sincronizando Dados da Frota',
      currentStep: 'Buscando conferências e justificativas no banco de dados...',
      status: 'syncing'
    }));

    try {
      // Função segura de requisição que não lança erro não tratado em caso de offline/CORS/rede
      const safeFetchJson = async (url: string) => {
        try {
          const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
          const timeoutId = controller ? setTimeout(() => controller.abort(), 12000) : null;
          const res = await fetch(url, {
            method: 'GET',
            mode: 'cors',
            signal: controller?.signal
          });
          if (timeoutId) clearTimeout(timeoutId);
          if (res && res.ok) {
            return await res.json();
          }
          return null;
        } catch (fetchErr) {
          console.warn("Aviso de rede ao contatar planilha Google (mantendo dados locais):", fetchErr);
          return null;
        }
      };

      const [logsRes, justRes] = await Promise.all([
        safeFetchJson(`${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=getLogs&_t=${Date.now()}`),
        safeFetchJson(`${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=getJustifications&_t=${Date.now()}`)
      ]);

      if (Array.isArray(logsRes) && logsRes.length > 0) {
        const validLogs: LogEntry[] = logsRes.filter((l: any) => l && (l.id || l.ID));
        allLogsCacheRef.current = validLogs;

        let logsToSet: LogEntry[];
        if (options?.forceAll || options?.scope === 'ALL') {
          logsToSet = validLogs;
        } else if (options?.targetMonth) {
          logsToSet = filterLogsBySelectedDates(validLogs, { month: options.targetMonth });
        } else {
          // Padrão especialista de Alta Performance: Carrega os últimos 3 meses
          // Garante precisão total para Mês Atual, Mês Anterior e KM contínuo
          logsToSet = filterLogsLast3Months(validLogs);
        }

        setLogs(logsToSet);

        try {
          // Manter cache local dos últimos 3 meses para carregamento inicial instantâneo
          const recentForStorage = filterLogsLast3Months(validLogs);
          localStorage.setItem('checkviatura_cached_logs', JSON.stringify(recentForStorage.slice(0, 600)));
        } catch (e) {
          console.warn("Limite de quota do storage atingido ao salvar logs", e);
        }

        const syncTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastSyncTime(syncTime);
        localStorage.setItem('checkviatura_last_sync', syncTime);

        const dataDuration = (performance.now() - startDataTime) / 1000;
        const durationFormatted = `${dataDuration.toFixed(2)}s`;
        setLastSyncDuration(durationFormatted);
        localStorage.setItem('checkviatura_last_sync_duration', durationFormatted);

        setSyncProgress(prev => {
          const sysTime = prev.systemTime;
          const totTime = sysTime !== undefined ? sysTime + dataDuration : dataDuration;
          return {
            ...prev,
            isActive: true,
            progress: 100,
            title: 'Dados Sincronizados com Sucesso',
            currentStep: 'Carregamento de dados finalizado com êxito!',
            dataTime: dataDuration,
            totalTime: totTime,
            status: 'completed',
            timestamp: syncTime,
            details: {
              ...prev.details,
              logsCount: validLogs.length
            }
          };
        });
      } else {
        // Se a requisição de rede falhar ou não retornar dados, aplicar filtro sobre o cache local já disponível
        if (allLogsCacheRef.current && allLogsCacheRef.current.length > 0) {
          let fallbackLogs: LogEntry[];
          if (options?.forceAll || options?.scope === 'ALL') {
            fallbackLogs = allLogsCacheRef.current;
          } else if (options?.targetMonth) {
            fallbackLogs = filterLogsBySelectedDates(allLogsCacheRef.current, { month: options.targetMonth });
          } else {
            fallbackLogs = filterLogsLast3Months(allLogsCacheRef.current);
          }
          setLogs(fallbackLogs);
        }
      }

      if (Array.isArray(justRes)) {
        setJustifications(justRes);
        try {
          localStorage.setItem('checkviatura_cached_justifications', JSON.stringify(justRes));
        } catch (e) {
          console.warn("Limite de quota do storage atingido ao salvar justificativas", e);
        }
      }
    } catch (err) {
      console.warn("Aviso ao buscar dados do dashboard (fallback para cache local ativado):", err);
      const dataDuration = (performance.now() - startDataTime) / 1000;
      setSyncProgress(prev => ({
        ...prev,
        isActive: true,
        progress: 100,
        title: 'Dados Carregados (Cache Local)',
        currentStep: 'Dados locais mantidos para operação contínua.',
        dataTime: dataDuration,
        totalTime: prev.systemTime ? prev.systemTime + dataDuration : dataDuration,
        status: 'completed',
        timestamp: new Date().toLocaleTimeString('pt-BR')
      }));
    } finally {
      setIsFetchingDashboardData(false);
    }
  };

  useEffect(() => {
    if (view === 'dashboard') {
      fetchDashboardData();
    }
  }, [view]);
  
  useEffect(() => {
    // Garantir que o usuário não permaneça em uma tela que não tem permissão
    if (view === 'dashboard' && !hasPermission('dashboard')) {
      setView('checklist');
    }
    if (view === 'settings' && !hasPermission('settings') && !['manual', 'about'].includes(activeTabInSettings)) {
      setView('checklist');
    }
  }, [view, currentUser]);

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('checkviatura_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as AppSettings;
        // Se a URL estiver vazia ou for uma das URLs antigas, forçamos a atualização para a nova URL fixa
        const legacyUrls = [
          'AKfycbz4tRvSdFPBJH5F8RBBg-30Br4e1-Ut4dxFSFejKvJtR8sgxgx5lZ25xHAvz_Z-4rK1',
          'AKfycbx6DPGFuH4H_PY_q6scgK6Tjq0l0-5BgF3EfucWYhCsSprX3ffLiobIOwusjQNkrKv54Q'
        ];
        if (!parsed.googleSheetUrl || legacyUrls.some(id => parsed.googleSheetUrl?.includes(id))) {
          parsed.googleSheetUrl = FIXED_GOOGLE_SHEET_URL;
        }

        // Sanitização de IDs duplicados
        if (parsed.stations) {
          const uniqueStations: Record<string, any> = {};
          parsed.stations.forEach((s: any) => {
            const id = s.id || Math.random().toString(36).substring(2, 11);
            if (!uniqueStations[id]) {
              uniqueStations[id] = { ...s, id };
            }
          });
          parsed.stations = Object.values(uniqueStations);
        }
        if (parsed.vehicles) {
          const uniqueVehicles: Record<string, any> = {};
          parsed.vehicles.forEach((v: any) => {
            const id = v.id || Math.random().toString(36).substring(2, 11);
            if (!uniqueVehicles[id]) {
              uniqueVehicles[id] = { ...v, id };
            }
          });
          parsed.vehicles = Object.values(uniqueVehicles);
        }

        return parsed;
      } catch (e) {
        console.error("Failed to parse settings", e);
      }
    }
    return {
      vehicleImages: INITIAL_VEHICLE_IMAGES,
      vehicleImageRatios: INITIAL_VEHICLE_RATIOS,
      defaultItems: INITIAL_CHECKLIST_ITEMS,
      vehicles: [],
      stations: [],
      headerTitle: 'Checklist de viatura',
      headerBgColor: undefined,
      headerLogoUrl1: undefined,
      headerLogoUrl2: undefined,
      printScale: 1.0,
      googleSheetUrl: FIXED_GOOGLE_SHEET_URL,
      appName: 'CheckViatura Pro',
      appDescription: 'Desenvolvido para gestão técnica de frotas de emergência e operacionais. Sistema resiliente de auditoria com reconstrução dinâmica de relatórios espelho e controle de acessos multinível.',
      developedBy: 'Equipe de Gestão de Frotas'
    };
  });

  const saveAuditLog = async (actionDesc: string, details: string) => {
    const rawUrl = settings.googleSheetUrl || FIXED_GOOGLE_SHEET_URL;
    const targetUrl = rawUrl?.trim();
    if (!targetUrl) return;

    let logUser = "VISITANTE";
    if (currentUser) {
      logUser = `${currentUser.rank || ''} ${currentUser.name || currentUser.username}`.trim();
    } else if (data.signatureName) {
      logUser = `VISITANTE: ${data.signatureRank || ''} ${data.signatureName} (VTR: ${data.prefix})`.trim().replace(/\s+/g, ' ');
    }

    const auditData = {
      action: 'saveAuditLog',
      id: crypto.randomUUID(),
      date: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      user: logUser,
      actionLog: actionDesc,
      details: details
    };

    try {
      const targetUrlWithAction = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=saveAuditLog`;
      await fetch(targetUrlWithAction, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(auditData)
      });
    } catch (err) {
      console.warn("Erro ao salvar log de auditoria:", err);
    }
  };

  const [data, setData] = useState<InspectionData>(() => {
    const initialFreq = 'Diário';
    const filteredDefaults = settings.defaultItems.filter(i => 
      i.frequency === initialFreq || i.frequency === 'Ambos'
    );
    
    return {
      id: crypto.randomUUID(),
      date: new Date().toISOString().split('T')[0],
      prefix: '',
      plate: '',
      checklistType: initialFreq,
      km: '',
      vehicleStatus: 'OPERANDO',
      items: filteredDefaults.map(i => ({ ...i, status: 'PENDING' as ItemStatus, photos: [] })),
      damages: [],
      photos: [],
      vehicleImages: [...settings.vehicleImages],
      vehicleImageRatios: [...(settings.vehicleImageRatios || INITIAL_VEHICLE_RATIOS)],
      generalObservation: '',
      signatureName: '',
      signatureRank: ''
    };
  });

  const performFullSync = async () => {
    const rawUrl = settings.googleSheetUrl || FIXED_GOOGLE_SHEET_URL;
    const targetUrl = (rawUrl && rawUrl.startsWith('http')) ? rawUrl.trim() : FIXED_GOOGLE_SHEET_URL;
    if (!targetUrl) return;

    const fullStartTime = performance.now();
    setIsSyncing(true);
    setSyncProgress({
      isActive: true,
      progress: 10,
      title: 'Sincronização Completa do Sistema & Dados',
      currentStep: 'Iniciando conexão com banco de dados e preparando tabelas...',
      status: 'syncing'
    });

    let systemDuration = 0;
    let dataDuration = 0;
    let vehiclesCount = settings.vehicles?.length || 0;
    let stationsCount = settings.stations?.length || 0;
    let usersCount = settings.users?.length || 0;
    let logsCount = logs.length;

    try {
      // ETAPA 1: Carregamento Completo do Sistema (Configurações, Usuários, Viaturas, Postos)
      const systemStartTime = performance.now();
      setSyncProgress(prev => ({
        ...prev,
        progress: 25,
        currentStep: 'Carregando configurações do sistema e banco de usuários...'
      }));

      const safeFetchJson = async (url: string) => {
        try {
          const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
          const timeoutId = controller ? setTimeout(() => controller.abort(), 12000) : null;
          const res = await fetch(url, {
            method: 'GET',
            mode: 'cors',
            signal: controller?.signal
          });
          if (timeoutId) clearTimeout(timeoutId);
          if (res && res.ok) {
            return await res.json();
          }
          return null;
        } catch (fetchErr) {
          console.warn("Aviso de rede ao contatar planilha Google (mantendo dados locais):", fetchErr);
          return null;
        }
      };

      const [settingsRes, usersRes, vehiclesRes, stationsRes] = await Promise.all([
        safeFetchJson(`${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=getSettings&_t=${Date.now()}`),
        safeFetchJson(`${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=getUsers&_t=${Date.now()}`),
        safeFetchJson(`${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=getVehicles&_t=${Date.now()}`),
        safeFetchJson(`${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=getStations&_t=${Date.now()}`)
      ]);

      systemDuration = (performance.now() - systemStartTime) / 1000;

      setSettings(prev => {
        let updated = { ...prev };

        // 1. Sincronizar Configurações do Sistema
        if (settingsRes && typeof settingsRes === 'object' && !Array.isArray(settingsRes)) {
          for (const key in settingsRes) {
            if (settingsRes.hasOwnProperty(key) && key !== 'googleSheetUrl' && key !== 'googleSpreadsheetId') {
              (updated as any)[key] = settingsRes[key];
            }
          }
        }

        // 2. Sincronizar Usuários
        if (Array.isArray(usersRes) && usersRes.length > 0) {
          updated.users = usersRes;
          usersCount = usersRes.length;
        }

        // 3. Sincronizar Viaturas
        if (Array.isArray(vehiclesRes) && vehiclesRes.length > 0) {
          updated.vehicles = vehiclesRes;
          vehiclesCount = vehiclesRes.length;
        }

        // 4. Sincronizar Postos
        if (Array.isArray(stationsRes) && stationsRes.length > 0) {
          updated.stations = stationsRes;
          stationsCount = stationsRes.length;
        }

        localStorage.setItem('checkviatura_settings', JSON.stringify(updated));
        console.log("Todas as configurações e tabelas sincronizadas do banco de dados com sucesso na inicialização!");
        return updated;
      });

      // ETAPA 2: Carregamento Completo de Dados (Logs de conferência e Justificativas)
      const dataStartTime = performance.now();
      setSyncProgress(prev => ({
        ...prev,
        progress: 60,
        systemTime: systemDuration,
        currentStep: 'Sistema carregado. Buscando conferências e justificativas operacionais...'
      }));

      const [logsRes, justRes] = await Promise.all([
        safeFetchJson(`${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=getLogs&_t=${Date.now()}`),
        safeFetchJson(`${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=getJustifications&_t=${Date.now()}`)
      ]);

      dataDuration = (performance.now() - dataStartTime) / 1000;

      if (Array.isArray(logsRes) && logsRes.length > 0) {
        const validLogs: LogEntry[] = logsRes.filter((l: any) => l && (l.id || l.ID));
        allLogsCacheRef.current = validLogs;
        const recentForStorage = filterLogsLast3Months(validLogs);
        setLogs(recentForStorage);
        logsCount = validLogs.length;

        try {
          localStorage.setItem('checkviatura_cached_logs', JSON.stringify(recentForStorage.slice(0, 600)));
        } catch (e) {
          console.warn("Storage quota excedida ao salvar logs", e);
        }
      }

      if (Array.isArray(justRes)) {
        setJustifications(justRes);
        try {
          localStorage.setItem('checkviatura_cached_justifications', JSON.stringify(justRes));
        } catch (e) {
          console.warn("Storage quota excedida ao salvar justificativas", e);
        }
      }

      const syncTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastSyncTime(syncTime);
      localStorage.setItem('checkviatura_last_sync', syncTime);

      const totalDuration = (performance.now() - fullStartTime) / 1000;
      const durationFormatted = `${totalDuration.toFixed(2)}s`;
      setLastSyncDuration(durationFormatted);
      localStorage.setItem('checkviatura_last_sync_duration', durationFormatted);

      setSyncProgress({
        isActive: true,
        progress: 100,
        title: 'Sincronização Concluída com Sucesso',
        currentStep: 'Carregamento completo do sistema e dados finalizado com êxito!',
        systemTime: systemDuration,
        dataTime: dataDuration,
        totalTime: totalDuration,
        status: 'completed',
        timestamp: syncTime,
        details: {
          vehiclesCount,
          stationsCount,
          usersCount,
          logsCount
        }
      });
    } catch (err) {
      console.warn("Aviso na sincronização completa:", err);
      const totalDuration = (performance.now() - fullStartTime) / 1000;
      setSyncProgress({
        isActive: true,
        progress: 100,
        title: 'Sincronização Concluída',
        currentStep: 'Dados locais preservados com sucesso.',
        systemTime: systemDuration,
        dataTime: dataDuration,
        totalTime: totalDuration,
        status: 'completed',
        timestamp: new Date().toLocaleTimeString('pt-BR')
      });
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    // Sincronização inicial automática ao abrir a aplicação
    performFullSync();
  }, []);

  useEffect(() => {
    // Sincronizar imagens da viatura caso a nuvem traga imagens customizadas
    if (settings.vehicleImages && settings.vehicleImages.length > 0) {
      setData(prev => {
        // Apenas sincroniza se o usuário ainda não tiver feito alterações locais (ex: sem fotos de inspeção e sem danos)
        if (prev.photos.length === 0 && prev.damages.length === 0) {
          return {
            ...prev,
            vehicleImages: [...settings.vehicleImages],
            vehicleImageRatios: [...(settings.vehicleImageRatios || [])]
          };
        }
        return prev;
      });
    }
  }, [settings.vehicleImages, settings.vehicleImageRatios]);

  useEffect(() => {
    if (currentUser) {
      setData(prev => ({
        ...prev,
        signatureName: prev.signatureName || currentUser.name || currentUser.username,
        signatureRank: prev.signatureRank || currentUser.rank || ''
      }));
    }
  }, [currentUser]);

  // Buscar último checklist ao selecionar uma viatura
  useEffect(() => {
    if (data.prefix && logs.length > 0) {
      const vehicleLogs = logs
        .filter(l => l.prefix === data.prefix)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      if (vehicleLogs.length > 0) {
        const lastLog = vehicleLogs[0];
        try {
          if (lastLog.fullData) {
            const parsed = JSON.parse(lastLog.fullData);
            if (parsed.items) {
              setLastChecklistData(parsed.items.map((i: any) => ({
                label: i.label,
                status: i.status,
                observation: i.observation
              })));
            }
          } else if (lastLog.itemsDetail) {
             const itemsDetail = JSON.parse(lastLog.itemsDetail);
             setLastChecklistData(itemsDetail.map((i: any) => ({
               label: i.label,
               status: i.status,
               observation: i.observation
             })));
          }
        } catch (e) {
          console.warn("Erro ao processar histórico do checklist:", e);
          setLastChecklistData(undefined);
        }
      } else {
        setLastChecklistData(undefined);
      }
    } else {
      setLastChecklistData(undefined);
    }
  }, [data.prefix, logs]);

  const themeColor = settings.headerBgColor || '#b91c1c';
  const printScale = settings.printScale || 1.0;


  useEffect(() => {
    const filteredDefaults = settings.defaultItems.filter(i => {
      const matchFreq = i.frequency === data.checklistType || i.frequency === 'Ambos';
      // Se tiver tipo de viatura selecionado, filtra por ele. Se não, mostra todos que batem com a frequência.
      const matchType = data.vehicleType ? i.vehicleTypes?.includes(data.vehicleType) : true;
      return matchFreq && matchType;
    });
    
    setData(prev => ({
      ...prev,
      items: filteredDefaults.map(i => {
        const existing = prev.items.find(pi => pi.id === i.id);
        return existing 
          ? { ...i, status: existing.status, observation: existing.observation, photos: existing.photos || [] } 
          : { ...i, status: 'PENDING' as ItemStatus, photos: [] };
      })
    }));
  }, [data.checklistType, data.vehicleType, settings.defaultItems]);

  const handleStatusChange = (id: string, status: ItemStatus) => {
    setData(prev => ({
      ...prev,
      items: prev.items.map(item => item.id === id ? { ...item, status } : item)
    }));
  };

  const handleObservationChange = (id: string, observation: string) => {
    setData(prev => ({
      ...prev,
      items: prev.items.map(item => item.id === id ? { ...item, observation } : item)
    }));
  };

  const handleItemPhotoUpload = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const compressed = await compressImage(reader.result as string);
      setData(prev => ({
        ...prev,
        items: prev.items.map(item => 
          item.id === id 
            ? { ...item, photos: [...(item.photos || []), compressed] }
            : item
        )
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveToGeneralNotes = (id: string) => {
    const item = data.items.find(i => i.id === id);
    if (!item || !item.observation) return;
    const textToAdd = `${item.label}: ${item.observation}`;
    setData(prev => ({
      ...prev,
      generalObservation: prev.generalObservation 
        ? `${prev.generalObservation}\n${textToAdd}` 
        : textToAdd
    }));
  };

  const handleVehicleImageUpload = async (index: number, base64: string) => {
    const compressed = await compressImage(base64);
    const newImages = [...data.vehicleImages];
    newImages[index] = compressed;
    setData(prev => ({ ...prev, vehicleImages: newImages }));
  };

  useEffect(() => {
    initAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
      }
    );
  }, []);

  const handleGoogleSync = async () => {
    if (!googleToken) {
      alert("Conecte sua conta Google primeiro nos ajustes.");
      return;
    }
    setIsSyncing(true);
    try {
      const spreadsheetId = await sheetsService.ensureSpreadsheet(googleToken, settings);
      if (spreadsheetId !== settings.googleSpreadsheetId) {
        const newSettings = { ...settings, googleSpreadsheetId: spreadsheetId };
        setSettings(newSettings);
        localStorage.setItem('checkviatura_settings', JSON.stringify(newSettings));
      }

      await sheetsService.syncSettings(googleToken, spreadsheetId, settings);
      if (settings.vehicles) await sheetsService.syncVehicles(googleToken, spreadsheetId, settings.vehicles);
      if (settings.stations) await sheetsService.syncStations(googleToken, spreadsheetId, settings.stations);
      if (settings.sgbs) await sheetsService.syncSgbs(googleToken, spreadsheetId, settings.sgbs);
      if (settings.gbs) await sheetsService.syncGbs(googleToken, spreadsheetId, settings.gbs);
      if (settings.users) await sheetsService.syncUsers(googleToken, spreadsheetId, settings.users);
      
      console.log("Sincronização com Google Sheets concluída.");
    } catch (err) {
      console.error("Erro na sincronização:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCheckConnection = async () => {
    const rawUrl = settings.googleSheetUrl || FIXED_GOOGLE_SHEET_URL;
    const targetUrl = rawUrl?.trim();
    if (!targetUrl) {
      setConnectionStatus('offline');
      return;
    }

    setConnectionStatus('checking');
    try {
      const targetUrlWithAction = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=ping`;
      await fetch(targetUrlWithAction, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'ping' })
      });
      setConnectionStatus('online');
    } catch (err) {
      console.error("Erro ao verificar conexão:", err);
      setConnectionStatus('offline');
    }
  };

  const syncEntitiesToGoogleSheets = async (newSettings: AppSettings) => {
    const rawUrl = newSettings.googleSheetUrl || FIXED_GOOGLE_SHEET_URL;
    const targetUrl = rawUrl?.trim();
    if (!targetUrl) return;

    const syncData = {
      action: 'syncEntities',
      settings: JSON.stringify(newSettings),
      vehicles: JSON.stringify(newSettings.vehicles || []),
      stations: JSON.stringify(newSettings.stations || []),
      sgbs: JSON.stringify(newSettings.sgbs || []),
      gbs: JSON.stringify(newSettings.gbs || []),
      users: JSON.stringify(newSettings.users || []),
      timestamp: new Date().toISOString()
    };

    try {
      const targetUrlWithAction = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=syncEntities`;
      await fetch(targetUrlWithAction, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(syncData)
      });
      console.log("Sincronização de entidades enviada.");
    } catch (err) {
      console.warn("Erro na sincronização de entidades:", err);
    }
  };

  const handleSaveSettings = async (newSettings: AppSettings) => {
    setIsSaving(true);
    setSettings(newSettings);
    localStorage.setItem('checkviatura_settings', JSON.stringify(newSettings));
    
    saveAuditLog('ALTERACAO_CONFIGURACOES', 'Usuário alterou as configurações do sistema');

    // Sincronização automática com Apps Script (Legado/Principal conforme pedido)
    await syncEntitiesToGoogleSheets(newSettings);

    // Sincronização automática com Google Sheets Autenticado (Opcional se ativo)
    if (googleToken) {
      handleGoogleSync();
    }
    
    // Atualizar logs para garantir que a conferencia anterior esteja disponível
    fetchDashboardData();
    
    setIsSaving(false);
    setView('checklist');
  };

  const handleGoogleLoginSuccess = async (profile: any, accessToken: string) => {
    setIsLoggingIn(true);
    try {
      const email = profile.email?.toLowerCase().trim();
      
      if (!email) {
        alert("Erro: E-mail não informado pela conta Google.");
        setIsLoggingIn(false);
        return;
      }

      // 1. Buscar usuário vinculado por este e-mail localmente
      let matchedUser = (settings.users || []).find(u => {
        const uEmail = u.email?.toString().toLowerCase().trim();
        return uEmail === email;
      });
      
      // 2. Se não encontrou localmente, busca lista atualizada do Sheets via GAS
      if (!matchedUser) {
        const targetUrl = settings.googleSheetUrl?.trim() || FIXED_GOOGLE_SHEET_URL;
        const usersRes = await fetch(`${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=getUsers`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null);
        
        if (Array.isArray(usersRes)) {
          const updatedSettings = { ...settings, users: usersRes };
          setSettings(updatedSettings);
          localStorage.setItem('checkviatura_settings', JSON.stringify(updatedSettings));
          
          matchedUser = usersRes.find(u => {
            const uEmail = u.email?.toString().toLowerCase().trim();
            return uEmail === email;
          });
        }
      }

      if (matchedUser) {
        const userObj: GoogleUser = {
          email: email,
          name: profile.name || email.split('@')[0],
          picture: profile.picture || `https://ui-avatars.com/api/?name=${email}&background=random`,
          displayName: profile.name || email.split('@')[0],
          photoURL: profile.picture || `https://ui-avatars.com/api/?name=${email}&background=random`
        };

        setGoogleUser(userObj);
        setGoogleToken(accessToken);
        saveGoogleSession(userObj, accessToken);
        
        setCurrentUser(matchedUser);
        setShowLoginModal(false);
        
        saveAuditLog('LOGIN_GOOGLE', `Usuário validado via Google (${email})`);
      } else {
        alert(`ERRO: O e-mail ${email} não está vinculado a nenhum usuário cadastrado na aba USUARIOS.`);
        googleLogout();
      }
    } catch (err) {
      console.error("Erro no processamento do login Google:", err);
      alert("Falha ao processar login Google.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    
    try {
      // 1. Tentar validar com usuários já carregados localmente
      let users = settings.users || [];
      let user = users.find(u => 
        u.username?.toString().toLowerCase().trim() === loginUsername.toLowerCase().trim() && 
        u.password?.toString().trim() === loginPassword.trim()
      );

      // 2. Se não encontrou localmente, busca a lista atualizada do Google Sheets (aba USUARIOS)
      if (!user) {
        const targetUrl = settings.googleSheetUrl?.trim() || FIXED_GOOGLE_SHEET_URL;
        const usersRes = await fetch(`${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=getUsers`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null);
        
        if (Array.isArray(usersRes)) {
          // Atualiza o estado local de usuários para futuras validações
          const updatedSettings = { ...settings, users: usersRes };
          setSettings(updatedSettings);
          localStorage.setItem('checkviatura_settings', JSON.stringify(updatedSettings));
          
          // Tenta validar novamente com a lista recém-baixada
          user = usersRes.find(u => 
            u.username?.toString().toLowerCase().trim() === loginUsername.toLowerCase().trim() && 
            u.password?.toString().trim() === loginPassword.trim()
          );
        }
      }

      // 3. Verificação de Super User Legado
      if (!user && loginUsername.toLowerCase() === 'cavalieri' && loginPassword === 'tricolor') {
        const superUser: User = {
          id: 'master',
          username: 'cavalieri',
          name: 'Administrador Mestre',
          password: 'tricolor',
          permissions: { checklist: true, reports: true, settings: true, admin: true }
        };
        setCurrentUser(superUser);
        setShowLoginModal(false);
        setLoginUsername('');
        setLoginPassword('');
        setIsLoggingIn(false);
        return;
      }

      if (user) {
        // Limpar estados de interface IMEDIATAMENTE
        setCurrentUser(user);
        setShowLoginModal(false);
        setLoginUsername('');
        setLoginPassword('');
        setIsLoggingIn(false);
        
        // Registro de log em background
        saveAuditLog('LOGIN', `Usuário ${user.username} realizou login com sucesso via base de dados`);
        return;
      } else {
        alert('Usuário ou senha inválidos. Verifique se o cadastro está correto na aba USUARIOS da planilha.');
      }
    } catch (err) {
      console.error("Erro no processo de login:", err);
      alert("Erro ao conectar com o servidor de usuários. Verifique sua conexão.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    saveAuditLog('LOGOUT', 'Usuário realizou logout');
    googleLogout();
    setCurrentUser(null);
    setGoogleUser(null);
    setGoogleToken(null);
    setLoginUsername('');
    setLoginPassword('');
    setShowLoginModal(false);
    setView('checklist');
  };

  // Removido o bloqueio de login obrigatório
  
  const hasPermission = (screen: keyof User['permissions']) => {
    // Se não há usuário logado (Visitante), restringimos menus críticos
    if (!currentUser) {
      if (screen === 'checklist' || screen === 'dashboard') return true; // Permitido para preencher checklist e visualizar dashboard
      return false; // Todos os outros bloqueados para não logados
    }
    
    // Telas Restritas Somente ao Super Usuário Cavalieri
    if (['viewAudit', 'manageLogs', 'manageDatabase', 'manageReportEditor'].includes(screen as string)) {
      return currentUser.username.toLowerCase() === 'cavalieri';
    }

    // Usuário Mestre Cavalieri sempre tem acesso total
    if (currentUser.username.toLowerCase() === 'cavalieri') return true;

    // Admin Geral continua como mestre do sistema para as demais telas
    if (currentUser.permissions.admin) return true;

    if (screen === 'settings') {
      const p = currentUser.permissions;
      const hasAnyReportPerm = !!(
        p.reports || 
        p.reportNovelties || 
        p.reportSynthetic || 
        p.reportAnalytical || 
        p.reportFull || 
        p.reportMonthlyGrouped || 
        p.reportHistory || 
        p.reportDailyControl || 
        p.reportDailyControlMotos || 
        p.reportWeeklyLeves || 
        p.reportWeeklyMotos || 
        p.reportWeeklyAb || 
        p.reportRetroactiveLogs || 
        p.reportFinalMonthlyBook || 
        p.reportFleetDashboard || 
        p.reportKmMonthly
      );

      return !!(p.manageStations || 
               p.manageVehicles || 
               p.manageUsers || 
               p.manageItems || 
               p.manageImages || 
               p.manageStyle || 
               hasAnyReportPerm ||
               p.settings);
    }

    if (screen === 'reports') {
      const p = currentUser.permissions;
      return !!(
        p.reports || 
        p.reportNovelties || 
        p.reportSynthetic || 
        p.reportAnalytical || 
        p.reportFull || 
        p.reportMonthlyGrouped || 
        p.reportHistory || 
        p.reportDailyControl || 
        p.reportDailyControlMotos || 
        p.reportWeeklyLeves || 
        p.reportWeeklyMotos || 
        p.reportWeeklyAb || 
        p.reportRetroactiveLogs || 
        p.reportFinalMonthlyBook || 
        p.reportFleetDashboard || 
        p.reportKmMonthly
      );
    }

    if (screen === 'dashboard') {
      return true; // Dashboard de prontidão é tela de consulta operacional acessível a todos
    }
    
    return !!currentUser.permissions[screen as keyof User['permissions']];
  };

  const handleExportModel = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `modelo_${data.prefix || 'viatura'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportModel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string);
        if (importedData.items && importedData.checklistType) {
          setData({ 
            ...importedData, 
            id: crypto.randomUUID(),
            date: new Date().toISOString().split('T')[0] // Mantém a data de hoje ao importar
          });
          alert("Modelo importado com sucesso!");
        } else {
          throw new Error("Formato inválido");
        }
      } catch (err) {
        alert("Erro ao importar modelo. Verifique se o arquivo é um JSON de checklist válido.");
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input para permitir nova importação do mesmo arquivo se necessário
  };

  const saveLogToGoogleSheets = async () => {
    const rawUrl = settings.googleSheetUrl || FIXED_GOOGLE_SHEET_URL;
    const targetUrl = rawUrl?.trim();
    
    if (!targetUrl) {
      console.warn("URL do Google Sheets não configurada.");
      return;
    }
    
    const itemsOk = data.items.filter(i => i.status === 'OK').length;
    const itemsCn = data.items.filter(i => i.status === 'CN').length;
    const inspectorFullName = `${data.signatureRank || ''} ${data.signatureName || ''}`.trim() || 'NÃO IDENTIFICADO';

    const itemsDetailArray = data.items.map(i => ({
      label: i.label,
      status: i.status === 'OK' ? 'SN' : i.status === 'CN' ? 'CN' : 'Pendente',
      observation: i.observation || ''
    }));

    const dataForMirror = {
      ...data,
      signatureFull: inspectorFullName,
      headerTitle: settings.headerTitle,
      headerBgColor: settings.headerBgColor,
      headerLogoUrl1: settings.headerLogoUrl1,
      headerLogoUrl2: settings.headerLogoUrl2
    };

    const brDateStr = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    const logData = {
      action: 'saveLog',
      id: data.id,
      date: brDateStr, 
      prefix: String(data.prefix || 'N/A').trim(),
      plate: String(data.plate || 'N/A').trim(),
      checklistType: data.checklistType,
      km: String(data.km || '0'), 
      inspector: inspectorFullName,
      itemsStatus: `${itemsOk} SN / ${itemsCn} CN`,
      vehicleStatus: data.vehicleStatus || 'OPERANDO',
      itemsDetail: JSON.stringify(itemsDetailArray),
      fullData: JSON.stringify(dataForMirror),
      generalObservation: data.generalObservation,
      screenshot: "" 
    };

    // Atualização instantânea e otimista do estado local de logs para exibição sem delay no Dashboard
    const instantLogEntry: LogEntry = {
      id: logData.id,
      date: logData.date,
      prefix: logData.prefix,
      plate: logData.plate,
      checklistType: logData.checklistType,
      km: logData.km,
      inspector: logData.inspector,
      itemsStatus: logData.itemsStatus,
      vehicleStatus: logData.vehicleStatus,
      itemsDetail: logData.itemsDetail,
      fullData: logData.fullData,
      generalObservation: logData.generalObservation,
      screenshot: ""
    };

    setLogs(prev => {
      const filtered = prev.filter(l => l.id !== instantLogEntry.id);
      const updated = [instantLogEntry, ...filtered];
      try {
        localStorage.setItem('checkviatura_cached_logs', JSON.stringify(updated.slice(0, 1000)));
      } catch (e) {
        console.warn("Storage quota:", e);
      }
      return updated;
    });

    // Atualizar KM da viatura localmente de imediato
    if (data.prefix && data.km) {
      const updatedVehicles = (settings.vehicles || []).map(v => {
        if (v.prefix === data.prefix) {
          return { ...v, currentKm: Number(data.km) };
        }
        return v;
      });
      const updatedSettings = { ...settings, vehicles: updatedVehicles };
      setSettings(updatedSettings);
      try {
        localStorage.setItem('checkviatura_settings', JSON.stringify(updatedSettings));
      } catch (e) {}
    }

    if (logData.fullData.length > 45000) {
      console.warn("Payload grande detectado. Otimizando dados...");
      const optimizedMirror = { ...dataForMirror, vehicleImages: [] };
      logData.fullData = JSON.stringify(optimizedMirror);
    }

    const targetUrlWithAction = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=saveLog`;
    console.log("Enviando dados para o Google Sheets...", { id: logData.id, size: logData.fullData.length, url: targetUrlWithAction });

    // Promisify the fetch to ensure we can await it even if it falls back
    return new Promise<void>(async (resolve) => {
      try {
        console.log("Payload para envio:", logData);
        
        // Usamos text/plain para evitar problemas de CORS (preflight) com Google Apps Script
        const response = await fetch(targetUrlWithAction, {
          method: 'POST',
          mode: 'cors',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8',
          },
          body: JSON.stringify(logData)
        }).catch(err => {
          console.warn("Erro CORS ou Rede, tentando modo no-cors...", err);
          return fetch(targetUrlWithAction, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
              'Content-Type': 'text/plain;charset=utf-8',
            },
            body: JSON.stringify(logData)
          });
        });

        if (response && response.type !== 'opaque') {
          const result = await response.json();
          if (result.result === 'success') {
            console.log("Log salvo com sucesso no Google Sheets");
            
            // Atualizar KM atual da viatura nas configurações globais
            if (data.prefix && data.km) {
              const updatedVehicles = (settings.vehicles || []).map(v => {
                if (v.prefix === data.prefix) {
                  return { ...v, currentKm: Number(data.km) };
                }
                return v;
              });
              
              const updatedSettings = { ...settings, vehicles: updatedVehicles };
              setSettings(updatedSettings);
              localStorage.setItem('checkviatura_settings', JSON.stringify(updatedSettings));
            }
          } else {
            console.error("Erro retornado pelo script:", result.message);
          }
        } else {
          console.log("Log enviado (modo no-cors). Verifique a planilha.");
          
          // Fallback para atualizar KM localmente mesmo no modo no-cors
          if (data.prefix && data.km) {
            const updatedVehicles = (settings.vehicles || []).map(v => {
              if (v.prefix === data.prefix) {
                return { ...v, currentKm: Number(data.km) };
              }
              return v;
            });
            const updatedSettings = { ...settings, vehicles: updatedVehicles };
            setSettings(updatedSettings);
            localStorage.setItem('checkviatura_settings', JSON.stringify(updatedSettings));
          }
        }
        resolve();
      } catch (err) {
        console.error("Erro fatal ao salvar no Google Sheets:", err);
        resolve(); // Resolve anyway to not block the main flow indefinitely
      }
    });
  };

  const resetChecklistForm = () => {
    const initialFreq = 'Diário';
    const filteredDefaults = (settings.defaultItems || []).filter(i => 
      i.frequency === initialFreq || i.frequency === 'Ambos'
    );
    
    setData({
      id: crypto.randomUUID(),
      date: new Date().toISOString().split('T')[0],
      prefix: '',
      plate: '',
      checklistType: initialFreq,
      km: '',
      vehicleStatus: 'OPERANDO',
      items: filteredDefaults.map(i => ({ ...i, status: 'PENDING' as ItemStatus, photos: [] })),
      damages: [],
      photos: [],
      vehicleImages: [...(settings.vehicleImages || [])],
      vehicleImageRatios: [...(settings.vehicleImageRatios || INITIAL_VEHICLE_RATIOS)],
      generalObservation: '',
      signatureName: currentUser ? (currentUser.name || currentUser.username || '') : (googleUser ? (googleUser.name || '') : ''),
      signatureRank: currentUser?.rank || ''
    });
  };

  const handleVisualizarPdf = async () => {
    if (data.items.some(item => item.status === 'PENDING')) {
      alert("BLOQUEIO: Existem itens pendentes.");
      return;
    }
    if (!data.prefix.trim() || !data.plate.trim() || !data.km.trim() || !data.signatureName?.trim()) {
      alert("DADOS INCOMPLETOS: Prefixo, Placa, KM e Nome do Conferente são obrigatórios.");
      return;
    }

    // Validação de KM não inferior ao atual
    const vehicle = settings.vehicles?.find(v => v.prefix === data.prefix);
    if (vehicle && vehicle.currentKm && Number(data.km) < vehicle.currentKm) {
      alert(`BLOQUEIO: O KM informado (${data.km}) é menor que o KM anterior (${vehicle.currentKm}). Por favor, verifique o odômetro.`);
      return;
    }

    // Bloqueio de duplicatas no mesmo dia
    const alreadyDone = logs.some(l => 
      l.prefix === data.prefix && 
      new Date(l.date).toLocaleDateString() === new Date().toLocaleDateString()
    );
    
    if (alreadyDone) {
      alert(`BLOQUEIO: Já existe um checklist realizado hoje para a viatura ${data.prefix}.`);
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    if (data.date !== today) {
      const reason = prompt("ESTE CHECKLIST POSSUI DATA RETROATIVA.\n\nPor favor, informe o MOTIVO DO LANÇAMENTO RETROATIVO para fins de auditoria na Folha de Justificativas:", "");
      if (!reason || reason.trim() === "") {
        alert("BLOQUEIO: É obrigatório informar o motivo para lançamentos com data retroativa.");
        return;
      }
      
      // Salvar justificativa automaticamente
      const rawUrl = settings.googleSheetUrl || FIXED_GOOGLE_SHEET_URL;
      if (rawUrl) {
         try {
           const jData = {
             action: "saveJustification",
             id: crypto.randomUUID(),
             date: data.date,
             dateRef: data.date,
             type: data.checklistType?.toUpperCase() || "GERAL",
             vehicleType: data.prefix,
             station: data.station || "",
             justification: `[LANÇAMENTO RETROATIVO] ${reason}`,
             author: `${data.signatureRank || ''} ${data.signatureName || ''}`.trim(),
             authorRank: data.signatureRank || "CONFERENTE",
             createdAt: new Date().toISOString(),
             month: data.date.substring(0, 7),
             status: "SIGNED"
           };
           
           await fetch(`${rawUrl}${rawUrl.includes('?') ? '&' : '?'}action=saveJustification`, {
             method: 'POST',
             mode: 'no-cors',
             body: JSON.stringify(jData)
           });
           console.log("Justificativa retroativa enviada com sucesso.");
         } catch (err) {
           console.warn("Erro ao enviar justificativa automática:", err);
         }
      }
    }

    setPrintTimestamp(new Date().toLocaleString('pt-BR'));
    setShowExportMenu(false);
    setIsSaving(true);
    
    const finishedPrefix = String(data.prefix || '').trim();
    const finishedCycle = data.checklistType || 'Diário';

    try {
      await saveLogToGoogleSheets();
      await saveAuditLog('CHECKLIST_FINALIZADO', `Checklist ${finishedCycle} finalizado para viatura ${finishedPrefix}`);
      
      // Se tiver token do Google Real, salva também na planilha real
      if (googleToken && settings.googleSpreadsheetId) {
        const logToAppend: LogEntry = {
          ...data,
          date: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
          signatureRank: data.signatureRank || '',
          signatureName: data.signatureName || ''
        } as any;
        await sheetsService.appendLog(googleToken, settings.googleSpreadsheetId, logToAppend);
      }
      
      // Atualizar dados do dashboard em tempo real
      await fetchDashboardData();

      // Definir feedback de sucesso para exibição no Dashboard
      setRecentConferenceSuccess({
        prefix: finishedPrefix,
        message: `Checklist ${finishedCycle} da viatura ${finishedPrefix} finalizado com sucesso! Todos os indicadores foram atualizados.`
      });

      // Resetar formulário do checklist para a próxima conferência
      resetChecklistForm();

      // Exibir imediatamente a tela de dashboard
      setView('dashboard');
      
    } catch (err) {
      console.error("Erro no processo de finalização:", err);
      alert("Erro ao salvar dados. Verifique sua conexão ou as configurações da planilha.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOnlySave = async () => {
    if (data.items.some(item => item.status === 'PENDING')) {
      alert("BLOQUEIO: Existem itens pendentes.");
      return;
    }
    if (!data.prefix.trim() || !data.plate.trim() || !data.km.trim() || !data.signatureName?.trim()) {
      alert("DADOS INCOMPLETOS: Prefixo, Placa, KM e Nome do Conferente são obrigatórios.");
      return;
    }

    // Validação de KM não inferior ao atual
    const vtr = settings.vehicles?.find(v => v.prefix === data.prefix);
    if (vtr && vtr.currentKm && Number(data.km) < vtr.currentKm) {
      alert(`BLOQUEIO: O KM informado (${data.km}) é menor que o KM anterior (${vtr.currentKm}). Por favor, verifique o odômetro.`);
      return;
    }

    // Bloqueio de duplicatas no mesmo dia
    const alreadyDone = logs.some(l => 
      l.prefix === data.prefix && 
      new Date(l.date).toLocaleDateString() === new Date().toLocaleDateString()
    );
    
    if (alreadyDone) {
      alert(`BLOQUEIO: Já existe um checklist realizado hoje para a viatura ${data.prefix}.`);
      return;
    }

    setIsSaving(true);
    const finishedPrefix = String(data.prefix || '').trim();
    const finishedCycle = data.checklistType || 'Diário';

    try {
      await saveLogToGoogleSheets();
      await saveAuditLog('CHECKLIST_SALVO', `Checklist ${finishedCycle} salvo manualmente para viatura ${finishedPrefix}`);
      
      // Atualizar dashboard
      await fetchDashboardData();

      setRecentConferenceSuccess({
        prefix: finishedPrefix,
        message: `Checklist ${finishedCycle} da viatura ${finishedPrefix} salvo com sucesso! Indicadores atualizados.`
      });

      resetChecklistForm();
      setView('dashboard');
    } catch (err) {
      console.error("Erro ao salvar:", err);
      alert("Erro ao salvar dados.");
    } finally {
      setIsSaving(false);
    }
  };

  const hasVehicleImages = data.vehicleImages.some(img => img && img !== "");

  return (
    <div 
      className="min-h-screen pt-24 pb-4 px-4 sm:px-6 print:pt-0 print:pb-0 print:px-0 transition-all flex flex-col relative"
      style={{ 
        backgroundImage: (!settings.homeVideoUrl && (view === 'checklist' || !currentUser || showLoginModal || showSplash)) 
          ? (((!currentUser || showLoginModal) && settings.loginBgUrl) ? `url(${settings.loginBgUrl})` : (settings.homeBgUrl ? `url(${settings.homeBgUrl})` : 'none'))
          : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Vídeo de fundo do sistema (Início / Login / Geral) */}
      {settings.homeVideoUrl && (view === 'checklist' || !currentUser || showLoginModal || showSplash) && (
        <div className="fixed inset-0 overflow-hidden pointer-events-none select-none -z-10 print:hidden">
          {getYouTubeEmbedUrl(settings.homeVideoUrl) ? (
            <iframe
              src={getYouTubeEmbedUrl(settings.homeVideoUrl)!}
              className="absolute top-1/2 left-1/2 w-[100vw] h-[100vh] min-w-[177.77vh] min-h-[56.25vw] -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-80"
              allow="autoplay; encrypted-media; gyroscope; picture-in-picture"
              title="Vídeo de Fundo do Sistema"
            />
          ) : (
            <video
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover opacity-80"
              src={settings.homeVideoUrl}
            />
          )}
          <div className="absolute inset-0 bg-black/35 backdrop-blur-[0.5px]" />
        </div>
      )}
      {/* Barra de Sincronização em Tempo Real (Métricas exatas de carregamento de sistema e dados) */}
      <SyncProgressBar 
        info={syncProgress} 
        onClose={() => setSyncProgress(prev => ({ ...prev, isActive: false }))} 
        onRetry={performFullSync}
      />

      {showSplash && !currentUser && (
        <div className="fixed inset-0 z-[500] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-1000">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
          <div className="relative space-y-12 max-w-lg w-full">
            <div className="space-y-4">
               {settings.headerLogoUrl1 && (
                 <img src={settings.headerLogoUrl1} alt="Logo" className="h-32 mx-auto drop-shadow-2xl animate-pulse" />
               )}
               <div className="space-y-2">
                 <h1 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter drop-shadow-2xl">
                   {settings.appName || 'Checklist Digital'}
                 </h1>
                 <div className="h-1 w-24 bg-blue-500 mx-auto rounded-full shadow-[0_0_20px_rgba(59,130,246,0.8)]" />
                 <p className="text-blue-100/80 text-xs font-bold uppercase tracking-[0.3em] mt-4 drop-shadow-lg">
                   {settings.appDescription || 'Sistema de Inspeção de Viaturas'}
                 </p>
               </div>
            </div>

            <button 
              onClick={() => {
                setShowSplash(false);
                setShowLoginModal(true);
                if (syncProgress.status !== 'syncing' && syncProgress.status !== 'completed') {
                  performFullSync();
                }
              }}
              className="group relative bg-white/10 backdrop-blur-md border border-white/20 text-white px-12 py-6 rounded-3xl text-sm font-black uppercase tracking-widest shadow-2xl hover:bg-white/20 transition-all active:scale-95 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/0 via-blue-600/20 to-blue-600/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              <span className="relative flex items-center gap-3">
                Carregar Sistema
                <RefreshCw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-700" />
              </span>
            </button>

            {syncProgress.status === 'syncing' ? (
              <div className="mt-3 flex items-center justify-center gap-2 text-xs font-mono text-blue-300">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
                <span>Carregando sistema e dados em tempo real...</span>
              </div>
            ) : syncProgress.status === 'completed' && syncProgress.totalTime !== undefined ? (
              <div className="mt-3 flex items-center justify-center gap-2 text-xs font-mono text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Sistema pronto • Carregado em {syncProgress.totalTime.toFixed(2)}s</span>
              </div>
            ) : null}

            <div className="pt-10">
               <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                 Desenvolvido por {settings.developedBy || 'Corpo de Bombeiros'}
               </p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto w-full flex-1">
        {(isSaving || isLoggingIn) && (
        <div className="fixed inset-0 z-[400] bg-black/70 backdrop-blur-md flex items-center justify-center flex-col text-white gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-blue-400" />
          <div className="text-center">
            <h3 className="font-black text-lg uppercase tracking-widest">
              {isLoggingIn ? 'Autenticando Usuário' : 'Gravando Conferência'}
            </h3>
            <p className="text-xs text-blue-200 font-bold opacity-70">
              {isLoggingIn ? 'Validando credenciais na nuvem...' : 'Sincronizando protocolo digital...'}
            </p>
          </div>
        </div>
      )}

      <div 
        ref={checklistRef}
        style={{ transform: `scale(${printScale})`, transformOrigin: 'top center', width: printScale !== 1 ? `${100 / printScale}%` : '100%', maxWidth: '100%' }}
        className="bg-white shadow-2xl rounded-xl border border-gray-100 overflow-hidden print:shadow-none print:rounded-none transition-transform relative"
      >
        {view !== 'settings' && (
          <Header 
            title={settings.headerTitle || 'Checklist de viatura'}
            date={data.date} 
            onDateChange={(newDate) => setData({ ...data, date: newDate })}
            logoUrl1={settings.headerLogoUrl1}
            logoUrl2={settings.headerLogoUrl2}
            bgColor={settings.headerBgColor}
            vehicleType={data.vehicleType}
            station={data.station}
          />
        )}
        <main className="p-4 print:p-2 space-y-4 print:space-y-3">
          {view === 'settings' ? (
            <Settings 
              settings={settings} 
              currentUser={currentUser}
              onSave={handleSaveSettings} 
              onClose={() => setView('checklist')} 
              onExportModel={handleExportModel}
              onImportModel={handleImportModel}
              initialTab={activeTabInSettings} 
              setCurrentUser={setCurrentUser}
              googleUser={googleUser}
              onGoogleSignIn={() => {}} // Not used as we use the component directly in Settings if needed
              onGoogleSync={handleGoogleSync}
              isSyncing={isSyncing}
              connectionStatus={connectionStatus}
              onCheckConnection={handleCheckConnection}
              onPerformFullSync={performFullSync}
              reportConfig={reportConfig}
            />
          ) : view === 'dashboard' ? (
            <FleetDashboard 
              logs={logs}
              settings={settings}
              justifications={justifications}
              onRefresh={fetchDashboardData}
              isLoading={isFetchingDashboardData}
              lastSyncTime={lastSyncTime}
              lastSyncDuration={lastSyncDuration}
              onOpenSyncInfo={() => setSyncProgress(prev => ({ ...prev, isActive: true }))}
              onUpdateVehicles={(updatedVehicles) => handleSaveSettings({ ...settings, vehicles: updatedVehicles })}
              onViewReport={handleViewReport}
              onViewWeekly={handleViewWeekly}
              onViewMirror={handleViewMirror}
              recentSuccessMessage={recentConferenceSuccess?.message}
              lastCompletedPrefix={recentConferenceSuccess?.prefix}
              onClearSuccessMessage={() => setRecentConferenceSuccess(null)}
            />
          ) : (!currentUser && !googleUser) ? (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center">
                  <ShieldCheck className="w-10 h-10 text-blue-600" />
               </div>
               <div className="space-y-2">
                  <h3 className="text-xl font-black uppercase text-gray-900">Acesso Restrito</h3>
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-widest leading-relaxed max-w-xs mx-auto">
                    Somente usuários logados no sistema podem realizar o checklist de viatura.
                  </p>
               </div>
               <button 
                 onClick={() => setShowLoginModal(true)}
                 className="bg-blue-600 text-white px-10 py-4 rounded-2xl text-xs font-black uppercase shadow-xl hover:bg-blue-700 transition-all active:scale-95"
               >
                 Entrar no Sistema
               </button>
            </div>
          ) : (
            <>
              <section className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 space-y-4 print:p-2 print:bg-transparent print:border-none">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 print:grid-cols-5 gap-4 print:gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5 mb-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.3)]" />
                      Filtrar por Posto
                    </label>
                    <select 
                      value={selectedStationFilter}
                      onChange={(e) => setSelectedStationFilter(e.target.value)}
                      className="w-full border-2 border-gray-100 rounded-xl p-2.5 text-xs font-black uppercase bg-white focus:border-blue-500 outline-none transition-all no-print"
                    >
                      <option value="">TODOS OS POSTOS</option>
                      {[...(settings.stations || [])].sort((a,b) => {
                        const nameA = (a.name || '').toUpperCase();
                        const nameB = (b.name || '').toUpperCase();
                        if (nameA === 'PB') return -1;
                        if (nameB === 'PB') return 1;
                        return nameA.localeCompare(nameB);
                      }).map((s, idx) => (
                        <option key={`${s.id}-${idx}`} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                    <div className="hidden print:block text-[10px] font-black uppercase text-gray-400">
                      {selectedStationFilter || 'TODOS OS POSTOS'}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Viatura (Prefixo)</label>
                    <div className="flex flex-col gap-2">
                      <select 
                        value={settings.vehicles?.some(v => v.prefix === data.prefix) ? data.prefix : (data.prefix ? 'MANUAL' : '')} 
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'MANUAL') {
                            setData({
                              ...data,
                              prefix: '',
                              plate: '',
                              vehicleType: undefined,
                              station: undefined
                            });
                            return;
                          }
                          const vehicle = settings.vehicles?.find(v => v.prefix === val);
                          if (vehicle) {
                            // Alerta se já foi realizado o checklist no dia
                            const alreadyDone = logs.some(l => 
                              l.prefix === vehicle.prefix && 
                              new Date(l.date).toLocaleDateString() === new Date().toLocaleDateString()
                            );
                            
                            if (alreadyDone) {
                              alert(`AVISO: Já existe um checklist realizado hoje para a viatura ${vehicle.prefix}.`);
                            }

                            setData({
                              ...data,
                              prefix: vehicle.prefix,
                              plate: vehicle.plate,
                              vehicleType: vehicle.type,
                              station: vehicle.station,
                              km: String(vehicle.currentKm || '')
                            });
                          } else {
                            setData({
                              ...data, 
                              prefix: '',
                              plate: '',
                              vehicleType: undefined,
                              station: undefined
                            });
                          }
                        }} 
                        className="w-full border-2 border-gray-100 rounded-xl p-2.5 text-xs font-black uppercase bg-white focus:border-blue-500 outline-none transition-all"
                      >
                        <option key="default-prefix" value="">Selecione...</option>
                        <option key="manual-prefix" value="MANUAL" className="font-black text-blue-600 bg-blue-50">⚠️ VTR NÃO CADASTRADA</option>
                        {settings.vehicles
                          ?.filter(v => !selectedStationFilter || v.station === selectedStationFilter)
                          ?.sort((a,b) => (a.prefix || '').localeCompare(b.prefix || ''))
                          .map((v, vIdx) => (
                            <option key={`${v.id || v.prefix}-${vIdx}`} value={v.prefix}>{v.prefix} - {v.plate}</option>
                          ))}
                      </select>
                      {(!settings.vehicles?.some(v => v.prefix === data.prefix) && data.prefix !== undefined) && (
                        <input 
                          type="text" 
                          placeholder="DIGITE O PREFIXO..." 
                          value={data.prefix} 
                          onChange={(e) => setData({...data, prefix: e.target.value.toUpperCase()})}
                          className="w-full border border-blue-200 rounded-lg p-2 text-xs font-black uppercase bg-blue-50 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Placa</label>
                    <input 
                      type="text" 
                      value={data.plate} 
                      onChange={(e) => setData({...data, plate: e.target.value.toUpperCase()})} 
                      className={`w-full border rounded-lg p-2 font-mono text-xs font-bold ${!settings.vehicles?.some(v => v.prefix === data.prefix) ? 'bg-blue-50 border-blue-200' : ''}`} 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Posto / Unidade</label>
                    <input 
                      type="text" 
                      value={data.station || ''} 
                      onChange={(e) => setData({...data, station: e.target.value.toUpperCase()})} 
                      placeholder="EX: PB CENTRAL"
                      className={`w-full border rounded-lg p-2 text-xs font-bold uppercase ${!settings.vehicles?.some(v => v.prefix === data.prefix) ? 'bg-blue-50 border-blue-200' : ''}`} 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Tipo</label>
                    <select 
                      value={data.vehicleType || ''} 
                      onChange={(e) => setData({...data, vehicleType: e.target.value as any})}
                      className={`w-full border rounded-lg p-2 text-xs font-bold ${!settings.vehicles?.some(v => v.prefix === data.prefix) ? 'bg-blue-50 border-blue-200' : ''}`}
                    >
                      <option key="default-type" value="">Selecione...</option>
                      <option key="leve-pesada" value="LEVE/PESADA">LEVE/PESADA</option>
                      <option key="motocicleta" value="MOTOCICLETA">MOTOCICLETA</option>
                      <option key="ab-aerea" value="AB/AÉREA">AB/AÉREA</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Status Operacional</label>
                    <select 
                      value={data.vehicleStatus || 'OPERANDO'} 
                      onChange={(e) => {
                        const newStatus = e.target.value as any;
                        if (newStatus === 'BAIXADA') {
                          setData({
                            ...data,
                            vehicleStatus: newStatus,
                            items: data.items.map(i => ({ ...i, status: 'CN' }))
                          });
                        } else {
                          setData({...data, vehicleStatus: newStatus});
                        }
                      }}
                      className={`w-full border rounded-lg p-2 text-xs font-black uppercase ${
                        data.vehicleStatus === 'BAIXADA' ? 'bg-red-50 text-red-600 border-red-200' : 
                        data.vehicleStatus === 'RESERVA' ? 'bg-orange-50 text-orange-600 border-orange-200' : 
                        'bg-green-50 text-green-600 border-green-200'
                      }`}
                    >
                      <option value="OPERANDO">✅ OPERANDO</option>
                      <option value="RESERVA">🟠 RESERVA</option>
                      <option value="BAIXADA">🚨 BAIXADA</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Ciclo</label>
                    <div className="flex bg-white border rounded-lg p-1 h-9 no-print">
                      <button onClick={() => setData({...data, checklistType: 'Diário'})} className={`flex-1 text-[10px] font-black uppercase rounded-md ${data.checklistType === 'Diário' ? 'text-white' : 'text-gray-400'}`} style={{ backgroundColor: data.checklistType === 'Diário' ? themeColor : undefined }}>Diário</button>
                      <button onClick={() => setData({...data, checklistType: 'Semanal'})} className={`flex-1 text-[10px] font-black uppercase rounded-md ${data.checklistType === 'Semanal' ? 'text-white' : 'text-gray-400'}`} style={{ backgroundColor: data.checklistType === 'Semanal' ? themeColor : undefined }}>Semanal</button>
                    </div>
                    <div className="hidden print:block border rounded-lg p-2 bg-white text-xs font-black uppercase text-center">{data.checklistType}</div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Odômetro (KM)</label>
                    <input type="number" value={data.km} onChange={(e) => setData({...data, km: e.target.value})} className="w-full border rounded-lg p-2 text-xs font-bold text-blue-700" />
                  </div>
                </div>
              </section>

              {showDamageMap && (
                <section className={`bg-white rounded-xl p-3 border shadow-sm print:p-2 ${!hasVehicleImages ? 'print:hidden' : ''}`}>
                  <DamageCanvas 
                    images={data.vehicleImages || []} 
                    ratios={data.vehicleImageRatios || INITIAL_VEHICLE_RATIOS} 
                    damages={data.damages} 
                    onAddDamage={(x, y, i) => setData(prev => ({ ...prev, damages: [...prev.damages, { id: crypto.randomUUID(), x, y, imageIndex: i, description: 'Dano' }] }))} 
                    onRemoveDamage={(id) => setData(prev => ({ ...prev, damages: prev.damages.filter(d => d.id !== id) }))} 
                    onUpdateImage={handleVehicleImageUpload} 
                    onUpdateRatio={(i, r) => setData(prev => { const n = [...(prev.vehicleImageRatios || INITIAL_VEHICLE_RATIOS)]; n[i] = r; return { ...prev, vehicleImageRatios: n }; })} 
                  />
                </section>
              )}

              <section className="space-y-3">
                <ChecklistTable 
                  items={data.items} 
                  lastItems={lastChecklistData}
                  onStatusChange={handleStatusChange} 
                  onObservationChange={handleObservationChange} 
                  onSaveToGeneralNotes={handleSaveToGeneralNotes} 
                  onAddPhoto={handleItemPhotoUpload} 
                />
              </section>

              {/* Seção de Observações Gerais - Editável (no-print) */}
              <section className="space-y-1 no-print">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Observações Gerais</label>
                <textarea 
                  rows={3} 
                  value={data.generalObservation} 
                  onChange={(e) => setData({...data, generalObservation: e.target.value})} 
                  placeholder="Anotações adicionais do conferente..." 
                  className="w-full border rounded-lg p-2 bg-gray-50 outline-none text-xs focus:ring-1 focus:ring-blue-500" 
                />
              </section>

              {/* Seção de Observações Gerais - Somente Impressão (PDF) */}
              {data.generalObservation && (
                <section className="hidden print:block space-y-1 pt-2 border-t mt-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Observações Gerais</label>
                  <div className="text-[10px] text-gray-700 whitespace-pre-wrap bg-gray-50 p-2 rounded-lg border italic leading-tight">
                    {data.generalObservation}
                  </div>
                </section>
              )}

              <Footer 
                signatureName={data.signatureName} 
                signatureRank={data.signatureRank} 
                date={data.date} 
                onSignatureNameChange={(v) => setData({ ...data, signatureName: v })} 
                onSignatureRankChange={(v) => setData({ ...data, signatureRank: v })} 
              />
              
              <section className="space-y-2 pt-2 border-t">
                 <div className="grid grid-cols-2 md:grid-cols-3 print:grid-cols-3 gap-3">
                  {data.items.filter(i => i.photos?.length).map(item => item.photos?.map((p, idx) => (
                    <div key={`${item.id}-${idx}`} className="relative aspect-square border rounded-lg overflow-hidden bg-gray-100 shadow-sm break-inside-avoid">
                      <img src={p} className="w-full h-full object-contain" alt={item.label} referrerPolicy="no-referrer" />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] p-1 font-bold truncate">ITEM: {item.label}</div>
                    </div>
                  )))}
                  {data.photos.map((p, i) => (
                    <div key={`g-${i}`} className="relative aspect-square border rounded-lg overflow-hidden bg-gray-100 shadow-sm break-inside-avoid">
                      <img src={p} className="w-full h-full object-contain" alt="Geral" referrerPolicy="no-referrer" />
                      <div className="absolute bottom-0 left-0 right-0 bg-blue-600/80 text-white text-[8px] p-1 font-bold uppercase text-center">Evidência Geral</div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </main>
        <div className="hidden print:flex absolute bottom-4 left-4 right-4 items-center justify-between text-[8px] font-black text-gray-300 uppercase tracking-widest border-t border-gray-100 pt-2">
           <span>Realização da Inspeção: {printTimestamp || new Date().toLocaleString('pt-BR')}</span>
           <span>Protocolo: {data.id}</span>
        </div>
      </div>

      <div className="fixed top-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-white/95 backdrop-blur-md border border-gray-200 shadow-xl px-4 py-2 rounded-2xl no-print z-[100] max-w-[95vw] overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-2 pr-2 border-r border-gray-200 shrink-0">
           <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${googleUser ? 'bg-green-50' : (currentUser ? 'bg-blue-50' : 'bg-gray-50')}`}>
              <UserIcon className={`w-4 h-4 ${googleUser ? 'text-green-600' : (currentUser ? 'text-blue-600' : 'text-gray-400')}`} />
           </div>
           <div className="flex flex-col">
              <span className="text-[9px] font-black text-gray-900 leading-none truncate max-w-[60px] uppercase">
                {googleUser ? googleUser.name?.split(' ')[0] : (currentUser ? (currentUser.name || currentUser.username || '').split(' ')[0] : 'PERFIL')}
              </span>
              {googleUser ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5">
                    <Cloud className="w-1.5 h-1.5 text-green-500" />
                    <span className="text-[6px] font-black text-green-500 uppercase">Cloud</span>
                  </div>
                  <button onClick={handleLogout} className="text-[6px] font-black text-red-500 uppercase text-left hover:underline">Sair</button>
                </div>
              ) : (
                currentUser ? (
                  <button onClick={handleLogout} className="text-[6px] font-black text-red-500 uppercase text-left hover:underline">Sair</button>
                ) : (
                  <button onClick={() => setShowLoginModal(true)} className="text-[6px] font-black text-blue-500 uppercase text-left hover:underline">Acesso</button>
                )
              )}
           </div>
        </div>

        {/* 2. Dashboard */}
        {hasPermission('dashboard') && (
          <button 
            onClick={() => setView('dashboard')} 
            className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all shrink-0 ${view === 'dashboard' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-xs font-bold hidden md:inline">Dashboard</span>
          </button>
        )}

        {view === 'checklist' && hasPermission('checklist') && (
          <>
            <div className="w-px h-6 bg-gray-200 mx-0.5"></div>
            
            <button 
              onClick={handleVisualizarPdf} 
              className={`px-4 py-2 rounded-xl text-xs font-black shadow-lg flex items-center gap-2 transition-all active:scale-95 bg-blue-600 text-white hover:bg-blue-700 shrink-0`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>FINALIZAR</span>
            </button>
            
            <div className="w-px h-6 bg-gray-200 mx-0.5"></div>
            
            <button 
              onClick={() => setShowDamageMap(!showDamageMap)} 
              className={`flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-xl transition-colors shrink-0 ${showDamageMap ? 'text-orange-600 bg-orange-50' : 'text-gray-400'}`}
              title="Mapa de Avarias"
            >
              {showDamageMap ? <Map className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
              <span className="text-xs font-bold hidden md:inline">Avarias</span>
            </button>
          </>
        )}

        <div className="w-px h-6 bg-gray-200 mx-0.5"></div>

        {/* 3. Checklist Switcher */}
        <button 
          onClick={() => setView('checklist')} 
          className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all shrink-0 ${view === 'checklist' ? 'bg-green-50 text-green-600 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          <RefreshCw className="w-5 h-5" />
          <span className="text-xs font-bold hidden md:inline">Checklist</span>
        </button>

        <div className="w-px h-6 bg-gray-200 mx-0.5"></div>
        
        {/* Others - Manual/About/Settings */}
        <div className="flex items-center gap-1">
          <button 
            onClick={() => { setActiveTabInSettings('manual'); setView('settings'); }} 
            className={`p-2 rounded-xl transition-all shrink-0 ${view === 'settings' && activeTabInSettings === 'manual' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:bg-gray-50'}`}
            title="Manual"
          >
            <BookOpen className="w-5 h-5" />
          </button>
          
          <button 
            onClick={() => { setActiveTabInSettings('about'); setView('settings'); }} 
            className={`p-2 rounded-xl transition-all shrink-0 ${view === 'settings' && activeTabInSettings === 'about' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:bg-gray-50'}`}
            title="Sobre"
          >
            <Info className="w-5 h-5" />
          </button>

          {hasPermission('settings') && (
            <button 
              onClick={() => { setActiveTabInSettings('login'); setView('settings'); }} 
              className={`p-2 rounded-xl transition-all shrink-0 ${view === 'settings' && (activeTabInSettings === 'login' || activeTabInSettings === 'admin') ? 'bg-red-50 text-red-600' : 'text-gray-400 hover:bg-gray-50'}`}
              title="Ajustes"
            >
              <SettingsIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {showLoginModal && (
        <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-sm space-y-6 border-t-4 border-blue-600 animate-in fade-in zoom-in duration-300 overflow-hidden">
            {(settings.loginBgUrl || settings.homeBgUrl) && (
              <div className="-mx-8 -mt-8 mb-2 h-28 overflow-hidden relative shadow-inner">
                <img 
                  src={settings.loginBgUrl || settings.homeBgUrl} 
                  alt="Início Login" 
                  className="w-full h-full object-cover" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex items-end p-4">
                  <div className="text-white">
                    <span className="text-[9px] font-black uppercase tracking-widest text-blue-300">Acesso ao Sistema</span>
                    <h3 className="text-sm font-black uppercase tracking-tight truncate">{settings.appName || 'Checklist Digital'}</h3>
                  </div>
                </div>
              </div>
            )}
            <div className="flex justify-between items-start">
               <div className="space-y-1">
                  <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Entrar</h2>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-blue-600">Identificação de Usuário</p>
               </div>
               <button onClick={() => { setShowLoginModal(false); }} className="p-2 hover:bg-gray-100 rounded-xl transition-colors"><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Usuário</label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="text" 
                    autoFocus
                    value={loginUsername} 
                    onChange={e => setLoginUsername(e.target.value)}
                    className="w-full bg-gray-50 border-2 rounded-2xl p-4 pl-12 text-sm font-bold outline-none focus:border-blue-600 transition-all uppercase"
                    placeholder="USUÁRIO"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="password" 
                    value={loginPassword} 
                    onChange={e => setLoginPassword(e.target.value)}
                    className="w-full bg-gray-50 border-2 rounded-2xl p-4 pl-12 text-sm font-bold outline-none focus:border-blue-600 transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <button 
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-xl transition-all active:scale-95 uppercase tracking-widest text-xs"
              >
                Confirmar Acesso
              </button>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
                <div className="relative flex justify-center text-[8px] font-black uppercase tracking-widest"><span className="bg-white px-2 text-gray-300">Ou use sua conta corporativa</span></div>
              </div>

              <GoogleLoginButton 
                onSuccess={handleGoogleLoginSuccess}
                isLoggingIn={isLoggingIn}
                setIsLoggingIn={setIsLoggingIn}
              />
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default App;
