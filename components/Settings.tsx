
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { GoogleLoginButton } from './GoogleLoginButton';
import { AppSettings, ChecklistItem, ItemFrequency, AspectRatio, LogEntry, User, UserPermissions } from '../types';
import { FIXED_GOOGLE_SHEET_URL } from '../constants';
import { filterLogsLast30Days, filterLogsBySelectedDates } from '../services/dateFilterService';
import { 
  Trash2, 
  Plus, 
  ArrowLeft, 
  CheckCircle, 
  Image as ImageIcon, 
  Palette, 
  ListChecks,
  Lock,
  Search,
  RefreshCw,
  FileText,
  LayoutDashboard,
  Calendar,
  X,
  Eye as ViewIcon,
  EyeOff,
  AlertTriangle,
  Activity,
  Wifi,
  WifiOff,
  Clock,
  UserCheck,
  ClipboardList,
  ClipboardCheck,
  FileSearch,
  BookOpen,
  Tag,
  Printer,
  RectangleHorizontal,
  RectangleVertical,
  Camera,
  Info,
  TrendingUp,
  BarChart3,
  Users,
  Car,
  PieChart,
  ShieldCheck,
  Zap,
  Key,
  ShieldAlert,
  Save,
  UserPlus,
  ChevronUp,
  ChevronDown,
  Navigation,
  Edit2,
  Cloud,
  CloudOff,
  LogOut,
  Database,
  Download,
  Upload,
  ExternalLink,
  Shield,
  Settings as SettingsIcon,
  Video,
  Film
} from 'lucide-react';
import { Header } from './Header';
import { Footer } from './Footer';

import { Reports } from './Reports';
import { compressImage } from '../services/imageUtils';
import { VEHICLE_TYPES } from '../constants';

interface AuditUser {
  id?: string;
  name?: string;
  username: string;
  email?: string;
  password?: string;
  rank?: string;
  permissions?: UserPermissions;
  forcePasswordChange?: boolean;
  createdAt?: string;
}

interface SettingsProps {
  settings: AppSettings;
  currentUser: User | null;
  onSave: (newSettings: AppSettings) => void;
  onClose: () => void;
  onExportModel: () => void;
  onImportModel: (e: React.ChangeEvent<HTMLInputElement>) => void;
  initialTab?: 'items' | 'images' | 'style' | 'about' | 'admin' | 'manual' | 'reports' | 'vehicles' | 'stations' | 'users' | 'report_editor' | 'cloud' | 'login';
  setCurrentUser: (user: User | null) => void;
  googleUser: any;
  onGoogleSignIn: () => void;
  onGoogleSync: () => void;
  isSyncing: boolean;
  connectionStatus: 'idle' | 'checking' | 'online' | 'offline';
  onCheckConnection: () => void;
  onPerformFullSync?: () => Promise<void> | void;
  reportConfig?: {
    prefix: string;
    reportType?: any;
  };
}

type TabType = 'items' | 'images' | 'style' | 'about' | 'admin' | 'manual' | 'reports' | 'vehicles' | 'stations' | 'users' | 'report_editor' | 'cloud' | 'login' | 'logs_admin';

