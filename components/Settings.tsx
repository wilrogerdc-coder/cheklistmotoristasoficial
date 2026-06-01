
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
  Upload
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
  };
  createdAt?: string;
}

interface SettingsProps {
  settings: AppSettings;
  currentUser: User | null;
  onSave: (newSettings: AppSettings) => void;
  onClose: () => void;
  initialTab?: 'items' | 'images' | 'style' | 'about' | 'admin' | 'manual' | 'reports' | 'vehicles' | 'stations' | 'users' | 'report_editor' | 'cloud';
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
  initialTab = 'items',
  setCurrentUser,
  googleUser,
  onGoogleSignIn,
  onGoogleSync,
  isSyncing,
  connectionStatus,
  onCheckConnection
}) => {
  const [activeTab, setActiveTab] = useState<'items' | 'images' | 'style' | 'about' | 'admin' | 'manual' | 'reports' | 'vehicles' | 'stations' | 'users' | 'report_editor' | 'cloud'>(initialTab);
  const [isSettingsUnlocked, setIsSettingsUnlocked] = useState(false);
  const [unlockUsername, setUnlockUsername] = useState('');
  const [unlockPassword, setUnlockPassword] = useState('');

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
  
  const isSuperUser = !currentUser || 
                      currentUser.username.toLowerCase() === 'cavalieri' || 
                      currentUser.permissions?.settings === true;
  
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
    permissions: { 
      checklist: true, 
      reports: false, 
      settings: false,
      admin: false 
    } 
  });
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [isAddingLocalUser, setIsAddingLocalUser] = useState(false);
  const [editingLocalUser, setEditingLocalUser] = useState<User | null>(null);
  const [localUserForm, setLocalUserForm] = useState({ username: '', password: '', name: '', rank: '' });
  
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
      permissions: user.permissions || {
        checklist: true,
        reports: false,
        settings: false,
        admin: false
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
      permissions: { 
        checklist: true, 
        reports: false, 
        settings: false,
        admin: false 
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
    const station = { id: crypto.randomUUID(), ...newStation };
    setLocalSettings({ ...localSettings, stations: [...(localSettings.stations || []), station] });
    setNewStation({ name: '', sgbId: '' });
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

    if ((localSettings.users || []).some(u => u.username.toLowerCase() === localUserForm.username.toLowerCase())) {
      alert('Erro: Este nome de usuário já está em uso.');
      return;
    }
    
    const newUser: User = {
      id: crypto.randomUUID(),
      username: localUserForm.username.toLowerCase(),
      password: localUserForm.password,
      name: localUserForm.name || localUserForm.username,
      permissions: {
        checklist: true,
        reports: true,
        settings: false, // Por padrão, novos usuários não têm acesso aos ajustes
        admin: false
      }
    };
    
    setLocalSettings({
      ...localSettings,
      users: [...(localSettings.users || []), newUser]
    });
    setLocalUserForm({ username: '', password: '', name: '', rank: '' });
    setIsAddingLocalUser(false);
    alert('Usuário cadastrado com sucesso! Lembre-se de clicar em "Aplicar Ajustes" para salvar permanentemente.');
  };

  const handleUpdateLocalUser = () => {
    if (!editingLocalUser || !localUserForm.username || !localUserForm.password) {
      alert('Preencha usuário e senha');
      return;
    }

    const updatedUsers = (localSettings.users || []).map(u => {
      if (u.id === editingLocalUser.id) {
        return {
          ...u,
          username: localUserForm.username.toLowerCase(),
          password: localUserForm.password,
          name: localUserForm.name || localUserForm.username,
          rank: localUserForm.rank
        };
      }
      return u;
    });

    setLocalSettings({ ...localSettings, users: updatedUsers });
    setEditingLocalUser(null);
    setLocalUserForm({ username: '', password: '', name: '', rank: '' });
    alert('Dados do usuário atualizados com sucesso!');
  };

  const handleStartEditLocalUser = (u: User) => {
    setEditingLocalUser(u);
    setLocalUserForm({
      username: u.username,
      password: u.password || '',
      name: u.name,
      rank: u.rank || ''
    });
    setIsAddingLocalUser(true); // Re-use the same form area
  };

  const deleteLocalUser = (id: string, username: string) => {
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

  const handleSettingsUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Suporte ao usuário mestre legacy/emergência
    if (unlockUsername.toLowerCase() === 'cavalieri' && (unlockPassword === (localSettings.settingsPassword || 'cavalieri') || unlockPassword === 'tricolor')) {
      setIsSettingsUnlocked(true);
      return;
    }

    const matchedUser = (localSettings.users || []).find(u => 
      u.username.toLowerCase() === unlockUsername.toLowerCase() && 
      u.password === unlockPassword &&
      (u.permissions.settings === true || u.username.toLowerCase() === 'cavalieri')
    );

    if (matchedUser) {
      setIsSettingsUnlocked(true);
      setCurrentUser(matchedUser);
    } else {
      alert('Acesso Negado: Usuário sem permissão de ajustes ou credenciais incorretas.');
    }
  };

  if (!isSettingsUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 space-y-6">
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
             <label className="text-[9px] font-black text-gray-500 uppercase ml-1">Senha</label>
             <input 
              type="password" 
              value={unlockPassword} 
              onChange={e => setUnlockPassword(e.target.value)} 
              placeholder="SENHA" 
              className="w-full border-2 rounded-2xl p-4 text-center font-black tracking-[4px] focus:border-red-500 outline-none transition-all"
            />
          </div>
          <button type="submit" className="bg-red-600 text-white font-black py-4 rounded-2xl shadow-lg hover:bg-red-700 transition-all uppercase tracking-widest text-xs mt-2">Entrar nos Ajustes</button>
          <button onClick={onClose} type="button" className="text-gray-400 font-bold text-[10px] uppercase hover:text-gray-600 mt-2">Voltar</button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors no-print"><ArrowLeft className="w-5 h-5" /></button>
          <h2 className="text-xl font-bold text-gray-800">Centro de Inteligência de Frota</h2>
        </div>
        <button onClick={() => onSave(localSettings)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold no-print shadow-lg">Aplicar Ajustes</button>
      </div>

      <nav className="flex gap-2 overflow-x-auto pb-2 no-print">
        {[
          { id: 'manual', label: 'Manual', icon: BookOpen },
          { id: 'stations', label: 'Postos', icon: Navigation, permission: 'settings' },
          { id: 'vehicles', label: 'Viaturas', icon: Car, permission: 'settings' },
          { id: 'users', label: 'Usuários', icon: Users, permission: 'settings' },
          { id: 'items', label: 'Itens', icon: ListChecks, permission: 'settings' },
          { id: 'images', label: 'Plantas', icon: ImageIcon, permission: 'settings' },
          { id: 'style', label: 'Estilo', icon: Palette, permission: 'settings' },
          { id: 'admin', label: 'Auditoria', icon: Lock, permission: 'admin' },
          { id: 'cloud', label: 'Nuvem', icon: Cloud, superOnly: true },
          { id: 'report_editor', label: 'Editor Relat.', icon: Edit2, permission: 'reports' },
          { id: 'reports', label: 'Relatórios', icon: FileText, permission: 'reports' },
          { id: 'about', label: 'SOBRE', icon: Info }
        ].filter(tab => {
          if (!tab.permission && !tab.superOnly) return true;
          // Se não houver usuário logado (Visitante), permitimos ver abas não restritas
          if (!currentUser) return !tab.superOnly;
          // Superusuário master
          if (currentUser.username.toLowerCase() === 'cavalieri') return true;
          
          if (tab.superOnly) return false;

          // Verificar permissão específica
          return (currentUser.permissions as any)[tab.permission!];
        }).map(tab => (
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
            <h3 className="text-2xl font-black text-gray-900 uppercase">Manual de Operação Técnica</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 p-6 rounded-2xl space-y-2 border">
                <h4 className="font-black text-xs text-blue-600 uppercase">1. Identificação</h4>
                <p className="text-[11px] text-gray-600 font-medium">Preencha Prefixo, Placa e KM. Escolha o ciclo de inspeção (Diário ou Semanal).</p>
              </div>
              <div className="bg-gray-50 p-6 rounded-2xl space-y-2 border">
                <h4 className="font-black text-xs text-orange-600 uppercase">2. Mapeamento</h4>
                <p className="text-[11px] text-gray-600 font-medium">Toque nas plantas da viatura para marcar pontos de avaria externa.</p>
              </div>
              <div className="bg-gray-50 p-6 rounded-2xl space-y-2 border">
                <h4 className="font-black text-xs text-green-600 uppercase">3. Checklist</h4>
                <p className="text-[11px] text-gray-600 font-medium">Marque SN (Sem Novidade) ou CN (Com Novidade) para cada item técnico.</p>
              </div>
              <div className="bg-gray-50 p-6 rounded-2xl space-y-2 border">
                <h4 className="font-black text-xs text-purple-600 uppercase">4. Finalização</h4>
                <p className="text-[11px] text-gray-600 font-medium">Assine digitalmente e gere o PDF para protocolo oficial.</p>
              </div>
            </div>
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
                <button onClick={handleAddStation} className="bg-blue-600 text-white p-2 rounded-xl hover:bg-blue-700 transition-all flex justify-center items-center"><Plus className="w-6 h-6" /></button>
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
                      <button onClick={() => handleRemoveStation(s.id)} className="text-red-400 hover:text-red-600 p-2"><Trash2 className="w-4 h-4" /></button>
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
                      onChange={e => setLocalUserForm({...localUserForm, rank: e.target.value})} 
                      placeholder="Ex: Cb PM 123456" 
                      className="w-full bg-white border rounded-2xl p-3 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500" 
                    />
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
              {(localSettings.users || []).map(u => (
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
                      { id: 'admin', label: 'Auditoria', icon: Lock }
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
                  readOnly={!isSuperUser}
                  className={`w-full border-2 rounded-2xl p-4 text-center text-xl font-black uppercase outline-none transition-all ${!isSuperUser ? 'bg-gray-50 border-gray-100 text-gray-400' : 'focus:border-blue-500'}`}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Descrição do Sistema</label>
                <textarea 
                  value={localSettings.appDescription || 'Desenvolvido para gestão técnica de frotas de emergência e operacionais. Sistema resiliente de auditoria com reconstrução dinâmica de relatórios espelho e controle de acessos multinível.'} 
                  onChange={e => setLocalSettings({...localSettings, appDescription: e.target.value})} 
                  placeholder="DESCRIÇÃO DO SISTEMA"
                  rows={4}
                  readOnly={!isSuperUser}
                  className={`w-full border-2 rounded-2xl p-4 text-[11px] font-medium leading-relaxed outline-none transition-all resize-none ${!isSuperUser ? 'bg-gray-50 border-gray-100 text-gray-300' : 'text-gray-500 focus:border-blue-500'}`}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Desenvolvido por</label>
                <input 
                  type="text" 
                  value={localSettings.developedBy || 'Equipe de Gestão de Frotas'} 
                  onChange={e => setLocalSettings({...localSettings, developedBy: e.target.value})} 
                  placeholder="DESENVOLVEDOR"
                  readOnly={!isSuperUser}
                  className={`w-full border-2 rounded-2xl p-4 text-center text-[10px] font-black uppercase outline-none transition-all ${!isSuperUser ? 'bg-gray-50 border-gray-100 text-gray-300' : 'text-blue-600 focus:border-blue-500'}`}
                />
              </div>
            </div>

            <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.3em]">Versão 3.8.0 Auditoria</p>
            
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl max-w-sm">
              <p className="text-[10px] text-blue-800 font-bold text-center leading-relaxed">
                As alterações realizadas aqui serão refletidas em todo o sistema após você clicar em "Aplicar Ajustes".
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
