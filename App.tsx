
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
import { 
  LogEntry,
  InspectionData, 
  ItemStatus, 
  DamagePoint,
  AppSettings,
  AspectRatio,
  User,
  Vehicle,
  Station
} from './types';
import { 
  initAuth, 
  googleSignIn, 
  logout as googleLogout, 
  getAccessToken 
} from './services/googleAuth';
import { sheetsService } from './services/googleSheets';
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
  RefreshCw
} from 'lucide-react';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  const [view, setView] = useState<'checklist' | 'settings'>('checklist');
  const [activeTabInSettings, setActiveTabInSettings] = useState<'items' | 'images' | 'style' | 'about' | 'admin' | 'manual' | 'reports' | 'vehicles' | 'stations' | 'users' | 'report_editor'>('items');
  const [showDamageMap, setShowDamageMap] = useState(true);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'checking' | 'online' | 'offline'>('idle');
  const [selectedStationFilter, setSelectedStationFilter] = useState<string>('');
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [printTimestamp, setPrintTimestamp] = useState<string>('');
  const checklistRef = useRef<HTMLDivElement>(null);
  
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

  useEffect(() => {
    // Busca inicial de configurações, usuários, viaturas e postos no banco de dados na nuvem para manter tudo atualizado
    const syncOnStartup = async () => {
      const targetUrl = settings.googleSheetUrl?.trim();
      if (!targetUrl) return;

      setIsSyncing(true);
      try {
        console.log("Iniciando sincronização completa com banco de dados na inicialização...");
        
        // Disparar requisições em paralelo
        const [settingsRes, usersRes, vehiclesRes, stationsRes] = await Promise.all([
          fetch(`${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=getSettings`).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(`${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=getUsers`).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(`${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=getVehicles`).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(`${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=getStations`).then(r => r.ok ? r.json() : null).catch(() => null)
        ]);

        setSettings(prev => {
          let updated = { ...prev };

          // 1. Sincronizar Configurações do Sistema (Ignorando dados específicos de conexão local como URL e SpreadsheetID)
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
          }

          // 3. Sincronizar Viaturas
          if (Array.isArray(vehiclesRes) && vehiclesRes.length > 0) {
            updated.vehicles = vehiclesRes;
          }

          // 4. Sincronizar Postos
          if (Array.isArray(stationsRes) && stationsRes.length > 0) {
            updated.stations = stationsRes;
          }

          localStorage.setItem('checkviatura_settings', JSON.stringify(updated));
          console.log("Todas as configurações e tabelas sincronizadas do banco de dados com sucesso na inicialização!");
          return updated;
        });
      } catch (err) {
        console.error("Erro no carregamento/sincronização inicial das configurações:", err);
      } finally {
        setIsSyncing(false);
      }
    };

    syncOnStartup();
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

  const themeColor = settings.headerBgColor || '#b91c1c';
  const printScale = settings.printScale || 1.0;

  const compressImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      if (!base64Str || !base64Str.startsWith('data:image')) {
        resolve(base64Str);
        return;
      }
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600;
        const MAX_HEIGHT = 600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.4));
      };
      img.onerror = () => resolve(base64Str);
    });
  };

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

  const handleGoogleSignIn = async () => {
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        setGoogleToken(result.accessToken);
      }
    } catch (err) {
      console.error("Google login failed:", err);
      alert("Falha ao conectar com o Google");
    }
  };

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
    
    setIsSaving(false);
    setView('checklist');
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = (settings.users || []).find(u => 
      u.username.toLowerCase() === loginUsername.toLowerCase() && u.password === loginPassword
    );

    // Super user legacy check
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
      return;
    }

    if (user) {
      setCurrentUser(user);
      setShowLoginModal(false);
      setLoginUsername('');
      setLoginPassword('');
      saveAuditLog('LOGIN', 'Usuário realizou login com sucesso');
    } else {
      alert('Usuário ou senha inválidos');
    }
  };

  const handleLogout = () => {
    saveAuditLog('LOGOUT', 'Usuário realizou logout');
    setCurrentUser(null);
    setLoginUsername('');
    setLoginPassword('');
    setShowLoginModal(false);
    setView('checklist');
  };

  // Removido o bloqueio de login obrigatório
  
  const hasPermission = (screen: keyof User['permissions']) => {
    // Se não há usuário logado (Visitante), permitimos visualizar os menus para que possam ser desbloqueados internamente
    if (!currentUser) return true;
    
    // Se há usuário logado, respeitamos estritamente suas permissões cadastradas
    return currentUser.permissions[screen];
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

    if (logData.fullData.length > 45000) {
      console.warn("Payload grande detectado. Otimizando dados...");
      const optimizedMirror = { ...dataForMirror, vehicleImages: [] };
      logData.fullData = JSON.stringify(optimizedMirror);
    }

    const targetUrlWithAction = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=saveLog`;
    console.log("Enviando dados para o Google Sheets...", { id: logData.id, size: logData.fullData.length, url: targetUrlWithAction });

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
        } else {
          console.error("Erro retornado pelo script:", result.message);
        }
      } else {
        console.log("Log enviado (modo no-cors). Verifique a planilha.");
      }
    } catch (err) {
      console.error("Erro fatal ao salvar no Google Sheets:", err);
    }
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

    setPrintTimestamp(new Date().toLocaleString('pt-BR'));
    setShowExportMenu(false);
    setIsSaving(true);
    await saveLogToGoogleSheets();
    await saveAuditLog('CHECKLIST_FINALIZADO', `Checklist ${data.checklistType} finalizado para viatura ${data.prefix}`);
    
    // Se tiver token do Google Real, salva também na planilha real
    if (googleToken && settings.googleSpreadsheetId) {
      try {
        const logToAppend: LogEntry = {
          ...data,
          date: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
          signatureRank: data.signatureRank || '',
          signatureName: data.signatureName || ''
        } as any;
        await sheetsService.appendLog(googleToken, settings.googleSpreadsheetId, logToAppend);
      } catch (err) {
        console.error("Erro ao salvar log no Google Real:", err);
      }
    }

    setIsSaving(false);
    
    setTimeout(() => {
      window.print();
    }, 500);
  };

  const hasVehicleImages = data.vehicleImages.some(img => img && img !== "");

  return (
    <div className="min-h-screen max-w-5xl mx-auto pt-24 pb-4 px-4 sm:px-6 print:pt-0 print:pb-0 print:px-0 transition-all">
      {isSaving && (
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-md flex items-center justify-center flex-col text-white gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-blue-400" />
          <div className="text-center">
            <h3 className="font-black text-lg uppercase tracking-widest">Gravando Conferência</h3>
            <p className="text-xs text-blue-200 font-bold opacity-70">Sincronizando protocolo digital...</p>
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
              initialTab={activeTabInSettings} 
              setCurrentUser={setCurrentUser}
              googleUser={googleUser}
              onGoogleSignIn={handleGoogleSignIn}
              onGoogleSync={handleGoogleSync}
              isSyncing={isSyncing}
              connectionStatus={connectionStatus}
              onCheckConnection={handleCheckConnection}
            />
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
                      {settings.stations?.sort((a,b) => (a.name || '').localeCompare(b.name || '')).map(s => (
                        <option key={s.id} value={s.name}>{s.name}</option>
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
                            setData({
                              ...data,
                              prefix: vehicle.prefix,
                              plate: vehicle.plate,
                              vehicleType: vehicle.type,
                              station: vehicle.station
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
                          .map(v => (
                            <option key={v.id} value={v.prefix}>{v.prefix} - {v.plate}</option>
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
                <ChecklistTable items={data.items} onStatusChange={handleStatusChange} onObservationChange={handleObservationChange} onSaveToGeneralNotes={handleSaveToGeneralNotes} onAddPhoto={handleItemPhotoUpload} />
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

      <div className="fixed top-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/95 backdrop-blur-sm border border-gray-200 shadow-2xl px-5 py-3 rounded-2xl no-print z-[100]">
        <div className="flex items-center gap-2 pr-3 border-r border-gray-200">
           <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${googleUser ? 'bg-green-50' : 'bg-blue-50'}`}>
              <UserIcon className={`w-4 h-4 ${googleUser ? 'text-green-600' : 'text-blue-600'}`} />
           </div>
           <div className="flex flex-col">
              <span className="text-[10px] font-black text-gray-900 leading-none truncate max-w-[80px] uppercase">{googleUser ? googleUser.displayName?.split(' ')[0] : (currentUser ? (currentUser.name || currentUser.username || '').split(' ')[0] : 'VISITANTE')}</span>
              {googleUser ? (
                <div className="flex items-center gap-1">
                  <Cloud className="w-2 h-2 text-green-500" />
                  <span className="text-[7px] font-black text-green-500 uppercase">Sincronizado</span>
                </div>
              ) : (
                currentUser ? (
                  <button onClick={handleLogout} className="text-[8px] font-black text-red-500 uppercase text-left hover:underline flex items-center gap-0.5"><LogOut className="w-2 h-2" /> Sair</button>
                ) : (
                  <button onClick={() => setShowLoginModal(true)} className="text-[8px] font-black text-blue-500 uppercase text-left hover:underline flex items-center gap-0.5"><Lock className="w-2 h-2" /> Entrar</button>
                )
              )}
           </div>
        </div>

        {view === 'checklist' ? (
          <>
            {hasPermission('settings') && (
              <button onClick={() => { setActiveTabInSettings('items'); setView('settings'); }} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-xl text-blue-600 transition-colors"><SettingsIcon className="w-5 h-5 text-blue-500" /><span className="text-xs font-bold hidden sm:inline">Ajustes</span></button>
            )}
            
            {hasPermission('reports') && (
              <>
                <div className="w-px h-6 bg-gray-200 mx-1"></div>
                <button onClick={() => { setActiveTabInSettings('reports'); setView('settings'); }} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-xl text-purple-600 transition-colors"><FileText className="w-5 h-5 text-purple-500" /><span className="text-xs font-bold hidden sm:inline">Relatórios</span></button>
              </>
            )}

            {view === 'checklist' && hasPermission('checklist') && (
              <>
                <div className="w-px h-6 bg-gray-200 mx-1"></div>
                
                <button 
                  onClick={handleExportModel} 
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-xl text-green-600 transition-colors"
                  title="Exportar Salvar modelo"
                >
                  <Save className="w-5 h-5 text-green-500" />
                  <span className="text-xs font-bold hidden sm:inline">Salvar Modelo</span>
                </button>

                <label 
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-xl text-purple-600 transition-colors cursor-pointer"
                  title="Importar Modelo"
                >
                  <Upload className="w-5 h-5 text-purple-500" />
                  <span className="text-xs font-bold hidden sm:inline">Importar</span>
                  <input type="file" accept=".json" className="hidden" onChange={handleImportModel} />
                </label>

                <div className="w-px h-6 bg-gray-200 mx-1"></div>
                
                <button 
                  onClick={() => setShowDamageMap(!showDamageMap)} 
                  className={`flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-xl transition-colors ${showDamageMap ? 'text-orange-600' : 'text-gray-400'}`}
                  title={showDamageMap ? "Ocultar Mapa de Avarias" : "Mostrar Mapa de Avarias"}
                >
                  {showDamageMap ? <Map className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                  <span className="text-xs font-bold hidden sm:inline">{showDamageMap ? 'Ocultar Mapa' : 'Mostrar Mapa'}</span>
                </button>
                
                <div className="w-px h-6 bg-gray-200 mx-1"></div>

                <button onClick={() => setShowExportMenu(!showExportMenu)} className={`px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg flex items-center gap-2 transition-all active:scale-95 ${showExportMenu ? 'bg-gray-800 text-white' : 'bg-blue-600 text-white'}`}>Finalizar</button>
                {showExportMenu && (
                  <div className="absolute top-full mt-3 left-0 bg-white border rounded-xl shadow-2xl p-2 w-56 z-[110]">
                    <button onClick={handleVisualizarPdf} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-green-50 text-gray-700 rounded-lg text-xs font-bold"><Printer className="w-4 h-4" /> Visualizar e Imprimir</button>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <button onClick={() => setView('checklist')} className="px-6 py-2 bg-gray-800 text-white rounded-xl text-sm font-bold flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Voltar ao Checklist</button>
        )}
      </div>

      {showLoginModal && (
        <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-sm space-y-8 border-t-4 border-blue-600 animate-in fade-in zoom-in duration-300">
            <div className="flex justify-between items-start">
               <div className="space-y-1">
                  <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Entrar</h2>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-blue-600">Identificação de Usuário</p>
               </div>
               <button onClick={() => setShowLoginModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors"><X className="w-5 h-5 text-gray-400" /></button>
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
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