export const Settings: React.FC<SettingsProps> = ({ 
  settings, 
  currentUser,
  onSave, 
  onClose, 
  onExportModel,
  onImportModel,
  initialTab = 'items',
  setCurrentUser,
  googleUser,
  onGoogleSignIn,
  onGoogleSync,
  isSyncing,
  connectionStatus,
  onCheckConnection,
  onPerformFullSync,
  reportConfig
}) => {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  const isTabAccessible = (tabId: string) => {
    if (tabId === 'manual' || tabId === 'about' || tabId === 'login') return true;

    // Usuário Mestre Cavalieri sempre tem acesso total
    if (currentUser?.username.toLowerCase() === 'cavalieri') return true;

    const permissions = currentUser?.permissions as UserPermissions;
    if (!permissions) return false;

    // Telas Restritas Somente ao Super Usuário Cavalieri
    if (['cloud', 'logs_admin', 'admin', 'report_editor'].includes(tabId)) {
      return currentUser?.username.toLowerCase() === 'cavalieri';
    }

    // Admin Geral continua como mestre do sistema para as demais telas
    if (permissions.admin) return true;

    // Mapeamento granular estrito para todos os usuários
    if (tabId === 'stations') return !!permissions.manageStations;
    if (tabId === 'vehicles') return !!permissions.manageVehicles;
    if (tabId === 'users') return !!permissions.manageUsers;
    if (tabId === 'items') return !!permissions.manageItems;
    if (tabId === 'images') return !!permissions.manageImages;
    if (tabId === 'style') return !!permissions.manageStyle;

    if (tabId === 'reports') {
      return !!(
        permissions.reports || 
        permissions.reportNovelties || 
        permissions.reportSynthetic || 
        permissions.reportAnalytical || 
        permissions.reportFull || 
        permissions.reportMonthlyGrouped || 
        permissions.reportHistory || 
        permissions.reportDailyControl || 
        permissions.reportDailyControlMotos || 
        permissions.reportWeeklyLeves || 
        permissions.reportWeeklyMotos || 
        permissions.reportWeeklyAb || 
        permissions.reportRetroactiveLogs || 
        permissions.reportFinalMonthlyBook || 
        permissions.reportFleetDashboard || 
        permissions.reportKmMonthly
      );
    }

    return false;
  };

  useEffect(() => {
    if (!isTabAccessible(activeTab)) {
      setActiveTab('manual');
    }
  }, [activeTab, currentUser]);

  const [localSettings, setLocalSettings] = useState<AppSettings>(() => {
    const s = { ...settings };
    // Se a URL estiver vazia ou for a URL antiga, forçamos a atualização para a nova URL fixa
    if (!s.googleSheetUrl || s.googleSheetUrl.includes('AKfycbz4tRvSdFPBJH5F8RBBg-30Br4e1-Ut4dxFSFejKvJtR8sgxgx5lZ25xHAvz_Z-4rK1')) {
      s.googleSheetUrl = FIXED_GOOGLE_SHEET_URL;
    }
    return {
      ...s,
      vehicles: s.vehicles || [],
      stations: s.stations || [],
      sgbs: s.sgbs || [],
      gbs: s.gbs || [],
      users: s.users || [],
      vehicleImageRatios: s.vehicleImageRatios || ['landscape', 'landscape', 'landscape', 'landscape', 'landscape']
    };
  });
  
  const isMasterUser = !!currentUser && currentUser.username.toLowerCase() === 'cavalieri';
  
  const isSuperUser = !!currentUser && (
                      currentUser.username.toLowerCase() === 'cavalieri' || 
                      currentUser.permissions?.settings === true
                    );
  
  const [newItem, setNewItem] = useState({ label: '', frequency: 'Diário' as ItemFrequency, vehicleTypes: [...VEHICLE_TYPES] });
  const [newVehicle, setNewVehicle] = useState({ 
    prefix: '', 
    plate: '', 
    type: 'LEVE/PESADA' as any, 
    station: '',
    sgb: '',
    gb: '',
    currentKm: 0
  });
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [editingStationId, setEditingStationId] = useState<string | null>(null);
  const [newStation, setNewStation] = useState({ name: '', sgbId: '' });
  const [newSGB, setNewSGB] = useState({ name: '', gbId: '' });
  const [newGB, setNewGB] = useState({ name: '' });
  const [itemsFilter, setItemsFilter] = useState<'all' | 'LEVE/PESADA' | 'MOTOCICLETA' | 'AB/AÉREA'>('all');
  
  // Auth State
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [currentAuditUser, setCurrentAuditUser] = useState<string | null>(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Data States
  const [adminSubTab, setAdminSubTab] = useState<'dashboard' | 'logs' | 'users' | 'audit'>('dashboard');
  const allLogsCacheRef = useRef<LogEntry[] | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>(() => {
    try {
      const cached = localStorage.getItem('checkviatura_cached_logs');
      if (!cached) return [];
      const parsed = JSON.parse(cached);
      return Array.isArray(parsed) ? filterLogsLast30Days(parsed) : [];
    } catch {
      return [];
    }
  });
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<AuditUser[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [logFilter, setLogFilter] = useState('');
  const [searchTermUsers, setSearchTermUsers] = useState('');

  // Manual Sub-tab & Documents state
  const [manualSubTab, setManualSubTab] = useState<'instructions' | 'links'>('instructions');
  const [editingDocLinkId, setEditingDocLinkId] = useState<string | null>(null);
  const [docName, setDocName] = useState('');
  const [docUrl, setDocUrl] = useState('');
  const [docCategory, setDocCategory] = useState('GERAL');
  const [docDescription, setDocDescription] = useState('');
  const [docParams, setDocParams] = useState('');

  // Synced localSettings updater when settings change
  useEffect(() => {
    if (settings) {
      setLocalSettings(prev => ({
        ...prev,
        ...settings,
        documentLinks: settings.documentLinks || prev.documentLinks || []
      }));
    }
  }, [settings]);

  useEffect(() => {
    if (activeTab === 'admin' && adminSubTab === 'audit') {
      fetchAuditLogs();
    }
  }, [adminSubTab, activeTab]);

  const fetchAuditLogs = async () => {
    const rawUrl = localSettings.googleSheetUrl || FIXED_GOOGLE_SHEET_URL;
    const targetUrl = rawUrl?.trim();
    if (!targetUrl) return;

    setIsLoadingAudit(true);
    try {
      const url = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=getAuditLogs&_t=${Date.now()}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) setAuditLogs(data);
      }
    } catch (e) {
      console.error("Erro ao buscar logs de auditoria:", e);
    } finally {
      setIsLoadingAudit(false);
    }
  };
  
  // User Management Form
  const [newUser, setNewUser] = useState<AuditUser>({ 
    username: '', 
    email: '',
    password: '', 
    name: '',
    rank: '',
    permissions: { 
      checklist: true, 
      reports: false, 
      settings: false,
      admin: false,
      canSign: false,
      signAsChefeMotoristas: false,
      signAsCmtProntidao: false,
      signAsCmtPosto: false,
      signAsCmtSgb: false,
      manageStations: false,
      manageVehicles: false,
      manageUsers: false,
      manageItems: false,
      manageImages: false,
      manageStyle: false,
      manageDatabase: false,
      manageLogs: false
    } 
  });
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [isAddingLocalUser, setIsAddingLocalUser] = useState(false);
  const [editingLocalUser, setEditingLocalUser] = useState<User | null>(null);
  const [localUserForm, setLocalUserForm] = useState<Partial<User>>({ 
    username: '', 
    email: '',
    password: '', 
    name: '', 
    rank: '',
    forcePasswordChange: false,
    permissions: {
      checklist: true,
      reports: false,
      settings: false,
      admin: false
    }
  });
  const [showUserFormPassword, setShowUserFormPassword] = useState(false);
  const [quickPasswordModalUser, setQuickPasswordModalUser] = useState<User | null>(null);
  const [quickNewPassword, setQuickNewPassword] = useState('');
  const [quickConfirmPassword, setQuickConfirmPassword] = useState('');
  const [quickForceChange, setQuickForceChange] = useState(false);
  const [showQuickNewPassword, setShowQuickNewPassword] = useState(false);
  
  const printMirrorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const hasAttemptedInitialFetch = useRef(false);

  // Efeito para carregar dados automaticamente ao entrar nas abas que dependem do banco
  useEffect(() => {
    if ((activeTab === 'admin' || activeTab === 'reports') && !hasAttemptedInitialFetch.current) {
      console.log(`Aba ${activeTab} ativada pela primeira vez. Disparando sincronização inicial...`);
      hasAttemptedInitialFetch.current = true;
      fetchLogs();
      fetchUsers();
    }
  }, [activeTab]);

  const fetchLogs = async (prefix?: string, month?: string, retryCount = 0) => {
    const isAllRequested = month === 'all' || month === 'ALL';
    const cleanPrefix = (prefix && prefix.trim() !== '') ? prefix.trim() : undefined;
    const cleanMonth = (month && !isAllRequested && month.trim() !== '') ? month.trim() : undefined;

    // Se já temos a lista completa em cache na memória e o usuário está filtrando por mês ou pediu tudo
    if (allLogsCacheRef.current && allLogsCacheRef.current.length > 0 && retryCount === 0) {
      if (cleanMonth) {
        const filtered = filterLogsBySelectedDates(allLogsCacheRef.current, { month: cleanMonth, prefix: cleanPrefix });
        setLogs(filtered);
        return;
      } else if (isAllRequested) {
        setLogs(cleanPrefix ? filterLogsBySelectedDates(allLogsCacheRef.current, { prefix: cleanPrefix }) : allLogsCacheRef.current);
        return;
      } else if (!cleanMonth && !isAllRequested && !cleanPrefix) {
        // Carga padrão: últimos 30 dias para velocidade instantânea
        setLogs(filterLogsLast30Days(allLogsCacheRef.current));
        return;
      }
    }

    const rawUrl = localSettings.googleSheetUrl || FIXED_GOOGLE_SHEET_URL;
    const targetUrl = rawUrl?.trim();
    
    if (!targetUrl) {
      console.warn("URL do Google Sheets não configurada.");
      return;
    }
    
    if (isLoadingLogs && retryCount === 0) return;
    setIsLoadingLogs(true);

    console.log(`[Tentativa ${retryCount + 1}] Buscando logs: ${targetUrl}`);
    
    try {
      let url = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=getLogs&_t=${Date.now()}`;
      
      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-store'
      });

      if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);

      const result = await response.json();
      if (Array.isArray(result)) {
        const validLogs: LogEntry[] = result.filter(log => log && (log.id || log.ID));
        allLogsCacheRef.current = validLogs;

        if (cleanMonth) {
          // Respeita rigorosamente o mês escolhido
          setLogs(filterLogsBySelectedDates(validLogs, { month: cleanMonth, prefix: cleanPrefix }));
        } else if (isAllRequested) {
          setLogs(cleanPrefix ? filterLogsBySelectedDates(validLogs, { prefix: cleanPrefix }) : validLogs);
        } else {
          // Ao carregar o sistema carregar no máximo os últimos 30 dias para máxima rapidez
          setLogs(filterLogsLast30Days(validLogs));
        }
      }
    } catch (err) {
      console.error(`Erro na tentativa ${retryCount + 1} ao buscar logs:`, err);
      if (retryCount < 2) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return fetchLogs(prefix, month, retryCount + 1);
      }
      alert("ERRO AO BUSCAR LOGS: Não foi possível obter os dados.\n\nIsso geralmente ocorre se o Google Apps Script não estiver publicado como 'Qualquer pessoa' (Anyone) ou se a URL estiver incorreta.");
      setLogs([]);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const fetchUsers = async (retryCount = 0): Promise<AuditUser[]> => {
    const rawUrl = localSettings.googleSheetUrl || FIXED_GOOGLE_SHEET_URL;
    const targetUrl = rawUrl?.trim();
    if (!targetUrl) return [];

    console.log(`[Tentativa ${retryCount + 1}] Buscando usuários: ${targetUrl}`);
    try {
      let url = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=getUsers&_t=${Date.now()}`;
      
      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-store'
      });

      if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);

      const result = await response.json();
      if (Array.isArray(result)) {
        const validUsers = result.filter(u => u && u.username);
        setUsersList(validUsers);
        return validUsers;
      }
      return [];
    } catch (err) {
      console.error(`Erro na tentativa ${retryCount + 1} ao buscar usuários:`, err);
      if (retryCount < 2) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return fetchUsers(retryCount + 1);
      }
      alert("ERRO AO BUSCAR USUÁRIOS: Verifique as permissões do Google Apps Script (deve ser 'Qualquer pessoa').");
      return [];
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername || !loginPassword) {
      alert("Informe usuário e senha.");
      return;
    }

    setIsLoggingIn(true);
    const targetUrl = localSettings.googleSheetUrl || FIXED_GOOGLE_SHEET_URL;
    
    // Check Super User (CAVALIERI)
    if (loginUsername.toUpperCase() === 'CAVALIERI' && loginPassword.toLowerCase() === 'tricolor') {
      setIsAdminAuthenticated(true);
      setCurrentAuditUser('CAVALIERI');
      setIsLoggingIn(false);
      fetchLogs();
      fetchUsers();
      return;
    }

    // Sincronização em tempo real no momento do login para garantir novos usuários
    try {
      const response = await fetch(`${targetUrl}?action=getUsers`);
      const updatedUsers = await response.json();
      if (Array.isArray(updatedUsers)) {
        setUsersList(updatedUsers);
        
        const match = updatedUsers.find((u: any) => 
          u && u.username && u.username.toString().toLowerCase() === loginUsername.toLowerCase() && 
          u.password && u.password.toString() === loginPassword
        );

        if (match) {
          setIsAdminAuthenticated(true);
          setCurrentAuditUser(match.username.toUpperCase());
          setAdminSubTab('dashboard');
          fetchLogs();
        } else {
          alert("CREDENCIAS INVÁLIDAS: Usuário não cadastrado ou senha incorreta.");
        }
      } else {
        throw new Error("Resposta inválida do servidor");
      }
    } catch (err) {
      alert("ERRO DE COMUNICAÇÃO: Não foi possível validar as credenciais com o servidor.");
      console.error("Login Validation Error:", err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSaveUser = async () => {
    if (!newUser.username) {
      alert("Preencha o Username do usuário.");
      return;
    }
    if (!editingUserId && (!newUser.password || !newUser.password.trim())) {
      alert("Preencha Username e Senha para o novo usuário.");
      return;
    }
    
    // Se for edição e não digitou nova senha, mantém a senha atual cadastrada
    const existingAuditUser = usersList.find(u => (u.id && u.id === editingUserId) || u.username === newUser.username);
    const resolvedPassword = (newUser.password && newUser.password.trim() !== '')
      ? newUser.password.trim()
      : (existingAuditUser?.password || '');

    const userPayload = { action: 'saveUser', ...newUser, password: resolvedPassword };

    setIsSavingUser(true);
    const rawUrl = localSettings.googleSheetUrl || FIXED_GOOGLE_SHEET_URL;
    const targetUrl = rawUrl?.trim();
    
    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(userPayload)
      }).catch(err => {
        console.warn("Erro CORS ao salvar usuário, tentando no-cors...", err);
        return fetch(targetUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8'
          },
          body: JSON.stringify(userPayload)
        });
      });
      
      if (response && response.type !== 'opaque') {
        const result = await response.json();
        if (result.result === 'success') {
          alert(editingUserId ? "Usuário atualizado com sucesso!" : "Usuário cadastrado com sucesso!");
        } else {
          alert(`Erro: ${result.message}`);
        }
      } else {
        alert("Comando enviado ao servidor. Verifique a lista em instantes.");
      }
      
      handleCancelUserEdit();
      
      setTimeout(() => {
        fetchUsers();
        setIsSavingUser(false);
      }, 2000);
      
    } catch (e) {
      console.error("Save User Error:", e);
      alert("Erro ao processar solicitação.");
      setIsSavingUser(false);
    }
  };

  const handleEditUser = (user: AuditUser) => {
    setNewUser({
      id: user.id,
      username: user.username,
      email: user.email || '',
      password: '', // A senha atual NUNCA deve aparecer na edição
      name: user.name,
      rank: user.rank,
      forcePasswordChange: user.forcePasswordChange || false,
      permissions: {
        checklist: user.permissions?.checklist ?? true,
        reports: user.permissions?.reports ?? false,
        settings: user.permissions?.settings ?? false,
        admin: user.permissions?.admin ?? false,
        canSign: user.permissions?.canSign ?? false,
        signAsChefeMotoristas: user.permissions?.signAsChefeMotoristas ?? false,
        signAsCmtProntidao: user.permissions?.signAsCmtProntidao ?? false,
        signAsCmtPosto: user.permissions?.signAsCmtPosto ?? false,
        signAsCmtSgb: user.permissions?.signAsCmtSgb ?? false,
        manageStations: user.permissions?.manageStations ?? false,
        manageVehicles: user.permissions?.manageVehicles ?? false,
        manageUsers: user.permissions?.manageUsers ?? false,
        manageItems: user.permissions?.manageItems ?? false,
        manageImages: user.permissions?.manageImages ?? false,
        manageStyle: user.permissions?.manageStyle ?? false,
        manageDatabase: user.permissions?.manageDatabase ?? false,
        manageLogs: user.permissions?.manageLogs ?? false,
      }
    });
    setEditingUserId(user.id || user.username);
  };

  const handleCancelUserEdit = () => {
    setNewUser({ 
      username: '', 
      email: '',
      password: '', 
      name: '',
      rank: '',
      forcePasswordChange: false,
      permissions: { 
        checklist: true, 
        reports: false, 
        settings: false,
        admin: false,
        canSign: false,
        signAsChefeMotoristas: false,
        signAsCmtProntidao: false,
        signAsCmtPosto: false,
        signAsCmtSgb: false,
        manageStations: false,
        manageVehicles: false,
        manageUsers: false,
        manageItems: false,
        manageImages: false,
        manageStyle: false,
        manageDatabase: false,
        manageLogs: false
      } 
    });
    setEditingUserId(null);
  };

  const handleDeleteUser = async (username: string) => {
    if (username.toUpperCase() === 'CAVALIERI') return;
    if (!confirm(`Confirma a EXCLUSÃO do usuário auditor: ${username}?`)) return;
    
    const rawUrl = localSettings.googleSheetUrl || FIXED_GOOGLE_SHEET_URL;
    const targetUrl = rawUrl?.trim();
    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify({ action: 'deleteUser', username })
      }).catch(err => {
        console.warn("Erro CORS ao excluir usuário, tentando no-cors...", err);
        return fetch(targetUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8'
          },
          body: JSON.stringify({ action: 'deleteUser', username })
        });
      });
      
      if (response && response.type !== 'opaque') {
        const result = await response.json();
        if (result.result === 'success') {
          alert("Usuário excluído com sucesso!");
        } else {
          alert(`Erro: ${result.message}`);
        }
      } else {
        alert("Comando de exclusão enviado.");
      }
      
      setTimeout(fetchUsers, 2000);
    } catch (e) {
      console.error("Delete User Error:", e);
      alert("Erro ao processar exclusão.");
    }
  };

  const handleDeleteLog = async (id: string) => {
    if (!id) return;
    if (!confirm(`TEM CERTEZA? Esta ação excluirá PERMANENTEMENTE o lançamento ${id} do banco de dados na nuvem.`)) return;
    
    setIsLoadingLogs(true);
    const rawUrl = localSettings.googleSheetUrl || FIXED_GOOGLE_SHEET_URL;
    const targetUrl = rawUrl?.trim();
    
    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'deleteLog', id })
      }).catch(err => {
        return fetch(targetUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'deleteLog', id })
        });
      });
      
      alert("Comando de exclusão enviado. A lista será atualizada.");
      setTimeout(fetchLogs, 2000);
    } catch (e) {
      console.error("Delete Log Error:", e);
      alert("Erro ao excluir log.");
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const stats = useMemo(() => {
    if (!Array.isArray(logs) || logs.length === 0) return { 
      total: 0, withIssues: 0, diario: 0, semanal: 0, conformityRate: 0,
      topInspectors: [], topVehicles: []
    };

    const diario = logs.filter(l => l.checklistType === 'Diário').length;
    const semanal = logs.filter(l => l.checklistType === 'Semanal').length;
    const withIssues = logs.filter(l => String(l.itemsStatus).includes('CN') && !String(l.itemsStatus).includes('0 CN')).length;
    const conformityRate = ((logs.length - withIssues) / logs.length) * 100;

    const inspectorsMap: Record<string, number> = {};
    const vehiclesMap: Record<string, number> = {};
    
    logs.forEach(l => {
      const insp = String(l.inspector || l.Inspetor || l.inspetor || l.conferente || 'NÃO IDENTIFICADO').toUpperCase().trim();
      const vtr = String(l.prefix || 'N/A').toUpperCase().trim();
      inspectorsMap[insp] = (inspectorsMap[insp] || 0) + 1;
      vehiclesMap[vtr] = (vehiclesMap[vtr] || 0) + 1;
    });

    return { 
      total: logs.length, 
      withIssues, 
      diario, 
      semanal,
      conformityRate,
      topInspectors: Object.entries(inspectorsMap).sort((a,b) => b[1]-a[1]).slice(0,5).map(([name, count]) => ({ name, count })),
      topVehicles: Object.entries(vehiclesMap).sort((a,b) => b[1]-a[1]).slice(0,5).map(([name, count]) => ({ name, count }))
    };
  }, [logs]);

  const handleAddItem = () => {
    if (!newItem.label.trim()) return;
    const newItemObj = { 
      id: crypto.randomUUID(), 
      label: newItem.label, 
      frequency: newItem.frequency,
      vehicleTypes: newItem.vehicleTypes
    };
    setLocalSettings({ ...localSettings, defaultItems: [...localSettings.defaultItems, newItemObj] });
    setNewItem({ label: '', frequency: 'Diário', vehicleTypes: [...VEHICLE_TYPES] });
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newItems = [...localSettings.defaultItems];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newItems.length) return;
    [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
    setLocalSettings({ ...localSettings, defaultItems: newItems });
  };

  const toggleItemVehicleType = (id: string, type: any) => {
    setLocalSettings({
      ...localSettings,
      defaultItems: localSettings.defaultItems.map(item => {
        if (item.id === id) {
          const currentTypes = item.vehicleTypes || [];
          const newTypes = currentTypes.includes(type)
            ? currentTypes.filter(t => t !== type)
            : [...currentTypes, type];
          return { ...item, vehicleTypes: newTypes };
        }
        return item;
      })
    });
  };

  const handleAddOrEditDocLink = () => {
    if (!docName.trim() || !docUrl.trim()) {
      alert("Por favor, preencha o nome e a URL do documento.");
      return;
    }

    const links = localSettings.documentLinks || [];
    if (editingDocLinkId) {
      const updated = links.map(link => {
        if (link.id === editingDocLinkId) {
          return {
            ...link,
            name: docName.trim().toUpperCase(),
            url: docUrl.trim(),
            category: docCategory.trim().toUpperCase(),
            description: docDescription.trim(),
            params: docParams.trim()
          };
        }
        return link;
      });
      setLocalSettings({ ...localSettings, documentLinks: updated });
      setEditingDocLinkId(null);
    } else {
      const newLink = {
        id: crypto.randomUUID(),
        name: docName.trim().toUpperCase(),
        url: docUrl.trim(),
        category: docCategory.trim().toUpperCase(),
        description: docDescription.trim(),
        params: docParams.trim()
      };
      setLocalSettings({ ...localSettings, documentLinks: [...links, newLink] });
    }

    setDocName('');
    setDocUrl('');
    setDocCategory('GERAL');
    setDocDescription('');
    setDocParams('');
    alert("Vínculo de documento salvo com sucesso! Clique em 'Aplicar Ajustes' no topo para registrar no banco de dados.");
  };

  const handleAddGB = () => {
    if (!newGB.name.trim()) return;
    const gb = { id: crypto.randomUUID(), name: newGB.name.trim() };
    setLocalSettings({ ...localSettings, gbs: [...(localSettings.gbs || []), gb] });
    setNewGB({ name: '' });
  };

  const handleRemoveGB = (id: string) => {
    setLocalSettings({
      ...localSettings,
      gbs: (localSettings.gbs || []).filter(g => g.id !== id),
      sgbs: (localSettings.sgbs || []).filter(s => s.gbId !== id)
    });
  };

  const handleAddSGB = () => {
    if (!newSGB.name.trim() || !newSGB.gbId) return;
    const sgb = { id: crypto.randomUUID(), ...newSGB };
    setLocalSettings({ ...localSettings, sgbs: [...(localSettings.sgbs || []), sgb] });
    setNewSGB({ name: '', gbId: '' });
  };

  const handleRemoveSGB = (id: string) => {
    setLocalSettings({
      ...localSettings,
      sgbs: (localSettings.sgbs || []).filter(s => s.id !== id),
      stations: (localSettings.stations || []).filter(st => st.sgbId !== id)
    });
  };

  const handleAddStation = () => {
    if (!newStation.name.trim() || !newStation.sgbId) return;
    
    if (editingStationId) {
      setLocalSettings({
        ...localSettings,
        stations: (localSettings.stations || []).map(s => 
          s.id === editingStationId ? { ...newStation, id: editingStationId } : s
        )
      });
      setEditingStationId(null);
    } else {
      const station = { id: crypto.randomUUID(), ...newStation };
      setLocalSettings({ ...localSettings, stations: [...(localSettings.stations || []), station] });
    }
    setNewStation({ name: '', sgbId: '' });
  };

  const handleStartEditStation = (s: any) => {
    setNewStation({ name: s.name, sgbId: s.sgbId });
    setEditingStationId(s.id);
  };

  const cancelEditStation = () => {
    setNewStation({ name: '', sgbId: '' });
    setEditingStationId(null);
  };

  const handleRemoveStation = (id: string) => {
    setLocalSettings({
      ...localSettings,
      stations: (localSettings.stations || []).filter(s => s.id !== id)
    });
  };

  const handleAddVehicle = () => {
    if (!newVehicle.prefix.trim()) return;
    
    let finalGB = newVehicle.gb;
    let finalSGB = newVehicle.sgb;

    if (newVehicle.station) {
      const station = localSettings.stations?.find(s => s.name === newVehicle.station);
      if (station) {
        const sgb = localSettings.sgbs?.find(s => s.id === station.sgbId);
        if (sgb) {
          finalSGB = sgb.name;
          const gb = localSettings.gbs?.find(g => g.id === sgb.gbId);
          if (gb) finalGB = gb.name;
        }
      }
    }
    
    const vehicleData = { ...newVehicle, gb: finalGB, sgb: finalSGB };

    if (editingVehicleId) {
      setLocalSettings({
        ...localSettings,
        vehicles: (localSettings.vehicles || []).map(v => 
          v.id === editingVehicleId ? { ...vehicleData, id: editingVehicleId } : v
        )
      });
      setEditingVehicleId(null);
    } else {
      const vehicle = { id: crypto.randomUUID(), ...vehicleData };
      setLocalSettings({ ...localSettings, vehicles: [...(localSettings.vehicles || []), vehicle] });
    }
    setNewVehicle({ prefix: '', plate: '', type: 'LEVE/PESADA', station: '', sgb: '', gb: '', currentKm: 0 });
  };

  const startEditVehicle = (v: any) => {
    setNewVehicle({ prefix: v.prefix, plate: v.plate, type: v.type, station: v.station, sgb: v.sgb || '', gb: v.gb || '', currentKm: v.currentKm || 0 });
    setEditingVehicleId(v.id);
  };

  const cancelEditVehicle = () => {
    setNewVehicle({ prefix: '', plate: '', type: 'LEVE/PESADA', station: '', sgb: '', gb: '', currentKm: 0 });
    setEditingVehicleId(null);
  };

  const removeVehicle = (id: string) => {
    setLocalSettings({ ...localSettings, vehicles: (localSettings.vehicles || []).filter(v => v.id !== id) });
  };

  const handleLogoUpload = (key: 'headerLogoUrl1' | 'headerLogoUrl2', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result as string, 400, 400, 0.7);
        setLocalSettings({ ...localSettings, [key]: compressed });
      };
      reader.readAsDataURL(file);
    }
  };

  // Função disparada ao trocar abas
  const handleTabChange = (tabId: typeof activeTab) => {
    setActiveTab(tabId);
  };

  const handleAddUser = () => {
    if (!localUserForm.username || !localUserForm.password || !localUserForm.password.trim() || !localUserForm.name) {
      alert('Preencha usuário, senha e nome');
      return;
    }

    if (localUserForm.username.toLowerCase() === 'cavalieri') {
      alert('Erro: Não é permitido criar um usuário com o nome "cavalieri".');
      return;
    }

    if ((localSettings.users || []).some(u => u.username.toLowerCase() === localUserForm.username!.toLowerCase())) {
      alert('Erro: Este nome de usuário já está em uso.');
      return;
    }
    
    const isCavalieri = currentUser?.username?.toLowerCase() === 'cavalieri';
    const restrictedPerms = ['viewAudit', 'manageLogs', 'manageDatabase', 'manageReportEditor'];
    
    // Validar permissões: usuário não pode dar o que não tem
    const validatedPermissions = { ...localUserForm.permissions } as UserPermissions;
    Object.keys(validatedPermissions).forEach(key => {
      const k = key as keyof UserPermissions;
      if (validatedPermissions[k]) {
        const hasPermission = currentUser?.permissions?.admin || !!currentUser?.permissions?.[k];
        const canGrant = isCavalieri || (hasPermission && !restrictedPerms.includes(k as string));
        if (!canGrant) validatedPermissions[k] = false;
      }
    });

    const newUser: User = {
      id: crypto.randomUUID(),
      username: localUserForm.username.toLowerCase(),
      email: localUserForm.email?.toLowerCase(),
      password: localUserForm.password.trim(),
      name: localUserForm.name,
      rank: localUserForm.rank,
      forcePasswordChange: localUserForm.forcePasswordChange,
      permissions: validatedPermissions
    };
    
    const updatedSettings = {
      ...localSettings,
      users: [...(localSettings.users || []), newUser]
    };
    setLocalSettings(updatedSettings);
    onSave(updatedSettings);

    setLocalUserForm({ 
      username: '', 
      email: '',
      password: '', 
      name: '', 
      rank: '', 
      forcePasswordChange: false,
      permissions: { checklist: true, reports: false, settings: false, admin: false } 
    });
    setShowUserFormPassword(false);
    setIsAddingLocalUser(false);
    alert('Usuário cadastrado com sucesso!');
  };

  const handleUpdateLocalUser = () => {
    if (!editingLocalUser || !localUserForm.username || !localUserForm.name) {
      alert('Preencha usuário e nome');
      return;
    }

    if (localUserForm.username.toLowerCase() === 'cavalieri' && editingLocalUser.username.toLowerCase() !== 'cavalieri') {
      alert('Erro: Não é permitido alterar um usuário para o nome "cavalieri".');
      return;
    }

    const isCavalieri = currentUser?.username?.toLowerCase() === 'cavalieri';
    const restrictedPerms = ['viewAudit', 'manageLogs', 'manageDatabase', 'manageReportEditor'];

    // Se informou nova senha, atualiza; senão, mantém a senha atual do usuário intacta
    const newPassword = (localUserForm.password && localUserForm.password.trim() !== '')
      ? localUserForm.password.trim()
      : editingLocalUser.password;

    const updatedUsers: User[] = (localSettings.users || []).map(u => {
      if (u.id === editingLocalUser.id) {
        // Validar permissões na edição
        const validatedPermissions = { ...(localUserForm.permissions || u.permissions) } as UserPermissions;
        
        // Se não for Cavalieri editando, aplicamos restrições estritas
        if (!isCavalieri) {
          Object.keys(validatedPermissions).forEach(key => {
            const k = key as keyof UserPermissions;
            if (validatedPermissions[k]) {
              const hasPermission = currentUser?.permissions?.admin || !!currentUser?.permissions?.[k];
              const canGrant = hasPermission && !restrictedPerms.includes(k as string);
              if (!canGrant) validatedPermissions[k] = false;
            }
          });
        }

        return {
          ...u,
          username: localUserForm.username!.toLowerCase(),
          email: localUserForm.email?.toLowerCase(),
          password: newPassword,
          name: localUserForm.name!,
          rank: localUserForm.rank,
          forcePasswordChange: localUserForm.forcePasswordChange,
          permissions: validatedPermissions
        };
      }
      return u;
    });

    const updatedSettings = { ...localSettings, users: updatedUsers };
    setLocalSettings(updatedSettings);
    onSave(updatedSettings);

    setEditingLocalUser(null);
    setLocalUserForm({ 
      username: '', 
      email: '',
      password: '', 
      name: '', 
      rank: '', 
      forcePasswordChange: false,
      permissions: { checklist: true, reports: false, settings: false, admin: false } 
    });
    setShowUserFormPassword(false);
    setIsAddingLocalUser(false);
    alert('Dados do usuário atualizados com sucesso!');
  };

  const handleStartEditLocalUser = (u: User) => {
    setEditingLocalUser(u);
    setLocalUserForm({
      username: u.username,
      email: u.email || '',
      password: '', // A senha atual NUNCA deve aparecer
      name: u.name,
      rank: u.rank || '',
      forcePasswordChange: u.forcePasswordChange || false,
      permissions: u.permissions
    });
    setShowUserFormPassword(false);
    setIsAddingLocalUser(true); // Re-use the same form area
  };

  const deleteLocalUser = (id: string, username: string) => {
    if (username.toLowerCase() === 'cavalieri') {
      alert("ERRO PROTEÇÃO: O usuário 'cavalieri' é o administrador mestre e não pode ser removido.");
      return;
    }
    
    if (window.confirm(`Tem certeza que deseja excluir o usuário "${username}"?`)) {
      const filteredUsers = (localSettings.users || []).filter(u => u.id !== id);
      const updatedSettings = {
        ...localSettings,
        users: filteredUsers
      };
      setLocalSettings(updatedSettings);
      onSave(updatedSettings);
    }
  };

  const handleOpenQuickPassword = (u: User) => {
    setQuickPasswordModalUser(u);
    setQuickNewPassword('');
    setQuickConfirmPassword('');
    setQuickForceChange(u.forcePasswordChange || false);
    setShowQuickNewPassword(false);
  };

  const handleSaveQuickPassword = () => {
    if (!quickPasswordModalUser) return;
    
    const trimmedPass = quickNewPassword.trim();
    if (!trimmedPass) {
      alert('Informe a nova senha do usuário.');
      return;
    }

    if (trimmedPass !== quickConfirmPassword.trim()) {
      alert('A confirmação não coincide com a nova senha digitada.');
      return;
    }

    const updatedUsers: User[] = (localSettings.users || []).map(user => {
      if (user.id === quickPasswordModalUser.id) {
        return {
          ...user,
          password: trimmedPass,
          forcePasswordChange: quickForceChange
        };
      }
      return user;
    });

    const updatedSettings = {
      ...localSettings,
      users: updatedUsers
    };

    setLocalSettings(updatedSettings);
    onSave(updatedSettings);

    const userName = quickPasswordModalUser.name || quickPasswordModalUser.username;
    setQuickPasswordModalUser(null);
    setQuickNewPassword('');
    setQuickConfirmPassword('');
    setShowQuickNewPassword(false);
    alert(`Senha do usuário "${userName}" alterada e salva com sucesso!`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors no-print"><ArrowLeft className="w-5 h-5" /></button>
          <h2 className="text-xl font-bold text-gray-800">Centro de Inteligência de Frota</h2>
        </div>
        <div className="flex items-center gap-2 no-print">
          {isSuperUser && (
            <button onClick={() => onSave(localSettings)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg">Aplicar Ajustes</button>
          )}
        </div>
      </div>

      <nav className="flex gap-2 overflow-x-auto pb-2 no-print">
        {[
          { id: 'reports', label: 'Relatórios', icon: FileText, permission: 'reports' },
          { id: 'report_editor', label: 'Editor Relat.', icon: Edit2, permission: 'reports' },
          { id: 'manual', label: 'Manual', icon: BookOpen },
          { id: 'stations', label: 'Postos', icon: Navigation, permission: 'manageStations' },
          { id: 'vehicles', label: 'Viaturas', icon: Car, permission: 'manageVehicles' },
          { id: 'users', label: 'Usuários', icon: Users, permission: 'manageUsers' },
          { id: 'items', label: 'Itens', icon: ListChecks, permission: 'manageItems' },
          { id: 'images', label: 'Plantas', icon: ImageIcon, permission: 'manageImages' },
          { id: 'style', label: 'Estilo', icon: Palette, permission: 'manageStyle' },
          { id: 'admin', label: 'Auditoria', icon: Lock, permission: 'viewAudit' },
          { id: 'logs_admin', label: 'Gestão Lanç.', icon: Database, permission: 'manageLogs' },
          { id: 'cloud', label: 'Nuvem', icon: Cloud, permission: 'manageDatabase' },
          { id: 'about', label: 'SOBRE', icon: Info }
        ].filter(tab => isTabAccessible(tab.id as any)).map(tab => (
          <button 
            key={tab.id} 
            onClick={() => handleTabChange(tab.id as any)} 
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="bg-white border rounded-3xl overflow-hidden min-h-[500px] shadow-sm">
        {activeTab === 'logs_admin' && (
          <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-xl font-black text-gray-900 uppercase">Gestão de Lançamentos (Mestre)</h3>
                <p className="text-xs text-gray-500 font-bold">Listagem e exclusão de checklists ({logs.length} registros exibidos).</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button 
                  type="button"
                  onClick={() => fetchLogs()} 
                  className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-2 rounded-xl text-xs font-black transition-all"
                  title="Exibir no máximo os últimos 30 dias para máxima rapidez"
                >
                  Últimos 30 Dias
                </button>
                <button 
                  type="button"
                  onClick={() => fetchLogs(undefined, 'all')} 
                  className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 px-3 py-2 rounded-xl text-xs font-black transition-all"
                  title="Carregar todos os lançamentos históricos da planilha"
                >
                  Histórico Completo
                </button>
                <button 
                  onClick={() => fetchLogs()} 
                  className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-xl text-xs font-black transition-all"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} />
                  Atualizar
                </button>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-black text-amber-800 uppercase mb-1">Atenção Admin</h4>
                <p className="text-[10px] text-amber-700 leading-relaxed font-bold">Use esta área com cautela. A exclusão de um lançamento é IRREVERSÍVEL e removerá o registro da planilha LOGS. Utilize para permitir que uma viatura refaça um checklist bloqueado por duplicata diária.</p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border bg-gray-50/30">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-100 text-[10px] font-black uppercase text-gray-500 tracking-widest border-b">
                  <tr>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Prefixo</th>
                    <th className="px-4 py-3">Ciclo</th>
                    <th className="px-4 py-3">Conferente</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs font-bold text-gray-700">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-gray-400 font-black uppercase tracking-widest">Nenhum lançamento encontrado</td>
                    </tr>
                  ) : (
                    logs.map((log, lIdx) => (
                      <tr key={`${log.id}-${lIdx}`} className="hover:bg-white transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">{new Date(log.date).toLocaleString('pt-BR')}</td>
                        <td className="px-4 py-3 font-black text-blue-600">{log.prefix}</td>
                        <td className="px-4 py-3"><span className="px-2 py-1 bg-gray-100 rounded-md text-[10px] font-black uppercase">{log.checklistType}</span></td>
                        <td className="px-4 py-3 truncate max-w-[200px]">{log.inspector}</td>
                        <td className="px-4 py-3 text-right">
                          <button 
                            onClick={() => handleDeleteLog(log.id)}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Excluir Lançamento"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'manual' && (
          <div className="p-8 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b pb-4 gap-4">
              <h3 className="text-2xl font-black text-gray-900 uppercase">Manual & Legislação</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setManualSubTab('instructions')}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all ${manualSubTab === 'instructions' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Instruções
                </button>
                <button
                  onClick={() => setManualSubTab('links')}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all ${manualSubTab === 'links' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Documentos & Links
                </button>
              </div>
            </div>

            {manualSubTab === 'instructions' ? (
              <div className="space-y-8 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {/* 1. OPERAÇÃO DO CHECKLIST */}
                <section className="space-y-4">
                  <div className="flex items-center gap-3 border-b border-gray-100 pb-2">
                    <div className="bg-blue-600 text-white w-10 h-10 rounded-2xl flex items-center justify-center font-black shadow-lg shadow-blue-100">01</div>
                    <h4 className="text-sm font-black uppercase text-gray-900">Operação do Checklist</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                      <h5 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Identificação e Ciclo</h5>
                      <p className="text-xs text-gray-600 leading-relaxed font-medium">Insira o prefixo da viatura, placa e odômetro atual. Selecione o tipo de viatura (Leve/Pesada, Moto ou AB) para carregar os itens específicos. Escolha entre inspeção <b>Diária</b> ou <b>Semanal</b>.</p>
                    </div>
                    <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                      <h5 className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-1">Mapa de Avarias</h5>
                      <p className="text-xs text-gray-600 leading-relaxed font-medium">Utilize as plantas interativas para marcar danos externos. Clique sobre o local do dano para abrir o menu de tipo de avaria (Risco, Amassado, Quebra, etc.). Isso substitui o preenchimento manual em papel.</p>
                    </div>
                    <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                      <h5 className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1">Itens Técnicos (SN/CN)</h5>
                      <p className="text-xs text-gray-600 leading-relaxed font-medium">Cada item deve ter seu status definido: <b>SN</b> (Sem Novidade) para itens operantes ou <b>CN</b> (Com Novidade) para falhas. Itens CN exigem obrigatoriamente um comentário e, opcionalmente, fotos.</p>
                    </div>
                    <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                      <h5 className="text-[10px] font-black text-purple-600 uppercase tracking-widest mb-1">Assinatura e PDF</h5>
                      <p className="text-xs text-gray-600 leading-relaxed font-medium">Após conferir todos os itens, assine na tela. Use o botão <b>Finalizar</b> para gerar o relatório em PDF altamente detalhado, pronto para impressão ou compartilhamento via WhatsApp.</p>
                    </div>
                  </div>
                </section>

                {/* 2. MONITORAMENTO (DASHBOARD) */}
                <section className="space-y-4">
                  <div className="flex items-center gap-3 border-b border-gray-100 pb-2">
                    <div className="bg-cyan-600 text-white w-10 h-10 rounded-2xl flex items-center justify-center font-black shadow-lg shadow-cyan-100">02</div>
                    <h4 className="text-sm font-black uppercase text-gray-900">Monitoramento (Dashboard)</h4>
                  </div>
                  <div className="bg-gray-900 p-8 rounded-[2.5rem] text-white">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className="space-y-3">
                          <h5 className="text-xs font-black uppercase text-cyan-400 tracking-widest flex items-center gap-2"><LayoutDashboard className="w-4 h-4"/> Prontidão em Tempo Real</h5>
                          <p className="text-xs text-gray-300 font-medium leading-loose">O Dashboard oferece uma visão macro da frota. Viaturas com checklists pendentes aparecem em <b>Vermelho</b>. Viaturas com checklists realizados aparecem em <b>Verde</b> (Sem Novidades) ou <b>Laranja</b> (Com Novidades).</p>
                       </div>
                       <div className="space-y-3">
                          <h5 className="text-xs font-black uppercase text-cyan-400 tracking-widest flex items-center gap-2"><Search className="w-4 h-4"/> Filtros Avançados</h5>
                          <p className="text-xs text-gray-300 font-medium leading-loose">Filtre a visualização por <b>Posto de Serviço</b> ou por <b>Status de Conformidade</b>. Você pode isolar rapidamente viaturas que possuem justificativas pendentes no mês corrente.</p>
                       </div>
                    </div>
                  </div>
                </section>

                {/* 3. ALERTAS E MANUTENÇÃO */}
                <section className="space-y-4">
                  <div className="flex items-center gap-3 border-b border-gray-100 pb-2">
                    <div className="bg-red-600 text-white w-10 h-10 rounded-2xl flex items-center justify-center font-black shadow-lg shadow-red-100">03</div>
                    <h4 className="text-sm font-black uppercase text-gray-900">Alertas de Manutenção</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white border-2 border-red-50 p-6 rounded-3xl">
                      <div className="flex items-center gap-3 mb-3">
                         <div className="bg-red-100 p-2 rounded-xl"><TrendingUp className="w-4 h-4 text-red-600" /></div>
                         <h5 className="text-[10px] font-black text-red-600 uppercase tracking-widest">Baseado em KM</h5>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed font-medium">Programe trocas de óleo, pneus ou revisões definindo o KM alvo. O sistema emitirá um alerta visual no dashboard conforme a viatura se aproxima do limite estabelecido.</p>
                    </div>
                    <div className="bg-white border-2 border-indigo-50 p-6 rounded-3xl">
                      <div className="flex items-center gap-3 mb-3">
                         <div className="bg-indigo-100 p-2 rounded-xl"><Calendar className="w-4 h-4 text-indigo-600" /></div>
                         <h5 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Calendário</h5>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed font-medium">Ideal para licenciamentos, seguros ou vistorias de compressores. Defina a data de expiração e o prazo de antecedência para o aviso prévio.</p>
                    </div>
                  </div>
                </section>

                {/* 4. GESTÃO E CONFIGURAÇÕES */}
                <section className="space-y-4">
                  <div className="flex items-center gap-3 border-b border-gray-100 pb-2">
                    <div className="bg-amber-600 text-white w-10 h-10 rounded-2xl flex items-center justify-center font-black shadow-lg shadow-amber-100">04</div>
                    <h4 className="text-sm font-black uppercase text-gray-900">Gestão e Auditoria</h4>
                  </div>
                  <div className="bg-gray-50 p-8 rounded-[2.5rem] border border-gray-200">
                    <ul className="space-y-4">
                      <li className="flex gap-4">
                        <div className="bg-white p-2 rounded-xl border shadow-sm h-fit"><Users className="w-4 h-4 text-amber-600" /></div>
                        <div>
                          <p className="text-xs font-black text-gray-900 uppercase">Hierarquia de Acesso</p>
                          <p className="text-[11px] text-gray-500 font-medium">Os administradores podem gerenciar usuários e suas permissões: acesso a relatórios, configurações de itens ou auditoria geral de acessos.</p>
                        </div>
                      </li>
                      <li className="flex gap-4">
                        <div className="bg-white p-2 rounded-xl border shadow-sm h-fit"><Database className="w-4 h-4 text-amber-600" /></div>
                        <div>
                          <p className="text-xs font-black text-gray-900 uppercase">Nuvem e Sincronização</p>
                          <p className="text-[11px] text-gray-500 font-medium">Todos os dados são persistidos no servidor (Google Sheets). Use o botão de sincronização para garantir que as informações locais correspondam ao banco oficial.</p>
                        </div>
                      </li>
                    </ul>
                  </div>
                </section>

                {/* 5. NOVAS FUNCIONALIDADES */}
                <section className="space-y-4">
                  <div className="flex items-center gap-3 border-b border-gray-100 pb-2">
                    <div className="bg-green-600 text-white w-10 h-10 rounded-2xl flex items-center justify-center font-black shadow-lg shadow-green-100">05</div>
                    <h4 className="text-sm font-black uppercase text-gray-900">Novas Funcionalidades</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                      <h5 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Gestão de Postos e SGB</h5>
                      <p className="text-xs text-gray-600 leading-relaxed font-medium">Agora é possível editar postos existentes e vinculá-los a um Subgrupamento (SGB) específico, facilitando a organização hierárquica da frota.</p>
                    </div>
                    <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                      <h5 className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-1">Customização Visual</h5>
                      <p className="text-xs text-gray-600 leading-relaxed font-medium">A tela inicial pode ser personalizada com uma imagem de fundo de sua escolha, permitindo uma identidade visual própria para cada unidade.</p>
                    </div>
                  </div>
                </section>

                {/* 6. RELATÓRIOS E ESTATÍSTICAS */}
                <section className="space-y-4">
                  <div className="flex items-center gap-3 border-b border-gray-100 pb-2">
                    <div className="bg-indigo-600 text-white w-10 h-10 rounded-2xl flex items-center justify-center font-black shadow-lg shadow-indigo-100">06</div>
                    <h4 className="text-sm font-black uppercase text-gray-900">Relatórios e Estatísticas</h4>
                  </div>
                  <div className="bg-gray-900 p-8 rounded-[2.5rem] text-white">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className="space-y-3">
                          <h5 className="text-xs font-black uppercase text-indigo-400 tracking-widest flex items-center gap-2"><BarChart3 className="w-4 h-4"/> KM Rodado Mensal</h5>
                          <p className="text-xs text-gray-300 font-medium leading-loose">Acesse relatórios detalhados de KM rodado por mês ou ano. Filtre por SGB, Posto ou visualize a frota completa com distribuição estatística por viatura.</p>
                       </div>
                       <div className="space-y-3">
                          <h5 className="text-xs font-black uppercase text-indigo-400 tracking-widest flex items-center gap-2"><PieChart className="w-4 h-4"/> Comparativo Geral</h5>
                          <p className="text-xs text-gray-300 font-medium leading-loose">Compare o desempenho entre postos e SGBs, identificando quais unidades e viaturas (UR, ABS, etc.) possuem maior volume de rodagem no período selecionado.</p>
                       </div>
                    </div>
                  </div>
                </section>

                {/* 7. PERMISSÕES E HIERARQUIA */}
                <section className="space-y-4">
                  <div className="flex items-center gap-3 border-b border-gray-100 pb-2">
                    <div className="bg-rose-600 text-white w-10 h-10 rounded-2xl flex items-center justify-center font-black shadow-lg shadow-rose-100">07</div>
                    <h4 className="text-sm font-black uppercase text-gray-900">Permissões e Hierarquia</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-rose-50 p-6 rounded-3xl border border-rose-100">
                      <h5 className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1">Controle de Acesso Granular</h5>
                      <p className="text-xs text-gray-600 leading-relaxed font-medium">As permissões agora são definidas tela a tela e relatório a relatório. Administradores podem restringir acesso a Postos, Viaturas, Itens e selecionar individualmente quais relatórios cada usuário pode gerar.</p>
                    </div>
                    <div className="bg-rose-50 p-6 rounded-3xl border border-rose-100">
                      <h5 className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1">Restrições de Segurança</h5>
                      <p className="text-xs text-gray-600 leading-relaxed font-medium">Um usuário com permissão de editar outros não pode conceder permissões que ele próprio não possua. Telas sensíveis como Nuvem, Auditoria e Editor de Relatórios são exclusivas do super usuário.</p>
                    </div>
                  </div>
                </section>
              </div>
            ) : (
              <div className="space-y-6">
                {(() => {
                  const canEditDocs = !!currentUser?.permissions?.admin || currentUser?.username?.toLowerCase() === 'cavalieri';
                  return (
                    <>
                      {canEditDocs ? (
                        <div className="bg-blue-50 border border-blue-200 p-6 rounded-2xl space-y-4 shadow-sm">
                          <div className="flex items-center gap-2 border-b border-blue-100 pb-2">
                            <ShieldCheck className="w-5 h-5 text-blue-600" />
                            <div>
                              <h4 className="font-black text-sm text-blue-900 uppercase">Gerenciar Documentos de Referência</h4>
                              <p className="text-[9px] font-bold text-blue-500 uppercase">Adicione ou edite links acessíveis a todos os usuários</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Nome do Documento</label>
                              <input
                                type="text"
                                placeholder="EX: POP N° 12 - SEGUIMENTO"
                                value={docName}
                                onChange={e => setDocName(e.target.value.toUpperCase())}
                                className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold"
                              />
                            </div>
                            
                            <div className="space-y-1">
                              <label className="text-[10px] font-black text-gray-500 uppercase ml-1">URL do Link</label>
                              <input
                                type="text"
                                placeholder="EX: https://exemplo.com/pop.pdf"
                                value={docUrl}
                                onChange={e => setDocUrl(e.target.value)}
                                className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-blue-600 font-mono"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Categoria de Legislação</label>
                              <select
                                value={docCategory}
                                onChange={e => setDocCategory(e.target.value)}
                                className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold"
                              >
                                <option value="GERAL">CONCEITOS GERAIS</option>
                                <option value="REGULAMENTO">REGULAMENTAÇÕES / LEIS</option>
                                <option value="DIRETRIZ">DIRETRIZES TÉCNICAS</option>
                                <option value="MANUAL_SERVICO">MANUAL DE SERVIÇO</option>
                                <option value="OUTROS">OUTROS RECURSOS</option>
                              </select>
                            </div>

                            <div className="space-y-1 md:col-span-2">
                              <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Descrição do Documento</label>
                              <input
                                type="text"
                                placeholder="EX: Diretriz referente ao preenchimento de checklists semanais das viaturas leves"
                                value={docDescription}
                                onChange={e => setDocDescription(e.target.value)}
                                className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Parâmetros de Edição (Edit Params)</label>
                              <input
                                type="text"
                                placeholder="EX: lang=pt-BR&view=fit"
                                value={docParams}
                                onChange={e => setDocParams(e.target.value)}
                                className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold font-mono"
                              />
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={handleAddOrEditDocLink}
                              className={`flex-1 p-2.5 rounded-xl text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                                editingDocLinkId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
                              }`}
                            >
                              {editingDocLinkId ? (
                                <>
                                  <Save className="w-4 h-4" />
                                  Salvar Link Alterado
                                </>
                              ) : (
                                <>
                                  <Plus className="w-4 h-4" />
                                  Registrar Novo Documento
                                </>
                              )}
                            </button>

                            {editingDocLinkId && (
                              <button
                                onClick={() => {
                                  setEditingDocLinkId(null);
                                  setDocName('');
                                  setDocUrl('');
                                  setDocCategory('GERAL');
                                  setDocDescription('');
                                  setDocParams('');
                                }}
                                className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-xl text-xs font-black uppercase transition-all"
                              >
                                Cancelar
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-50 border p-4 rounded-2xl flex items-center gap-3">
                          <Info className="w-5 h-5 text-gray-500 shrink-0" />
                          <div>
                            <h4 className="font-extrabold text-xs text-gray-700 uppercase">Biblioteca de Manuais e Legislação</h4>
                            <p className="text-[10px] font-bold text-gray-400 uppercase">Consulte os documentos oficiais abaixo. Apenas administradores e o super usuário podem incluir ou editar links.</p>
                          </div>
                        </div>
                      )}

                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <h4 className="text-xs font-black uppercase text-gray-400">Documentação Cadastrada</h4>
                          <span className="text-[9px] font-black text-gray-400 uppercase bg-gray-100 px-2 py-0.5 rounded border">
                            {(localSettings.documentLinks || []).length} link(s)
                          </span>
                        </div>
                        
                        {(!localSettings.documentLinks || localSettings.documentLinks.length === 0) ? (
                          <div className="p-12 text-center border-2 border-dashed rounded-3xl bg-gray-50">
                            <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                            <p className="text-xs text-gray-400 font-bold uppercase text-center">Nenhum documento cadastrado</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {localSettings.documentLinks.map((link) => {
                              const destinationUrl = link.url + (link.params ? (link.url.includes('?') ? '&' : '?') + link.params : '');
                              return (
                                <div key={link.id} className="bg-white border rounded-2xl p-4 flex flex-col justify-between hover:shadow-md transition-all">
                                  <div className="space-y-1">
                                    <div className="flex justify-between items-start gap-2 flex-wrap">
                                      <span className="bg-blue-50 text-blue-600 text-[8px] font-black px-2 py-0.5 rounded-full uppercase">
                                        {link.category || 'GERAL'}
                                      </span>
                                      {link.params && (
                                        <span className="bg-purple-50 text-purple-600 text-[8px] font-mono px-2 py-0.5 rounded uppercase" title="Editing parameters configured">
                                          Config: {link.params}
                                        </span>
                                      )}
                                    </div>
                                    <h5 className="font-black text-gray-800 text-xs uppercase tracking-tight mt-1.5 leading-tight">
                                      {link.name}
                                    </h5>
                                    {link.description && (
                                      <p className="text-[10px] text-gray-500 font-medium">
                                        {link.description}
                                      </p>
                                    )}
                                    <div className="text-[8px] font-mono text-gray-400 truncate mt-1">
                                      {link.url}
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between border-t pt-2.5 mt-3.5 gap-2">
                                    <a 
                                      href={destinationUrl} 
                                      target="_blank" 
                                      rel="noreferrer" 
                                      className="text-[10px] font-black uppercase text-blue-600 hover:text-blue-800 flex items-center gap-1.5 transition-all"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
                                      Visualizar
                                    </a>

                                    {canEditDocs && (
                                      <div className="flex gap-1">
                                        <button
                                          onClick={() => {
                                            setEditingDocLinkId(link.id);
                                            setDocName(link.name);
                                            setDocUrl(link.url);
                                            setDocCategory(link.category || 'GERAL');
                                            setDocDescription(link.description || '');
                                            setDocParams(link.params || '');
                                          }}
                                          className="text-amber-500 hover:text-amber-700 bg-amber-50 p-1.5 rounded-lg transition-all"
                                          title="Editar"
                                        >
                                          <Edit2 className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={() => {
                                            if (confirm(`Excluir o link do documento "${link.name}"?`)) {
                                              const updated = (localSettings.documentLinks || []).filter(l => l.id !== link.id);
                                              setLocalSettings({ ...localSettings, documentLinks: updated });
                                            }
                                          }}
                                          className="text-red-500 hover:text-red-700 bg-red-50 p-1.5 rounded-lg transition-all"
                                          title="Excluir"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {activeTab === 'stations' && (
          <div className="p-6 space-y-8">
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase text-gray-400">1. Cadastro de Grupamento (GB)</h4>
              <div className="flex gap-2 bg-gray-50 p-3 rounded-2xl border">
                <input type="text" placeholder="Nome do GB (Ex: 10º GB)" value={newGB.name} onChange={e => setNewGB({name: e.target.value.toUpperCase()})} className="flex-1 border rounded-xl px-4 py-2 text-xs font-bold" />
                <button onClick={handleAddGB} className="bg-blue-600 text-white p-2 rounded-xl hover:bg-blue-700 transition-all"><Plus className="w-6 h-6" /></button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(localSettings.gbs || []).map(g => (
                  <span key={g.id} className="bg-white border px-3 py-1.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2">
                    {g.name}
                    <button onClick={() => handleRemoveGB(g.id)} className="text-red-400 hover:text-red-600"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase text-gray-400">2. Cadastro de Subgrupamento (SGB)</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 bg-gray-50 p-3 rounded-2xl border">
                <select value={newSGB.gbId} onChange={e => setNewSGB({...newSGB, gbId: e.target.value})} className="border rounded-xl px-3 py-2 text-xs font-bold bg-white">
                  <option key="default-gb" value="">Selecione o GB...</option>
                  {(localSettings.gbs || []).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <input type="text" placeholder="Nome do SGB (Ex: 2ª SGB)" value={newSGB.name} onChange={e => setNewSGB({...newSGB, name: e.target.value.toUpperCase()})} className="md:col-span-1 border rounded-xl px-4 py-2 text-xs font-bold" />
                <button onClick={handleAddSGB} className="bg-blue-600 text-white p-2 rounded-xl hover:bg-blue-700 transition-all flex justify-center items-center"><Plus className="w-6 h-6" /></button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(localSettings.sgbs || []).map(s => {
                  const gb = localSettings.gbs?.find(g => g.id === s.gbId);
                  return (
                    <span key={s.id} className="bg-white border px-3 py-1.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2">
                      <span className="text-gray-400 mr-1">{gb?.name}</span> {s.name}
                      <button onClick={() => handleRemoveSGB(s.id)} className="text-red-400 hover:text-red-600"><X className="w-3 h-3" /></button>
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase text-gray-400">3. Cadastro de Posto de Bombeiros (Station)</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 bg-gray-50 p-3 rounded-2xl border">
                <select value={newStation.sgbId} onChange={e => setNewStation({...newStation, sgbId: e.target.value})} className="border rounded-xl px-3 py-2 text-xs font-bold bg-white">
                  <option key="default-sgb" value="">Selecione o SGB...</option>
                  {(localSettings.sgbs || []).map(s => {
                    const gb = localSettings.gbs?.find(g => g.id === s.gbId);
                    return <option key={s.id} value={s.id}>{gb?.name} - {s.name}</option>;
                  })}
                </select>
                <input type="text" placeholder="Nome do Posto (Ex: PB Central)" value={newStation.name} onChange={e => setNewStation({...newStation, name: e.target.value.toUpperCase()})} className="md:col-span-1 border rounded-xl px-4 py-2 text-xs font-bold" />
                <div className="flex gap-1">
                  <button onClick={handleAddStation} className={`flex-1 ${editingStationId ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} text-white p-2 rounded-xl transition-all flex justify-center items-center font-bold text-[10px] uppercase gap-1`}>
                    {editingStationId ? <><Save className="w-4 h-4" /> Salvar</> : <><Plus className="w-6 h-6" /></>}
                  </button>
                  {editingStationId && (
                    <button onClick={cancelEditStation} className="bg-gray-200 text-gray-600 p-2 rounded-xl hover:bg-gray-300 transition-all flex items-center justify-center font-bold text-[10px] uppercase">
                      Sair
                    </button>
                  )}
                </div>
              </div>
              <div className="max-h-[300px] overflow-y-auto divide-y border rounded-2xl">
                {(localSettings.stations || []).length === 0 && <p className="p-10 text-center text-xs text-gray-400 font-bold uppercase">Nenhum posto cadastrado</p>}
                {(localSettings.stations || []).map((s) => {
                  const sgb = localSettings.sgbs?.find(sg => sg.id === s.sgbId);
                  const gb = localSettings.gbs?.find(g => g.id === sgb?.gbId);
                  return (
                    <div key={s.id} className="p-3 flex items-center justify-between hover:bg-gray-50">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-black text-gray-800 uppercase">{s.name}</span>
                        <span className="text-[9px] font-bold text-gray-400 uppercase">{gb?.name} / {sgb?.name}</span>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => handleStartEditStation(s)} className="text-blue-400 hover:text-blue-600 p-2 transition-all" title="Editar Posto"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleRemoveStation(s.id)} className="text-red-400 hover:text-red-600 p-2 transition-all" title="Excluir Posto"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'vehicles' && (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-2 bg-gray-50 p-3 rounded-2xl border">
              <input type="text" placeholder="Prefixo" value={newVehicle.prefix} onChange={e => setNewVehicle({...newVehicle, prefix: e.target.value.toUpperCase()})} className="border rounded-xl px-4 py-2 text-xs font-bold shadow-sm" />
              <input type="text" placeholder="Placa" value={newVehicle.plate} onChange={e => setNewVehicle({...newVehicle, plate: e.target.value.toUpperCase()})} className="border rounded-xl px-4 py-2 text-xs font-bold shadow-sm" />
              <select value={newVehicle.type} onChange={e => setNewVehicle({...newVehicle, type: e.target.value as any})} className="border rounded-xl px-3 py-2 text-xs font-bold shadow-sm bg-white">
                {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={newVehicle.station} onChange={e => setNewVehicle({...newVehicle, station: e.target.value})} className="border rounded-xl px-3 py-2 text-xs font-bold shadow-sm bg-white">
                <option key="default-station" value="">Posto...</option>
                {(localSettings.stations || []).map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
              <input 
                type="number" 
                placeholder="KM ATUAL" 
                value={newVehicle.currentKm} 
                onChange={e => setNewVehicle({...newVehicle, currentKm: Number(e.target.value)})} 
                className="border rounded-xl px-4 py-2 text-xs font-bold shadow-sm" 
                title="Odômetro Atual"
              />
              <div className="flex gap-1 md:col-span-2">
                <button onClick={handleAddVehicle} className={`flex-1 ${editingVehicleId ? 'bg-green-600' : 'bg-blue-600'} text-white p-2 rounded-xl transition-all shadow-md flex items-center justify-center font-bold text-[10px] uppercase gap-1`}>
                  {editingVehicleId ? <><Save className="w-4 h-4" /> Salvar</> : <><Plus className="w-4 h-4" /> Adicionar</>}
                </button>
                {editingVehicleId && (
                  <button onClick={cancelEditVehicle} className="bg-gray-200 text-gray-600 p-2 rounded-xl hover:bg-gray-300 transition-all flex items-center justify-center font-bold text-[10px] uppercase">
                    Sair
                  </button>
                )}
              </div>
            </div>
            
            <div className="max-h-[400px] overflow-y-auto divide-y border rounded-2xl">
              {(localSettings.vehicles || []).length === 0 && <p className="p-10 text-center text-xs text-gray-400 font-bold uppercase">Nenhuma viatura cadastrada</p>}
              {(localSettings.vehicles || []).map((v, vIdx) => (
                <div key={`${v.id || v.prefix}-${vIdx}`} className="p-3 flex items-center justify-between hover:bg-gray-50 group">
                  <div className="grid grid-cols-4 flex-1 gap-4 items-center">
                    <span className="text-[11px] font-black text-gray-800">{v.prefix}</span>
                    <span className="text-[11px] font-mono text-gray-600">{v.plate}</span>
                    <span className="text-[10px] font-bold text-blue-600">{v.type}</span>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-gray-800 uppercase">{v.station || 'Sem Posto'}</span>
                      <span className="text-[8px] font-bold text-gray-400 uppercase">{v.gb} / {v.sgb}</span>
                    </div>
                    <div className="flex flex-col text-right pr-2">
                      <span className="text-[9px] font-black text-blue-600 uppercase">KM ATUAL</span>
                      <span className="text-[10px] font-mono font-bold text-gray-800">{v.currentKm || 0}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => startEditVehicle(v)} className="text-blue-400 hover:text-blue-600 p-2 opacity-0 group-hover:opacity-100 transition-opacity"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => removeVehicle(v.id)} className="text-red-400 hover:text-red-600 p-2 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'items' && (
          <div className="p-6 space-y-4">
            <div className="space-y-3 bg-gray-50 p-4 rounded-2xl border">
              <div className="flex gap-2">
                <input type="text" placeholder="Nome do item..." value={newItem.label} onChange={e => setNewItem({...newItem, label: e.target.value})} className="flex-1 bg-white border rounded-xl px-4 py-2 text-xs font-bold outline-none" />
                <select value={newItem.frequency} onChange={e => setNewItem({...newItem, frequency: e.target.value as any})} className="bg-white border rounded-xl px-3 py-2 text-xs font-black uppercase">
                  <option value="Diário">Diário</option>
                  <option value="Semanal">Semanal</option>
                  <option value="Ambos">Ambos</option>
                </select>
                <button onClick={handleAddItem} className="bg-blue-600 text-white p-2 rounded-xl hover:bg-blue-700 transition-all"><Plus className="w-6 h-6" /></button>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="text-[9px] font-black text-gray-400 uppercase w-full">Vincular aos tipos:</span>
                {VEHICLE_TYPES.map(type => (
                  <button 
                    key={type}
                    onClick={() => {
                      const current = newItem.vehicleTypes;
                      const next = current.includes(type) ? current.filter(t => t !== type) : [...current, type];
                      setNewItem({ ...newItem, vehicleTypes: next });
                    }}
                    className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border transition-all ${newItem.vehicleTypes.includes(type) ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-white text-gray-400 border-gray-200'}`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 border-b pb-2">
              <span className="text-[10px] font-black text-gray-400 uppercase">Filtrar por Tipo:</span>
              <button onClick={() => setItemsFilter('all')} className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${itemsFilter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-400'}`}>Todos</button>
              {VEHICLE_TYPES.map(type => (
                <button 
                  key={type} 
                  onClick={() => setItemsFilter(type)} 
                  className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${itemsFilter === type ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'}`}
                >
                  {type}
                </button>
              ))}
            </div>

            <div className="max-h-[500px] overflow-y-auto divide-y border rounded-2xl">
              {localSettings.defaultItems
                .filter(item => itemsFilter === 'all' || item.vehicleTypes?.includes(itemsFilter))
                .map((item, idx) => (
                <div key={`${item.id}-${idx}`} className="p-3 flex items-center justify-between hover:bg-gray-50 transition-colors gap-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1">
                      <button onClick={() => moveItem(idx, 'up')} className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-blue-600"><ChevronUp className="w-3 h-3" /></button>
                      <button onClick={() => moveItem(idx, 'down')} className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-blue-600"><ChevronDown className="w-3 h-3" /></button>
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-[11px] font-bold text-gray-800">{item.label}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <span className="text-[9px] font-black uppercase text-blue-500 mr-2 border-r pr-2 border-gray-200">{item.frequency}</span>
                      {VEHICLE_TYPES.map(type => (
                        <button 
                          key={type}
                          onClick={() => toggleItemVehicleType(item.id, type)}
                          className={`text-[8px] font-black px-1.5 rounded border transition-all ${item.vehicleTypes?.includes(type) ? 'text-blue-600 border-blue-200 bg-blue-50' : 'text-gray-300 border-gray-100 bg-gray-50'}`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => setLocalSettings({...localSettings, defaultItems: localSettings.defaultItems.filter(i => i.id !== item.id)})} className="text-red-400 hover:text-red-600 p-2"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase text-gray-400 flex items-center gap-2">
                <Users className="w-4 h-4" /> Gestão de Usuários e Permissões
              </h3>
              {!isAddingLocalUser && (
                <button onClick={() => setIsAddingLocalUser(true)} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-sm">
                  <UserPlus className="w-4 h-4" /> Novo Usuário
                </button>
              )}
            </div>

            {!isAddingLocalUser && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  placeholder="PESQUISAR USUÁRIO POR NOME OU RE..." 
                  value={searchTermUsers}
                  onChange={e => setSearchTermUsers(e.target.value.toUpperCase())}
                  className="w-full bg-gray-50 border-none rounded-xl pl-9 pr-4 py-2.5 text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>
            )}

            {isAddingLocalUser && (
              <div className="bg-blue-50 border border-blue-100 p-6 rounded-3xl space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-black uppercase text-blue-900 flex items-center gap-2">
                    {editingLocalUser ? <Edit2 className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                    {editingLocalUser ? 'Editar Usuário' : 'Cadastro de Novo Usuário'}
                  </h4>
                  <button onClick={() => { setIsAddingLocalUser(false); setEditingLocalUser(null); }} className="text-blue-400 hover:text-blue-600"><X className="w-5 h-5" /></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Username</label>
                    <input 
                      type="text" 
                      value={localUserForm.username} 
                      onChange={e => setLocalUserForm({...localUserForm, username: e.target.value.toLowerCase()})} 
                      placeholder="Ex: cavalieri" 
                      className="w-full bg-white border rounded-2xl p-3 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase ml-1">
                      {editingLocalUser ? 'Nova Senha (opcional)' : 'Senha'}
                    </label>
                    <div className="relative">
                      <input 
                        type={showUserFormPassword ? "text" : "password"} 
                        value={localUserForm.password} 
                        onChange={e => setLocalUserForm({...localUserForm, password: e.target.value})} 
                        placeholder={editingLocalUser ? "Deixe em branco p/ manter atual" : "••••••••"} 
                        className="w-full bg-white border rounded-2xl p-3 pr-10 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500" 
                      />
                      <button
                        type="button"
                        onClick={() => setShowUserFormPassword(!showUserFormPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                        title={showUserFormPassword ? "Ocultar senha" : "Ver senha digitada"}
                      >
                        {showUserFormPassword ? <EyeOff className="w-4 h-4" /> : <ViewIcon className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Gmail (Login OAuth)</label>
                    <input 
                      type="email" 
                      value={localUserForm.email || ''} 
                      onChange={e => setLocalUserForm({...localUserForm, email: e.target.value.toLowerCase()})} 
                      placeholder="usuario@gmail.com" 
                      className="w-full bg-white border rounded-2xl p-3 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Nome Completo</label>
                    <input 
                      type="text" 
                      value={localUserForm.name} 
                      onChange={e => setLocalUserForm({...localUserForm, name: e.target.value})} 
                      placeholder="Ex: Cavalieri" 
                      className="w-full bg-white border rounded-2xl p-3 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Posto/Grad (RE)</label>
                    <input 
                      type="text" 
                      value={localUserForm.rank} 
                      onChange={e => setLocalUserForm({...localUserForm, rank: e.target.value})} 
                      placeholder="Ex: Cb PM 123456" 
                      className="w-full bg-white border rounded-2xl p-3 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500" 
                    />
                  </div>
                  <div className="space-y-1 md:col-span-1 flex items-center pt-5">
                    <label className="flex items-center gap-2 cursor-pointer p-3 bg-white border rounded-2xl w-full hover:bg-blue-100 transition-colors">
                      <input 
                        type="checkbox" 
                        checked={localUserForm.forcePasswordChange || false} 
                        onChange={e => setLocalUserForm({...localUserForm, forcePasswordChange: e.target.checked})} 
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                      />
                      <span className="text-[10px] font-black uppercase text-gray-700">Trocar senha no próximo login</span>
                    </label>
                  </div>
                  <div className="space-y-6 border-t pt-4 md:col-span-4">
                    <h5 className="text-[10px] font-black text-gray-500 uppercase flex items-center gap-1">Configurações de Permissões</h5>
                    
                    <div className="space-y-4">
                      {/* Grupo 0: Permissões de Administração Mestre */}
                      <div className="space-y-2">
                        <p className="text-[9px] font-black text-red-600 uppercase tracking-widest ml-1">Administração Mestre</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {[
                            { id: 'admin', label: 'Admin Geral' },
                            { id: 'settings', label: 'Acesso Ajustes' },
                          ].map((perm) => {
                            const canEdit = currentUser?.username?.toUpperCase() === 'CAVALIERI';
                            
                            return (
                            <label key={perm.id} className={`flex items-center gap-2 p-2 border rounded-xl transition-colors ${canEdit ? 'cursor-pointer hover:bg-gray-50' : 'cursor-not-allowed opacity-60 bg-gray-50'}`}>
                              <input 
                                type="checkbox" 
                                disabled={!canEdit}
                                checked={localUserForm.permissions?.[perm.id as keyof UserPermissions] || false} 
                                onChange={e => setLocalUserForm({
                                  ...localUserForm, 
                                  permissions: {
                                    ...localUserForm.permissions!, 
                                    [perm.id]: e.target.checked
                                  }
                                })}
                                className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500" 
                              />
                              <span className={`text-[9px] font-black uppercase ${canEdit ? 'text-red-600' : 'text-gray-600'}`}>{perm.label}</span>
                            </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Grupo 1: Módulos de Acesso */}
                      <div className="space-y-2">
                        <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest ml-1">Módulos de Acesso</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {[
                            { id: 'checklist', label: 'Checklist' },
                            { id: 'reports', label: 'Relatórios' },
                          ].map((perm) => {
                            const isCavalieri = currentUser?.username?.toLowerCase() === 'cavalieri';
                            const hasPermission = currentUser?.permissions?.admin || !!currentUser?.permissions?.[perm.id as keyof UserPermissions];
                            const canEdit = isCavalieri || hasPermission;

                            return (
                            <label key={perm.id} className={`flex items-center gap-2 p-2 border rounded-xl transition-colors ${canEdit ? 'cursor-pointer hover:bg-gray-50' : 'cursor-not-allowed opacity-60 bg-gray-50'}`}>
                              <input 
                                type="checkbox" 
                                disabled={!canEdit}
                                checked={localUserForm.permissions?.[perm.id as keyof UserPermissions] || false} 
                                onChange={e => setLocalUserForm({
                                  ...localUserForm, 
                                  permissions: {
                                    ...localUserForm.permissions!, 
                                    [perm.id]: e.target.checked
                                  }
                                })}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                              />
                              <span className={`text-[9px] font-black uppercase ${canEdit ? 'text-gray-600' : 'text-gray-400'}`}>{perm.label}</span>
                            </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Grupo 2: Gestão Administrativa */}
                      <div className="space-y-2">
                        <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest ml-1">Gestão Administrativa</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {[
                            { id: 'manageStations', label: 'Postos' },
                            { id: 'manageVehicles', label: 'Viaturas' },
                            { id: 'manageUsers', label: 'Usuários' },
                            { id: 'manageItems', label: 'Itens' },
                          ].map((perm) => {
                            const isCavalieri = currentUser?.username?.toLowerCase() === 'cavalieri';
                            const hasPermission = currentUser?.permissions?.admin || !!currentUser?.permissions?.[perm.id as keyof UserPermissions];
                            const canEdit = isCavalieri || hasPermission;

                            return (
                            <label key={perm.id} className={`flex items-center gap-2 p-2 border rounded-xl transition-colors ${canEdit ? 'cursor-pointer hover:bg-gray-50' : 'cursor-not-allowed opacity-60 bg-gray-50'}`}>
                              <input 
                                type="checkbox" 
                                disabled={!canEdit}
                                checked={localUserForm.permissions?.[perm.id as keyof UserPermissions] || false} 
                                onChange={e => setLocalUserForm({
                                  ...localUserForm, 
                                  permissions: {
                                    ...localUserForm.permissions!, 
                                    [perm.id]: e.target.checked
                                  }
                                })}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                              />
                              <span className={`text-[9px] font-black uppercase ${canEdit ? 'text-gray-600' : 'text-gray-400'}`}>{perm.label}</span>
                            </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Grupo 3: Sistema e Auditoria */}
                      <div className="space-y-2">
                        <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest ml-1">Sistema e Auditoria</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {[
                            { id: 'manageImages', label: 'Plantas' },
                            { id: 'manageStyle', label: 'Estilo' },
                            { id: 'viewAudit', label: 'Auditoria' },
                            { id: 'manageLogs', label: 'Gestão Lanç.' },
                            { id: 'manageDatabase', label: 'Nuvem' },
                            { id: 'manageReportEditor', label: 'Editor Relat.' },
                          ].map((perm) => {
                            const isCavalieri = currentUser?.username?.toLowerCase() === 'cavalieri';
                            const isRestricted = ['viewAudit', 'manageLogs', 'manageDatabase', 'manageReportEditor'].includes(perm.id);
                            
                            // Regra: Somente Cavalieri pode conceder permissões restritas.
                            // Para as demais, o usuário deve possuir a permissão para concedê-la.
                            const hasPermission = currentUser?.permissions?.admin || !!currentUser?.permissions?.[perm.id as keyof UserPermissions];
                            const canEdit = isCavalieri || (hasPermission && !isRestricted);
                            
                            return (
                            <label key={perm.id} className={`flex items-center gap-2 p-2 border rounded-xl transition-colors ${canEdit ? 'cursor-pointer hover:bg-gray-50' : 'cursor-not-allowed opacity-60 bg-gray-50'}`}>
                              <input 
                                type="checkbox" 
                                disabled={!canEdit}
                                checked={localUserForm.permissions?.[perm.id as keyof UserPermissions] || false} 
                                onChange={e => setLocalUserForm({
                                  ...localUserForm, 
                                  permissions: {
                                    ...localUserForm.permissions!, 
                                    [perm.id]: e.target.checked
                                  }
                                })}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                              />
                              <span className={`text-[9px] font-black uppercase ${isRestricted && canEdit ? 'text-amber-600' : canEdit ? 'text-gray-600' : 'text-gray-400'}`}>{perm.label}</span>
                            </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Grupo 4: Assinaturas Digitais */}
                      <div className="space-y-2">
                        <p className="text-[9px] font-black text-green-500 uppercase tracking-widest ml-1">Assinaturas e Autoridade</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {[
                            { id: 'canSign', label: 'Assinar Doc' },
                            { id: 'signAsChefeMotoristas', label: 'Ch. Motoristas' },
                            { id: 'signAsCmtProntidao', label: 'CMT Prontidão' },
                            { id: 'signAsCmtPosto', label: 'CMT Posto' },
                            { id: 'signAsCmtSgb', label: 'CMT SGB' }
                          ].map((perm) => {
                            const isCavalieri = currentUser?.username?.toLowerCase() === 'cavalieri';
                            const hasPermission = currentUser?.permissions?.admin || !!currentUser?.permissions?.[perm.id as keyof UserPermissions];
                            const canEdit = isCavalieri || hasPermission;

                            return (
                            <label key={perm.id} className={`flex items-center gap-2 p-2 border rounded-xl transition-colors ${canEdit ? 'cursor-pointer hover:bg-gray-50' : 'cursor-not-allowed opacity-60 bg-gray-50'}`}>
                              <input 
                                type="checkbox" 
                                disabled={!canEdit}
                                checked={localUserForm.permissions?.[perm.id as keyof UserPermissions] || false} 
                                onChange={e => setLocalUserForm({
                                  ...localUserForm, 
                                  permissions: {
                                    ...localUserForm.permissions!, 
                                    [perm.id]: e.target.checked
                                  }
                                })}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                              />
                              <span className={`text-[9px] font-black uppercase ${canEdit ? 'text-gray-600' : 'text-gray-400'}`}>{perm.label}</span>
                            </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Grupo 5: Permissões de Relatórios Específicos */}
                      <div className="space-y-2">
                        <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest ml-1">Relatórios Autorizados</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {[
                            { id: 'reportNovelties', label: 'Alterações' },
                            { id: 'reportSynthetic', label: 'Sintético' },
                            { id: 'reportAnalytical', label: 'Analítico' },
                            { id: 'reportFull', label: 'Completo' },
                            { id: 'reportMonthlyGrouped', label: 'Agrup. Mensal' },
                            { id: 'reportHistory', label: 'Histórico' },
                            { id: 'reportDailyControl', label: 'Controle Diário' },
                            { id: 'reportDailyControlMotos', label: 'Diário Motos' },
                            { id: 'reportWeeklyLeves', label: 'Semanal Leves' },
                            { id: 'reportWeeklyMotos', label: 'Semanal Motos' },
                            { id: 'reportWeeklyAb', label: 'Semanal AB' },
                            { id: 'reportRetroactiveLogs', label: 'Lanç. Retroat.' },
                            { id: 'reportFinalMonthlyBook', label: 'Livro Mensal' },
                            { id: 'reportFleetDashboard', label: 'Dashboard' },
                            { id: 'reportKmMonthly', label: 'KM Mensal' },
                          ].map((perm) => {
                            const isCavalieri = currentUser?.username?.toLowerCase() === 'cavalieri';
                            const hasPermission = currentUser?.permissions?.admin || !!currentUser?.permissions?.[perm.id as keyof UserPermissions];
                            const canEdit = isCavalieri || hasPermission;

                            return (
                            <label key={perm.id} className={`flex items-center gap-2 p-2 border rounded-xl transition-colors ${canEdit ? 'cursor-pointer hover:bg-gray-50' : 'cursor-not-allowed opacity-60 bg-gray-50'}`}>
                              <input 
                                type="checkbox" 
                                disabled={!canEdit}
                                checked={localUserForm.permissions?.[perm.id as keyof UserPermissions] || false} 
                                onChange={e => setLocalUserForm({
                                  ...localUserForm, 
                                  permissions: {
                                    ...localUserForm.permissions!, 
                                    [perm.id]: e.target.checked
                                  }
                                })}
                                className="w-4 h-4 rounded border-gray-300 text-rose-600 focus:ring-rose-500" 
                              />
                              <span className={`text-[9px] font-black uppercase ${canEdit ? 'text-gray-600' : 'text-gray-400'}`}>{perm.label}</span>
                            </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button 
                    onClick={editingLocalUser ? handleUpdateLocalUser : handleAddUser} 
                    className="bg-blue-600 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg hover:bg-blue-700 transition-all border-b-4 border-blue-800 active:border-b-0 active:translate-y-1"
                  >
                    {editingLocalUser ? 'Salvar Alterações' : 'Confirmar Cadastro'}
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3">
              {(localSettings.users || [])
                .filter(u => 
                   !searchTermUsers || 
                   u.username?.toUpperCase().includes(searchTermUsers) || 
                   u.name?.toUpperCase().includes(searchTermUsers) ||
                   u.rank?.toUpperCase().includes(searchTermUsers)
                )
                .map(u => (
                <div key={u.id} className="bg-gray-50 border rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white border rounded-xl flex items-center justify-center font-black text-blue-600 text-xs">
                      {u.username.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase text-gray-900">
                        {u.rank ? `${u.rank} ` : ''}{u.name || u.username}
                      </h4>
                      <p className="text-[10px] font-bold text-gray-400">@ {u.username} • Senha: ••••••••</p>
                      {u.forcePasswordChange && (
                        <div className="mt-1 flex items-center gap-1 text-[8px] font-black uppercase text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 w-fit">
                          <Key className="w-2.5 h-2.5" /> Trocar senha pendente
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 flex-1">
                    {/* Administração */}
                    <div className="flex flex-wrap gap-1 items-center">
                      <span className="text-[7px] font-black text-gray-400 uppercase w-10">Mestre:</span>
                      {[
                        { id: 'admin', label: 'Admin', icon: Shield },
                        { id: 'settings', label: 'Ajustes', icon: SettingsIcon },
                      ].map((perm: any) => {
                        const hasPerm = (u.permissions as any)[perm.id];
                        if (!hasPerm) return null;
                        return (
                          <div key={perm.id} className="flex items-center gap-1 px-1.5 py-0.5 bg-red-50 text-red-600 border border-red-100 rounded text-[7px] font-black uppercase">
                            {perm.label}
                          </div>
                        );
                      })}
                    </div>

                    {/* Acesso */}
                    <div className="flex flex-wrap gap-1 items-center">
                      <span className="text-[7px] font-black text-gray-400 uppercase w-10">Módulos:</span>
                      {[
                        { id: 'checklist', label: 'Checklist', icon: ClipboardCheck },
                        { id: 'reports', label: 'Relatórios', icon: FileSearch },
                      ].map((perm: any) => {
                        const hasPerm = (u.permissions as any)[perm.id];
                        if (!hasPerm) return null;
                        return (
                          <div key={perm.id} className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded text-[7px] font-black uppercase">
                            {perm.label}
                          </div>
                        );
                      })}
                    </div>

                    {/* Gestão */}
                    <div className="flex flex-wrap gap-1 items-center">
                      <span className="text-[7px] font-black text-gray-400 uppercase w-10">Gestão:</span>
                      {[
                        { id: 'manageStations', label: 'Postos', icon: Navigation },
                        { id: 'manageVehicles', label: 'Viaturas', icon: Car },
                        { id: 'manageUsers', label: 'Usuários', icon: Users },
                        { id: 'manageItems', label: 'Itens', icon: ListChecks },
                      ].map((perm: any) => {
                        const hasPerm = (u.permissions as any)[perm.id];
                        if (!hasPerm) return null;
                        return (
                          <div key={perm.id} className="flex items-center gap-1 px-1.5 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded text-[7px] font-black uppercase">
                            {perm.label}
                          </div>
                        );
                      })}
                    </div>

                    {/* Sistema */}
                    <div className="flex flex-wrap gap-1 items-center">
                      <span className="text-[7px] font-black text-gray-400 uppercase w-10">Sistema:</span>
                      {[
                        { id: 'manageImages', label: 'Plantas', icon: ImageIcon },
                        { id: 'manageStyle', label: 'Estilo', icon: Palette },
                        { id: 'viewAudit', label: 'Auditoria', icon: ShieldAlert },
                        { id: 'manageLogs', label: 'Gestão Lanç.', icon: Database },
                        { id: 'manageDatabase', label: 'Nuvem', icon: Cloud },
                        { id: 'manageReportEditor', label: 'Editor Relat.', icon: Edit2 },
                      ].map((perm: any) => {
                        const hasPerm = (u.permissions as any)[perm.id];
                        if (!hasPerm) return null;
                        return (
                          <div key={perm.id} className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 rounded text-[7px] font-black uppercase">
                            {perm.label}
                          </div>
                        );
                      })}
                    </div>

                    {/* Assinaturas */}
                    <div className="flex flex-wrap gap-1 items-center">
                      <span className="text-[7px] font-black text-gray-400 uppercase w-10">Assin.:</span>
                      {[
                        { id: 'canSign', label: 'Assinar Doc', icon: ShieldCheck },
                        { id: 'signAsChefeMotoristas', label: 'Ch. Motoristas', icon: UserCheck },
                        { id: 'signAsCmtProntidao', label: 'CMT Prontidão', icon: UserCheck },
                        { id: 'signAsCmtPosto', label: 'CMT Posto', icon: UserCheck },
                        { id: 'signAsCmtSgb', label: 'CMT SGB', icon: UserCheck }
                      ].map((perm: any) => {
                        const hasPerm = (u.permissions as any)[perm.id];
                        if (!hasPerm) return null;
                        return (
                          <div key={perm.id} className="flex items-center gap-1 px-1.5 py-0.5 bg-green-50 text-green-600 border border-green-100 rounded text-[7px] font-black uppercase">
                            {perm.label}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleStartEditLocalUser(u)}
                      className="p-2 hover:bg-blue-50 rounded-xl text-blue-400 transition-colors"
                      title="Editar Usuário"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleOpenQuickPassword(u)}
                      className="p-2 hover:bg-blue-50 hover:text-blue-600 rounded-xl text-gray-400 transition-colors"
                      title="Alterar Senha Rápido"
                    >
                      <Key className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => deleteLocalUser(u.id, u.username)}
                      disabled={u.username.toLowerCase() === 'cavalieri'}
                      className={`p-2 rounded-xl transition-colors ${u.username.toLowerCase() === 'cavalieri' ? 'text-gray-200' : 'hover:bg-red-50 text-red-400'}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {(localSettings.users || []).length === 0 && (
                <div className="text-center py-10 bg-gray-50 border-2 border-dashed rounded-3xl">
                  <Users className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                  <p className="text-[10px] font-black text-gray-400 uppercase">Nenhum usuário local cadastrado</p>
                </div>
              )}
            </div>
            
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <h4 className="text-[10px] font-black uppercase text-amber-900">Segurança do Painel</h4>
                <p className="text-[9px] text-amber-700 font-medium leading-relaxed">
                  Os usuários cadastrados aqui têm permissões granulares. O usuário <span className="font-black uppercase">cavalieri</span> é o administrador mestre e não pode ser removido para evitar bloqueio do sistema.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'images' && (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {localSettings.vehicleImages.map((img, idx) => (
              <div key={idx} className="border p-4 rounded-2xl space-y-3 bg-gray-50">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black uppercase text-gray-500">Vista {idx + 1}</h4>
                  <div className="flex gap-2">
                    <button onClick={() => {
                      const nr = [...(localSettings.vehicleImageRatios || [])];
                      nr[idx] = nr[idx] === 'landscape' ? 'portrait' : 'landscape';
                      setLocalSettings({...localSettings, vehicleImageRatios: nr as AspectRatio[]});
                    }} className="p-1.5 bg-white border rounded-lg text-gray-400 hover:text-blue-500">
                      {localSettings.vehicleImageRatios?.[idx] === 'landscape' ? <RectangleVertical className="w-4 h-4" /> : <RectangleHorizontal className="w-4 h-4" />}
                    </button>
                    <label className="p-1.5 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700"><Camera className="w-4 h-4" /><input type="file" accept="image/*" className="hidden" onChange={async e => {
                      const file = e.target.files?.[0];
                      if(file) {
                        const r = new FileReader();
                        r.onloadend = async () => {
                          const compressed = await compressImage(r.result as string, 800, 800, 0.5);
                          const ni = [...localSettings.vehicleImages];
                          ni[idx] = compressed;
                          setLocalSettings({...localSettings, vehicleImages: ni});
                        };
                        r.readAsDataURL(file);
                      }
                    }} /></label>
                  </div>
                </div>
                <div className={`relative bg-white border rounded-lg overflow-hidden flex items-center justify-center ${localSettings.vehicleImageRatios?.[idx] === 'landscape' ? 'aspect-video' : 'aspect-[3/4]'}`}>
                  {img ? <img src={img} className="w-full h-full object-contain" /> : <ImageIcon className="w-8 h-8 text-gray-200" />}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'style' && (
          <div className="p-8 space-y-8">
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase text-gray-400">Identidade da Organização</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-500">Título do Cabeçalho</label>
                  <input type="text" value={localSettings.headerTitle} onChange={e => setLocalSettings({...localSettings, headerTitle: e.target.value})} className="w-full border rounded-xl p-3 text-xs font-bold" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-500">Senha de Acesso aos Ajustes</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input 
                      type="password" 
                      value={localSettings.settingsPassword || ''} 
                      onChange={e => setLocalSettings({...localSettings, settingsPassword: e.target.value})} 
                      className="w-full border rounded-xl p-3 pl-10 text-xs font-bold text-gray-800 tracking-widest outline-none focus:border-blue-500 bg-white" 
                      placeholder="••••••••" 
                      autoComplete="new-password"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-500">Título do Relatório Diário</label>
                  <input type="text" value={localSettings.reportTitle} onChange={e => setLocalSettings({...localSettings, reportTitle: e.target.value})} className="w-full border rounded-xl p-3 text-xs font-bold" placeholder="Ficha de Controle do Check List Diário de Viaturas" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-500">Cor Institucional</label>
                  <input type="color" value={localSettings.headerBgColor || '#b91c1c'} onChange={e => setLocalSettings({...localSettings, headerBgColor: e.target.value})} className="w-full h-11 p-1 bg-white border rounded-xl cursor-pointer" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-500">Imagem de Fundo (Tela Inicial)</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={localSettings.homeBgUrl || ''} 
                      onChange={e => setLocalSettings({...localSettings, homeBgUrl: e.target.value})} 
                      className="flex-1 border rounded-xl p-3 text-xs font-bold" 
                      placeholder="URL da Imagem (Ex: https://...)" 
                    />
                    <label className="bg-blue-600 text-white p-3 rounded-xl cursor-pointer hover:bg-blue-700 shadow-sm flex items-center justify-center" title="Enviar Imagem">
                      <Camera className="w-4 h-4" />
                      <input type="file" accept="image/*" className="hidden" onChange={async e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = async () => {
                            const compressed = await compressImage(reader.result as string, 1200, 800, 0.6);
                            setLocalSettings({ ...localSettings, homeBgUrl: compressed });
                          };
                          reader.readAsDataURL(file);
                        }
                      }} />
                    </label>
                    {localSettings.homeBgUrl && (
                      <button onClick={() => setLocalSettings({...localSettings, homeBgUrl: ''})} className="bg-red-50 text-red-600 p-3 rounded-xl hover:bg-red-100 transition-all border border-red-100" title="Remover">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {localSettings.homeBgUrl && (
                    <div className="mt-1 flex items-center gap-2 p-2 bg-gray-50 rounded-xl border border-gray-100">
                      <img src={localSettings.homeBgUrl} alt="Preview Fundo" className="w-8 h-8 object-cover rounded-lg border" />
                      <span className="text-[10px] font-bold text-gray-500 truncate">Imagem de fundo geral configurada</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-500">Imagem de Início no Login</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={localSettings.loginBgUrl || ''} 
                      onChange={e => setLocalSettings({...localSettings, loginBgUrl: e.target.value})} 
                      className="flex-1 border rounded-xl p-3 text-xs font-bold" 
                      placeholder="URL da Imagem do Login (Ex: https://...)" 
                    />
                    <label className="bg-blue-600 text-white p-3 rounded-xl cursor-pointer hover:bg-blue-700 shadow-sm flex items-center justify-center" title="Enviar Imagem de Início do Login">
                      <Camera className="w-4 h-4" />
                      <input type="file" accept="image/*" className="hidden" onChange={async e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = async () => {
                            const compressed = await compressImage(reader.result as string, 1200, 800, 0.6);
                            setLocalSettings({ ...localSettings, loginBgUrl: compressed });
                          };
                          reader.readAsDataURL(file);
                        }
                      }} />
                    </label>
                    {localSettings.loginBgUrl && (
                      <button onClick={() => setLocalSettings({...localSettings, loginBgUrl: ''})} className="bg-red-50 text-red-600 p-3 rounded-xl hover:bg-red-100 transition-all border border-red-100" title="Remover">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {localSettings.loginBgUrl && (
                    <div className="mt-1 flex items-center gap-2 p-2 bg-blue-50/50 rounded-xl border border-blue-100">
                      <img src={localSettings.loginBgUrl} alt="Preview Login" className="w-8 h-8 object-cover rounded-lg border border-blue-200" />
                      <span className="text-[10px] font-bold text-blue-700 truncate">Imagem de início exibida no login</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black uppercase text-gray-500 flex items-center gap-1.5">
                    <Video className="w-3.5 h-3.5 text-blue-600" />
                    Vídeo no Sistema (Tela Inicial / Login / Fundo)
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={localSettings.homeVideoUrl || ''} 
                      onChange={e => setLocalSettings({...localSettings, homeVideoUrl: e.target.value})} 
                      className="flex-1 border rounded-xl p-3 text-xs font-bold" 
                      placeholder="URL do Vídeo (.mp4, .webm ou link do YouTube: https://www.youtube.com/watch?v=...)" 
                    />
                    <label className="bg-indigo-600 text-white p-3 rounded-xl cursor-pointer hover:bg-indigo-700 shadow-sm flex items-center justify-center gap-1.5" title="Enviar Arquivo de Vídeo">
                      <Film className="w-4 h-4" />
                      <input 
                        type="file" 
                        accept="video/mp4,video/webm,video/ogg,video/quicktime" 
                        className="hidden" 
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 25 * 1024 * 1024) {
                              alert("Vídeo superior a 25MB. Para carregamento mais veloz, recomendamos utilizar link direto ou YouTube.");
                            }
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setLocalSettings({ ...localSettings, homeVideoUrl: reader.result as string });
                            };
                            reader.readAsDataURL(file);
                          }
                        }} 
                      />
                    </label>
                    {localSettings.homeVideoUrl && (
                      <button onClick={() => setLocalSettings({...localSettings, homeVideoUrl: ''})} className="bg-red-50 text-red-600 p-3 rounded-xl hover:bg-red-100 transition-all border border-red-100" title="Remover Vídeo">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {localSettings.homeVideoUrl ? (
                    <div className="mt-1 flex items-center justify-between p-2.5 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs">
                      <div className="flex items-center gap-2 text-indigo-700 font-bold text-[10px]">
                        <Video className="w-3.5 h-3.5" />
                        <span>Vídeo ativo no fundo do sistema, tela inicial e login</span>
                      </div>
                      <span className="text-[9px] uppercase font-mono px-2 py-0.5 bg-indigo-200/50 text-indigo-800 rounded-md">
                        {localSettings.homeVideoUrl.includes('youtube') || localSettings.homeVideoUrl.includes('youtu.be') ? 'YouTube Embed' : 'Vídeo Direto / Upload'}
                      </span>
                    </div>
                  ) : (
                    <p className="text-[9px] text-gray-400 font-medium">
                      Permite vincular um vídeo em loop (MP4, WebM ou YouTube) que rodará em alta definição no fundo da tela inicial, login e checklist.
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-500">Brasão 1</label>
                <div className="border-2 border-dashed p-4 rounded-2xl flex flex-col items-center gap-3 bg-gray-50">
                  {localSettings.headerLogoUrl1 && <img src={localSettings.headerLogoUrl1} className="h-20 object-contain" />}
                  <label className="bg-white border px-4 py-2 rounded-xl text-[10px] font-black uppercase cursor-pointer hover:bg-gray-100 shadow-sm">Alterar Logo 1 <input type="file" className="hidden" onChange={e => handleLogoUpload('headerLogoUrl1', e)} /></label>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-500">Brasão 2</label>
                <div className="border-2 border-dashed p-4 rounded-2xl flex flex-col items-center gap-3 bg-gray-50">
                  {localSettings.headerLogoUrl2 && <img src={localSettings.headerLogoUrl2} className="h-20 object-contain" />}
                  <label className="bg-white border px-4 py-2 rounded-xl text-[10px] font-black uppercase cursor-pointer hover:bg-gray-100 shadow-sm">Alterar Logo 2 <input type="file" className="hidden" onChange={e => handleLogoUpload('headerLogoUrl2', e)} /></label>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="p-6 h-full flex flex-col">
            {!isAdminAuthenticated ? (
              <form onSubmit={handleLogin} className="max-w-xs mx-auto text-center space-y-4 pt-10">
                <div className="bg-blue-600 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto shadow-xl mb-4">
                  <Lock className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-black text-gray-900 uppercase">Audit Portal</h3>
                <div className="space-y-2">
                  <div className="relative">
                    <UserCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" placeholder="USUÁRIO" value={loginUsername} onChange={e => setLoginUsername(e.target.value)} className="w-full border rounded-xl p-4 pl-12 text-xs font-black outline-none focus:border-blue-500 transition-all bg-gray-50" />
                  </div>
                  <div className="relative">
                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="password" placeholder="SENHA" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} className="w-full border rounded-xl p-4 pl-12 text-xs font-black outline-none focus:border-blue-500 transition-all bg-gray-50" />
                  </div>
                </div>
                <button 
                  type="submit" 
                  disabled={isLoggingIn}
                  className="w-full bg-blue-600 text-white p-4 rounded-xl font-black text-xs shadow-lg hover:bg-blue-700 uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                >
                  {isLoggingIn ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Entrar na Auditoria"}
                </button>
                <p className="text-[9px] font-black text-gray-400 uppercase">Sincronização Ativa com o Banco de Dados</p>
              </form>
            ) : (
              <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between border-b pb-2">
                   <div className="flex items-center gap-2 overflow-x-auto">
                     <button onClick={() => setAdminSubTab('dashboard')} className={`text-[10px] font-black uppercase px-4 py-2 rounded-lg transition-all ${adminSubTab === 'dashboard' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:bg-gray-100'}`}>Dashboard Gerencial</button>
                     <button onClick={() => setAdminSubTab('audit')} className={`text-[10px] font-black uppercase px-4 py-2 rounded-lg transition-all ${adminSubTab === 'audit' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-400 hover:bg-gray-100'}`}>Ações do Sistema</button>
                     {(currentAuditUser === 'CAVALIERI' || usersList.find(u => u.username?.toUpperCase() === currentAuditUser?.toUpperCase())?.permissions?.manageUsers) && (
                       <button onClick={() => setAdminSubTab('users')} className={`text-[10px] font-black uppercase px-4 py-2 rounded-lg transition-all ${adminSubTab === 'users' ? 'bg-red-600 text-white shadow-sm' : 'text-gray-400 hover:bg-gray-100'}`}>Gestão de Acesso</button>
                     )}
                   </div>
                   <div className="flex items-center gap-3">
                     <span className="text-[9px] font-black text-gray-400 uppercase hidden sm:block">Logado como: <span className="text-blue-600">{currentAuditUser}</span></span>
                     <button 
                       onClick={() => {
                         setIsAdminAuthenticated(false);
                         setCurrentAuditUser(null);
                       }}
                       className="text-[9px] font-black uppercase text-red-600 flex items-center gap-1 hover:underline"
                     >
                       <LogOut className="w-3 h-3" /> Sair
                     </button>
                     <button 
                       onClick={async () => {
                         const targetUrl = localSettings.googleSheetUrl || FIXED_GOOGLE_SHEET_URL;
                         try {
                           const res = await fetch(`${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=test&_t=${Date.now()}`, {
                             method: 'GET',
                             mode: 'cors',
                             cache: 'no-store'
                           });
                           
                           if (res.ok) {
                             const data = await res.json();
                             if (data.result === 'success') {
                               alert(`CONEXÃO OK!\nServidor respondeu com sucesso.\nHorário do Servidor: ${data.timestamp}`);
                             } else {
                               alert(`ERRO NO SCRIPT: ${data.message}`);
                             }
                           } else {
                             alert(`ERRO HTTP: ${res.status}\nO script pode não estar publicado corretamente.`);
                           }
                         } catch (e) {
                           console.error("Test Connection Error:", e);
                           alert("ERRO DE CONEXÃO: O script parece estar exigindo LOGIN ou está inacessível.\n\nCertifique-se de que em 'Quem tem acesso' esteja selecionado 'Qualquer pessoa' (Anyone).");
                         }
                       }} 
                       className="text-[9px] font-black uppercase text-green-600 flex items-center gap-1 hover:underline"
                     >
                       <Activity className="w-3 h-3" /> Testar Conexão
                     </button>
                     <button onClick={() => { if (onPerformFullSync) { onPerformFullSync(); } else { fetchLogs(); fetchUsers(); } }} className="text-[9px] font-black uppercase text-blue-600 flex items-center gap-1 hover:underline cursor-pointer">
                       <RefreshCw className={`w-3 h-3 ${(isLoadingLogs || isSavingUser || isSyncing)?'animate-spin':''}`} /> Sincronizar Tudo
                     </button>
                   </div>
                </div>

                {adminSubTab === 'dashboard' && (
                  <div className="flex-1 overflow-y-auto pt-4 space-y-6">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-blue-50 p-4 rounded-3xl border border-blue-100 flex flex-col justify-between">
                        <BarChart3 className="w-5 h-5 text-blue-600 mb-2" />
                        <div>
                          <div className="text-2xl font-black text-blue-900">{stats.total}</div>
                          <p className="text-[9px] font-bold text-blue-500 uppercase">Inspeções Totais</p>
                        </div>
                      </div>
                      <div className="bg-red-50 p-4 rounded-3xl border border-red-100 flex flex-col justify-between">
                        <AlertTriangle className="w-5 h-5 text-red-600 mb-2" />
                        <div>
                          <div className="text-2xl font-black text-red-900">{stats.withIssues}</div>
                          <p className="text-[9px] font-bold text-red-500 uppercase">Viaturas com Avarias</p>
                        </div>
                      </div>
                      <div className="bg-green-50 p-4 rounded-3xl border border-green-100 flex flex-col justify-between">
                        <ShieldCheck className="w-5 h-5 text-green-600 mb-2" />
                        <div>
                          <div className="text-2xl font-black text-green-900">{stats.conformityRate.toFixed(1)}%</div>
                          <p className="text-[9px] font-bold text-green-500 uppercase">Conformidade</p>
                        </div>
                      </div>
                      <div className="bg-orange-50 p-4 rounded-3xl border border-orange-100 flex flex-col justify-between">
                        <Zap className="w-5 h-5 text-orange-600 mb-2" />
                        <div>
                          <div className="text-2xl font-black text-orange-900">{stats.diario}</div>
                          <p className="text-[9px] font-bold text-orange-500 uppercase">Ciclos Atuais</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6">
                       <div className="bg-gray-50 border rounded-3xl p-6">
                          <div className="flex items-center gap-2 mb-4">
                             <Users className="w-4 h-4 text-blue-600" />
                             <h4 className="text-xs font-black uppercase text-gray-800">Conferentes Ativos</h4>
                          </div>
                          <div className="space-y-3">
                             {stats.topInspectors.map((item, i) => (
                               <div key={i} className="flex flex-col gap-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-gray-700 uppercase truncate max-w-[140px]">{item.name}</span>
                                    <span className="text-[10px] font-black text-blue-600">{item.count}</span>
                                  </div>
                                  <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-600" style={{ width: `${(item.count / stats.total) * 100}%` }}></div>
                                  </div>
                               </div>
                             ))}
                          </div>
                       </div>

                       <div className="bg-gray-50 border rounded-3xl p-6">
                          <div className="flex items-center gap-2 mb-4">
                             <Car className="w-4 h-4 text-orange-600" />
                             <h4 className="text-xs font-black uppercase text-gray-800">Ranking Frota (Uso)</h4>
                          </div>
                          <div className="space-y-3">
                             {stats.topVehicles.map((item, i) => (
                               <div key={i} className="flex flex-col gap-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-gray-700 uppercase">{item.name}</span>
                                    <span className="text-[10px] font-black text-orange-600">{item.count}</span>
                                  </div>
                                  <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-orange-600" style={{ width: `${(item.count / stats.total) * 100}%` }}></div>
                                  </div>
                               </div>
                             ))}
                          </div>
                       </div>
                    </div>
                  </div>
                )}

                {adminSubTab === 'audit' && (
                  <div className="flex-1 overflow-hidden flex flex-col pt-4">
                    <div className="flex items-center justify-between mb-4 px-2">
                       <h4 className="text-xs font-black uppercase text-gray-500">Log de Auditoria de Ações</h4>
                       <button onClick={fetchAuditLogs} className="text-blue-600 hover:underline text-[10px] font-black uppercase">Atualizar Logs</button>
                    </div>
                    <div className="flex-1 overflow-y-auto border rounded-2xl bg-gray-50 divide-y">
                      {isLoadingAudit && <div className="p-10 text-center"><RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600" /></div>}
                      {!isLoadingAudit && auditLogs.length === 0 && <div className="p-10 text-center text-[10px] font-black text-gray-400 uppercase">Nenhum log de auditoria encontrado.</div>}
                      {auditLogs.map((log, idx) => (
                        <div key={log.id || idx} className="p-3 hover:bg-white transition-colors cursor-default">
                           <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-3">
                                 <div className={`p-2 rounded-lg ${
                                   log.action === 'LOGIN' ? 'bg-green-100 text-green-700' :
                                   log.action === 'LOGOUT' ? 'bg-gray-100 text-gray-700' :
                                   log.action === 'ALTERACAO_CONFIGURACOES' ? 'bg-purple-100 text-purple-700' :
                                   'bg-blue-100 text-blue-700'
                                 }`}>
                                    <Activity className="w-3.5 h-3.5" />
                                 </div>
                                 <div>
                                    <p className="text-[11px] font-black uppercase text-gray-900">{log.action}</p>
                                    <p className="text-[9px] font-bold text-gray-500">{log.user} | {log.date}</p>
                                 </div>
                              </div>
                              <p className="text-[10px] font-medium text-gray-600 flex-1 text-right max-w-md italic">{log.details}</p>
                           </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(adminSubTab === 'users' && (currentAuditUser === 'CAVALIERI' || usersList.find(u => u.username?.toUpperCase() === currentAuditUser?.toUpperCase())?.permissions?.manageUsers)) && (
                  <div className="flex-1 flex flex-col gap-6 pt-4 overflow-hidden">
                    <div className="bg-red-50 p-6 rounded-3xl border border-red-100 flex items-start gap-4">
                       <div className="bg-red-600 p-3 rounded-2xl text-white shadow-lg">
                          <ShieldAlert className="w-6 h-6" />
                       </div>
                       <div>
                          <h4 className="text-xs font-black uppercase text-red-900 mb-1">Painel de Controle de Acesso</h4>
                          <p className="text-[10px] text-red-700 font-medium leading-relaxed">Área restrita ao Superusuário. Aqui você pode cadastrar outros auditores que terão acesso limitado à aba Auditoria. O usuário CAVALIERI é o único mestre e não pode ser editado ou excluído.</p>
                       </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
                       <div className="bg-white border rounded-3xl p-6 space-y-4">
                          <div className="flex items-center gap-2 mb-2">
                             <UserPlus className="w-4 h-4 text-blue-600" />
                             <h4 className="text-xs font-black uppercase text-gray-800">{editingUserId ? 'Editar Usuário' : 'Novo Usuário / Auditor'}</h4>
                          </div>
                          <div className="space-y-3">
                             <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                   <label className="text-[9px] font-black text-gray-400 uppercase">Nome Completo</label>
                                   <input type="text" placeholder="Ex: Cb PM Cavalieri" value={newUser.name || ''} onChange={e => setNewUser({...newUser, name: e.target.value})} className="w-full border rounded-xl p-3 text-xs font-bold outline-none focus:border-blue-500 bg-white" />
                                </div>
                                <div className="space-y-1">
                                   <label className="text-[9px] font-black text-gray-400 uppercase">P/Grad (RE)</label>
                                   <input type="text" placeholder="Ex: Cb PM 123456" value={newUser.rank || ''} onChange={e => setNewUser({...newUser, rank: e.target.value})} className="w-full border rounded-xl p-3 text-xs font-bold outline-none focus:border-blue-500 bg-white" />
                                </div>
                             </div>
                             <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                   <label className="text-[9px] font-black text-gray-400 uppercase">Username</label>
                                   <input type="text" placeholder="Ex: Auditor01" disabled={!!editingUserId} value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} className={`w-full border rounded-xl p-3 text-xs font-bold outline-none focus:border-blue-500 ${editingUserId ? 'bg-gray-100 text-gray-500' : 'bg-white'}`} />
                                </div>
                                <div className="space-y-1">
                                   <label className="text-[9px] font-black text-gray-400 uppercase">{editingUserId ? 'Nova Senha (opcional)' : 'Senha de Acesso'}</label>
                                   <input 
                                      type="password" 
                                      placeholder={editingUserId ? "Deixe em branco p/ manter atual" : "••••••••"} 
                                      value={newUser.password} 
                                      onChange={e => setNewUser({...newUser, password: e.target.value})} 
                                      className="w-full border rounded-xl p-3 text-xs font-bold outline-none focus:border-blue-500 bg-white" 
                                   />
                                </div>
                             </div>
                             <div className="space-y-1">
                                <label className="text-[9px] font-black text-gray-400 uppercase">Gmail (Para Login OAuth)</label>
                                <input type="email" placeholder="Ex: usuario@gmail.com" value={newUser.email || ''} onChange={e => setNewUser({...newUser, email: e.target.value.toLowerCase()})} className="w-full border rounded-xl p-3 text-xs font-bold outline-none focus:border-blue-500 bg-white" />
                             </div>

                             <div className="space-y-2 pt-2 border-t mt-2">
                                <label className="text-[9px] font-black text-gray-400 uppercase">Permissões de Acesso (Telas)</label>
                                <div className="grid grid-cols-2 gap-2">
                                   <label className="flex items-center gap-2 p-3 border rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                                      <input type="checkbox" checked={newUser.permissions?.checklist} onChange={e => setNewUser({...newUser, permissions: {...newUser.permissions!, checklist: e.target.checked}})} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                      <span className="text-[10px] font-black uppercase text-gray-600">Checklist</span>
                                   </label>
                                   <label className="flex items-center gap-2 p-3 border rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                                      <input type="checkbox" checked={newUser.permissions?.reports} onChange={e => setNewUser({...newUser, permissions: {...newUser.permissions!, reports: e.target.checked}})} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                      <span className="text-[10px] font-black uppercase text-gray-600">Relatórios</span>
                                   </label>
                                   <label className="flex items-center gap-2 p-3 border rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                                      <input type="checkbox" checked={newUser.permissions?.settings} onChange={e => setNewUser({...newUser, permissions: {...newUser.permissions!, settings: e.target.checked}})} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                      <span className="text-[10px] font-black uppercase text-gray-600">Ajustes</span>
                                   </label>
                                   <label className="flex items-center gap-2 p-3 border rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                                      <input type="checkbox" checked={newUser.permissions?.manageStations || false} onChange={e => setNewUser({...newUser, permissions: {...newUser.permissions!, manageStations: e.target.checked}})} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                      <span className="text-[10px] font-black uppercase text-gray-600">Postos</span>
                                   </label>
                                   <label className="flex items-center gap-2 p-3 border rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                                      <input type="checkbox" checked={newUser.permissions?.manageVehicles || false} onChange={e => setNewUser({...newUser, permissions: {...newUser.permissions!, manageVehicles: e.target.checked}})} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                      <span className="text-[10px] font-black uppercase text-gray-600">Viaturas</span>
                                   </label>
                                   <label className="flex items-center gap-2 p-3 border rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                                      <input type="checkbox" checked={newUser.permissions?.manageUsers || false} onChange={e => setNewUser({...newUser, permissions: {...newUser.permissions!, manageUsers: e.target.checked}})} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                      <span className="text-[10px] font-black uppercase text-gray-600">Gestão Usuários</span>
                                   </label>
                                   <label className="flex items-center gap-2 p-3 border rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                                      <input type="checkbox" checked={newUser.permissions?.manageItems || false} onChange={e => setNewUser({...newUser, permissions: {...newUser.permissions!, manageItems: e.target.checked}})} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                      <span className="text-[10px] font-black uppercase text-gray-600">Gestão Itens</span>
                                   </label>
                                   <label className={`flex items-center gap-2 p-3 border rounded-xl transition-colors ${currentAuditUser?.toUpperCase() === 'CAVALIERI' ? 'cursor-pointer hover:bg-gray-50' : 'cursor-not-allowed opacity-60 bg-gray-50'}`}>
                                      <input type="checkbox" disabled={currentAuditUser?.toUpperCase() !== 'CAVALIERI'} checked={newUser.permissions?.manageImages || false} onChange={e => setNewUser({...newUser, permissions: {...newUser.permissions!, manageImages: e.target.checked}})} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                      <span className="text-[10px] font-black uppercase text-gray-600">Plantas</span>
                                   </label>
                                   <label className={`flex items-center gap-2 p-3 border rounded-xl transition-colors ${currentAuditUser?.toUpperCase() === 'CAVALIERI' ? 'cursor-pointer hover:bg-gray-50' : 'cursor-not-allowed opacity-60 bg-gray-50'}`}>
                                      <input type="checkbox" disabled={currentAuditUser?.toUpperCase() !== 'CAVALIERI'} checked={newUser.permissions?.manageStyle || false} onChange={e => setNewUser({...newUser, permissions: {...newUser.permissions!, manageStyle: e.target.checked}})} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                      <span className="text-[10px] font-black uppercase text-gray-600">Estilo</span>
                                   </label>
                                   <label className={`flex items-center gap-2 p-3 border rounded-xl transition-colors ${currentAuditUser?.toUpperCase() === 'CAVALIERI' ? 'cursor-pointer hover:bg-gray-50' : 'cursor-not-allowed opacity-60 bg-gray-50'}`}>
                                      <input type="checkbox" disabled={currentAuditUser?.toUpperCase() !== 'CAVALIERI'} checked={newUser.permissions?.manageLogs || false} onChange={e => setNewUser({...newUser, permissions: {...newUser.permissions!, manageLogs: e.target.checked}})} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                      <span className="text-[10px] font-black uppercase text-gray-600">Gestão Lançamento</span>
                                   </label>
                                   <label className={`flex items-center gap-2 p-3 border rounded-xl transition-colors ${currentAuditUser?.toUpperCase() === 'CAVALIERI' ? 'cursor-pointer hover:bg-gray-50' : 'cursor-not-allowed opacity-60 bg-gray-50'}`}>
                                      <input type="checkbox" disabled={currentAuditUser?.toUpperCase() !== 'CAVALIERI'} checked={newUser.permissions?.manageDatabase || false} onChange={e => setNewUser({...newUser, permissions: {...newUser.permissions!, manageDatabase: e.target.checked}})} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                      <span className="text-[10px] font-black uppercase text-gray-600">Nuvem</span>
                                   </label>
                                   <label className={`flex items-center gap-2 p-3 border-2 border-red-100 bg-red-50 rounded-xl transition-colors ${currentAuditUser?.toUpperCase() === 'CAVALIERI' ? 'cursor-pointer hover:bg-red-100' : 'cursor-not-allowed opacity-60'}`}>
                                      <input type="checkbox" disabled={currentAuditUser?.toUpperCase() !== 'CAVALIERI'} checked={newUser.permissions?.admin} onChange={e => setNewUser({...newUser, permissions: {...newUser.permissions!, admin: e.target.checked}})} className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
                                      <span className="text-[10px] font-black uppercase text-red-600">Auditoria</span>
                                   </label>
                                </div>
                             </div>

                             <div className="flex gap-2">
                                 <div className="space-y-4 border-t pt-4">
                                    <h5 className="text-[9px] font-black text-amber-600 uppercase flex items-center gap-1">🔒 Assinaturas Digitais e Funções Autorizadas</h5>
                                    <div className="grid grid-cols-1 gap-2">
                                       <label className="flex items-center gap-2 p-3 border border-amber-200 bg-amber-50 rounded-xl cursor-pointer hover:bg-amber-100 transition-colors">
                                          <input type="checkbox" checked={newUser.permissions?.canSign || false} onChange={e => setNewUser({...newUser, permissions: {...newUser.permissions!, canSign: e.target.checked}})} className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
                                          <span className="text-[10px] font-black uppercase text-amber-900">Permitir Assinar Documentos</span>
                                       </label>
                                       <div className="grid grid-cols-2 gap-2 pl-2 border-l-2 border-amber-200">
                                          <label className="flex items-center gap-2 p-2 border rounded-xl cursor-pointer hover:bg-gray-50 transition-colors bg-white">
                                             <input type="checkbox" checked={newUser.permissions?.signAsChefeMotoristas || false} onChange={e => setNewUser({...newUser, permissions: {...newUser.permissions!, signAsChefeMotoristas: e.target.checked}})} className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                                             <span className="text-[9px] font-black uppercase text-purple-600">Chefe Motoristas</span>
                                          </label>
                                          <label className="flex items-center gap-2 p-2 border rounded-xl cursor-pointer hover:bg-gray-50 transition-colors bg-white">
                                             <input type="checkbox" checked={newUser.permissions?.signAsCmtProntidao || false} onChange={e => setNewUser({...newUser, permissions: {...newUser.permissions!, signAsCmtProntidao: e.target.checked}})} className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                                             <span className="text-[9px] font-black uppercase text-purple-600">CMT Prontidão</span>
                                          </label>
                                          <label className="flex items-center gap-2 p-2 border rounded-xl cursor-pointer hover:bg-gray-50 transition-colors bg-white">
                                             <input type="checkbox" checked={newUser.permissions?.signAsCmtPosto || false} onChange={e => setNewUser({...newUser, permissions: {...newUser.permissions!, signAsCmtPosto: e.target.checked}})} className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                                             <span className="text-[9px] font-black uppercase text-purple-600">CMT Posto</span>
                                          </label>
                                          <label className="flex items-center gap-2 p-2 border rounded-xl cursor-pointer hover:bg-gray-50 transition-colors bg-white">
                                             <input type="checkbox" checked={newUser.permissions?.signAsCmtSgb || false} onChange={e => setNewUser({...newUser, permissions: {...newUser.permissions!, signAsCmtSgb: e.target.checked}})} className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                                             <span className="text-[9px] font-black uppercase text-purple-600">CMT SGB</span>
                                          </label>
                                       </div>
                                    </div>
                                 </div>

                                <button onClick={handleSaveUser} disabled={isSavingUser} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 transition-all">
                                   {isSavingUser ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                   {editingUserId ? 'Atualizar Dados' : 'Salvar Credenciais'}
                                </button>
                                {editingUserId && (
                                   <button onClick={handleCancelUserEdit} className="bg-gray-100 hover:bg-gray-200 text-gray-600 p-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all">
                                      Cancelar
                                   </button>
                                )}
                             </div>
                                 <div className="flex flex-col gap-3 mb-2">
                                   <div className="flex items-center justify-between">
                                      <h4 className="text-xs font-black uppercase text-gray-800">Auditores Cadastrados</h4>
                                      <span className="text-[9px] font-bold text-gray-400 uppercase">{usersList.length} usuários</span>
                                   </div>
                                   <div className="relative">
                                      <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                      <input 
                                         type="text" 
                                         placeholder="PESQUISAR USUÁRIO OU RE..." 
                                         value={searchTermUsers}
                                         onChange={e => setSearchTermUsers(e.target.value.toUpperCase())}
                                         className="w-full bg-gray-50 border-none rounded-xl pl-9 pr-4 py-2.5 text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                                      />
                                   </div>
                                 </div>
                          </div>
                          <div className="flex-1 overflow-auto space-y-2">
                             {usersList.length === 0 && <div className="text-center py-10 text-[10px] text-gray-300 font-black uppercase">Nenhum auditor adicional.</div>}
                             {usersList
                               .filter(u => 
                                  !searchTermUsers || 
                                  u.username?.toUpperCase().includes(searchTermUsers) || 
                                  u.name?.toUpperCase().includes(searchTermUsers) ||
                                  u.rank?.toUpperCase().includes(searchTermUsers)
                               )
                               .map((u, i) => (
                               u && u.username ? (
                               <div key={i} className="bg-white border p-3 rounded-2xl flex items-center justify-between shadow-sm group">
                                  <div className="flex items-center gap-3">
                                     <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-black text-xs">
                                        {u.username.substring(0,1).toUpperCase()}
                                     </div>
                                     <div>
                                        <p className="text-[11px] font-black text-gray-800 uppercase">{u.name || u.username}</p>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            <span className="text-[7px] font-black px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded uppercase">{u.rank || 'S/ GRAD'}</span>
                                            {u.permissions?.checklist && <span className="text-[7px] font-black px-1.5 py-0.5 bg-green-100 text-green-600 rounded uppercase">Checklist</span>}
                                            {u.permissions?.reports && <span className="text-[7px] font-black px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded uppercase">Relatórios</span>}
                                            {u.permissions?.manageStations && <span className="text-[7px] font-black px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded uppercase">Postos</span>}
                                            {u.permissions?.manageVehicles && <span className="text-[7px] font-black px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded uppercase">Viaturas</span>}
                                            {u.permissions?.manageUsers && <span className="text-[7px] font-black px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded uppercase">Usuários</span>}
                                            {u.permissions?.manageItems && <span className="text-[7px] font-black px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded uppercase">Itens</span>}
                                            {u.permissions?.manageImages && <span className="text-[7px] font-black px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded uppercase">Plantas</span>}
                                            {u.permissions?.manageStyle && <span className="text-[7px] font-black px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded uppercase">Estilo</span>}
                                            {u.permissions?.manageDatabase && <span className="text-[7px] font-black px-1.5 py-0.5 bg-blue-500 text-white rounded uppercase">Nuvem</span>}
                                            {u.permissions?.manageLogs && <span className="text-[7px] font-black px-1.5 py-0.5 bg-gray-600 text-white rounded uppercase">Lanç.</span>}
                                            {(u.permissions?.admin || u.permissions?.viewAudit) && <span className="text-[7px] font-black px-1.5 py-0.5 bg-red-100 text-red-600 rounded uppercase">Auditoria</span>}
                                            {u.permissions?.canSign && <span className="text-[7px] font-black px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded uppercase">Assinar Doc</span>}
                                            {u.permissions?.signAsChefeMotoristas && <span className="text-[7px] font-black px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded uppercase">Ch. Mot.</span>}
                                            {u.permissions?.signAsCmtProntidao && <span className="text-[7px] font-black px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded uppercase">Cmt Pront.</span>}
                                            {u.permissions?.signAsCmtPosto && <span className="text-[7px] font-black px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded uppercase">Cmt Posto</span>}
                                            {u.permissions?.signAsCmtSgb && <span className="text-[7px] font-black px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded uppercase">Cmt Sgb</span>}
                                         </div>
                                     </div>
                                  </div>
                                  <div className="flex gap-1">
                                     <button onClick={() => handleEditUser(u)} className="p-2 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                                        <Edit2 className="w-4 h-4" />
                                     </button>
                                     <button onClick={() => handleDeleteUser(u.username)} className="p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                                        <Trash2 className="w-4 h-4" />
                                     </button>
                                  </div>
                               </div>
                               ) : null
                             ))}
                          </div>
                       </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'cloud' && (
          <div className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-3">
                <Cloud className="w-6 h-6 text-blue-600" />
                <h3 className="text-2xl font-black text-gray-900 uppercase">Sincronização em Nuvem</h3>
              </div>
              <div className="flex items-center gap-2">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[9px] font-black uppercase transition-all ${
                  connectionStatus === 'online' ? 'bg-green-50 border-green-200 text-green-600' :
                  connectionStatus === 'offline' ? 'bg-red-50 border-red-200 text-red-600' :
                  connectionStatus === 'checking' ? 'bg-blue-50 border-blue-200 text-blue-600' :
                  'bg-gray-50 border-gray-200 text-gray-400'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    connectionStatus === 'online' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' :
                    connectionStatus === 'offline' ? 'bg-red-500' :
                    connectionStatus === 'checking' ? 'bg-blue-500 animate-pulse' :
                    'bg-gray-400'
                  }`} />
                  {connectionStatus === 'online' ? 'Servidor Online' :
                   connectionStatus === 'offline' ? 'Servidor Offline' :
                   connectionStatus === 'checking' ? 'Verificando...' :
                   'Status Desconhecido'}
                </div>
                <button 
                  onClick={onCheckConnection}
                  disabled={connectionStatus === 'checking'}
                  className="p-2 bg-white border-2 border-gray-100 rounded-xl hover:border-blue-500 hover:text-blue-600 transition-all active:scale-90 disabled:opacity-50"
                  title="Verificar Conexão"
                >
                  <RefreshCw className={`w-4 h-4 ${connectionStatus === 'checking' ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                {(currentUser?.username.toLowerCase() === 'cavalieri' || !currentUser) && (
                  <div className="p-8 bg-purple-50 rounded-3xl border border-purple-100 space-y-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Database className="w-5 h-5 text-purple-600" />
                      <h4 className="text-xs font-black uppercase text-purple-900">Backup e Manutenção do Banco</h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button 
                        onClick={() => {
                          const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(localSettings, null, 2));
                          const downloadAnchorNode = document.createElement('a');
                          downloadAnchorNode.setAttribute("href", dataStr);
                          downloadAnchorNode.setAttribute("download", `checkviatura_backup_${new Date().toISOString().split('T')[0]}.json`);
                          document.body.appendChild(downloadAnchorNode);
                          downloadAnchorNode.click();
                          downloadAnchorNode.remove();
                        }}
                        className="flex items-center justify-center gap-2 p-4 bg-white text-purple-700 rounded-2xl hover:bg-purple-100 transition-all active:scale-95 border border-purple-200 shadow-sm"
                      >
                        <Download className="w-5 h-5" />
                        <div className="text-left">
                          <p className="text-[10px] font-black uppercase leading-tight">Exportar</p>
                          <p className="text-[8px] font-bold opacity-70 uppercase leading-tight">Backup Local</p>
                        </div>
                      </button>
                      
                      <label className="flex items-center justify-center gap-2 p-4 bg-white text-amber-700 rounded-2xl hover:bg-amber-100 transition-all active:scale-95 border border-amber-200 shadow-sm cursor-pointer">
                        <Upload className="w-5 h-5" />
                        <div className="text-left">
                          <p className="text-[10px] font-black uppercase leading-tight">Importar</p>
                          <p className="text-[8px] font-bold opacity-70 uppercase leading-tight">Restaurar JSON</p>
                        </div>
                        <input 
                          type="file" 
                          className="hidden" 
                          accept=".json" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              try {
                                const json = JSON.parse(event.target?.result as string);
                                if (json.vehicles || json.users) {
                                  setLocalSettings(json);
                                  alert("BANCO DE DADOS IMPORTADO COM SUCESSO!\nClique em 'APLICAR AJUSTES' para salvar as alterações.");
                                } else {
                                  alert("ERRO: O arquivo não parece ser um backup válido do CheckViatura.");
                                }
                              } catch (err) {
                                alert("ERRO AO LER ARQUIVO: " + err);
                              }
                            };
                            reader.readAsText(file);
                          }}
                        />
                      </label>
                    </div>
                    <p className="text-[9px] font-bold text-purple-400 uppercase text-center leading-relaxed">
                      Cuidado: Ao importar, todos os veículos, postos e usuários atuais serão substituídos pelos do arquivo.
                    </p>
                  </div>
                )}

                <div className="p-8 bg-white rounded-3xl border border-gray-100 shadow-sm space-y-6">
                  <div className="space-y-4">
                    <h4 className="text-xs font-black uppercase text-gray-400 tracking-widest">Banco de Dados Principal (Apps Script)</h4>
                    <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 space-y-4">
                      <p className="text-[10px] font-bold text-blue-800 uppercase leading-relaxed">
                        Este sistema utiliza um script vinculado à sua planilha para salvar logs e sincronizar veículos/postos automaticamente.
                      </p>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-blue-600 uppercase ml-1">URL do Web App (Google Apps Script)</label>
                        <input 
                          type="text"
                          value={localSettings.googleSheetUrl || ''}
                          onChange={e => setLocalSettings({...localSettings, googleSheetUrl: e.target.value})}
                          placeholder="https://script.google.com/macros/s/.../exec"
                          className="w-full bg-white border-2 border-blue-100 rounded-xl p-3 text-[10px] font-mono focus:border-blue-500 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <button 
                      onClick={async () => {
                        const syncData = {
                          action: 'syncEntities',
                          settings: JSON.stringify(localSettings),
                          vehicles: JSON.stringify(localSettings.vehicles || []),
                          stations: JSON.stringify(localSettings.stations || []),
                          users: JSON.stringify(localSettings.users || []),
                          timestamp: new Date().toISOString()
                        };
                        
                        try {
                          const targetUrl = (localSettings.googleSheetUrl || settings.googleSheetUrl || '').trim();
                          if (!targetUrl) {
                            alert("URL do Google Sheets não configurada.");
                            return;
                          }
                          const targetUrlWithAction = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=syncEntities`;
                          await fetch(targetUrlWithAction, {
                            method: 'POST',
                            mode: 'no-cors',
                            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                            body: JSON.stringify(syncData)
                          });
                          alert("Sincronização enviada com sucesso!");
                          onCheckConnection();
                        } catch (err) {
                          alert("Erro ao sincronizar. Verifique a URL do script.");
                        }
                      }}
                      className="w-full flex items-center justify-center gap-3 py-4 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Sincronizar Banco de Dados
                    </button>
                    <p className="text-[9px] text-gray-400 font-bold uppercase text-center">
                      Envia veículos, postos e usuários cadastrados para a planilha principal.
                    </p>
                  </div>
                </div>

                <div className="p-8 bg-white rounded-3xl border border-gray-100 shadow-sm space-y-6">
                  <div className="space-y-2">
                    <h4 className="text-xs font-black uppercase text-gray-400 tracking-widest">Login Google (Backup Extra)</h4>
                    {googleUser ? (
                      <div className="flex items-center gap-4 p-4 bg-green-50 rounded-2xl border border-green-100">
                        <img src={googleUser.photoURL} alt="" className="w-12 h-12 rounded-full border-2 border-white shadow-sm" referrerPolicy="no-referrer" />
                        <div className="flex-1">
                          <p className="text-sm font-black text-gray-900 uppercase">{googleUser.displayName}</p>
                          <p className="text-[10px] font-bold text-green-600 truncate">{googleUser.email}</p>
                        </div>
                        <Cloud className="w-5 h-5 text-green-500" />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                        <CloudOff className="w-10 h-10 text-gray-300 mb-3" />
                        <p className="text-[10px] font-black text-gray-400 uppercase mb-4 text-center">Login via API nativa</p>
                        <GoogleLoginButton 
                          onSuccess={(profile, token) => {
                            // No Settings.tsx, apenas salvamos a sessão e atualizamos o estado pai se necessário
                            // Mas como as props do Settings já tem o googleUser atualizado pelo pai (App.tsx),
                            // precisamos que o pai lide com o sucesso.
                            // Para simplificar, vamos passar a prop onGoogleSignIn se ela for fornecida
                            // Ou melhor, o Settings.tsx pode ter seu próprio estado local para o login se for apenas para Backup.
                            // Mas o ideal é que o App.tsx gerencie o googleUser.
                            
                            // Vamos assumir que se o usuário clicar aqui, ele quer conectar.
                            // Como o Settings não tem acesso direto aos setters do App, 
                            // vamos usar uma prop de callback se necessário.
                            
                            // Na verdade, o App.tsx passa o handleGoogleLoginSuccess para o LoginModal.
                            // Podemos passar o mesmo sucesso para cá.
                            alert("Login realizado! Por favor, recarregue as configurações.");
                            window.location.reload(); // Forma bruta de garantir que o App pegue o novo localStorage
                          }}
                          isLoggingIn={isSavingUser}
                          setIsLoggingIn={() => {}}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="p-8 bg-purple-50 rounded-3xl border border-purple-100 space-y-6">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck className="w-5 h-5 text-purple-600" />
                    <h4 className="text-xs font-black uppercase text-purple-900">Script do Google Sheets</h4>
                  </div>
                  <p className="text-[10px] font-bold text-purple-800 uppercase leading-relaxed">
                    Para que a sincronização funcione, o seu Google Apps Script deve conter a função <code className="bg-white/50 px-1 rounded">doPost(e)</code> processando a ação <code className="bg-white/50 px-1 rounded">syncEntities</code>.
                  </p>
                  
                  <div className="space-y-3">
                    <h5 className="text-[9px] font-black text-purple-400 uppercase tracking-tighter">O que é sincronizado:</h5>
                    <ul className="space-y-2">
                       {[
                         'Lista completa de Viaturas/Células',
                         'Postos e Setores de Atendimento',
                         'Usuários e Conferentes cadastrados',
                         'Configurações visuais e Marcado Dágua'
                       ].map((text, i) => (
                         <li key={i} className="flex items-start gap-2">
                           <CheckCircle className="w-3 h-3 text-purple-500 mt-0.5 flex-shrink-0" />
                           <span className="text-[9px] font-bold text-purple-800 uppercase leading-tight">{text}</span>
                         </li>
                       ))}
                    </ul>
                  </div>

                  {settings.googleSpreadsheetId && (
                    <div className="p-4 bg-white rounded-2xl border border-purple-200">
                      <p className="text-[9px] font-black text-gray-400 uppercase mb-1">ID da Planilha (OAuth):</p>
                      <code className="text-[9px] font-mono font-bold text-purple-600 break-all">{settings.googleSpreadsheetId}</code>
                    </div>
                  )}
                </div>

                <div className="p-8 bg-amber-50 rounded-3xl border border-amber-100 space-y-4">
                  <div className="flex items-center gap-2">
                    <Info className="w-5 h-5 text-amber-600" />
                    <h4 className="text-xs font-black uppercase text-amber-900">Atenção</h4>
                  </div>
                  <p className="text-[10px] font-bold text-amber-800 uppercase leading-relaxed">
                    A sincronização via script Google é o método principal. O sistema enviará os dados sempre que você salvar novas configurações.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'report_editor' && (
          <div className="p-8 space-y-8">
            <div className="flex items-center gap-3 mb-6">
              <Edit2 className="w-6 h-6 text-blue-600" />
              <h3 className="text-2xl font-black text-gray-900 uppercase">Editor de Cabeçalhos e Títulos</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4 p-6 bg-gray-50 rounded-3xl border border-gray-100">
                <h4 className="text-xs font-black uppercase text-blue-600">Relatórios Semanais (Leves/Pesadas)</h4>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Título do Relatório</label>
                  <input 
                    type="text" 
                    value={localSettings.weeklyLevesTitle || ''} 
                    onChange={e => setLocalSettings({...localSettings, weeklyLevesTitle: e.target.value.toUpperCase()})}
                    placeholder="TIPO LEVES E PESADAS"
                    className="w-full bg-white border-2 rounded-2xl p-4 text-xs font-black uppercase outline-none focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-4 p-6 bg-gray-50 rounded-3xl border border-gray-100">
                <h4 className="text-xs font-black uppercase text-yellow-600">Relatórios Semanais (Motos)</h4>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Título do Relatório</label>
                  <input 
                    type="text" 
                    value={localSettings.weeklyMotosTitle || ''} 
                    onChange={e => setLocalSettings({...localSettings, weeklyMotosTitle: e.target.value.toUpperCase()})}
                    placeholder="DE MOTOCICLETAS"
                    className="w-full bg-white border-2 rounded-2xl p-4 text-xs font-black uppercase outline-none focus:border-yellow-500 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-4 p-6 bg-gray-50 rounded-3xl border border-gray-100">
                <h4 className="text-xs font-black uppercase text-red-600">Relatórios Semanais (AB/Aéreas)</h4>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Título do Relatório</label>
                  <input 
                    type="text" 
                    value={localSettings.weeklyAbTitle || ''} 
                    onChange={e => setLocalSettings({...localSettings, weeklyAbTitle: e.target.value.toUpperCase()})}
                    placeholder="TIPO AB E AÉREAS"
                    className="w-full bg-white border-2 rounded-2xl p-4 text-xs font-black uppercase outline-none focus:border-red-500 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-4 p-6 bg-gray-50 rounded-3xl border border-gray-100">
                <h4 className="text-xs font-black uppercase text-orange-600">Relatório Diário de Motos</h4>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Título do Relatório</label>
                  <input 
                    type="text" 
                    value={localSettings.dailyMotosTitle || ''} 
                    onChange={e => setLocalSettings({...localSettings, dailyMotosTitle: e.target.value.toUpperCase()})}
                    placeholder="CHECK LIST DIÁRIO DE MOTOS"
                    className="w-full bg-white border-2 rounded-2xl p-4 text-xs font-black uppercase outline-none focus:border-orange-500 transition-all"
                  />
                </div>
              </div>

              <div className="md:col-span-2 space-y-4 p-6 bg-blue-50 rounded-3xl border border-blue-100">
                <h4 className="text-xs font-black uppercase text-blue-900">Cabeçalho Geral (Dashboard / App)</h4>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Título Principal</label>
                  <input 
                    type="text" 
                    value={localSettings.headerTitle || ''} 
                    onChange={e => setLocalSettings({...localSettings, headerTitle: e.target.value.toUpperCase()})}
                    placeholder="CHECKLIST DE VIATURAS"
                    className="w-full bg-white border-2 rounded-2xl p-4 text-xs font-black uppercase outline-none focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <div className="md:col-span-2 space-y-4 p-6 bg-purple-50 rounded-3xl border border-purple-100">
                <h4 className="text-xs font-black uppercase text-purple-900">Marca d'Água dos Relatórios</h4>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-1">URL da Imagem (Link)</label>
                  <input 
                    type="text" 
                    value={localSettings.watermarkUrl || ''} 
                    onChange={e => setLocalSettings({...localSettings, watermarkUrl: e.target.value})}
                    placeholder="https://exemplo.com/logo-pm.png"
                    className="w-full bg-white border-2 rounded-2xl p-4 text-xs font-black outline-none focus:border-purple-500 transition-all"
                  />
                  <p className="text-[10px] text-gray-400 font-bold uppercase mt-2">Dica: Use um link direto para uma imagem PNG transparente para melhor resultado.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <ErrorBoundary>
            <Reports 
              logs={logs} 
              settings={localSettings} 
              currentUser={currentUser}
              onFetch={fetchLogs}
              isLoading={isLoadingLogs}
              onUpdateVehicles={(updated) => onSave({ ...localSettings, vehicles: updated })}
              initialConfig={reportConfig}
            />
          </ErrorBoundary>
        )}

        {activeTab === 'about' && (
          <div className="p-12 flex flex-col items-center justify-center space-y-6">
            <div className="w-24 h-24 bg-blue-600 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-blue-200">
              <ClipboardCheck className="w-12 h-12 text-white" />
            </div>
            
            <div className="w-full max-w-md space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Nome do Sistema</label>
                <input 
                  type="text" 
                  value={localSettings.appName || 'CHECKLIST VIATURA'} 
                  onChange={e => setLocalSettings({...localSettings, appName: e.target.value})} 
                  placeholder="NOME DO SISTEMA"
                  readOnly={!isMasterUser}
                  className={`w-full border-2 rounded-2xl p-4 text-center text-xl font-black uppercase outline-none transition-all ${!isMasterUser ? 'bg-gray-50 border-gray-100 text-gray-400' : 'focus:border-blue-500'}`}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Descrição do Sistema</label>
                <textarea 
                  value={localSettings.appDescription || 'Plataforma avançada para gestão técnica de frotas de emergência. Inclui monitoramento de prontidão em tempo real, dashboard analítico, gestão de alertas de manutenção preditiva (por KM e data), e sistema de auditoria multinível com persistência em nuvem (Google Sheets).'} 
                  onChange={e => setLocalSettings({...localSettings, appDescription: e.target.value})} 
                  placeholder="DESCRIÇÃO DO SISTEMA"
                  rows={4}
                  readOnly={!isMasterUser}
                  className={`w-full border-2 rounded-2xl p-4 text-[11px] font-medium leading-relaxed outline-none transition-all resize-none ${!isMasterUser ? 'bg-gray-50 border-gray-100 text-gray-300' : 'text-gray-500 focus:border-blue-500'}`}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Desenvolvido por</label>
                <input 
                  type="text" 
                  value={localSettings.developedBy || 'Equipe de Gestão de Frota Intelligence'} 
                  onChange={e => setLocalSettings({...localSettings, developedBy: e.target.value})} 
                  placeholder="DESENVOLVEDOR"
                  readOnly={!isSuperUser}
                  className={`w-full border-2 rounded-2xl p-4 text-center text-[10px] font-black uppercase outline-none transition-all ${!isSuperUser ? 'bg-gray-50 border-gray-100 text-gray-300' : 'text-blue-600 focus:border-blue-500'}`}
                />
              </div>
            </div>

            <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.3em]">Versão 4.0.0 Intelligence</p>
            
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl max-w-sm">
              <p className="text-[10px] text-blue-800 font-bold text-center leading-relaxed">
                As alterações realizadas aqui serão refletidas em todo o sistema após você clicar em "Aplicar Ajustes".
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Alteração Rápida de Senha */}
      {quickPasswordModalUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b">
              <div className="flex items-center gap-2.5 text-blue-700">
                <div className="p-2 bg-blue-50 rounded-xl">
                  <Key className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase text-gray-900">Alteração Rápida de Senha</h3>
                  <p className="text-[10px] font-bold text-gray-500">
                    {quickPasswordModalUser.rank ? `${quickPasswordModalUser.rank} ` : ''}{quickPasswordModalUser.name || quickPasswordModalUser.username} (@{quickPasswordModalUser.username})
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setQuickPasswordModalUser(null)} 
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-colors"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-blue-50/80 border border-blue-100 rounded-2xl p-3 flex items-center gap-2.5 text-blue-800 text-[10px] font-bold">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Por segurança, a senha atual nunca é exibida. Defina a nova credencial abaixo.</span>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Nova Senha</label>
                <div className="relative">
                  <input 
                    type={showQuickNewPassword ? "text" : "password"}
                    value={quickNewPassword}
                    onChange={e => setQuickNewPassword(e.target.value)}
                    placeholder="Digite a nova senha"
                    className="w-full bg-gray-50 border rounded-2xl p-3.5 pr-10 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowQuickNewPassword(!showQuickNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                    title={showQuickNewPassword ? "Ocultar senha" : "Ver senha digitada"}
                  >
                    {showQuickNewPassword ? <EyeOff className="w-4 h-4" /> : <ViewIcon className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Confirmar Nova Senha</label>
                <input 
                  type={showQuickNewPassword ? "text" : "password"}
                  value={quickConfirmPassword}
                  onChange={e => setQuickConfirmPassword(e.target.value)}
                  placeholder="Confirme a nova senha"
                  className="w-full bg-gray-50 border rounded-2xl p-3.5 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer p-3 bg-gray-50 border rounded-2xl hover:bg-blue-50 transition-colors">
                <input 
                  type="checkbox" 
                  checked={quickForceChange} 
                  onChange={e => setQuickForceChange(e.target.checked)} 
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                />
                <span className="text-[10px] font-black uppercase text-gray-700">Exigir troca de senha no próximo login</span>
              </label>
            </div>

            <div className="flex gap-2 pt-2 border-t">
              <button 
                type="button"
                onClick={() => setQuickPasswordModalUser(null)}
                className="flex-1 py-3 px-4 rounded-xl border border-gray-200 text-gray-600 font-black text-[10px] uppercase tracking-wider hover:bg-gray-50 transition-all"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleSaveQuickPassword}
                className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-wider shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2"
              >
                <Save className="w-3.5 h-3.5" />
                Salvar Nova Senha
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
