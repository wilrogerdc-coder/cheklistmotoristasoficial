
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { AppSettings, ChecklistItem, ItemFrequency, AspectRatio, LogEntry, User, UserPermissions } from '../types';
import { FIXED_GOOGLE_SHEET_URL } from '../constants';
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
  BarChart,
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
  ExternalLink
} from 'lucide-react';
import { Header } from './Header';
import { Footer } from './Footer';

import { Reports } from './Reports';
import { VEHICLE_TYPES } from '../constants';

interface AuditUser {
  id?: string;
  name?: string;
  username: string;
  password?: string;
  rank?: string;
  permissions?: {
    checklist: boolean;
    reports: boolean;
    settings: boolean;
    admin: boolean;
    canSign?: boolean;
    signAsChefeMotoristas?: boolean;
    signAsCmtProntidao?: boolean;
    signAsCmtPosto?: boolean;
    signAsCmtSgb?: boolean;
    manageStations?: boolean;
    manageVehicles?: boolean;
    manageUsers?: boolean;
    manageReports?: boolean;
    completeMaintenance?: boolean;
    deleteMaintenance?: boolean;
  };
  createdAt?: string;
  shouldChangePassword?: boolean;
}

interface SettingsProps {
  settings: AppSettings;
  currentUser: User | null;
  onSave: (newSettings: AppSettings) => void;
  onClose: () => void;
  onExportModel: () => void;
  onImportModel: (e: React.ChangeEvent<HTMLInputElement>) => void;
  initialTab?: 'items' | 'images' | 'style' | 'about' | 'admin' | 'manual' | 'reports' | 'vehicles' | 'stations' | 'users' | 'report_editor' | 'cloud' | 'login';
  initialReportPrefix?: string;
  initialReportType?: any;
  setCurrentUser: (user: User | null) => void;
  googleUser: any;
  onGoogleSignIn: () => void;
  onGoogleSync: () => void;
  isSyncing: boolean;
  connectionStatus: 'idle' | 'checking' | 'online' | 'offline';
  onCheckConnection: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ 
  settings, 
  currentUser,
  onSave, 
  onClose, 
  onExportModel,
  onImportModel,
  initialTab = 'items',
  initialReportPrefix,
  initialReportType,
  setCurrentUser,
  googleUser,
  onGoogleSignIn,
  onGoogleSync,
  isSyncing,
  connectionStatus,
  onCheckConnection
}) => {
  const [activeTab, setActiveTab] = useState<'items' | 'images' | 'style' | 'about' | 'admin' | 'manual' | 'reports' | 'vehicles' | 'stations' | 'users' | 'report_editor' | 'cloud' | 'login'>(initialTab);
  const [isSettingsUnlocked, setIsSettingsUnlocked] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [unlockUsername, setUnlockUsername] = useState('');
  const [unlockPassword, setUnlockPassword] = useState('');

  const isTabAccessible = (tabId: string) => {
    if (tabId === 'login') return true;
    if (tabId === 'manual' || tabId === 'about') return true;

    // Se é a aba relatórios ou editor de relatórios, ela só pode ser exibida se os ajustes estiverem desbloqueados por senha
    if (tabId === 'reports' || tabId === 'report_editor') {
      if (!isSettingsUnlocked) return false;
    }

    // Ocultar menus de relatórios para usuários visitantes (sem usuário logado)
    if (tabId === 'reports' || tabId === 'report_editor') {
      if (!currentUser && !isSettingsUnlocked) return false;
    }

    // Se é superOnly, precisa do login Cavalieri (mestre)
    if (['cloud', 'admin', 'style', 'report_editor'].includes(tabId)) {
      return currentUser?.username.toLowerCase() === 'cavalieri';
    }

    // Se as configurações estão desbloqueadas por senha/login de ajustes ou master
    if (isSettingsUnlocked) {
      if (!currentUser) return true; // Desbloqueio master de emergência sem usuário logado no app
      if (currentUser.username.toLowerCase() === 'cavalieri') return true;
      
      const tabPermissionMap: Record<string, string> = {
        stations: 'manageStations',
        vehicles: 'manageVehicles',
        users: 'manageUsers',
        reports: 'manageReports',
        report_editor: 'manageReports',
        items: 'settings',
        images: 'settings',
        style: 'settings',
        admin: 'admin',
      };
      
      const perm = tabPermissionMap[tabId];
      if (perm) {
        const hasSpecific = !!(currentUser.permissions as any)[perm];
        if (hasSpecific) return true;
        
        // Fallback para permissões mestre legadas
        if (['stations', 'vehicles', 'users', 'items', 'images', 'style'].includes(tabId)) {
          return !!(currentUser.permissions as any).settings;
        }
        if (['reports', 'report_editor'].includes(tabId)) {
          return !!(currentUser.permissions as any).reports;
        }
        
        return false;
      }
      return true;
    }

    // Se não está desbloqueado, o usuário ainda pode acessar caso tenha permissão específica direta no login do app
    if (currentUser) {
      if (currentUser.username.toLowerCase() === 'cavalieri') return true;
      const tabPermissionMap: Record<string, string> = {
        stations: 'manageStations',
        vehicles: 'manageVehicles',
        users: 'manageUsers',
        reports: 'manageReports',
        report_editor: 'manageReports',
        items: 'settings',
        images: 'settings',
        style: 'settings',
        admin: 'admin',
      };
      const perm = tabPermissionMap[tabId];
      if (perm) {
        const hasSpecific = !!(currentUser.permissions as any)[perm];
        if (hasSpecific) return true;
        
        if (['stations', 'vehicles', 'users', 'items', 'images', 'style'].includes(tabId)) {
          return !!(currentUser.permissions as any).settings;
        }
        if (['reports', 'report_editor'].includes(tabId)) {
          return !!(currentUser.permissions as any).reports;
        }
        
        return false;
      }
    }

    return false;
  };

  useEffect(() => {
    if (activeTab === 'login' || !isSettingsUnlocked) {
      const rawUrl = localSettings.googleSheetUrl || settings.googleSheetUrl || FIXED_GOOGLE_SHEET_URL;
      const targetUrl = rawUrl?.trim();
      if (targetUrl) {
        fetch(`${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=getUsers&_t=${Date.now()}`)
          .then(r => r.ok ? r.json() : null)
          .then(res => {
            if (Array.isArray(res) && res.length > 0) {
              setLocalSettings(prev => ({ ...prev, users: res }));
            }
          })
          .catch(err => console.warn("Erro ao sincronizar usuários na tela de login/ajustes:", err));
      }
    }
  }, [activeTab, isSettingsUnlocked]);

  useEffect(() => {
    if (currentUser && (currentUser.permissions?.settings || currentUser.username.toLowerCase() === 'cavalieri')) {
      setIsSettingsUnlocked(true);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!isTabAccessible(activeTab)) {
      setActiveTab('manual');
    }
  }, [activeTab, isSettingsUnlocked, currentUser]);

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
    gb: ''
  });
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [newStation, setNewStation] = useState({ name: '', sgbId: '' });
  const [editingStationId, setEditingStationId] = useState<string | null>(null);
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
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<AuditUser[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [logFilter, setLogFilter] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [dashboardSubTab, setDashboardSubTab] = useState<'stats' | 'config'>('stats');

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
    password: '', 
    name: '',
    rank: '',
    shouldChangePassword: false,
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
      manageReports: false,
      completeMaintenance: false,
      deleteMaintenance: false
    } 
  });
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [isAddingLocalUser, setIsAddingLocalUser] = useState(false);
  const [editingLocalUser, setEditingLocalUser] = useState<User | null>(null);
  const [localUserForm, setLocalUserForm] = useState({ 
    username: '', 
    password: '', 
    name: '', 
    rank: '',
    shouldChangePassword: false,
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
      manageReports: false,
      completeMaintenance: false,
      deleteMaintenance: false
    }
  });
  
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
    const rawUrl = localSettings.googleSheetUrl || FIXED_GOOGLE_SHEET_URL;
    const targetUrl = rawUrl?.trim();
    
    if (!targetUrl) {
      console.warn("URL do Google Sheets não configurada.");
      return;
    }
    
    if (isLoadingLogs && retryCount === 0) return;
    setIsLoadingLogs(true);
    
    const cleanPrefix = (prefix && prefix.trim() !== '') ? prefix.trim() : undefined;
    const cleanMonth = (month && month !== 'all' && month.trim() !== '') ? month.trim() : undefined;

    console.log(`[Tentativa ${retryCount + 1}] Buscando logs: ${targetUrl}`);
    
    try {
      let url = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=getLogs`;
      if (cleanPrefix) url += `&prefix=${encodeURIComponent(cleanPrefix)}`;
      if (cleanMonth) url += `&month=${encodeURIComponent(cleanMonth)}`;
      url += `&_t=${Date.now()}`;
      
      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-store'
      });

      if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);

      const result = await response.json();
      if (Array.isArray(result)) {
        setLogs(result.filter(log => log && (log.id || log.ID)));
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
      const response = await fetch(`${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=getUsers&_t=${Date.now()}`);
      if (!response.ok) throw new Error("Falha na conexão com o servidor");
      const updatedUsers = await response.json();
      if (Array.isArray(updatedUsers)) {
        setUsersList(updatedUsers);
        setLocalSettings(prev => ({ ...prev, users: updatedUsers }));
        
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
    if (!newUser.username || !newUser.password) {
      alert("Preencha Username e Senha para o usuário.");
      return;
    }
    
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
        body: JSON.stringify({ action: 'saveUser', ...newUser })
      }).catch(err => {
        console.warn("Erro CORS ao salvar usuário, tentando no-cors...", err);
        return fetch(targetUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8'
          },
          body: JSON.stringify({ action: 'saveUser', ...newUser })
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
      password: user.password,
      name: user.name,
      rank: user.rank,
      shouldChangePassword: user.shouldChangePassword || false,
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
        manageReports: user.permissions?.manageReports ?? false,
        completeMaintenance: user.permissions?.completeMaintenance ?? false,
        deleteMaintenance: user.permissions?.deleteMaintenance ?? false,
      }
    });
    setEditingUserId(user.id || user.username);
  };

  const handleCancelUserEdit = () => {
    setNewUser({ 
      username: '', 
      password: '', 
      name: '',
      rank: '',
      shouldChangePassword: false,
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
        manageReports: false,
        completeMaintenance: false,
        deleteMaintenance: false
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
          s.id === editingStationId ? { ...s, name: newStation.name.toUpperCase(), sgbId: newStation.sgbId } : s
        )
      });
      setEditingStationId(null);
    } else {
      const station = { id: crypto.randomUUID(), name: newStation.name.toUpperCase(), sgbId: newStation.sgbId };
      setLocalSettings({ ...localSettings, stations: [...(localSettings.stations || []), station] });
    }
    setNewStation({ name: '', sgbId: '' });
  };

  const handleStartEditStation = (s: any) => {
    setNewStation({ name: s.name, sgbId: s.sgbId });
    setEditingStationId(s.id);
  };

  const handleCancelEditStation = () => {
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
    setNewVehicle({ prefix: '', plate: '', type: 'LEVE/PESADA', station: '', sgb: '', gb: '' });
  };

  const startEditVehicle = (v: any) => {
    setNewVehicle({ prefix: v.prefix, plate: v.plate, type: v.type, station: v.station, sgb: v.sgb || '', gb: v.gb || '' });
    setEditingVehicleId(v.id);
  };

  const cancelEditVehicle = () => {
    setNewVehicle({ prefix: '', plate: '', type: 'LEVE/PESADA', station: '', sgb: '', gb: '' });
    setEditingVehicleId(null);
  };

  const removeVehicle = (id: string) => {
    setLocalSettings({ ...localSettings, vehicles: (localSettings.vehicles || []).filter(v => v.id !== id) });
  };

  const handleLogoUpload = (key: 'headerLogoUrl1' | 'headerLogoUrl2', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setLocalSettings({ ...localSettings, [key]: reader.result as string });
      reader.readAsDataURL(file);
    }
  };

  // Função disparada ao trocar abas
  const handleTabChange = (tabId: typeof activeTab) => {
    setActiveTab(tabId);
  };

  const handleAddUser = () => {
    if (!localUserForm.username || !localUserForm.password) {
      alert('Preencha usuário e senha');
      return;
    }

    if (localUserForm.username.toLowerCase().trim() === 'cavalieri') {
      alert('Erro: O nome de usuário "cavalieri" é reservado para o sistema.');
      return;
    }

    if ((localSettings.users || []).some(u => u.username.toLowerCase() === localUserForm.username.toLowerCase())) {
      alert('Erro: Este nome de usuário já está em uso.');
      return;
    }
    
    const newUser: User = {
      id: crypto.randomUUID(),
      username: localUserForm.username.toLowerCase().trim(),
      password: localUserForm.password,
      name: localUserForm.name || localUserForm.username,
      rank: localUserForm.rank,
      permissions: { ...localUserForm.permissions },
      shouldChangePassword: (localUserForm as any).shouldChangePassword || false
    };
    
    setLocalSettings({
      ...localSettings,
      users: [...(localSettings.users || []), newUser]
    });
    setLocalUserForm({ 
      username: '', 
      password: '', 
      name: '', 
      rank: '', 
      shouldChangePassword: false,
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
        manageReports: false,
        completeMaintenance: false,
        deleteMaintenance: false
      }
    });
    setIsAddingLocalUser(false);
    alert('Usuário cadastrado com sucesso! Lembre-se de clicar em "Aplicar Ajustes" para salvar permanentemente.');
  };

  const handleUpdateLocalUser = () => {
    if (!editingLocalUser || !localUserForm.username || !localUserForm.password) {
      alert('Preencha usuário e senha');
      return;
    }

    if (localUserForm.username.toLowerCase().trim() === 'cavalieri') {
      alert('Erro: O nome de usuário "cavalieri" é reservado para o sistema.');
      return;
    }

    const updatedUsers = (localSettings.users || []).map(u => {
      if (u.id === editingLocalUser.id) {
        return {
          ...u,
          username: localUserForm.username.toLowerCase().trim(),
          password: localUserForm.password,
          name: localUserForm.name || localUserForm.username,
          rank: localUserForm.rank,
          permissions: { ...localUserForm.permissions },
          shouldChangePassword: (localUserForm as any).shouldChangePassword || false
        };
      }
      return u;
    });

    setLocalSettings({ ...localSettings, users: updatedUsers });
    setEditingLocalUser(null);
    setLocalUserForm({ 
      username: '', 
      password: '', 
      name: '', 
      rank: '',
      shouldChangePassword: false,
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
        manageReports: false,
        completeMaintenance: false,
        deleteMaintenance: false
      }
    });
    alert('Dados do usuário atualizados com sucesso!');
  };

  const handleStartEditLocalUser = (u: User) => {
    setEditingLocalUser(u);
    setLocalUserForm({
      username: u.username,
      password: u.password || '',
      name: u.name,
      rank: u.rank || '',
      shouldChangePassword: u.shouldChangePassword || false,
      permissions: {
        checklist: u.permissions?.checklist ?? true,
        reports: u.permissions?.reports ?? false,
        settings: u.permissions?.settings ?? false,
        admin: u.permissions?.admin ?? false,
        canSign: u.permissions?.canSign ?? false,
        signAsChefeMotoristas: u.permissions?.signAsChefeMotoristas ?? false,
        signAsCmtProntidao: u.permissions?.signAsCmtProntidao ?? false,
        signAsCmtPosto: u.permissions?.signAsCmtPosto ?? false,
        signAsCmtSgb: u.permissions?.signAsCmtSgb ?? false,
        manageStations: u.permissions?.manageStations ?? false,
        manageVehicles: u.permissions?.manageVehicles ?? false,
        manageUsers: u.permissions?.manageUsers ?? false,
        manageReports: u.permissions?.manageReports ?? false,
        completeMaintenance: u.permissions?.completeMaintenance ?? false,
        deleteMaintenance: u.permissions?.deleteMaintenance ?? false,
      }
    });
    setIsAddingLocalUser(true); // Re-use the same form area
  };

  const deleteLocalUser = (id: string, username: string) => {
    if (!isMasterUser) {
      alert("Acesso Negado: Somente o administrador mestre 'cavalieri' pode excluir usuários.");
      return;
    }
    if (username.toLowerCase() === 'cavalieri') {
      alert("ERRO PROTEÇÃO: O usuário 'cavalieri' é o administrador mestre e não pode ser removido.");
      return;
    }
    
    if (window.confirm(`Tem certeza que deseja excluir o usuário "${username}"?`)) {
      const filteredUsers = (localSettings.users || []).filter(u => u.id !== id);
      setLocalSettings({
        ...localSettings,
        users: filteredUsers
      });
    }
  };

  const handleSettingsUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    
    const findUser = (userList: User[]) => {
      return userList.find(u => 
        u.username.toLowerCase() === unlockUsername.toLowerCase() && 
        u.password === unlockPassword &&
        (u.permissions.settings === true || u.username.toLowerCase() === 'cavalieri')
      );
    };

    // Suporte ao usuário mestre legacy/emergência
    if (unlockUsername.toLowerCase() === 'cavalieri' && (unlockPassword === (localSettings.settingsPassword || 'cavalieri') || unlockPassword === 'tricolor')) {
      setIsSettingsUnlocked(true);
      setActiveTab('stations');
      setIsVerifying(false);
      return;
    }

    // Sincronização obrigatória antes da validação
    const rawUrl = localSettings.googleSheetUrl || settings.googleSheetUrl || FIXED_GOOGLE_SHEET_URL;
    const targetUrl = rawUrl?.trim();
    let currentUsers = localSettings.users || [];

    if (targetUrl) {
      try {
        const res = await fetch(`${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=getUsers&_t=${Date.now()}`).then(r => r.ok ? r.json() : null);
        if (Array.isArray(res) && res.length > 0) {
          setLocalSettings(prev => ({ ...prev, users: res }));
          currentUsers = res;
        }
      } catch (err) {
        console.warn("Falha na sincronização obrigatória durante unlock:", err);
      }
    }

    const matchedUser = findUser(currentUsers);

    if (matchedUser) {
      setIsSettingsUnlocked(true);
      setCurrentUser(matchedUser);
      if (matchedUser.permissions?.checklist) {
         setActiveTab('manual');
      } else if (matchedUser.permissions?.reports) {
         setActiveTab('reports');
      } else {
         setActiveTab('manual');
      }
    } else {
      alert('Acesso Negado: Usuário sem permissão de ajustes ou credenciais incorretas.');
    }
    setIsVerifying(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors no-print"><ArrowLeft className="w-5 h-5" /></button>
          <h2 className="text-xl font-bold text-gray-800">Centro de Inteligência de Frota</h2>
        </div>
        <div className="flex items-center gap-2 no-print">
          <button onClick={() => onSave(localSettings)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg">Aplicar Ajustes</button>
        </div>
      </div>

      <nav className="flex gap-2 overflow-x-auto pb-2 no-print">
        {[
          { id: 'reports', label: 'Relatórios', icon: FileText, permission: 'reports' },
          { id: 'report_editor', label: 'Editor Relat.', icon: Edit2, superOnly: true },
          { id: 'manual', label: 'Manual', icon: BookOpen },
          { id: 'stations', label: 'Postos', icon: Navigation, permission: 'settings' },
          { id: 'vehicles', label: 'Viaturas', icon: Car, permission: 'settings' },
          { id: 'users', label: 'Usuários', icon: Users, permission: 'settings' },
          { id: 'items', label: 'Itens', icon: ListChecks, permission: 'settings' },
          { id: 'images', label: 'Plantas', icon: ImageIcon, permission: 'settings' },
          { id: 'style', label: 'Estilo', icon: Palette, superOnly: true },
          { id: 'admin', label: 'Auditoria', icon: Lock, superOnly: true },
          { id: 'cloud', label: 'Nuvem', icon: Cloud, superOnly: true },
          { id: 'about', label: 'SOBRE', icon: Info },
          ...(!isSettingsUnlocked ? [{ id: 'login', label: 'Entrar nos Ajustes', icon: Lock }] : [])
        ].filter(tab => isTabAccessible(tab.id)).map(tab => (
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
                  <button onClick={handleAddStation} className={`${editingStationId ? 'bg-green-600' : 'bg-blue-600'} text-white p-2 rounded-xl transition-all flex-1 flex justify-center items-center shadow-md`}>
                    {editingStationId ? <Save className="w-5 h-5" /> : <Plus className="w-6 h-6" />}
                  </button>
                  {editingStationId && (
                    <button onClick={handleCancelEditStation} className="bg-gray-200 text-gray-600 px-3 rounded-xl hover:bg-gray-300 transition-all text-[10px] font-black uppercase">Sair</button>
                  )}
                </div>
              </div>
              <div className="max-h-[300px] overflow-y-auto divide-y border rounded-2xl">
                {(localSettings.stations || []).length === 0 && <p className="p-10 text-center text-xs text-gray-400 font-bold uppercase">Nenhum posto cadastrado</p>}
                {[...(localSettings.stations || [])]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((s) => {
                  const sgb = localSettings.sgbs?.find(sg => sg.id === s.sgbId);
                  const gb = localSettings.gbs?.find(g => g.id === sgb?.gbId);
                  return (
                    <div key={s.id} className="p-3 flex items-center justify-between hover:bg-gray-50 group">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-black text-gray-800 uppercase">{s.name}</span>
                        <span className="text-[9px] font-bold text-gray-400 uppercase">{gb?.name} / {sgb?.name}</span>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => handleStartEditStation(s)} className="text-blue-400 hover:text-blue-600 p-2 opacity-0 group-hover:opacity-100 transition-all"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleRemoveStation(s.id)} className="text-red-400 hover:text-red-600 p-2 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-4 h-4" /></button>
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
              {(localSettings.vehicles || []).map(v => (
                <div key={v.id} className="p-3 flex items-center justify-between hover:bg-gray-50 group">
                  <div className="grid grid-cols-4 flex-1 gap-4 items-center">
                    <span className="text-[11px] font-black text-gray-800">{v.prefix}</span>
                    <span className="text-[11px] font-mono text-gray-600">{v.plate}</span>
                    <span className="text-[10px] font-bold text-blue-600">{v.type}</span>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-gray-800 uppercase">{v.station || 'Sem Posto'}</span>
                      <span className="text-[8px] font-bold text-gray-400 uppercase">{v.gb} / {v.sgb}</span>
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
                <div key={item.id} className="p-3 flex items-center justify-between hover:bg-gray-50 transition-colors gap-3">
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h3 className="text-sm font-black uppercase text-gray-400 flex items-center gap-2">
                <Users className="w-4 h-4" /> Gestão de Usuários e Permissões
              </h3>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Pesquisar por RE..." 
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value.toUpperCase())}
                    className="pl-9 pr-4 py-2 border rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-blue-500 w-full sm:w-48"
                  />
                </div>
                {!isAddingLocalUser && (
                  <button onClick={() => setIsAddingLocalUser(true)} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-sm whitespace-nowrap">
                    <UserPlus className="w-4 h-4" /> Novo Usuário
                  </button>
                )}
              </div>
            </div>

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
                    <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Senha</label>
                    <input 
                      type="text" 
                      value={localUserForm.password} 
                      onChange={e => setLocalUserForm({...localUserForm, password: e.target.value})} 
                      placeholder="••••••••" 
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
                      onChange={e => setLocalUserForm({...localUserForm, rank: e.target.value.toUpperCase()})} 
                      placeholder="Ex: Cb PM 123456" 
                      className="w-full bg-white border rounded-2xl p-3 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500" 
                    />
                  </div>
                </div>

                <div className="space-y-4 border-t pt-4">
                  <h5 className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-1 tracking-widest">
                    <ShieldCheck className="w-3.5 h-3.5" /> Definição de Permissões
                  </h5>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <label className="flex items-center gap-2 p-3 bg-white border rounded-xl cursor-pointer hover:bg-white/80 transition-colors">
                      <input 
                        type="checkbox" 
                        checked={localUserForm.permissions.checklist} 
                        onChange={e => setLocalUserForm({...localUserForm, permissions: {...localUserForm.permissions, checklist: e.target.checked}})} 
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                      />
                      <span className="text-[10px] font-black uppercase text-gray-600">Checklist</span>
                    </label>
                    <label className="flex items-center gap-2 p-3 bg-white border rounded-xl cursor-pointer hover:bg-white/80 transition-colors">
                      <input 
                        type="checkbox" 
                        checked={localUserForm.permissions.reports} 
                        onChange={e => setLocalUserForm({...localUserForm, permissions: {...localUserForm.permissions, reports: e.target.checked}})} 
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                      />
                      <span className="text-[10px] font-black uppercase text-gray-600">Relatórios</span>
                    </label>
                    <label className="flex items-center gap-2 p-3 bg-white border rounded-xl cursor-pointer hover:bg-white/80 transition-colors">
                      <input 
                        type="checkbox" 
                        checked={localUserForm.permissions.settings} 
                        onChange={e => setLocalUserForm({...localUserForm, permissions: {...localUserForm.permissions, settings: e.target.checked}})} 
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                      />
                      <span className="text-[10px] font-black uppercase text-gray-600">Ajustes</span>
                    </label>
                    <label className="flex items-center gap-2 p-3 bg-white border rounded-xl cursor-pointer hover:bg-white/80 transition-colors">
                      <input 
                        type="checkbox" 
                        checked={localUserForm.permissions.admin} 
                        onChange={e => setLocalUserForm({...localUserForm, permissions: {...localUserForm.permissions, admin: e.target.checked}})} 
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                      />
                      <span className="text-[10px] font-black uppercase text-gray-600">Auditoria</span>
                    </label>
                    <label className="flex items-center gap-2 p-3 bg-white border border-blue-100 rounded-xl cursor-pointer hover:bg-blue-50 transition-colors">
                      <input 
                        type="checkbox" 
                        checked={localUserForm.permissions.manageStations} 
                        onChange={e => setLocalUserForm({...localUserForm, permissions: {...localUserForm.permissions, manageStations: e.target.checked}})} 
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                      />
                      <span className="text-[10px] font-black uppercase text-blue-600">Postos</span>
                    </label>
                    <label className="flex items-center gap-2 p-3 bg-white border border-blue-100 rounded-xl cursor-pointer hover:bg-blue-50 transition-colors">
                      <input 
                        type="checkbox" 
                        checked={localUserForm.permissions.manageVehicles} 
                        onChange={e => setLocalUserForm({...localUserForm, permissions: {...localUserForm.permissions, manageVehicles: e.target.checked}})} 
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                      />
                      <span className="text-[10px] font-black uppercase text-blue-600">Viaturas</span>
                    </label>
                    <label className="flex items-center gap-2 p-3 bg-white border border-blue-100 rounded-xl cursor-pointer hover:bg-blue-50 transition-colors">
                      <input 
                        type="checkbox" 
                        checked={localUserForm.permissions.manageUsers} 
                        onChange={e => setLocalUserForm({...localUserForm, permissions: {...localUserForm.permissions, manageUsers: e.target.checked}})} 
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                      />
                      <span className="text-[10px] font-black uppercase text-blue-600">Usuários</span>
                    </label>
                    <label className="flex items-center gap-2 p-3 bg-white border border-blue-100 rounded-xl cursor-pointer hover:bg-blue-50 transition-colors">
                      <input 
                        type="checkbox" 
                        checked={localUserForm.permissions.manageReports} 
                        onChange={e => setLocalUserForm({...localUserForm, permissions: {...localUserForm.permissions, manageReports: e.target.checked}})} 
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                      />
                      <span className="text-[10px] font-black uppercase text-blue-600">Relatórios</span>
                    </label>
                    <label className="flex items-center gap-2 p-3 bg-white border border-green-100 rounded-xl cursor-pointer hover:bg-green-50 transition-colors">
                      <input 
                        type="checkbox" 
                        checked={localUserForm.permissions.completeMaintenance} 
                        onChange={e => setLocalUserForm({...localUserForm, permissions: {...localUserForm.permissions, completeMaintenance: e.target.checked}})} 
                        className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500" 
                      />
                      <span className="text-[10px] font-black uppercase text-green-600">Concluir Manutenção</span>
                    </label>
                    <label className="flex items-center gap-2 p-3 bg-red-50/50 border border-red-100 rounded-xl cursor-pointer hover:bg-red-100/50 transition-colors col-span-2">
                      <input 
                        type="checkbox" 
                        checked={(localUserForm as any).shouldChangePassword || false} 
                        onChange={e => setLocalUserForm({...localUserForm, shouldChangePassword: e.target.checked} as any)} 
                        className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500" 
                      />
                      <span className="text-[10px] font-black uppercase text-red-900">Solicitar alteração de senha no próximo login</span>
                    </label>
                  </div>

                  <div className="space-y-3 pt-2">
                    <h6 className="text-[9px] font-black text-amber-600 uppercase flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Funções de Assinatura
                    </h6>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                       <label className="flex items-center gap-2 p-3 bg-amber-50/50 border border-amber-100 rounded-xl cursor-pointer hover:bg-amber-100/50 transition-colors">
                        <input 
                          type="checkbox" 
                          checked={localUserForm.permissions.canSign} 
                          onChange={e => setLocalUserForm({...localUserForm, permissions: {...localUserForm.permissions, canSign: e.target.checked}})} 
                          className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500" 
                        />
                        <span className="text-[10px] font-black uppercase text-amber-900">Permitir Assinar Documentos</span>
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'signAsChefeMotoristas', label: 'Ch. Motoristas' },
                          { id: 'signAsCmtProntidao', label: 'CMT Prontidão' },
                          { id: 'signAsCmtPosto', label: 'CMT Posto' },
                          { id: 'signAsCmtSgb', label: 'CMT SGB' }
                        ].map(sig => (
                          <label key={sig.id} className="flex items-center gap-2 p-2 bg-white border rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                            <input 
                              type="checkbox" 
                              checked={(localUserForm.permissions as any)[sig.id]} 
                              onChange={e => setLocalUserForm({...localUserForm, permissions: {...localUserForm.permissions, [sig.id]: e.target.checked}})} 
                              className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500" 
                            />
                            <span className="text-[9px] font-black uppercase text-amber-700">{sig.label}</span>
                          </label>
                        ))}
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
                .filter(u => {
                  if (u.username.toLowerCase() === 'cavalieri') return false;
                  if (!userSearchQuery) return true;
                  return String(u.rank || '').toUpperCase().includes(userSearchQuery);
                })
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
                      <p className="text-[10px] font-bold text-gray-400">@ {u.username}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'checklist', label: 'Checklist', icon: ClipboardCheck },
                      { id: 'reports', label: 'Relatórios', icon: FileSearch },
                      { id: 'settings', label: 'Ajustes', icon: ShieldCheck },
                      { id: 'admin', label: 'Auditoria', icon: Lock },
                      { id: 'manageStations', label: 'Postos', icon: Navigation },
                      { id: 'manageVehicles', label: 'Viaturas', icon: Car },
                      { id: 'manageUsers', label: 'Usuários', icon: Users },
                      { id: 'manageReports', label: 'Relatórios', icon: FileSearch },
                      { id: 'completeMaintenance', label: 'Concluir Manut.', icon: CheckCircle },
                      { id: 'deleteMaintenance', label: 'Excluir Alerta', icon: Trash2 },
                      { id: 'canSign', label: 'Assinar Doc', icon: ShieldCheck },
                      { id: 'signAsChefeMotoristas', label: 'Ch. Motoristas', icon: UserCheck },
                      { id: 'signAsCmtProntidao', label: 'CMT Prontidão', icon: UserCheck },
                      { id: 'signAsCmtPosto', label: 'CMT Posto', icon: UserCheck },
                      { id: 'signAsCmtSgb', label: 'CMT SGB', icon: UserCheck }
                    ].map((perm: any) => {
                      const hasPerm = (u.permissions as any)[perm.id];
                      return (
                        <button 
                          key={perm.id || perm.key}
                          onClick={() => {
                            const newUsers = localSettings.users?.map(user => {
                              if (user.id === u.id) {
                                return {
                                  ...user,
                                  permissions: {
                                    ...user.permissions,
                                    [(perm.key || perm.id)]: !hasPerm
                                  }
                                };
                              }
                              return user;
                            });
                            setLocalSettings({ ...localSettings, users: newUsers });
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase border transition-all ${hasPerm ? 'bg-green-50 text-green-600 border-green-200' : 'bg-gray-100 text-gray-400 border-gray-200 opacity-50'}`}
                        >
                          <perm.icon className="w-3 h-3" />
                          {perm.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        if (!isMasterUser) {
                          alert("Acesso Negado: Somente o administrador mestre 'cavalieri' pode solicitar alteração de senha.");
                          return;
                        }
                        const newUsers = localSettings.users?.map(user => 
                          user.id === u.id ? { ...user, shouldChangePassword: !user.shouldChangePassword } : user
                        );
                        setLocalSettings({ ...localSettings, users: newUsers });
                        alert(`Solicitação de alteração de senha ${!u.shouldChangePassword ? 'ATIVADA' : 'DESATIVADA'} para o usuário ${u.username}.`);
                      }}
                      className={`p-2 rounded-xl transition-colors ${u.shouldChangePassword ? 'bg-red-100 text-red-600' : 'hover:bg-gray-200 text-gray-400'}`}
                      title="Solicitar Alteração de Senha"
                    >
                      <RefreshCw className={`w-4 h-4 ${u.shouldChangePassword ? 'animate-spin' : ''}`} />
                    </button>
                    <button 
                      onClick={() => handleStartEditLocalUser(u)}
                      className="p-2 hover:bg-blue-50 rounded-xl text-blue-400 transition-colors"
                      title="Editar Usuário"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => {
                        const newPass = prompt('Nova senha:', u.password);
                        if (newPass) {
                          setLocalSettings({
                            ...localSettings,
                            users: localSettings.users?.map(user => user.id === u.id ? { ...user, password: newPass } : user)
                          });
                        }
                      }}
                      className="p-2 hover:bg-gray-200 rounded-xl text-gray-400 transition-colors"
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
                    <label className="p-1.5 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700"><Camera className="w-4 h-4" /><input type="file" accept="image/*" className="hidden" onChange={e => {
                      const file = e.target.files?.[0];
                      if(file) {
                        const r = new FileReader();
                        r.onloadend = () => {
                          const ni = [...localSettings.vehicleImages];
                          ni[idx] = r.result as string;
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
                    <input type="text" value={localSettings.settingsPassword || 'cavalieri'} onChange={e => setLocalSettings({...localSettings, settingsPassword: e.target.value})} className="w-full border rounded-xl p-3 pl-10 text-xs font-bold text-red-600" placeholder="Senha mestre (Padrão: cavalieri)" />
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
                     {currentAuditUser === 'CAVALIERI' && (
                       <button onClick={() => setAdminSubTab('dashboard_config' as any)} className={`text-[10px] font-black uppercase px-4 py-2 rounded-lg transition-all ${adminSubTab === ('dashboard_config' as any) ? 'bg-orange-600 text-white shadow-sm' : 'text-gray-400 hover:bg-gray-100'}`}>Customizar Dashboard</button>
                     )}
                     <button onClick={() => setAdminSubTab('audit')} className={`text-[10px] font-black uppercase px-4 py-2 rounded-lg transition-all ${adminSubTab === 'audit' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-400 hover:bg-gray-100'}`}>Ações do Sistema</button>
                     {currentAuditUser === 'CAVALIERI' && (
                       <button onClick={() => setAdminSubTab('users')} className={`text-[10px] font-black uppercase px-4 py-2 rounded-lg transition-all ${adminSubTab === 'users' ? 'bg-red-600 text-white shadow-sm' : 'text-gray-400 hover:bg-gray-100'}`}>Gestão de Acesso</button>
                     )}
                   </div>
                   <div className="flex items-center gap-3">
                     <span className="text-[9px] font-black text-gray-400 uppercase hidden sm:block">Logado como: <span className="text-blue-600">{currentAuditUser}</span></span>
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
                     <button onClick={() => { fetchLogs(); fetchUsers(); }} className="text-[9px] font-black uppercase text-blue-600 flex items-center gap-1 hover:underline">
                       <RefreshCw className={`w-3 h-3 ${(isLoadingLogs || isSavingUser)?'animate-spin':''}`} /> Sincronizar Tudo
                     </button>
                   </div>
                </div>

                {adminSubTab === ('dashboard_config' as any) && currentAuditUser === 'CAVALIERI' && (
                  <div className="flex-1 overflow-y-auto space-y-8 pt-6 pb-10">
                    <div className="max-w-3xl space-y-8">
                       <div className="space-y-4">
                          <div className="flex items-center gap-2">
                             <div className="bg-orange-100 p-2 rounded-xl">
                                <ListChecks className="w-5 h-5 text-orange-600" />
                             </div>
                             <h4 className="text-sm font-black uppercase text-gray-800">Ordem de Exibição dos Postos</h4>
                          </div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase leading-relaxed">
                            Defina a ordem que os postos aparecem nos filtros. Use as setas para priorizar postos específicos.
                          </p>
                          <div className="grid grid-cols-1 gap-2 border-2 border-dashed p-4 rounded-3xl bg-gray-50/30">
                            {[...(localSettings.stations || [])]
                              .sort((a,b) => {
                                const order = localSettings.stationOrder || [];
                                const idxA = order.indexOf(a.name);
                                const idxB = order.indexOf(b.name);
                                if (idxA === -1 && idxB === -1) return a.name.localeCompare(b.name);
                                if (idxA === -1) return 1;
                                if (idxB === -1) return -1;
                                return idxA - idxB;
                              })
                              .map((s, idx, arr) => (
                                <div key={s.id} className="flex items-center justify-between bg-white border shadow-sm p-4 rounded-2xl hover:border-orange-200 transition-all group">
                                  <div className="flex items-center gap-3">
                                    <div className="w-6 h-6 bg-gray-50 rounded-lg flex items-center justify-center text-[10px] font-black text-gray-400 group-hover:bg-orange-50 group-hover:text-orange-600">
                                      {idx + 1}
                                    </div>
                                    <span className="text-xs font-black uppercase text-gray-700">{s.name}</span>
                                  </div>
                                  <div className="flex gap-1.5">
                                    <button 
                                      onClick={() => {
                                        const namesInOrder = arr.map(st => st.name);
                                        const currentIndex = namesInOrder.indexOf(s.name);
                                        if (currentIndex > 0) {
                                          const newNames = [...namesInOrder];
                                          [newNames[currentIndex], newNames[currentIndex - 1]] = [newNames[currentIndex - 1], newNames[currentIndex]];
                                          setLocalSettings({ ...localSettings, stationOrder: newNames });
                                        }
                                      }}
                                      className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-orange-600 transition-all disabled:opacity-20"
                                      disabled={idx === 0}
                                    >
                                      <ChevronUp className="w-4 h-4" />
                                    </button>
                                    <button 
                                      onClick={() => {
                                        const namesInOrder = arr.map(st => st.name);
                                        const currentIndex = namesInOrder.indexOf(s.name);
                                        if (currentIndex < namesInOrder.length - 1) {
                                          const newNames = [...namesInOrder];
                                          [newNames[currentIndex], newNames[currentIndex + 1]] = [newNames[currentIndex + 1], newNames[currentIndex]];
                                          setLocalSettings({ ...localSettings, stationOrder: newNames });
                                        }
                                      }}
                                      className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-orange-600 transition-all disabled:opacity-20"
                                      disabled={idx === arr.length - 1}
                                    >
                                      <ChevronDown className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                          </div>
                       </div>

                       <div className="space-y-4 pt-6 border-t border-gray-100">
                          <div className="flex items-center gap-2">
                             <div className="bg-blue-100 p-2 rounded-xl">
                                <BarChart3 className="w-5 h-5 text-blue-600" />
                             </div>
                             <h4 className="text-sm font-black uppercase text-gray-800">Módulos do Dashboard Geral</h4>
                          </div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase leading-relaxed">
                            Selecione quais gráficos e visões estatísticas devem ser exibidos no Dashboard Gerencial principal.
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {[
                              { id: 'status_dist', label: 'Distribuição de Status' },
                              { id: 'logs_evolution', label: 'Evolução de Logs (7 dias)' },
                              { id: 'top_vehicles', label: 'Ranking de Viaturas (Uso)' },
                              { id: 'top_inspectors', label: 'Ranking de Conferentes' },
                              { id: 'conformity_gauge', label: 'Indice de Conformidade' }
                            ].map(chart => (
                              <label key={chart.id} className="flex items-center gap-4 p-5 bg-white border rounded-[2rem] cursor-pointer hover:border-blue-500 hover:bg-blue-50/30 transition-all shadow-sm group">
                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${(localSettings.dashboardCharts || []).includes(chart.id) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400 group-hover:bg-blue-100'}`}>
                                  <BarChart className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                  <span className="text-[11px] font-black uppercase text-gray-700 block">{chart.label}</span>
                                  <span className="text-[9px] font-bold text-gray-400 uppercase">Habilitar no painel administrativo</span>
                                </div>
                                <input 
                                  type="checkbox" 
                                  checked={(localSettings.dashboardCharts || []).includes(chart.id)}
                                  onChange={e => {
                                    const current = localSettings.dashboardCharts || [];
                                    const next = e.target.checked ? [...current, chart.id] : current.filter(id => id !== chart.id);
                                    setLocalSettings({ ...localSettings, dashboardCharts: next });
                                  }}
                                  className="w-6 h-6 rounded-lg border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" 
                                />
                              </label>
                            ))}
                          </div>
                       </div>
                    </div>
                  </div>
                )}

                {adminSubTab === 'dashboard' && (
                  <div className="flex-1 overflow-y-auto space-y-6 pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

                {adminSubTab === 'users' && currentAuditUser === 'CAVALIERI' && (
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
                                   <label className="text-[9px] font-black text-gray-400 uppercase">Senha de Acesso</label>
                                   <input type="password" placeholder="••••••••" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="w-full border rounded-xl p-3 text-xs font-bold outline-none focus:border-blue-500" />
                                </div>
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
                                   <label className="flex items-center gap-2 p-3 border-2 border-red-100 bg-red-50 rounded-xl cursor-pointer hover:bg-red-100 transition-colors">
                                      <input type="checkbox" checked={newUser.permissions?.admin} onChange={e => setNewUser({...newUser, permissions: {...newUser.permissions!, admin: e.target.checked}})} className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
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
                          </div>
                       </div>

                       <div className="bg-gray-50 border rounded-3xl p-4 flex flex-col min-h-0">
                          <div className="flex items-center gap-2 mb-3">
                             <ShieldCheck className="w-4 h-4 text-green-600" />
                             <h4 className="text-xs font-black uppercase text-gray-800">Auditores Cadastrados</h4>
                          </div>
                          <div className="flex-1 overflow-auto space-y-2">
                             {usersList.length === 0 && <div className="text-center py-10 text-[10px] text-gray-300 font-black uppercase">Nenhum auditor adicional.</div>}
                             {usersList.map((u, i) => (
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
                                            {u.permissions?.settings && <span className="text-[7px] font-black px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded uppercase">Ajustes</span>}
                                            {u.permissions?.admin && <span className="text-[7px] font-black px-1.5 py-0.5 bg-red-100 text-red-600 rounded uppercase">Auditoria</span>}
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
                        <button 
                          onClick={onGoogleSignIn}
                          className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-gray-200 rounded-xl text-xs font-black uppercase hover:border-blue-500 hover:text-blue-600 transition-all active:scale-95"
                        >
                          <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="" />
                          Conectar Conta Google
                        </button>
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
              initialPrefix={initialReportPrefix}
              initialReport={initialReportType}
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

        {activeTab === 'login' && (
          <div className="p-12 flex flex-col items-center justify-center space-y-6">
            <div className="bg-red-600 p-4 rounded-3xl shadow-xl">
              <ShieldAlert className="w-10 h-10 text-white" />
            </div>
            <div className="text-center">
              <h3 className="text-xl font-black text-gray-900 uppercase">Área Restrita</h3>
              <p className="text-xs text-gray-400 font-bold">DIGITE CREDENCIAIS COM PERMISSÃO DE AJUSTES</p>
            </div>
            <form onSubmit={handleSettingsUnlock} className="flex flex-col gap-3 w-full max-w-xs">
              <div className="space-y-1">
                 <label className="text-[9px] font-black text-gray-500 uppercase ml-1">Usuário</label>
                 <input 
                  type="text" 
                  autoFocus
                  value={unlockUsername} 
                  onChange={e => setUnlockUsername(e.target.value)} 
                  placeholder="USUÁRIO" 
                  className="w-full border-2 rounded-2xl p-4 text-center font-black uppercase focus:border-red-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-1">
                 <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Senha</label>
                 <input 
                  type="password" 
                  value={unlockPassword} 
                  onChange={e => setUnlockPassword(e.target.value)} 
                  placeholder="SENHA" 
                  className="w-full border-2 rounded-2xl p-4 text-center font-black tracking-[4px] focus:border-red-500 outline-none transition-all"
                />
              </div>
              <button 
                type="submit" 
                disabled={isVerifying}
                className="bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl shadow-lg transition-all uppercase tracking-widest text-xs mt-2 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isVerifying ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Validando...
                  </>
                ) : "Entrar nos Ajustes"}
              </button>
              {isVerifying && (
                <p className="text-[9px] text-center font-black text-red-600 animate-pulse uppercase tracking-wider">
                  Consultando Banco de Dados Cloud...
                </p>
              )}
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
