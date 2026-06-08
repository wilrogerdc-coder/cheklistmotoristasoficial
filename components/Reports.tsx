import React, { useState, useMemo, useRef, useEffect } from "react";
import { Justification, LogEntry, AppSettings, User } from "../types";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { FleetDashboard } from "./FleetDashboard";
import {
  FileText,
  Download,
  Printer,
  Calendar,
  Filter,
  ChevronRight,
  AlertCircle,
  BarChart,
  PieChart,
  List,
  Search,
  RefreshCw,
  ChevronLeft,
  X,
  Eye,
  EyeOff,
  Clock,
  Loader2,
  CheckCircle,
  Lock,
  ShieldCheck,
  Shield,
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface ReportsProps {
  logs: LogEntry[];
  settings: AppSettings;
  currentUser: User | null;
  onFetch: (prefix?: string, month?: string) => Promise<void>;
  isLoading?: boolean;
  onUpdateVehicles?: (vehicles: any[]) => void;
  initialPrefix?: string;
  initialReport?: ReportType;
}

type ReportType =
  | "novelties"
  | "synthetic"
  | "analytical"
  | "full"
  | "monthly_grouped"
  | "history"
  | "daily_control"
  | "daily_control_motos"
  | "weekly_leves"
  | "weekly_motos"
  | "weekly_ab"
  | "retroactive_logs"
  | "final_monthly_book"
  | "fleet_dashboard"
  | null;

export const Reports: React.FC<ReportsProps> = ({
  logs,
  settings,
  currentUser,
  onFetch,
  isLoading,
  onUpdateVehicles,
  initialPrefix,
  initialReport
}) => {
  const [activeReport, setActiveReport] = useState<ReportType>(initialReport || null);
  const [monthFilter, setMonthFilter] = useState<string>(() => {
    // Se inicializado com prefixo, default para mês atual
    if (initialPrefix) {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    return "";
  });
  const [monthClosures, setMonthClosures] = useState<any[]>([]);
  const [isClosingMonth, setIsClosingMonth] = useState(false);
  const [showClosureModal, setShowClosureModal] = useState(false);
  const [closureAuth, setClosureAuth] = useState({
    username: "",
    password: "",
  });

  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatureRole, setSignatureRole] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const [sigAuth, setSigAuth] = useState({ username: "", password: "" });
  const [isSigning, setIsSigning] = useState(false);
  const [sigError, setSigError] = useState<string | null>(null);
  const [closureError, setClosureError] = useState<string | null>(null);
  const [showSigPassword, setShowSigPassword] = useState(false);
  const [showClosurePassword, setShowClosurePassword] = useState(false);
  const [justificationAuth, setJustificationAuth] = useState({
    username: "",
    password: "",
  });

  const [justificationDrafts, setJustificationDrafts] = useState<Record<string, string>>({});
  const [showJustificationAuthModal, setShowJustificationAuthModal] = useState(false);
  const [pendingJustification, setPendingJustification] = useState<{
    date: string;
    text: string;
    day: number;
  } | null>(null);

  const fetchMonthClosures = async () => {
    const rawUrl = settings.googleSheetUrl;
    if (!rawUrl) return;
    try {
      const url = `${rawUrl}${rawUrl.includes("?") ? "&" : "?"}action=getAuditLogs&_t=${Date.now()}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setMonthClosures(
            data.filter(
              (l: any) =>
                l.action === "FECHAMENTO_MENSAL" ||
                l.action === "ASSINATURA_DIVERSA",
            ),
          );
        }
      }
    } catch (e) {}
  };

  const getSignature = (roleId: string, customReportType?: string) => {
    const prefix = Array.from(selectedPrefixes)[0];
    if (!prefix || !monthFilter) return null;

    const reportTypeToUse = customReportType || activeReport;

    const sigLog = monthClosures.find((c) => {
      const details = c.details || "";
      return (
        c.action === "ASSINATURA_DIVERSA" &&
        details.includes(`MONTH: ${monthFilter}`) &&
        details.includes(`VTR: ${prefix}`) &&
        details.includes(`ROLE: ${roleId}`) &&
        (reportTypeToUse ? details.includes(`REPORT: ${reportTypeToUse}`) : true)
      );
    });

    if (sigLog) {
      const match = sigLog.details.match(/SIGNED_BY:\s*(.*)$/);
      return {
        user: match ? match[1] : sigLog.user,
        date: sigLog.date,
      };
    }
    return null;
  };

  const handleTriggerSignature = (roleId: string, roleLabel: string) => {
    setSignatureRole({ id: roleId, label: roleLabel });
    setSigAuth({ username: "", password: "" });
    setSigError(null);
    setShowSigPassword(false);
    setShowSignatureModal(true);
  };

  const handleTriggerClosure = () => {
    setClosureAuth({ username: "", password: "" });
    setClosureError(null);
    setShowClosurePassword(false);
    setShowClosureModal(true);
  };

  const handleConfirmSignature = async () => {
    setSigError(null);
    if (!sigAuth.username || !sigAuth.password) {
      setSigError("Por favor, preencha o Usuário e a Senha.");
      return;
    }
    if (!signatureRole || !monthFilter || selectedPrefixes.size !== 1) {
      setSigError("Selecione uma viatura e mês para assinar.");
      return;
    }

    setIsSigning(true);
    const rawUrl = settings.googleSheetUrl;
    if (!rawUrl) {
      setSigError("URL do banco de dados não configurada.");
      setIsSigning(false);
      return;
    }

    try {
      const usersResp = await fetch(
        `${rawUrl}${rawUrl.includes("?") ? "&" : "?"}action=getUsers&_t=${Date.now()}`,
      );
      const users = await usersResp.json();
      const user = users.find(
        (u: any) =>
          u.username.toLowerCase() === sigAuth.username.toLowerCase() &&
          u.password.toString() === sigAuth.password,
      );

      if (!user) {
        setSigError(
          "Usuário ou Senha incorretos. A assinatura digital exige cadastro no sistema.",
        );
        setIsSigning(false);
        return;
      }

      // Validação de Permissão e Papel de Assinatura
      let userPerms = user.permissions || {};
      if (typeof userPerms === 'string') {
        try {
          userPerms = JSON.parse(userPerms);
        } catch (err) {
          userPerms = {};
        }
      }

      const isMaster = user.username.toLowerCase() === 'cavalieri';

      if (!isMaster) {
        if (userPerms.canSign !== true) {
          setSigError("Acesso Negado: Seu usuário não tem permissão geral de 'Permitir Assinar Documentos' ativada.");
          setIsSigning(false);
          return;
        }

        // Validar por papel específico de acordo com a função solicitada
        if (signatureRole.id.startsWith("CH_MOTORISTAS_") || signatureRole.id.startsWith("CH_MOTOS_")) {
          if (userPerms.signAsChefeMotoristas !== true) {
            setSigError("Acesso Negado: Seu usuário não possui a função 'Chefe Motoristas' ativada.");
            setIsSigning(false);
            return;
          }
        } else if (signatureRole.id.startsWith("CMT_PRONTIDAO_")) {
          if (userPerms.signAsCmtProntidao !== true) {
            setSigError("Acesso Negado: Seu usuário não possui a função 'CMT Prontidão' ativada.");
            setIsSigning(false);
            return;
          }
        } else if (signatureRole.id === "CMT_POSTO" || signatureRole.id === "CMT_POSTO_MOTO") {
          if (userPerms.signAsCmtPosto !== true) {
            setSigError("Acesso Negado: Seu usuário não possui a função 'CMT Posto' ativada.");
            setIsSigning(false);
            return;
          }
        } else if (signatureRole.id === "CMT_SGB" || signatureRole.id === "CMT_SGB_MOTO") {
          if (userPerms.signAsCmtSgb !== true) {
            setSigError("Acesso Negado: Seu usuário não possui a função 'CMT SGB' ativada.");
            setIsSigning(false);
            return;
          }
        }
      }

      const prefix = Array.from(selectedPrefixes)[0];
      const signatureData = {
        action: "saveAuditLog",
        date: new Date().toLocaleString("pt-BR", {
          timeZone: "America/Sao_Paulo",
        }),
        user: `${user.rank || ""} ${user.name || user.username}`.trim(),
        actionLog: "ASSINATURA_DIVERSA",
        details: `SIGNATURE | MONTH: ${monthFilter} | VTR: ${prefix} | ROLE: ${signatureRole.id} | REPORT: ${activeReport} | SIGNED_BY: ${user.rank || ""} ${user.name || user.username}`,
      };

      await fetch(rawUrl, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(signatureData),
      });

      alert(`Assinatura registrada com sucesso para: ${signatureRole.label}!`);
      setShowSignatureModal(false);
      setSigAuth({ username: "", password: "" });
      setSignatureRole(null);
      setSigError(null);
      fetchMonthClosures();
    } catch (e) {
      setSigError("Erro operacional ao registrar assinatura digital.");
      console.error(e);
    } finally {
      setIsSigning(false);
    }
  };

  const handleConfirmJustificationAuth = async () => {
    if (!pendingJustification || !justificationAuth.username || !justificationAuth.password) {
      alert("Por favor, informe Usuário e Senha.");
      return;
    }

    const rawUrl = settings.googleSheetUrl;
    if (!rawUrl) {
      alert("URL do banco de dados não configurada.");
      return;
    }

    setIsSigning(true);
    try {
      const usersResp = await fetch(`${rawUrl}${rawUrl.includes('?') ? '&' : '?'}action=getUsers&_t=${Date.now()}`);
      const users = await usersResp.json();
      const user = users.find((u: any) => 
        u.username.toLowerCase() === justificationAuth.username.toLowerCase() && 
        u.password.toString() === justificationAuth.password
      );

      if (!user) {
        alert("Usuário ou Senha incorretos.");
        setIsSigning(false);
        return;
      }

      // Permissions check (same as in modal)
      let userPerms = user.permissions || {};
      if (typeof userPerms === 'string') {
        try { userPerms = JSON.parse(userPerms); } catch (err) { userPerms = {}; }
      }
      const isMaster = user.username.toLowerCase() === 'cavalieri';
      if (!isMaster) {
        if (userPerms.canSign !== true || userPerms.signAsChefeMotoristas !== true) {
          alert("Acesso Negado: Seu usuário não tem permissão de Chefe dos Motoristas.");
          setIsSigning(false);
          return;
        }
      }

      const prefix = Array.from(selectedPrefixes)[0];
      const jData: Justification = {
        id: crypto.randomUUID(),
        date: pendingJustification.date,
        dateRef: pendingJustification.date,
        type: activeReport || "GERAL",
        vehicleType: prefix,
        justification: pendingJustification.text,
        author: `${user.rank || ''} ${user.name || user.username}`.trim(),
        authorRank: user.rank || (user.permissions?.signAsChefeMotoristas ? "CHEFE DOS MOTORISTAS" : (user.rank || "SUPERVISOR")),
        createdAt: new Date().toISOString(),
        month: monthFilter,
        status: "SIGNED" as const,
        station: prefix,
      };

      // Force immediate local update with cloned array to trigger re-render
      const newJustification: Justification = { ...jData };
      setJustifications(prev => {
        // Check if it already exists (to avoid duplicates)
        const exists = prev.find(j => 
          (j.id === newJustification.id) || 
          (j.date === newJustification.date && j.vehicleType === newJustification.vehicleType && j.type === newJustification.type)
        );
        if (exists) return prev;
        return [...prev, newJustification];
      });

      const payload = {
        ...newJustification,
        action: "saveJustification",
      };

      // Send to server (don't await to keep UI responsive)
      fetch(rawUrl, {
        method: "POST",
        mode: "no-cors",
        body: JSON.stringify(payload),
      })
      .then(() => {
        console.log("Justification sent successfully to server");
        // We could sync after a longer delay if we wanted to
      })
      .catch(err => {
        console.error("Sync error:", err);
        alert("Erro na conexão com o banco de dados, mas o registro foi salvo localmente.");
      });

      alert("REGISTRO REALIZADO E ASSINADO COM SUCESSO!");
      setShowJustificationAuthModal(false);
      setPendingJustification(null);
      setJustificationAuth({ username: "", password: "" });
      
      // Clear draft for this day
      setJustificationDrafts(prev => {
        const next = { ...prev };
        delete next[pendingJustification.day];
        return next;
      });

      // NO REFRESH HERE to prevent stale fetch from overwriting local state
    } catch (e) {
      alert("Erro ao salvar justificativa.");
    } finally {
      setIsSigning(false);
    }
  };

  const [selectedPrefixes, setSelectedPrefixes] = useState<Set<string>>(
    initialPrefix ? new Set([initialPrefix]) : new Set(),
  );
  const [prefixSearch, setPrefixSearch] = useState<string>("");
  const [postoFilter, setPostoFilter] = useState<string>("");
  const [bookConfig, setBookConfig] = useState({
    includeDaily: true,
    includeJustifications: true,
    includeWeekly: false,
    includeNovelties: false,
    includeSynthetic: false,
    includeAnalytical: false,
  });
  const [justifications, setJustifications] = useState<Justification[]>(() => {
    // Try to load from localStorage on init
    try {
      const saved = localStorage.getItem("checkviatura_justifications");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Persist to localStorage whenever changed
  useEffect(() => {
    localStorage.setItem("checkviatura_justifications", JSON.stringify(justifications));
  }, [justifications]);
  const [isFetchingJustifications, setIsFetchingJustifications] =
    useState(false);
  const [showJustificationModal, setShowJustificationModal] = useState(false);
  const [newJustification, setNewJustification] = useState({
    date: "",
    justification: "",
    author: "",
    authorRank: "",
  });

  useEffect(() => {
    if (showJustificationModal && currentUser) {
      setNewJustification((prev) => ({
        ...prev,
        author: prev.author || currentUser.name || currentUser.username,
        authorRank: prev.authorRank || currentUser.rank || "",
      }));
    }
  }, [showJustificationModal, currentUser]);

  const fetchJustifications = async () => {
    const rawUrl = settings.googleSheetUrl;
    if (!rawUrl) return;
    setIsFetchingJustifications(true);
    try {
      const url = `${rawUrl}${rawUrl.includes("?") ? "&" : "?"}action=getJustifications&_t=${Date.now()}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          // Santize data keys to ensure consistency
          const sanitized = data.map((item: any) => {
            const getValueByKeys = (keys: string[]) => {
              for (const k of keys) {
                if (item[k] !== undefined) return item[k];
                if (item[k.toLowerCase()] !== undefined) return item[k.toLowerCase()];
                if (item[k.toUpperCase()] !== undefined) return item[k.toUpperCase()];
              }
              const upperKeys = keys.map(k => k.toUpperCase());
              for (const ik of Object.keys(item)) {
                const normalizedIk = ik.toUpperCase().replace(/[\s_]/g, '');
                if (upperKeys.includes(normalizedIk) || upperKeys.map(k => k.replace(/[\s_]/g, '')).includes(normalizedIk)) {
                  return item[ik];
                }
              }
              return undefined;
            };

            const id = getValueByKeys(['id', 'ID']) || crypto.randomUUID();
            const dateVal = getValueByKeys(['date', 'dateRef', 'DATA_REFERENCIA', 'data_referencia']) || "";
            const jType = getValueByKeys(['type', 'tipo', 'TIPO']) || "GERAL";
            const vehicleType = getValueByKeys(['vehicleType', 'vehicle_type', 'TIPO_VEICULO', 'tipo_veiculo', 'station', 'posto']) || "";
            const station = getValueByKeys(['station', 'posto', 'POSTO', 'vehicleType']) || "";
            const justification = getValueByKeys(['justification', 'JUSTIFICATIVA', 'justificativa', 'obs', 'OBS']) || "";
            const author = getValueByKeys(['author', 'AUTOR', 'autor', 'user', 'USER']) || "";
            const authorRank = getValueByKeys(['authorRank', 'author_rank', 'RE', 're', 'rank', 'RANK']) || "";
            const createdAt = getValueByKeys(['createdAt', 'created_at', 'CRIADO_EM', 'criado_em', 'time']) || new Date().toISOString();
            const rawMonth = getValueByKeys(['month', 'MES', 'mes']) || "";
            const month = rawMonth ? normalizeMonthString(rawMonth) : (dateVal ? parseLogDateToMonth(dateVal) : "");
            const status = getValueByKeys(['status', 'STATUS']) || "SIGNED";

            return {
              id,
              date: dateVal,
              type: jType,
              vehicleType,
              station,
              justification,
              author,
              authorRank,
              createdAt,
              month,
              status
            };
          });

          setJustifications(prev => {
            const fetchedIds = new Set(sanitized.map(j => j.id));
            const locals = prev.filter(j => !fetchedIds.has(j.id));
            return [...sanitized, ...locals];
          });
        }
      }
    } catch (e) {
      console.error("Erro ao buscar justificativas:", e);
    } finally {
      setIsFetchingJustifications(false);
    }
  };

  useEffect(() => {
    if (activeReport && selectedPrefixes.size > 0) {
      fetchMonthClosures();
      fetchJustifications();
    }
  }, [activeReport, monthFilter, selectedPrefixes]);

  const handleMonthClosure = async () => {
    setClosureError(null);
    if (!closureAuth.username || !closureAuth.password) {
      setClosureError("Informe usuário e senha para assinar o fechamento.");
      return;
    }

    setIsClosingMonth(true);
    const rawUrl = settings.googleSheetUrl;
    if (!rawUrl) {
      setClosureError("URL do banco de dados não configurada.");
      setIsClosingMonth(false);
      return;
    }

    try {
      // Validar usuário
      const usersResp = await fetch(
        `${rawUrl}${rawUrl.includes("?") ? "&" : "?"}action=getUsers&_t=${Date.now()}`,
      );
      const users = await usersResp.json();
      const user = users.find(
        (u: any) =>
          u.username.toLowerCase() === closureAuth.username.toLowerCase() &&
          u.password.toString() === closureAuth.password,
      );

      if (!user) {
        setClosureError("Usuário ou Senha incorretos. O fechamento exige cadastro ativo.");
        setIsClosingMonth(false);
        return;
      }

      // Validação de Permissão e Papel de Assinatura para Fechamento Mensal
      let userPerms = user.permissions || {};
      if (typeof userPerms === 'string') {
        try {
          userPerms = JSON.parse(userPerms);
        } catch (err) {
          userPerms = {};
        }
      }

      const isMaster = user.username.toLowerCase() === 'cavalieri';

      if (!isMaster) {
        if (userPerms.canSign !== true || userPerms.signAsChefeMotoristas !== true) {
          setClosureError("Acesso Negado: Seu usuário não tem permissão para realizar o Fechamento Mensal como CHEFE DOS MOTORISTAS.");
          setIsClosingMonth(false);
          return;
        }
      }

      // Salvar log de fechamento
      const prefix = Array.from(selectedPrefixes)[0];
      const closureData = {
        action: "saveAuditLog",
        date: new Date().toLocaleString("pt-BR", {
          timeZone: "America/Sao_Paulo",
        }),
        user: `${user.rank || ""} ${user.name || user.username}`.trim(),
        actionLog: "FECHAMENTO_MENSAL",
        details: `FECHAMENTO MENSAL: ${monthFilter} | VTR: ${prefix} | ASSINADO POR: ${user.rank} ${user.name}`,
      };

      await fetch(rawUrl, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(closureData),
      });

      alert("Mês encerrado com sucesso!");
      setShowClosureModal(false);
      setClosureAuth({ username: "", password: "" });
      setClosureError(null);
      fetchMonthClosures();
    } catch (e) {
      setClosureError("Erro operacional ao realizar fechamento no banco.");
      console.error(e);
    } finally {
      setIsClosingMonth(false);
    }
  };

  // Carregamento inicial automático ao abrir a aba de relatórios
  React.useEffect(() => {
    // Removido o carregamento automático redundante que causava loop infinito em caso de erro.
    // O carregamento inicial agora é gerenciado pelo componente pai (Settings).
    console.log(
      `Reports montado. logs.length=${logs.length}, isLoading=${isLoading}`,
    );
  }, []);

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(
    {
      date: true,
      prefix: true,
      plate: true,
      km: true,
      type: true,
      inspector: true,
      status: true,
      obs: true,
      id: false,
      details: false,
    },
  );
  const [statusFilter, setStatusFilter] = useState<"all" | "ok" | "cn">("all");
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [autoPrint, setAutoPrint] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [viewingJsonData, setViewingJsonData] = useState<{
    data: any;
    title: string;
    subtitle: string;
  } | null>(null);
  const printMirrorRef = useRef<HTMLDivElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const normalizePrefix = (p: any) =>
    String(p || "")
      .replace(/[-\s]/g, "")
      .toUpperCase();

  const getItemStatusFromLog = (
    log: LogEntry,
    itemLabel: string,
  ): { val: string; colorClass: string } => {
    let val = "";
    let colorClass = "";

    if (log.vehicleStatus === "BAIXADA") {
      return { val: "BX", colorClass: "text-red-600" };
    } else if (log.vehicleStatus === "RESERVA") {
      return { val: "RS", colorClass: "text-orange-600" };
    }

    let details: any[] = [];
    try {
      if (log.itemsDetail) {
        details = JSON.parse(log.itemsDetail);
      } else {
        const full = getFullData(log);
        if (full && Array.isArray(full.items)) {
          details = full.items;
        } else if (full && typeof full === "object") {
          // Em alguns logs antigos pode estar em uma estrutura diferente
          const possibleItems =
            full.checklistItems || full.InspectionItems || [];
          if (Array.isArray(possibleItems)) details = possibleItems;
        }
      }
    } catch (e) {}

    if (details.length > 0) {
      const item = details.find((det: any) => {
        const label = det.label || det.description || "";
        return label.trim().toLowerCase() === itemLabel.trim().toLowerCase();
      });
      if (item) {
        const status = item.status;
        if (status === "SN" || status === "OK" || status === "S") {
          val = "OK";
        } else if (status === "CN" || status === "N") {
          val = "CN";
          colorClass = "text-red-700 bg-red-50";
        }
      }
    }

    return { val, colorClass };
  };

  const getFullData = (log: LogEntry): any => {
    const rawData = log.fullData || (log as any).fulldata;
    if (!rawData) return null;
    if (typeof rawData === "object") return rawData;
    if (typeof rawData === "string" && rawData.trim().startsWith("{")) {
      try {
        return JSON.parse(rawData);
      } catch (e) {
        console.error("Erro parse fullData", e);
      }
    }
    return null;
  };

  function normalizeMonthString(mStr: string | any): string {
    if (!mStr) return "";
    const trimmed = String(mStr).trim();
    // check if format is YYYY-MM or YYYY-M
    const match = trimmed.match(/^(\d{4})-(\d{1,2})$/);
    if (match) {
      return `${match[1]}-${match[2].padStart(2, "0")}`;
    }
    // check if format is YYYY/MM or YYYY/M
    const slashMatchYM = trimmed.match(/^(\d{4})\/(\d{1,2})$/);
    if (slashMatchYM) {
      return `${slashMatchYM[1]}-${slashMatchYM[2].padStart(2, "0")}`;
    }
    // Also try to parse using date components if it's a full date string like "2026-06-01T03:00:00.000Z"
    const comps = parseDateToComponents(trimmed);
    if (comps) {
      return `${comps.year}-${comps.month.toString().padStart(2, "0")}`;
    }
    return trimmed;
  }

  function parseDateToComponents(dateStr: any): { year: number, month: number, day: number } | null {
    if (!dateStr) return null;
    const s = String(dateStr).trim();
    const baseStr = s.split('T')[0].split(' ')[0];

    // Dash format: YYYY-MM-DD
    const dashMatch = baseStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (dashMatch) {
      return {
        year: parseInt(dashMatch[1], 10),
        month: parseInt(dashMatch[2], 10),
        day: parseInt(dashMatch[3], 10)
      };
    }

    // Reverse dash format: DD-MM-YYYY
    const revDashMatch = baseStr.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (revDashMatch) {
      return {
        year: parseInt(revDashMatch[3], 10),
        month: parseInt(revDashMatch[2], 10),
        day: parseInt(revDashMatch[1], 10)
      };
    }

    // Slash format: DD/MM/YYYY
    const slashMatch = baseStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
      return {
        year: parseInt(slashMatch[3], 10),
        month: parseInt(slashMatch[2], 10),
        day: parseInt(slashMatch[1], 10)
      };
    }

    // Slash format: YYYY/MM/DD
    const slashMatchYMD = baseStr.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (slashMatchYMD) {
      return {
        year: parseInt(slashMatchYMD[1], 10),
        month: parseInt(slashMatchYMD[2], 10),
        day: parseInt(slashMatchYMD[3], 10)
      };
    }

    // Fallback: system Date parsing
    try {
      const dObj = new Date(dateStr);
      if (!isNaN(dObj.getTime())) {
        const isUTC = s.includes('Z') || s.includes('GMT+0000') || s.includes('UTC');
        return {
          year: isUTC ? dObj.getUTCFullYear() : dObj.getFullYear(),
          month: isUTC ? (dObj.getUTCMonth() + 1) : (dObj.getMonth() + 1),
          day: isUTC ? dObj.getUTCDate() : dObj.getDate()
        };
      }
    } catch (e) {}

    return null;
  }

  function isDateMatch(dateStr: any, targetYear: number, targetMonth: number, targetDay: number): boolean {
    const comps = parseDateToComponents(dateStr);
    if (!comps) return false;
    return comps.year === targetYear && comps.month === targetMonth && comps.day === targetDay;
  }

  function parseLogDateToMonth(dateStr: string): string {
    const comps = parseDateToComponents(dateStr);
    if (!comps) return "";
    return `${comps.year}-${comps.month.toString().padStart(2, "0")}`;
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    // Se já parece formatado pt-BR (contém / e :)
    if (dateStr.includes("/") && dateStr.includes(":")) return dateStr;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString("pt-BR");
    } catch (e) {
      return dateStr;
    }
  };

  const handlePrintMirror = () => {
    if (printMirrorRef.current) window.print();
  };

  const generateReportPdf = async (openInNewTab: boolean = false) => {
    if (!reportRef.current || !activeReport) return;

    setIsGeneratingPdf(true);
    try {
      const element = reportRef.current;

      // Capturar o conteúdo interno para evitar cortes do container com scroll
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        width: element.scrollWidth,
        height: element.scrollHeight,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
        onclone: (clonedDoc) => {
          const clonedElement =
            (clonedDoc.querySelector(
              '[data-pdf-content="report"]',
            ) as HTMLElement) ||
            (clonedDoc.querySelector(
              ".bg-white.p-8.rounded-\\[2\\.5rem\\]",
            ) as HTMLElement);
          if (clonedElement) {
            clonedElement.style.overflow = "visible";
            clonedElement.style.height = "auto";
            clonedElement.style.maxHeight = "none";
            clonedElement.style.borderRadius = "0";
            clonedElement.style.border = "none";
            clonedElement.style.boxShadow = "none";
          }
        },
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgProps = pdf.getImageProperties(imgData);
      const contentHeight = (imgProps.height * pdfWidth) / imgProps.width;

      let heightLeft = contentHeight;
      let position = 0;

      // Primeira página
      pdf.addImage(imgData, "PNG", 0, position, pdfWidth, contentHeight);
      heightLeft -= pdfHeight;

      // Páginas subsequentes
      while (heightLeft > 0) {
        position = heightLeft - contentHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, pdfWidth, contentHeight);
        heightLeft -= pdfHeight;
      }

      const fileName = `Relatorio_${activeReport.toUpperCase()}_${new Date().toISOString().split("T")[0]}.pdf`;

      if (openInNewTab) {
        const blobUrl = pdf.output("bloburl");
        window.open(blobUrl, "_blank");
      } else {
        pdf.save(fileName);
      }
    } catch (error) {
      console.error("Erro ao gerar PDF do relatório:", error);
      alert("Ocorreu um erro ao gerar o arquivo PDF.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const generatePdf = async (openInNewTab: boolean = false) => {
    if (!printMirrorRef.current || !selectedLog) return;

    setIsGeneratingPdf(true);
    try {
      const element = printMirrorRef.current;

      // Capturar o conteúdo interno para evitar cortes do container com scroll
      const contentElement =
        (element.querySelector('[data-pdf-content="audit"]') as HTMLElement) ||
        (element.querySelector(".max-w-4xl") as HTMLElement) ||
        element;

      const canvas = await html2canvas(contentElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        width: contentElement.scrollWidth,
        height: contentElement.scrollHeight,
        windowWidth: contentElement.scrollWidth,
        windowHeight: contentElement.scrollHeight,
        onclone: (clonedDoc) => {
          // No clone, garantimos que o elemento capturado esteja totalmente expandido
          const clonedElement =
            (clonedDoc.querySelector(
              '[data-pdf-content="audit"]',
            ) as HTMLElement) ||
            (clonedDoc.querySelector(".max-w-4xl") as HTMLElement);
          if (clonedElement) {
            clonedElement.style.overflow = "visible";
            clonedElement.style.height = "auto";
            clonedElement.style.maxHeight = "none";
          }
        },
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgProps = pdf.getImageProperties(imgData);
      const contentHeight = (imgProps.height * pdfWidth) / imgProps.width;

      let heightLeft = contentHeight;
      let position = 0;

      // Primeira página
      pdf.addImage(imgData, "PNG", 0, position, pdfWidth, contentHeight);
      heightLeft -= pdfHeight;

      // Páginas subsequentes
      while (heightLeft > 0) {
        position = heightLeft - contentHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, pdfWidth, contentHeight);
        heightLeft -= pdfHeight;
      }

      const fileName = `Relatorio_Auditoria_${selectedLog.prefix}_${String(selectedLog.date || "").replace(/[/\\?%*:|"<>]/g, "-")}.pdf`;

      if (openInNewTab) {
        const blobUrl = pdf.output("bloburl");
        window.open(blobUrl, "_blank");
      } else {
        pdf.save(fileName);
      }
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      alert(
        "Ocorreu um erro ao gerar o arquivo PDF. Tente usar a opção de imprimir.",
      );
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  React.useEffect(() => {
    if (selectedLog && autoPrint) {
      const timer = setTimeout(() => {
        handlePrintMirror();
        setAutoPrint(false);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [selectedLog, autoPrint]);

  const getInspector = (log: LogEntry) => {
    return String(
      log.inspector ||
        log.Inspetor ||
        log.inspetor ||
        log.conferente ||
        "NÃO IDENTIFICADO",
    ).trim();
  };

  const uniquePrefixes = useMemo(() => {
    const prefixes = new Set<string>();
    logs.forEach((log) => {
      const norm = normalizePrefix(log.prefix);
      if (norm) prefixes.add(norm);
    });
    return Array.from(prefixes).sort();
  }, [logs]);

  const uniqueStations = useMemo(() => {
    const stations = new Set<string>();
    if (settings.stations && settings.stations.length > 0) {
      settings.stations.forEach((s) => {
        if (s.name) stations.add(s.name);
      });
    }
    settings.vehicles?.forEach((v) => {
      if (v.station) stations.add(v.station);
    });
    return Array.from(stations).sort();
  }, [settings.stations, settings.vehicles]);

  const visiblePrefixes = useMemo(() => {
    return uniquePrefixes.filter((prefix) => {
      const matchesSearch =
        !prefixSearch ||
        prefix.includes(normalizePrefix(prefixSearch));

      if (!postoFilter) return matchesSearch;
      const vehicle = settings.vehicles?.find(
        (v) => normalizePrefix(v.prefix) === prefix,
      );
      return (
        matchesSearch &&
        vehicle &&
        normalizePrefix(vehicle.station) === normalizePrefix(postoFilter)
      );
    });
  }, [uniquePrefixes, prefixSearch, postoFilter, settings.vehicles]);

  const uniqueMonths = useMemo(() => {
    const months = new Set<string>();
    logs.forEach((log) => {
      const month = parseLogDateToMonth(log.date);
      if (month) months.add(month);
    });
    return Array.from(months).sort((a, b) => b.localeCompare(a)); // Mais recentes primeiro
  }, [logs]);

  const getMonthLabel = (monthStr: string) => {
    if (!monthStr) return "Todos os Meses";
    const [year, month] = monthStr.split("-");
    const months = [
      "Janeiro",
      "Fevereiro",
      "Março",
      "Abril",
      "Maio",
      "Junho",
      "Julho",
      "Agosto",
      "Setembro",
      "Outubro",
      "Novembro",
      "Dezembro",
    ];
    return `${months[parseInt(month) - 1]}/${year}`;
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const logMonth = parseLogDateToMonth(log.date);
      const matchesMonth = !monthFilter || logMonth === monthFilter;

      const normLogPrefix = normalizePrefix(log.prefix);
      const matchesPrefix =
        selectedPrefixes.size === 0 || selectedPrefixes.has(normLogPrefix);

      return matchesMonth && matchesPrefix;
    });
  }, [logs, monthFilter, selectedPrefixes]);

  const togglePrefix = (prefix: string) => {
    const newSelected = new Set(selectedPrefixes);
    if (newSelected.has(prefix)) {
      newSelected.delete(prefix);
    } else {
      newSelected.add(prefix);
    }
    setSelectedPrefixes(newSelected);
  };

  const selectAllPrefixes = () => {
    const newSelected = new Set(selectedPrefixes);
    visiblePrefixes.forEach((p) => newSelected.add(p));
    setSelectedPrefixes(newSelected);
  };

  const deselectAllPrefixes = () => {
    const newSelected = new Set(selectedPrefixes);
    visiblePrefixes.forEach((p) => newSelected.delete(p));
    setSelectedPrefixes(newSelected);
  };

  const handlePrint = () => {
    window.print();
  };

  const Watermark = () => {
    if (!settings.watermarkUrl) return null;
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.12] z-0 overflow-hidden">
        <img
          src={settings.watermarkUrl}
          alt="Watermark"
          className="w-4/5 h-auto object-contain grayscale"
          style={{ mixBlendMode: "multiply" }}
        />
      </div>
    );
  };

  const renderDailyControlReport = (customPrefix?: string) => {
    const prefixesArray = Array.from(selectedPrefixes);
    if (!customPrefix && prefixesArray.length !== 1) {
      return (
        <div className="p-10 text-center flex flex-col items-center gap-4 text-gray-400 font-bold uppercase">
          <AlertCircle className="w-12 h-12 text-blue-500 mb-4" />
          Selecione uma única viatura para gerar este relatório.
        </div>
      );
    }

    if (!monthFilter) {
      return (
        <div className="p-10 text-center flex flex-col items-center gap-4 text-gray-400 font-bold uppercase">
          <Calendar className="w-12 h-12 text-blue-500 mb-4" />
          Selecione um mês de referência.
        </div>
      );
    }

    const selectedPrefix = customPrefix || prefixesArray[0];
    const vehicle = settings.vehicles?.find(
      (v) => normalizePrefix(v.prefix) === selectedPrefix,
    );

    const [year, month] = monthFilter.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const getDayColor = (d: number) => {
      const refDate = new Date(2026, 0, 1);
      const curDate = new Date(year, month - 1, d);
      const diffDays = Math.round((curDate.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24));
      let idx = diffDays % 3;
      if (idx < 0) idx += 3;
      const colors = ["bg-[#4ade80]", "bg-[#facc15]", "bg-[#60a5fa]"];
      return colors[idx];
    };

    const targetLogs = logs.filter((log) => {
      const matchPrefix = normalizePrefix(log.prefix) === normalizePrefix(selectedPrefix);
      const logMonth = parseLogDateToMonth(log.date);
      const matchMonth = !monthFilter || logMonth === monthFilter;
      return matchPrefix && matchMonth;
    });

    const logsByDay: Record<number, LogEntry> = {};
    targetLogs.forEach((log) => {
      if (parseLogDateToMonth(log.date) === monthFilter) {
        let dd = 0;
        const dateStr = String(log.date);
        if (dateStr.includes("-")) {
          const parts = dateStr.split("T")[0].split("-");
          if (parts.length === 3) dd = parseInt(parts[2]);
        } else if (dateStr.includes("/")) {
          const parts = dateStr.split("/");
          if (parts.length >= 1) dd = parseInt(parts[0]);
        }

        if (dd > 0) {
          if (
            !logsByDay[dd] ||
            new Date(log.date).getTime() > new Date(logsByDay[dd].date).getTime()
          ) {
            logsByDay[dd] = log;
          }
        }
      }
    });

    let reportItems: string[] = [];
    if (settings.defaultItems) {
      reportItems = settings.defaultItems
        .filter(
          (item) =>
            (item.frequency === "Diário" || item.frequency === "Ambos") &&
            (!vehicle ||
              !item.vehicleTypes ||
              item.vehicleTypes.includes(vehicle.type)),
        )
        .map((i) => i.label);
    }

    const displayItemsCount = 30;
    const displayItems = reportItems.slice(0, displayItemsCount);
    while (displayItems.length < displayItemsCount) displayItems.push("");

    let countOperando = 0,
      countBaixada = 0,
      countReserva = 0;
    Object.values(logsByDay).forEach((log) => {
      if (log.vehicleStatus === "OPERANDO") countOperando++;
      else if (log.vehicleStatus === "BAIXADA") countBaixada++;
      else if (log.vehicleStatus === "RESERVA") countReserva++;
    });

    return (
      <>
        <div
          className="space-y-1 mx-auto print:p-0 print:m-0 relative"
          style={{ maxWidth: "297mm" }}
        >
          <style>{`
            @media print {
              @page { size: landscape; margin: 5mm; }
              body { 
                -webkit-print-color-adjust: exact; 
                counter-reset: page;
              }
              .page-footer {
                position: fixed;
                bottom: 0;
                width: 100%;
              }
              .page-number:after {
                counter-increment: page;
                content: counter(page);
              }
            }
            .vertical-text {
              writing-mode: vertical-rl;
              transform: rotate(180deg);
              white-space: nowrap;
            }
            .ficha-table th, .ficha-table td {
               border: 1px solid black !important;
               padding: 1px !important;
               line-height: 1 !important;
            }
          `}</style>

          {/* Top Header conforming to image */}
          <div className="flex items-stretch border border-black overflow-hidden bg-white mb-0.5">
            <div className="w-24 border-r border-black p-1 flex items-center justify-center bg-white">
              {settings.headerLogoUrl1 && (
                <img
                  src={settings.headerLogoUrl1}
                  className="h-12 object-contain"
                  alt="Logo 1"
                />
              )}
            </div>
            <div className="flex-1 bg-[#00e5ff] text-center flex flex-col items-center justify-center py-1">
              <h1 className="text-[11px] font-black uppercase leading-tight">
                {settings.reportTitle ||
                  "Ficha de Controle do Check List Diário de Viaturas Leves e Pesadas"}
              </h1>
            </div>
            <div className="w-24 border-l border-black p-1 flex items-center justify-center bg-white">
              {settings.headerLogoUrl2 ? (
                <img
                  src={settings.headerLogoUrl2}
                  className="h-12 object-contain"
                  alt="Logo 2"
                />
              ) : (
                <span className="text-[6px] font-black uppercase text-center text-gray-300">
                  LOGO 2
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-5 border border-black text-[8px] font-black uppercase bg-white">
            <div className="border-r border-black px-1 py-0.5">
              Prefixo da VTR:{" "}
              <span className="ml-1 text-[9px]">{selectedPrefix}</span>
            </div>
            <div className="border-r border-black px-1 py-0.5">
              Posto: <span className="ml-1 text-[9px]">{vehicle?.station}</span>
            </div>
            <div className="border-r border-black px-1 py-0.5">
              GB: <span className="ml-1 text-[9px]">{vehicle?.gb}</span>
            </div>
            <div className="border-r border-black px-1 py-0.5 text-center">
              Mês:{" "}
              <span className="ml-1 text-[9px]">
                {getMonthLabel(monthFilter).toUpperCase()}
              </span>
            </div>
            <div className="px-1 py-0.5">Observações:</div>
          </div>

          <table className="w-full ficha-table border-collapse text-[7.5px] font-black">
            <thead>
              <tr>
                <th className="w-[150px] text-left px-2 bg-gray-100">DATA</th>
                {days.map((d) => (
                  <th
                    key={d}
                    className={`w-[25px] text-center border-l border-black ${getDayColor(d)}`}
                  >
                    {d}
                  </th>
                ))}
              </tr>
              <tr className="bg-red-600 text-white">
                <th className="text-left px-2 uppercase">
                  Item de Verificação Técnica
                </th>
                {days.map((d) => (
                  <th key={d} className="border-l border-black"></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayItems.map((itemLabel, rowIdx) => (
                <tr key={rowIdx} className={itemLabel ? "" : "h-4"}>
                  <td
                    className={`px-2 border border-black ${itemLabel ? "" : "bg-gray-50"}`}
                  >
                    {itemLabel
                      ? `${rowIdx + 1}. ${itemLabel.slice(0, 50)}`
                      : ""}
                  </td>
                  {days.map((d) => {
                    const log = logsByDay[d];
                    let { val, colorClass } = log
                      ? getItemStatusFromLog(log, itemLabel)
                      : { val: "", colorClass: "" };

                    if (!log) {
                      // Remoção da verificação de justificativa na Ficha de Controle Diário
                      // conforme solicitação do usuário para manter apenas na Folha de Justificativas
                    }
                    return (
                      <td
                        key={d}
                        className={`text-center font-black border border-black ${colorClass}`}
                      >
                        {val}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* Linha NOME - Ajustada para ser idêntica ao RE e evitar expansão */}
              <tr className="h-[85px]">
                <td className="bg-[#e8f5e9] text-center border border-black">
                  <div className="vertical-text mx-auto font-black text-[9px] tracking-widest h-[85px] flex items-center justify-center">
                    NOME
                  </div>
                </td>
                {days.map((d) => {
                  const log = logsByDay[d];
                  if (log) {
                    const full = getFullData(log);
                    const name = (full?.signatureName || "").toUpperCase();
                    return (
                      <td
                        key={d}
                        className="p-0 border border-black overflow-hidden h-[85px]"
                      >
                        <div className="vertical-text mx-auto text-[7px] leading-tight font-black h-[85px] flex items-center justify-center uppercase overflow-hidden">
                          {name.substring(0, 20)}
                        </div>
                      </td>
                    );
                  } else {
                    // Verificar Justificativa
                    const dayStr = `${year}-${month.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
                    const justification = justifications.find(
                      (j) =>
                        normalizeMonthString(j.month) === normalizeMonthString(monthFilter) &&
                        normalizePrefix(j.vehicleType) ===
                          normalizePrefix(selectedPrefix) &&
                        isDateMatch(j.date || (j as any).dateRef, year, month, d),
                    );
                    if (justification) {
                      return (
                        <td
                          key={d}
                          className="p-0 border border-black overflow-hidden h-[85px] bg-purple-50"
                        >
                          <div className="vertical-text mx-auto text-[7px] leading-tight font-black h-[85px] flex items-center justify-center uppercase overflow-hidden text-purple-700">
                            {justification.author
                              .substring(0, 20)
                              .toUpperCase()}
                          </div>
                        </td>
                      );
                    }
                    return <td key={d} className="border border-black"></td>;
                  }
                })}
              </tr>

              {/* Linha RE - Base de comparação e idêntica ao NOME */}
              <tr className="h-[85px]">
                <td className="bg-[#e8f5e9] text-center border border-black">
                  <div className="vertical-text mx-auto font-black text-[9px] tracking-widest h-[85px] flex items-center justify-center">
                    RE
                  </div>
                </td>
                {days.map((d) => {
                  const log = logsByDay[d];
                  if (log) {
                    const full = getFullData(log);
                    const re = full?.signatureRank || "";
                    return (
                      <td
                        key={d}
                        className="p-0 border border-black overflow-hidden h-[85px]"
                      >
                        <div className="vertical-text mx-auto text-[8px] font-black h-[85px] flex items-center justify-center overflow-hidden">
                          {re}
                        </div>
                      </td>
                    );
                  } else {
                    // Verificar Justificativa
                    const dayStr = `${year}-${month.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
                    const justification = justifications.find(
                      (j) =>
                        normalizeMonthString(j.month) === normalizeMonthString(monthFilter) &&
                        normalizePrefix(j.vehicleType) ===
                          normalizePrefix(selectedPrefix) &&
                        isDateMatch(j.date || (j as any).dateRef, year, month, d),
                    );
                    if (justification) {
                      return (
                        <td
                          key={d}
                          className="p-0 border border-black overflow-hidden h-[85px] bg-purple-50"
                        >
                          <div className="vertical-text mx-auto text-[8px] font-black h-[85px] flex items-center justify-center overflow-hidden text-purple-700">
                            {justification.authorRank}
                          </div>
                        </td>
                      );
                    }
                    return <td key={d} className="border border-black"></td>;
                  }
                })}
              </tr>
            </tbody>
          </table>

          {/* Footer Conforming to image layout */}
          <div className="mt-2 text-[8px] font-black uppercase">
            <div className="grid grid-cols-4 gap-4">
              {/* Legenda Col 1 */}
              <div className="space-y-0.5">
                <div className="flex border border-black">
                  <div className="w-16 border-r border-black px-1 font-bold">
                    LEGENDA:
                  </div>
                  <div className="w-10 border-r border-black px-1 text-center">
                    OK
                  </div>
                  <div className="flex-1 px-1">SEM NOVIDADES</div>
                </div>
                <div className="flex border border-black">
                  <div className="w-16 border-r border-black px-1"></div>
                  <div className="w-10 border-r border-black px-1 text-center">
                    CN
                  </div>
                  <div className="flex-1 px-1">COM NOVIDADES</div>
                </div>
              </div>

              {/* Status do Mês Col 2 */}
              <div className="space-y-0.5">
                <div className="text-center border-x border-t border-black bg-gray-100 py-0.5">
                  STATUS DO MÊS
                </div>
                <div className="grid grid-cols-3 border border-black">
                  <div className="border-r border-black px-1">OPERANDO</div>
                  <div className="border-r border-black px-1 text-center">
                    {countOperando}
                  </div>
                  <div className="px-1 text-right">DIAS</div>
                </div>
                <div className="grid grid-cols-3 border-x border-b border-black">
                  <div className="border-r border-black px-1">BAIXADA</div>
                  <div className="border-r border-black px-1 text-center">
                    {countBaixada}
                  </div>
                  <div className="px-1 text-right">DIAS</div>
                </div>
                <div className="grid grid-cols-3 border-x border-b border-black">
                  <div className="border-r border-black px-1">RESERVA</div>
                  <div className="border-r border-black px-1 text-center">
                    {countReserva}
                  </div>
                  <div className="px-1 text-right">DIAS</div>
                </div>
              </div>

              {/* Assinaturas Motoristas Col 3 */}
              <div className="space-y-0.5">
                <div className="flex justify-between border-x border-t border-black bg-gray-100 px-1 py-0.5 text-[8px] font-black">
                  <span>CH DOS MOTORISTAS</span>
                  <span>VISTO</span>
                </div>
                {[
                  { id: "CH_MOTORISTAS_AMARELA", label: "AMARELA" },
                  { id: "CH_MOTORISTAS_AZUL", label: "AZUL" },
                  { id: "CH_MOTORISTAS_VERDE", label: "VERDE" },
                ].map((role) => {
                  const sig = getSignature(role.id);
                  return (
                    <div
                      key={role.id}
                      onClick={() =>
                        handleTriggerSignature(
                          role.id,
                          `CHEFE DOS MOTORISTAS - ${role.label}`,
                        )
                      }
                      className="flex border border-black cursor-pointer hover:bg-gray-50 transition-colors h-4 items-center"
                    >
                      <div className="w-2/3 border-r border-black px-1 font-bold text-[7px] flex items-center uppercase">
                        {role.label}
                      </div>
                      <div className="flex-1 px-1 text-[6.5px] font-black text-blue-600 flex items-center justify-center truncate uppercase leading-none">
                        {sig ? (
                          sig.user
                        ) : (
                          <span 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTriggerSignature(
                                role.id,
                                `CHEFE DOS MOTORISTAS - ${role.label}`,
                              );
                            }}
                            className="text-[6px] text-purple-600 bg-purple-50 px-1 py-0.5 hover:bg-purple-100 rounded font-black no-print transition-all cursor-pointer"
                          >
                            + ASSINAR
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Assinaturas Prontidão Col 4 */}
              <div className="space-y-0.5">
                <div className="flex justify-between border-x border-t border-black bg-gray-100 px-1 py-0.5 text-[8px] font-black">
                  <span>CMT PRONTIDÃO</span>
                  <span>VISTO</span>
                </div>
                {[
                  { id: "CMT_PRONTIDAO_AMARELA", label: "AMARELA" },
                  { id: "CMT_PRONTIDAO_AZUL", label: "AZUL" },
                  { id: "CMT_PRONTIDAO_VERDE", label: "VERDE" },
                ].map((role) => {
                  const sig = getSignature(role.id);
                  return (
                    <div
                      key={role.id}
                      onClick={() =>
                        handleTriggerSignature(
                          role.id,
                          `COMANDANTE DE PRONTIDÃO - ${role.label}`,
                        )
                      }
                      className="flex border border-black cursor-pointer hover:bg-gray-50 transition-colors h-4 items-center"
                    >
                      <div className="w-2/3 border-r border-black px-1 font-bold text-[7px] flex items-center uppercase">
                        {role.label}
                      </div>
                      <div className="flex-1 px-1 text-[6.5px] font-black text-blue-600 flex items-center justify-center truncate uppercase leading-none">
                        {sig ? (
                          sig.user
                        ) : (
                          <span 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTriggerSignature(
                                role.id,
                                `COMANDANTE DE PRONTIDÃO - ${role.label}`,
                              );
                            }}
                            className="text-[6px] text-purple-600 bg-purple-50 px-1 py-0.5 hover:bg-purple-100 rounded font-black no-print transition-all cursor-pointer"
                          >
                            + ASSINAR
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-2 flex justify-between items-center text-[7px] text-gray-400 no-print">
              <span>
                Página <span className="page-number"></span>
              </span>
              <span>
                Protocolo de Emissão:{" "}
                {Math.random().toString(36).substring(7).toUpperCase()}
              </span>
            </div>
          </div>
        </div>
        {renderJustificationSheet("DIÁRIO", selectedPrefix, monthFilter)}
      </>
    );
  };

  const renderWeeklyControlReport = (
    vType: "LEVE/PESADA" | "MOTOCICLETA" | "AB/AÉREA",
    customPrefix?: string,
  ) => {
    const prefixesArray = Array.from(selectedPrefixes);
    if (!customPrefix && prefixesArray.length !== 1) {
      return (
        <div className="p-10 text-center flex flex-col items-center gap-4">
          <AlertCircle className="w-12 h-12 text-blue-500" />
          <h4 className="text-sm font-black uppercase text-gray-700">
            Selecione uma única viatura para o relatório semanal
          </h4>
        </div>
      );
    }
    if (!monthFilter) {
      return (
        <div className="p-10 text-center flex flex-col items-center gap-4">
          <Calendar className="w-12 h-12 text-blue-500" />
          <h4 className="text-sm font-black uppercase text-gray-700">
            Selecione um Mês
          </h4>
        </div>
      );
    }

    const selectedPrefix = customPrefix || prefixesArray[0];
    const vehicle = settings.vehicles?.find(
      (v) => normalizePrefix(v.prefix) === selectedPrefix,
    );
    const [year, month] = monthFilter.split("-").map(Number);
    const weeks = ["1ª SEMANA", "2ª SEMANA", "3ª SEMANA", "4ª SEMANA"];

    const targetLogs = logs.filter((log) => {
      const matchPrefix = normalizePrefix(log.prefix) === normalizePrefix(selectedPrefix);
      const logMonth = parseLogDateToMonth(log.date);
      const matchMonth = !monthFilter || logMonth === monthFilter;
      return matchPrefix && matchMonth;
    });

    // Agrupa logs por semana (aproximado: 1-7, 8-14, 15-21, 22+)
    const logsByWeek: Record<number, LogEntry> = {};
    targetLogs.forEach((log) => {
      // FILTRO: Somente logs marcados explicitamente como "Semanal"
      if (log.checklistType !== "Semanal") return;

      const d = new Date(log.date);
      if (d.getFullYear() === year && d.getMonth() + 1 === month) {
        const day = d.getDate();
        let wIdx = 0;
        if (day <= 7) wIdx = 0;
        else if (day <= 14) wIdx = 1;
        else if (day <= 21) wIdx = 2;
        else wIdx = 3;

        // Pega o último log de cada semana
        if (
          !logsByWeek[wIdx] ||
          d.getTime() > new Date(logsByWeek[wIdx].date).getTime()
        ) {
          logsByWeek[wIdx] = log;
        }
      }
    });

    let reportItems: string[] = [];
    if (settings.defaultItems) {
      reportItems = settings.defaultItems
        .filter(
          (item) =>
            (item.frequency === "Semanal" || item.frequency === "Ambos") &&
            (!vehicle ||
              !item.vehicleTypes ||
              item.vehicleTypes.includes(vehicle.type)),
        )
        .map((i) => i.label);
    }

    const maxItems =
      vType === "AB/AÉREA" ? 23 : vType === "MOTOCICLETA" ? 16 : 19;
    const displayItems = reportItems.slice(0, maxItems);
    while (displayItems.length < maxItems) displayItems.push("");

    const title =
      vType === "AB/AÉREA"
        ? settings.weeklyAbTitle || "TIPO AB E AÉREAS"
        : vType === "MOTOCICLETA"
          ? settings.weeklyMotosTitle || "DE MOTOS"
          : settings.weeklyLevesTitle || "TIPO LEVES E PESADAS";

    return (
      <div
        className="space-y-1 mx-auto print:p-0 print:m-0 relative"
        style={{ maxWidth: "210mm" }}
      >
        <style>{`
          @media print { @page { size: portrait; margin: 5mm; } }
          .ficha-table th, .ficha-table td { border: 1px solid black !important; padding: 2px !important; }
        `}</style>

        <div className="flex items-stretch border border-black bg-cyan-400 text-center py-1">
          <h1 className="w-full text-[10px] font-black uppercase">
            FICHA DE CONTROLE DO CHECK LIST SEMANAL DE VIATURAS {title}
          </h1>
        </div>

        <div className="grid grid-cols-5 border-x border-b border-black text-[7px] font-black uppercase bg-white">
          <div className="border-r border-black px-1 py-0.5">
            PREFIXO: {selectedPrefix}
          </div>
          <div className="border-r border-black px-1 py-0.5">
            POSTO: {vehicle?.station}
          </div>
          <div className="border-r border-black px-1 py-0.5">
            GB: {vehicle?.gb}
          </div>
          <div className="border-r border-black px-1 py-0.5">
            MÊS: {getMonthLabel(monthFilter).toUpperCase()}
          </div>
          <div className="px-1 py-0.5">OBSERVAÇÕES:</div>
        </div>

        <table className="w-full ficha-table border-collapse text-[8px] font-black">
          <thead>
            <tr className="bg-yellow-100">
              <th className="w-8 text-center bg-red-600 text-white">ITEM</th>
              <th className="text-left px-2">DESCRIÇÃO</th>
              {weeks.map((w) => (
                <th key={w} className="w-24 text-center">
                  {w}
                </th>
              ))}
              <th className="w-32 text-center">OBSERVAÇÕES</th>
            </tr>
          </thead>
          <tbody>
            {displayItems.map((label, idx) => (
              <tr key={idx} className="h-5">
                <td className="text-center bg-red-600 text-white border-black">
                  {idx + 1}
                </td>
                <td className="px-2 border-black max-w-[200px] truncate">
                  {label}
                </td>
                {weeks.map((_, wIdx) => {
                  const log = logsByWeek[wIdx];
                  const { val } = log
                    ? getItemStatusFromLog(log, label)
                    : { val: "" };
                  return (
                    <td key={wIdx} className="text-center border-black">
                      {val}
                    </td>
                  );
                })}
                <td className="border-black"></td>
              </tr>
            ))}

            {vType === "LEVE/PESADA" && (
              <>
                {[
                  "LEITURA DO HODOMETRO (KM)",
                  "COMBUST GASTO (LITROS)",
                  "GASTOS COM PEÇAS (R$)",
                  "GASTOS C/ MÃO DE OBRA (R$)",
                ].map((extra, eIdx) => (
                  <tr key={eIdx} className="h-10">
                    <td
                      colSpan={2}
                      className="bg-green-50 px-2 uppercase text-[7px]"
                    >
                      {extra}
                    </td>
                    {weeks.map((_, wIdx) => {
                      const log = logsByWeek[wIdx];
                      let val = "";
                      if (eIdx === 0) val = log?.km?.toString() || "";
                      return (
                        <td key={wIdx} className="text-center border-black">
                          {val}
                        </td>
                      );
                    })}
                    <td className="border-black"></td>
                  </tr>
                ))}
              </>
            )}

            <tr className="h-10">
              <td
                colSpan={2}
                className="bg-green-50 px-2 text-center align-middle uppercase text-[7px]"
              >
                NOME
              </td>
              {weeks.map((_, wIdx) => {
                const log = logsByWeek[wIdx];
                return (
                  <td
                    key={wIdx}
                    className="text-center border-black text-[6px]"
                  >
                    {log
                      ? getFullData(log)
                          ?.signatureName?.split(" ")
                          .slice(-2)
                          .join(" ")
                      : ""}
                  </td>
                );
              })}
              <td className="border-black"></td>
            </tr>
            <tr className="h-10">
              <td
                colSpan={2}
                className="bg-green-50 px-2 text-center align-middle uppercase text-[7px]"
              >
                RE
              </td>
              {weeks.map((_, wIdx) => (
                <td key={wIdx} className="text-center border-black text-[6px]">
                  {logsByWeek[wIdx]
                    ? getFullData(logsByWeek[wIdx])?.signatureRank
                    : ""}
                </td>
              ))}
              <td className="border-black"></td>
            </tr>
          </tbody>
        </table>

        <div className="mt-2 grid grid-cols-2 gap-4 text-[7px] font-black uppercase">
          <div className="space-y-1">
            <div className="flex border border-black w-48">
              <div className="w-16 border-r border-black px-1">LEGENDA:</div>
              <div className="w-8 border-r border-black text-center">OK</div>
              <div className="flex-1 px-1">SEM NOVIDADES</div>
            </div>
            <div className="flex border border-black w-48">
              <div className="w-16 border-r border-black px-1"></div>
              <div className="w-8 border-r border-black text-center">CN</div>
              <div className="flex-1 px-1">COM NOVIDADES</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              {[
                { id: "CH_MOTORISTAS_AMARELA", label: "CH DOS MOTORISTAS AMARELA" },
                { id: "CH_MOTORISTAS_AZUL", label: "CH DOS MOTORISTAS AZUL" },
                { id: "CH_MOTORISTAS_VERDE", label: "CH DOS MOTORISTAS VERDE" },
              ].map((role) => {
                const sig = getSignature(role.id);
                return (
                  <div 
                    key={role.id} 
                    onClick={() => handleTriggerSignature(role.id, role.label)}
                    className="flex border border-black cursor-pointer hover:bg-gray-50 transition-colors h-4 items-center"
                  >
                    <div className="flex-1 px-1 text-[7px] uppercase">{role.label}</div>
                    <div className="w-16 border-l border-black text-center text-[6px] font-black text-blue-600">
                      {sig ? sig.user : (
                        <span 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTriggerSignature(role.id, role.label);
                          }}
                          className="text-purple-600 bg-purple-50 px-1 py-0.5 rounded cursor-pointer no-print font-black"
                        >
                          + ASSINAR
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="space-y-1">
            </div>
          </div>
        </div>
        {renderJustificationSheet(
          `SEMANAL ${vType}`,
          selectedPrefix,
          monthFilter,
        )}
      </div>
    );
  };

  const renderDailyControlMotosReport = (customPrefix?: string) => {
    const prefixesArray = Array.from(selectedPrefixes);
    if (!customPrefix && prefixesArray.length !== 1) {
      return (
        <div className="p-10 text-center flex flex-col items-center gap-4">
          <AlertCircle className="w-12 h-12 text-blue-500" />
          <h4 className="text-sm font-black uppercase text-gray-700">
            Selecione uma única motocicleta para gerar este relatório
          </h4>
          <p className="text-xs text-gray-400 font-bold uppercase max-w-sm">
            Este relatório matrix mensal é gerado individualmente por prefixo.
          </p>
        </div>
      );
    }

    if (!monthFilter) {
      return (
        <div className="p-10 text-center flex flex-col items-center gap-4">
          <Calendar className="w-12 h-12 text-blue-500" />
          <h4 className="text-sm font-black uppercase text-gray-700">
            Selecione um Mês de Referência
          </h4>
          <p className="text-xs text-gray-400 font-bold uppercase max-w-sm">
            A Ficha de Controle Diário de Motos é calculada para um mês civil
            completo.
          </p>
        </div>
      );
    }

    const selectedPrefix = customPrefix || prefixesArray[0];
    const vehicle = settings.vehicles?.find(
      (v) => normalizePrefix(v.prefix) === selectedPrefix,
    );

    const [year, month] = monthFilter.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const getDayColor = (d: number) => {
      const refDate = new Date(2026, 0, 1);
      const curDate = new Date(year, month - 1, d);
      const diffDays = Math.round((curDate.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24));
      let idx = diffDays % 3;
      if (idx < 0) idx += 3;
      const colors = ["bg-[#4ade80]", "bg-[#facc15]", "bg-[#60a5fa]"];
      return colors[idx];
    };

    const targetLogs = logs.filter((log) => {
      const matchPrefix = normalizePrefix(log.prefix) === normalizePrefix(selectedPrefix);
      const logMonth = parseLogDateToMonth(log.date);
      const matchMonth = !monthFilter || logMonth === monthFilter;
      return matchPrefix && matchMonth;
    });

    const logsByDay: Record<number, LogEntry> = {};
    targetLogs.forEach((log) => {
      if (parseLogDateToMonth(log.date) === monthFilter) {
        let dd = 0;
        const dateStr = String(log.date);
        if (dateStr.includes("-")) {
          const parts = dateStr.split("T")[0].split("-");
          if (parts.length === 3) dd = parseInt(parts[2]);
        } else if (dateStr.includes("/")) {
          const parts = dateStr.split("/");
          if (parts.length >= 1) dd = parseInt(parts[0]);
        }

        if (dd > 0) {
          if (
            !logsByDay[dd] ||
            new Date(log.date).getTime() > new Date(logsByDay[dd].date).getTime()
          ) {
            logsByDay[dd] = log;
          }
        }
      }
    });

    let reportItems: string[] = [];
    if (settings.defaultItems) {
      reportItems = settings.defaultItems
        .filter(
          (item) =>
            (item.frequency === "Diário" || item.frequency === "Ambos") &&
            (!vehicle ||
              !item.vehicleTypes ||
              item.vehicleTypes.includes(vehicle.type)),
        )
        .map((i) => i.label);
    }

    if (reportItems.length === 0) {
      const allLabels = new Set<string>();
      targetLogs.forEach((log) => {
        try {
          if (log.itemsDetail) {
            const details = JSON.parse(log.itemsDetail);
            details.forEach((d: any) => allLabels.add(d.label));
          }
        } catch (e) {}
      });
      reportItems = Array.from(allLabels);
    }

    const displayItemsCount = 30;
    const displayItems = reportItems.slice(0, displayItemsCount);
    while (displayItems.length < displayItemsCount) {
      displayItems.push("");
    }

    let countOperando = 0;
    let countBaixada = 0;
    let countReserva = 0;
    Object.values(logsByDay).forEach((log) => {
      if (log.vehicleStatus === "OPERANDO") countOperando++;
      else if (log.vehicleStatus === "BAIXADA") countBaixada++;
      else if (log.vehicleStatus === "RESERVA") countReserva++;
    });

    return (
      <div
        className="space-y-1 mx-auto print:p-0 print:m-0 relative"
        style={{ maxWidth: "297mm" }}
      >
        <Watermark />
        <style>{`
          @media print {
            @page { size: landscape; margin: 5mm; }
            body { 
              -webkit-print-color-adjust: exact; 
              counter-reset: page;
            }
            .page-footer {
              position: fixed;
              bottom: 0;
              width: 100%;
            }
            .page-number:after {
              counter-increment: page;
              content: counter(page);
            }
          }
          .vertical-text {
            writing-mode: vertical-rl;
            transform: rotate(180deg);
            white-space: nowrap;
          }
          .ficha-table th, .ficha-table td {
             border: 1px solid black !important;
             padding: 1px !important;
             line-height: 1 !important;
          }
        `}</style>

        {/* Top Header */}
        <div className="flex items-stretch border border-black overflow-hidden bg-white mb-0.5">
          <div className="w-24 border-r border-black p-1 flex items-center justify-center bg-white">
            {settings.headerLogoUrl1 && (
              <img
                src={settings.headerLogoUrl1}
                className="h-12 object-contain"
                alt="Logo 1"
              />
            )}
          </div>
          <div className="flex-1 bg-yellow-400 text-center flex flex-col items-center justify-center py-1">
            <h1 className="text-[11px] font-black uppercase leading-tight">
              {settings.dailyMotosTitle ||
                "Ficha de Controle do Check List Diário de Motocicletas"}
            </h1>
          </div>
          <div className="w-24 border-l border-black p-1 flex items-center justify-center bg-white">
            {settings.headerLogoUrl2 ? (
              <img
                src={settings.headerLogoUrl2}
                className="h-12 object-contain"
                alt="Logo 2"
              />
            ) : (
              <div className="text-[6px] font-black uppercase text-center text-gray-300">
                LOGO 2
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-5 border border-black text-[8px] font-black uppercase bg-white">
          <div className="border-r border-black px-1 py-0.5">
            Prefixo da Moto:{" "}
            <span className="ml-1 text-[9px]">{selectedPrefix}</span>
          </div>
          <div className="border-r border-black px-1 py-0.5">
            Posto: <span className="ml-1 text-[9px]">{vehicle?.station}</span>
          </div>
          <div className="border-r border-black px-1 py-0.5">
            GB: <span className="ml-1 text-[9px]">{vehicle?.gb}</span>
          </div>
          <div className="border-r border-black px-1 py-0.5 text-center">
            Mês:{" "}
            <span className="ml-1 text-[9px]">
              {getMonthLabel(monthFilter).toUpperCase()}
            </span>
          </div>
          <div className="px-1 py-0.5">Observações:</div>
        </div>

        <table className="w-full ficha-table border-collapse text-[7.5px] font-black">
          <thead>
            <tr>
              <th className="w-[150px] text-left px-2 bg-gray-100">DATA</th>
              {days.map((d) => (
                <th
                  key={d}
                  className={`w-[25px] text-center border-l border-black ${getDayColor(d)}`}
                >
                  {d}
                </th>
              ))}
            </tr>
            <tr className="bg-red-600 text-white">
              <th className="text-left px-2 uppercase">
                Item de Verificação Técnica (Motos)
              </th>
              {days.map((d) => (
                <th key={d} className="border-l border-black"></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayItems.map((itemLabel, rowIdx) => (
              <tr key={rowIdx} className={itemLabel ? "" : "h-4"}>
                <td
                  className={`px-2 border border-black ${itemLabel ? "" : "bg-gray-50"}`}
                >
                  {itemLabel ? `${rowIdx + 1}. ${itemLabel.slice(0, 50)}` : ""}
                </td>
                {days.map((d) => {
                  const log = logsByDay[d];
                  let { val, colorClass } = log
                    ? getItemStatusFromLog(log, itemLabel)
                    : { val: "", colorClass: "" };

                  if (!log) {
                    // Remoção da verificação de justificativa na Ficha de Controle de Motos
                  }
                  return (
                    <td
                      key={d}
                      className={`text-center font-black border border-black ${colorClass}`}
                    >
                      {val}
                    </td>
                  );
                })}
              </tr>
            ))}

            <tr className="h-[85px]">
              <td className="bg-[#e8f5e9] text-center border border-black">
                <div className="vertical-text mx-auto font-black text-[9px] tracking-widest h-[85px] flex items-center justify-center">
                  NOME
                </div>
              </td>
              {days.map((d) => {
                const log = logsByDay[d];
                if (log) {
                  const full = getFullData(log);
                  const name = (full?.signatureName || "").toUpperCase();
                  return (
                    <td
                      key={d}
                      className="p-0 border border-black overflow-hidden h-[85px]"
                    >
                      <div className="vertical-text mx-auto text-[7px] leading-tight font-black h-[85px] flex items-center justify-center uppercase overflow-hidden">
                        {name.substring(0, 20)}
                      </div>
                    </td>
                  );
                } else {
                  // Justificativa
                  const dayStr = `${year}-${month.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
                  const justification = justifications.find(
                    (j) =>
                      normalizeMonthString(j.month) === normalizeMonthString(monthFilter) &&
                      normalizePrefix(j.vehicleType) ===
                        normalizePrefix(selectedPrefix) &&
                      isDateMatch(j.date || (j as any).dateRef, year, month, d),
                  );
                  if (justification) {
                    return (
                      <td
                        key={d}
                        className="p-0 border border-black overflow-hidden h-[85px] bg-purple-50"
                      >
                        <div className="vertical-text mx-auto text-[7px] leading-tight font-black h-[85px] flex items-center justify-center uppercase overflow-hidden text-purple-700">
                          {justification.author.substring(0, 20).toUpperCase()}
                        </div>
                      </td>
                    );
                  }
                  return <td key={d} className="border border-black"></td>;
                }
              })}
            </tr>

            <tr className="h-[85px]">
              <td className="bg-[#e8f5e9] text-center border border-black">
                <div className="vertical-text mx-auto font-black text-[9px] tracking-widest h-[85px] flex items-center justify-center">
                  RE
                </div>
              </td>
              {days.map((d) => {
                const log = logsByDay[d];
                if (log) {
                  const full = getFullData(log);
                  const re = full?.signatureRank || "";
                  return (
                    <td
                      key={d}
                      className="p-0 border border-black overflow-hidden h-[85px]"
                    >
                      <div className="vertical-text mx-auto text-[8px] font-black h-[85px] flex items-center justify-center overflow-hidden">
                        {re}
                      </div>
                    </td>
                  );
                } else {
                  // Justificativa
                  const dayStr = `${year}-${month.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
                  const justification = justifications.find(
                    (j) =>
                      normalizeMonthString(j.month) === normalizeMonthString(monthFilter) &&
                      normalizePrefix(j.vehicleType) ===
                        normalizePrefix(selectedPrefix) &&
                      isDateMatch(j.date || (j as any).dateRef, year, month, d),
                  );
                  if (justification) {
                    return (
                      <td
                        key={d}
                        className="p-0 border border-black overflow-hidden h-[85px] bg-purple-50"
                      >
                        <div className="vertical-text mx-auto text-[8px] font-black h-[85px] flex items-center justify-center overflow-hidden text-purple-700">
                          {justification.authorRank}
                        </div>
                      </td>
                    );
                  }
                  return <td key={d} className="border border-black"></td>;
                }
              })}
            </tr>
          </tbody>
        </table>

        {/* Footer */}
        <div className="mt-2 text-[8px] font-black uppercase">
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-0.5">
              <div className="flex border border-black">
                <div className="w-16 border-r border-black px-1 font-bold">
                  LEGENDA:
                </div>
                <div className="w-10 border-r border-black px-1 text-center">
                  OK
                </div>
                <div className="flex-1 px-1">SEM NOVIDADES</div>
              </div>
              <div className="flex border border-black">
                <div className="w-16 border-r border-black px-1"></div>
                <div className="w-10 border-r border-black px-1 text-center">
                  CN
                </div>
                <div className="flex-1 px-1">COM NOVIDADES</div>
              </div>
            </div>

            <div className="space-y-0.5">
              <div className="text-center border-x border-t border-black bg-gray-100 py-0.5">
                STATUS DO MÊS (MOTOS)
              </div>
              <div className="grid grid-cols-3 border border-black">
                <div className="border-r border-black px-1">OPERANDO</div>
                <div className="border-r border-black px-1 text-center">
                  {countOperando}
                </div>
                <div className="px-1 text-right">DIAS</div>
              </div>
              <div className="grid grid-cols-3 border-x border-b border-black">
                <div className="border-r border-black px-1">BAIXADA</div>
                <div className="border-r border-black px-1 text-center">
                  {countBaixada}
                </div>
                <div className="px-1 text-right">DIAS</div>
              </div>
              <div className="grid grid-cols-3 border-x border-b border-black">
                <div className="border-r border-black px-1">RESERVA</div>
                <div className="border-r border-black px-1 text-center">
                  {countReserva}
                </div>
                <div className="px-1 text-right">DIAS</div>
              </div>
            </div>

            {/* Assinaturas Motoristas Col 3 */}
            <div className="space-y-0.5">
              <div className="flex justify-between border-x border-t border-black bg-gray-100 px-1 py-0.5 text-[8px] font-black">
                <span>CH DOS MOTOCICLISTAS</span>
                <span>VISTO</span>
              </div>
              {[
                { id: "CH_MOTOS_AMARELA", label: "AMARELA" },
                { id: "CH_MOTOS_AZUL", label: "AZUL" },
                { id: "CH_MOTOS_VERDE", label: "VERDE" },
              ].map((role) => {
                const sig = getSignature(role.id);
                return (
                  <div
                    key={role.id}
                    onClick={() =>
                      handleTriggerSignature(
                        role.id,
                        `CH DOS MOTOCICLISTAS - ${role.label}`,
                      )
                    }
                    className="flex border border-black cursor-pointer hover:bg-gray-50 transition-colors h-4 items-center"
                  >
                    <div className="w-2/3 border-r border-black px-1 font-bold text-[7px] flex items-center uppercase">
                      {role.label}
                    </div>
                    <div className="flex-1 px-1 text-[6.5px] font-black text-blue-600 flex items-center justify-center truncate uppercase leading-none">
                      {sig ? (
                        sig.user
                      ) : (
                        <span 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTriggerSignature(
                              role.id,
                              `CH DOS MOTOCICLISTAS - ${role.label}`,
                            );
                          }}
                          className="text-[6px] text-purple-600 bg-purple-50 px-1 py-0.5 hover:bg-purple-100 rounded font-black no-print transition-all cursor-pointer"
                        >
                          + ASSINAR
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Assinaturas Prontidão Col 4 */}
            <div className="space-y-0.5">
              <div className="flex justify-between border-x border-t border-black bg-gray-100 px-1 py-0.5 text-[8px] font-black">
                <span>CMT PRONTIDÃO</span>
                <span>VISTO</span>
              </div>
              {[
                { id: "CMT_PRONTIDAO_MOTO_AMARELA", label: "AMARELA" },
                { id: "CMT_PRONTIDAO_MOTO_AZUL", label: "AZUL" },
                { id: "CMT_PRONTIDAO_MOTO_VERDE", label: "VERDE" },
              ].map((role) => {
                const sig = getSignature(role.id);
                return (
                  <div
                    key={role.id}
                    onClick={() =>
                      handleTriggerSignature(
                        role.id,
                        `COMANDANTE DE PRONTIDÃO (MOTOS) - ${role.label}`,
                      )
                    }
                    className="flex border border-black cursor-pointer hover:bg-gray-50 transition-colors h-4 items-center"
                  >
                    <div className="w-2/3 border-r border-black px-1 font-bold text-[7px] flex items-center uppercase">
                      {role.label}
                    </div>
                    <div className="flex-1 px-1 text-[6.5px] font-black text-blue-600 flex items-center justify-center truncate uppercase leading-none">
                      {sig ? (
                        sig.user
                      ) : (
                        <span 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTriggerSignature(
                              role.id,
                              `COMANDANTE DE PRONTIDÃO (MOTOS) - ${role.label}`,
                            );
                          }}
                          className="text-[6px] text-purple-600 bg-purple-50 px-1 py-0.5 hover:bg-purple-100 rounded font-black no-print transition-all cursor-pointer"
                        >
                          + ASSINAR
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        {renderJustificationSheet("DIÁRIO MOTOS", selectedPrefix, monthFilter)}
      </div>
    );
  };

  const renderRetroactiveLogsReport = () => {
    const prefixesArray = Array.from(selectedPrefixes);
    if (prefixesArray.length !== 1 || !monthFilter) {
      return (
        <div className="p-20 text-center flex flex-col items-center gap-4 text-gray-400">
          <Calendar className="w-16 h-16 text-blue-500 mb-2 opacity-20" />
          <h3 className="text-sm font-black uppercase tracking-widest">Selecione uma viatura e mês para gerar o relatório retroativo.</h3>
        </div>
      );
    }

    const selectedPrefix = prefixesArray[0];
    const [year, monthNum] = monthFilter.split("-").map(Number);
    const daysInMonth = new Date(year, monthNum, 0).getDate();

    const logsByDay: Record<number, LogEntry> = {};
    filteredLogs.forEach((log) => {
      if (parseLogDateToMonth(log.date) === monthFilter) {
        let dd = 0;
        const dateStr = String(log.date);
        if (dateStr.includes("-")) {
          const parts = dateStr.split("T")[0].split("-");
          if (parts.length === 3) dd = parseInt(parts[2]);
        } else if (dateStr.includes("/")) {
          const parts = dateStr.split("/");
          if (parts.length >= 1) dd = parseInt(parts[0]);
        }
        if (dd > 0) {
          if (!logsByDay[dd] || new Date(log.date).getTime() > new Date(logsByDay[dd].date).getTime()) {
            logsByDay[dd] = log;
          }
        }
      }
    });

    const reportJustifications = justifications.filter(j => {
      const jDate = (j.date || (j as any).dateRef || "").toString();
      const jMonth = j.month || (jDate ? parseLogDateToMonth(jDate) : "");
      const matchesMonth = normalizeMonthString(jMonth) === normalizeMonthString(monthFilter);
      const matchesPrefix = normalizePrefix(j.vehicleType) === normalizePrefix(selectedPrefix);
      return matchesMonth && matchesPrefix;
    });

    return (
      <div className="space-y-6">
        <div className="flex items-stretch border-2 border-black overflow-hidden bg-white mb-6">
          <div className="w-24 border-r-2 border-black p-2 flex items-center justify-center bg-white">
            {settings.headerLogoUrl1 && <img src={settings.headerLogoUrl1} className="h-14 object-contain" alt="Logo 1" />}
          </div>
          <div className="flex-1 bg-blue-900 text-white text-center flex flex-col items-center justify-center py-3">
            <h1 className="text-base font-black uppercase leading-tight tracking-widest">
              Relatório de Conferências Realizadas em Data Retroativa
            </h1>
            <p className="text-[9px] font-bold mt-1 opacity-80 uppercase">Auditoria de Lançamentos fora do Prazo Regulamentar</p>
          </div>
          <div className="w-24 border-l-2 border-black p-2 flex items-center justify-center bg-white">
            {settings.headerLogoUrl2 && <img src={settings.headerLogoUrl2} className="h-14 object-contain" alt="Logo 2" />}
          </div>
        </div>

        <div className="grid grid-cols-3 border-2 border-black text-[9px] font-black uppercase divide-x-2 divide-black bg-white mb-6">
          <div className="px-3 py-2 bg-gray-50">Viatura: <span className="text-blue-700 ml-1">{selectedPrefix}</span></div>
          <div className="px-3 py-2 bg-gray-50">Mês de Referência: <span className="text-blue-700 ml-1">{getMonthLabel(monthFilter).toUpperCase()}</span></div>
          <div className="px-3 py-2 bg-gray-50">Emitido em: <span className="text-blue-700 ml-1">{new Date().toLocaleString("pt-BR")}</span></div>
        </div>

        <div className="border-2 border-black shadow-lg overflow-hidden rounded-sm">
          <table className="w-full text-[9px] border-collapse bg-white">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-black text-center font-black uppercase">
                <th className="w-16 border-r-2 border-black p-2">Dia Ref.</th>
                <th className="w-24 border-r border-black p-2">Status</th>
                <th className="w-48 border-r border-black p-2">Data/Hora Realização</th>
                <th className="p-2 text-left">Motivo / Justificativa do Atraso</th>
                <th className="w-64 border-l-2 border-black p-2 text-left">Responsável pela Validação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/20">
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                const log = logsByDay[day];
                const justification = reportJustifications.find((j) => {
                  const jDate = j.date || (j as any).dateRef;
                  return isDateMatch(jDate, year, monthNum, day);
                });

                if (!log || !justification) return null;

                return (
                  <tr key={day} className="h-14 hover:bg-blue-50/30 transition-colors">
                    <td className="border-r-2 border-black p-2 text-center font-black text-[13px] bg-gray-50/50">
                      {day.toString().padStart(2, "0")}
                    </td>
                    <td className="border-r border-black p-2 text-center">
                      <span className="text-green-700 font-extrabold text-[10px] uppercase">OK</span>
                    </td>
                    <td className="border-r border-black p-2 text-center font-black">
                      <div className="text-gray-900 border-b border-gray-100 pb-0.5">{new Date(log.date).toLocaleDateString("pt-BR")}</div>
                      <div className="text-blue-700 text-[10px] mt-0.5">{new Date(log.date).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}h</div>
                    </td>
                    <td className="border-r border-black p-3 font-bold text-[10px] leading-relaxed text-gray-800 bg-yellow-50/10">
                      "{justification.justification}"
                    </td>
                    <td className="p-2 px-4 border-l-2 border-black">
                      <div className="flex flex-col">
                        <span className="font-black text-[10px] uppercase text-gray-900 border-b border-gray-100 pb-0.5">
                          {justification.author || log.inspector}
                        </span>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-[7.5px] text-green-700 font-extrabold flex items-center gap-1 uppercase">
                            <CheckCircle className="w-3 h-3" /> Digitalmente Validado
                          </span>
                          <span className="text-[7px] text-gray-400 font-mono">HASH: {justification.id?.substring(0, 8).toUpperCase()}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[6.5px] text-gray-400 font-bold italic mt-1">
                          <Clock className="w-2.5 h-2.5" />
                          <span>REGISTRADO EM: {justification.createdAt ? new Date(justification.createdAt).toLocaleString('pt-BR') : 'DATA INDISPONÍVEL'}</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              }).filter(Boolean)}

              {Array.from({ length: daysInMonth }, (_, i) => i + 1).every(d => {
                const log = logsByDay[d];
                const justification = reportJustifications.find((j) => isDateMatch(j.date || (j as any).dateRef, year, monthNum, d));
                return !(log && justification);
              }) && (
                <tr>
                  <td colSpan={4} className="p-20 text-center text-gray-400 font-black uppercase text-[11px] bg-white italic tracking-widest leading-loose">
                    Nenhum registro retroativo identificado para este período e viatura.<br/>
                    <span className="text-[9px] opacity-60">Todos os checklists foram realizados dentro do prazo ou não possuem justificativa associada.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-12 pt-8 border-t-2 border-black grid grid-cols-2 gap-12">
            <div className="flex flex-col items-center">
                <div className="w-full border-b-2 border-black h-16 flex items-end justify-center pb-2">
                    <span className="text-[10px] font-black text-blue-800 uppercase tracking-wider">{getSignature("CH_MOTORISTAS_AMARELA", "retroactive_logs")?.user || getSignature("CH_MOTORISTAS_AZUL", "retroactive_logs")?.user || getSignature("CH_MOTORISTAS_VERDE", "retroactive_logs")?.user}</span>
                </div>
                <span className="text-[9px] font-black uppercase mt-2 text-gray-600">Chefe dos Motoristas (Auditoria de Atrasos)</span>
            </div>
            <div className="flex flex-col items-center">
                <div className="w-full border-b-2 border-black h-16 flex items-end justify-center pb-2">
                    <span className="text-[10px] font-black text-blue-800 uppercase tracking-wider">{getSignature("CMT_POSTO", "retroactive_logs")?.user}</span>
                </div>
                <span className="text-[9px] font-black uppercase mt-2 text-gray-600">Comandante do Posto (Visto Superior)</span>
            </div>
        </div>

        <div className="mt-20 pt-6 flex justify-between items-end text-[8px] font-black text-gray-300 uppercase tracking-widest border-t-2 border-gray-50">
          <div className="flex flex-col gap-1">
            <span>DT-LOG | SISTEMA DE GESTÃO DE FROTA OPERACIONAL</span>
            <span>DATA DE EMISSÃO: {new Date().toLocaleString("pt-BR")}</span>
          </div>
          <div className="text-right">
            <span>PÁGINA 1 DE 1 | CÓDIGO CRC: {Math.random().toString(36).substring(2, 12).toUpperCase()}</span>
          </div>
        </div>
      </div>
    );
  };

  const renderJustificationSheet = (
    type: string,
    vehiclePrefix: string,
    month: string,
  ) => {
    const [year, monthNum] = month.split("-").map(Number);
    const daysInMonth = new Date(year, monthNum, 0).getDate();

    // Find logs per day
    const logsByDay: Record<number, LogEntry> = {};
    logs
      .filter(
        (log) => 
          normalizePrefix(log.prefix) === normalizePrefix(vehiclePrefix) ||
          normalizePrefix(log.plate) === normalizePrefix(vehiclePrefix)
      )
      .forEach((log) => {
        if (parseLogDateToMonth(log.date) === month) {
          let dayValue = 0;
          const dateStr = String(log.date);
          if (dateStr.includes("-")) {
            const parts = dateStr.split("T")[0].split("-");
            if (parts.length === 3) dayValue = parseInt(parts[2]);
          } else if (dateStr.includes("/")) {
            const parts = dateStr.split("/");
            if (parts.length >= 1) dayValue = parseInt(parts[0]);
          }

          if (dayValue > 0) {
            if (
              !logsByDay[dayValue] ||
              new Date(log.date).getTime() >
                new Date(logsByDay[dayValue].date).getTime()
            ) {
              logsByDay[dayValue] = log;
            }
          }
        }
      });

    const existingDays = new Set<number>(
      Object.keys(logsByDay).map((k) => parseInt(k)),
    );

    const reportJustifications = justifications.filter(
      (j) => {
        // Month match - Be very permissive
        const jDate = (j.date || (j as any).dateRef || "").toString();
        const jMonth = j.month || (jDate ? parseLogDateToMonth(jDate) : "");
        const matchesMonth = !month || normalizeMonthString(jMonth) === normalizeMonthString(month);
        
        // Prefix/Vehicle match - Normalize both sides
        const targetNormalized = normalizePrefix(vehiclePrefix);
        const matchesPrefix = 
          normalizePrefix(j.vehicleType) === targetNormalized ||
          normalizePrefix(j.station) === targetNormalized ||
          !j.vehicleType; // Also allow justifications without vehicleType if it happened
        
        return matchesMonth && matchesPrefix;
      }
    );

    return (
      <div
        className="mt-8 border border-black p-4 bg-white break-before-page relative"
        style={{ pageBreakBefore: "always", minHeight: "290mm" }}
      >
        {/* Branding Marca D'água ou Logo de Fundo Opcional */}
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
          <Shield className="w-96 h-96" />
        </div>

        <div className="text-center border-b-2 border-black pb-3 mb-6 relative z-10">
          <h2 className="text-sm font-black uppercase tracking-tight">
            DEPARTAMENTO DE TRANSPORTES E LOGÍSTICA
          </h2>
          <h1 className="text-lg font-black uppercase mt-1">
            FOLHA DE JUSTIFICATIVAS E REGISTROS - {type}
          </h1>
          <button
            onClick={() => fetchJustifications()}
            className="absolute right-0 top-0 bg-blue-50 hover:bg-blue-100 text-blue-600 p-2 rounded-full transition-all no-print print:hidden"
            title="Sincronizar com Banco de Dados"
          >
            <RefreshCw className={`w-4 h-4 ${isFetchingJustifications ? 'animate-spin' : ''}`} />
          </button>
          <div className="flex justify-center gap-6 mt-2 text-[11px] font-black uppercase text-gray-700">
            <span className="bg-gray-100 px-3 py-1 rounded-sm border border-gray-300">
              MÊS: {getMonthLabel(month).toUpperCase()}
            </span>
            <span className="bg-gray-100 px-3 py-1 rounded-sm border border-gray-300">
              PREFIXO: {vehiclePrefix}
            </span>
            <span className="bg-gray-100 px-3 py-1 rounded-sm border border-gray-300">
              CÓD: {Math.random().toString(36).substring(7).toUpperCase()}
            </span>
          </div>
        </div>

        <div className="space-y-8 relative z-10">
          {/* Seção 1: Justificativas de Ausência */}
          <div className="border border-black shadow-sm">
            <div className="bg-gray-900 border-b border-black p-1.5 text-[10px] font-black uppercase text-white tracking-widest flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4" />
              01. JUSTIFICATIVAS DE AUSÊNCIA DE CONFERÊNCIA (CHECKLIST NÃO REALIZADO)
            </div>
            <table className="w-full text-[8.5px] border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-black">
                  <th className="w-14 border-r border-black p-1.5 font-extrabold uppercase">Dia</th>
                  <th className="w-32 border-r border-black p-1.5 font-extrabold uppercase text-center">Status</th>
                  <th className="flex-1 p-1.5 text-left font-extrabold uppercase">Observação / Justificativa do Responsável</th>
                  <th className="w-60 border-l border-black p-1.5 text-left font-extrabold uppercase">Assinado por:</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: daysInMonth }, (_, i) => i + 1)
                  .map((day) => {
                    const dayStrFormatted = `${year}-${monthNum.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
                    const justification = reportJustifications.find((j) => isDateMatch(j.date || (j as any).dateRef, year, monthNum, day));
                    const hasLog = existingDays.has(day);
                    
                    // Só mostrar se NÃO tiver log (ausência) ou se tiver uma justificativa
                    if (hasLog && !justification) return null;

                    return (
                      <tr 
                        key={day} 
                        className={`border-b border-black h-14 transition-colors ${!hasLog ? 'bg-red-50/10' : 'bg-white'}`}
                      >
                        <td className="border-r border-black p-1.5 text-center font-black text-[12px] bg-gray-50/50">
                          {day.toString().padStart(2, "0")}
                        </td>
                        <td className="border-r border-black p-1.5 text-center font-black text-[8px]">
                          {justification ? (
                            <div className="flex flex-col items-center">
                              <span className="text-green-700 font-black text-[10px] uppercase tracking-tighter shadow-sm">OK</span>
                              <span className="text-[6px] text-green-600 font-bold uppercase mt-0.5">Validado</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center">
                               <span className="text-red-700 underline font-black text-[9px] uppercase">Pendente</span>
                               <span className="text-[6px] text-red-500 mt-1 uppercase">Aguardando Justificativa</span>
                            </div>
                          )}
                        </td>
                        <td className="border-r border-black p-2 font-medium text-[9.5px] leading-relaxed text-gray-800">
                          {justification ? (
                            <div className="flex flex-col gap-1.5 animate-fadeIn">
                              <textarea
                                rows={2}
                                readOnly
                                disabled
                                className="w-full bg-purple-50/20 border border-purple-100 rounded p-1.5 text-[9px] font-semibold text-purple-900 cursor-not-allowed resize-none"
                                value={justification.justification || "JUSTIFICATIVA REGISTRADA"}
                              />
                              {hasLog && <span className="text-[7px] text-blue-600 font-black uppercase">Registro Retroativo Identificado</span>}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                               <textarea
                                 rows={2}
                                 className="flex-1 bg-yellow-50/30 border border-gray-200 rounded p-1.5 text-[9px] font-bold focus:border-purple-500 outline-none transition-all resize-none shadow-inner"
                                 placeholder="Digite a justificativa aqui..."
                                 value={justificationDrafts[day] || ""}
                                 onChange={(e) => setJustificationDrafts(prev => ({ ...prev, [day]: e.target.value }))}
                               />
                            </div>
                          )}
                        </td>
                        <td className="p-2 border-l border-black bg-gray-50/10 text-left align-middle w-60">
                          {justification ? (
                            <div className="flex flex-col justify-center animate-fadeIn">
                              <div className="flex items-center gap-1.5 mb-1 text-purple-900">
                                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                                <span className="font-black text-[9.5px] uppercase border-b border-gray-300 flex-1">
                                  {justification.author}
                                </span>
                              </div>
                              <div className="flex flex-col gap-0.5 mt-0.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[7.5px] text-gray-500 font-black">RE: {justification.authorRank}</span>
                                  <span className="text-[6.5px] text-purple-400 font-mono font-bold tracking-tighter bg-purple-50 px-1 border border-purple-100 rounded">VAL: {justification.id?.substring(0, 6).toUpperCase()}</span>
                                </div>
                                <div className="flex items-center gap-1 text-[6.5px] text-gray-400 font-bold italic">
                                  <Clock className="w-2 h-2 shrink-0" />
                                  <span>REGISTRADO EM: {justification.createdAt ? new Date(justification.createdAt).toLocaleString('pt-BR') : 'DATA INDISPONÍVEL'}</span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center">
                              <button
                                onClick={() => {
                                  const text = justificationDrafts[day];
                                  if (!text || text.trim().length < 5) {
                                    alert("Por favor, digite uma justificativa válida antes de assinar.");
                                    return;
                                  }
                                  setPendingJustification({
                                    day,
                                    date: dayStrFormatted,
                                    text: text
                                  });
                                  setJustificationAuth({ username: "", password: "" });
                                  setShowJustificationAuthModal(true);
                                }}
                                className="bg-purple-600 hover:bg-purple-700 text-white text-[8px] font-black px-4 py-1.5 rounded shadow-sm transition-all flex items-center gap-1 uppercase no-print"
                              >
                                <Lock className="w-3 h-3" />
                                Assinar e Registrar
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                  .filter(Boolean)}
              </tbody>
            </table>
            <div className="bg-gray-50 p-1.5 text-[7px] text-gray-500 italic font-bold border-t border-black text-center">
              * Justificativas de ausência são lançadas manualmente pelos chefes dos motoristas quando o checklist diário não é realizado no período regulamentar.
            </div>
          </div>

          {/* Seção 3: Assinaturas de Validação de Auditoria */}
          <div className="mt-8 pt-6 border-t-2 border-black">
            <div className="text-center mb-6">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-700">CAMPOS DE VALIDAÇÃO DIGITAL E ASSINATURA DOS RESPONSÁVEIS</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-10">
              {/* Coluna 1: Chefes de Motoristas */}
              <div className="space-y-3">
                <div className="bg-gray-100 border border-black p-1 text-[8px] font-extrabold text-center uppercase">Chefes dos Motoristas (Auditoria Mensal)</div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "CH_MOTORISTAS_AMARELA", label: "AMARELA" },
                    { id: "CH_MOTORISTAS_AZUL", label: "AZUL" },
                    { id: "CH_MOTORISTAS_VERDE", label: "VERDE" },
                  ].map((role) => {
                    const sig = getSignature(role.id, activeReport || type);
                    return (
                      <div key={role.id} className="flex flex-col items-center">
                        <div 
                          onClick={() => handleTriggerSignature(role.id, `CHEFE MOTORISTAS ${role.label}`)}
                          className="w-full border border-black h-12 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 bg-white p-0.5"
                        >
                          {sig ? (
                            <div className="text-center">
                              <span className="text-[7px] font-black text-blue-700 leading-none block uppercase">{sig.user}</span>
                              <span className="text-[5px] text-gray-400 block mt-0.5">{sig.date?.substring(0, 10)}</span>
                            </div>
                          ) : (
                            <span className="text-[6.5px] text-purple-600 font-extrabold no-print border border-purple-200 px-1 rounded">ASSINAR</span>
                          )}
                        </div>
                        <span className="text-[7.5px] font-black mt-1 uppercase text-gray-600">{role.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Coluna 2: Comandantes de Prontidão */}
              <div className="space-y-3">
                <div className="bg-gray-100 border border-black p-1 text-[8px] font-extrabold text-center uppercase">Comandantes de Prontidão (Visto Superior)</div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "CMT_PRONTIDAO_AMARELA", label: "AMARELA" },
                    { id: "CMT_PRONTIDAO_AZUL", label: "AZUL" },
                    { id: "CMT_PRONTIDAO_VERDE", label: "VERDE" },
                  ].map((role) => {
                    const sig = getSignature(role.id, activeReport || type);
                    return (
                      <div key={role.id} className="flex flex-col items-center">
                        <div 
                          onClick={() => handleTriggerSignature(role.id, `CMT PRONTIDÃO ${role.label}`)}
                          className="w-full border border-black h-12 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 bg-white p-0.5"
                        >
                          {sig ? (
                            <div className="text-center">
                              <span className="text-[7px] font-black text-blue-700 leading-none block uppercase">{sig.user}</span>
                              <span className="text-[5px] text-gray-400 block mt-0.5">{sig.date?.substring(0, 10)}</span>
                            </div>
                          ) : (
                            <span className="text-[6.5px] text-purple-600 font-extrabold no-print border border-purple-200 px-1 rounded">ASSINAR</span>
                          )}
                        </div>
                        <span className="text-[7.5px] font-black mt-1 uppercase text-gray-600">{role.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Linha Final de Assinaturas (Posto e SGB) */}
            <div className="grid grid-cols-2 gap-10 mt-6 pt-4 border-t border-gray-200 border-dashed">
               <div className="flex flex-col items-center">
                  <div 
                    onClick={() => handleTriggerSignature("CMT_POSTO", "COMANDANTE DO POSTO")}
                    className="w-full border-b border-black h-12 flex items-center justify-center cursor-pointer hover:bg-gray-50 bg-white"
                  >
                    {getSignature("CMT_POSTO", activeReport || type) ? (
                      <span className="text-[9px] font-black text-blue-800 uppercase">{getSignature("CMT_POSTO", activeReport || type)?.user}</span>
                    ) : (
                      <span className="text-[7px] text-gray-300 font-bold uppercase no-print">Assinatura Comandante do Posto</span>
                    )}
                  </div>
                  <span className="text-[8px] font-extrabold mt-1 uppercase">COMANDANTE DO POSTO</span>
               </div>
               <div className="flex flex-col items-center">
                  <div 
                    onClick={() => handleTriggerSignature("CMT_SGB", "COMANDANTE DO SGB")}
                    className="w-full border-b border-black h-12 flex items-center justify-center cursor-pointer hover:bg-gray-50 bg-white"
                  >
                    {getSignature("CMT_SGB", activeReport || type) ? (
                      <span className="text-[9px] font-black text-blue-800 uppercase">{getSignature("CMT_SGB", activeReport || type)?.user}</span>
                    ) : (
                      <span className="text-[7px] text-gray-300 font-bold uppercase no-print">Assinatura Comandante do SGB</span>
                    )}
                  </div>
                  <span className="text-[8px] font-extrabold mt-1 uppercase">COMANDANTE DO SGB</span>
               </div>
            </div>
          </div>
        </div>

        <div className="mt-auto pt-10 flex justify-between items-end text-[7px] font-black text-gray-300 uppercase tracking-tighter">
          <div className="flex flex-col tracking-widest">
            <span>DT-LOG | SISTEMA INTEGRADO DE GESTÃO FLOTA</span>
            <span>DATA DE EMISSÃO: {new Date().toLocaleString("pt-BR")}</span>
          </div>
          <div className="text-right">
            <span>CÓDIGO DE VERIFICAÇÃO CRC: {Math.random().toString(36).substring(2, 10).toUpperCase()}</span>
            <br />
            <span>VERSÃO 4.2.1-PRO | PÁGINA 1 DE 1</span>
          </div>
        </div>
      </div>
    );
  };

  const renderNoveltiesReport = (customPrefix?: string) => {
    const sourceLogs = customPrefix
      ? logs.filter((log) => {
          const matchPrefix = normalizePrefix(log.prefix) === normalizePrefix(customPrefix);
          const logMonth = parseLogDateToMonth(log.date);
          const matchMonth = !monthFilter || logMonth === monthFilter;
          return matchPrefix && matchMonth;
        })
      : filteredLogs;

    const novelties = sourceLogs.filter(
      (log) =>
        String(log.itemsStatus || "").includes("CN") ||
        (log.generalObservation &&
          String(log.generalObservation).trim() !== ""),
    );

    let totalCnItems = 0;
    novelties.forEach((log) => {
      try {
        if (log.itemsDetail) {
          const details = JSON.parse(log.itemsDetail);
          totalCnItems += details.filter((d: any) => d.status === "CN").length;
        }
      } catch (e) {}
    });

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center border-b pb-4 print:pb-2">
          <div>
            <h3 className="text-xl font-black uppercase text-gray-900 text-red-600">
              Relatório de Novidades Constatadas
            </h3>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Filtro:{" "}
              {customPrefix || (selectedPrefixes.size > 0
                ? Array.from(selectedPrefixes).join(", ")
                : "Todas as Viaturas")}{" "}
              | {monthFilter}
            </p>
          </div>
          <div className="text-right hidden print:block">
            <p className="text-[10px] font-black uppercase text-gray-400">
              Página <span className="page-number"></span>
            </p>
          </div>
        </div>

        {/* Resumo de Novidades */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 no-print">
          <div className="bg-red-50 border-2 border-red-100 p-4 rounded-3xl flex items-center gap-4">
            <div className="bg-red-600 p-3 rounded-2xl text-white shadow-lg">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-red-500 uppercase">
                Viaturas com Novidades
              </p>
              <p className="text-xl font-black text-red-900">
                {novelties.length}
              </p>
            </div>
          </div>
          <div className="bg-orange-50 border-2 border-orange-100 p-4 rounded-3xl flex items-center gap-4">
            <div className="bg-orange-600 p-3 rounded-2xl text-white shadow-lg">
              <List className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-orange-500 uppercase">
                Total de Itens "CN"
              </p>
              <p className="text-xl font-black text-orange-900">
                {totalCnItems}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {novelties.map((log, idx) => {
            let cnItems: any[] = [];
            try {
              if (log.itemsDetail) {
                const details = JSON.parse(log.itemsDetail);
                cnItems = details.filter((d: any) => d.status === "CN");
              }
            } catch (e) {}

            return (
              <div
                key={`${log.id}-${idx}`}
                className="border-2 rounded-[2rem] p-6 space-y-4 bg-white print:break-inside-avoid shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start border-b border-gray-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-red-600 text-white p-2 rounded-xl shadow-md">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black uppercase text-gray-900 tracking-tight">
                        {log.prefix}{" "}
                        <span className="text-gray-400 font-bold ml-1">
                          ({log.plate})
                        </span>
                      </h4>
                      <p className="text-[9px] font-bold text-gray-400 uppercase">
                        {new Date(log.date).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-black uppercase text-red-600 bg-red-50 border border-red-100 px-3 py-1 rounded-full">
                      {cnItems.length} Itens com Avaria
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-[11px]">
                  <div>
                    <p className="font-black uppercase text-gray-400 text-[8px] tracking-widest mb-1">
                      Conferente
                    </p>
                    <p className="font-bold uppercase text-blue-700 bg-blue-50 px-3 py-1.5 rounded-xl inline-block">
                      {getInspector(log)}
                    </p>
                  </div>
                  <div>
                    <p className="font-black uppercase text-gray-400 text-[8px] tracking-widest mb-1">
                      Tipo de Checklist
                    </p>
                    <p className="font-bold text-gray-700 uppercase">
                      {log.checklistType}
                    </p>
                  </div>
                  <div>
                    <p className="font-black uppercase text-gray-400 text-[8px] tracking-widest mb-1">
                      Odômetro
                    </p>
                    <p className="font-bold text-gray-700 uppercase">
                      {log.km} KM
                    </p>
                  </div>
                </div>

                {cnItems.length > 0 && (
                  <div className="space-y-2">
                    <p className="font-black uppercase text-gray-400 text-[8px] tracking-widest">
                      Detalhamento de Itens "CN"
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                      {cnItems.map((d: any, i: number) => (
                        <div
                          key={i}
                          className="flex flex-col sm:flex-row sm:items-center justify-between bg-red-50/30 p-3 rounded-2xl border border-red-100/50 gap-2"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                            <span className="font-black text-[10px] uppercase text-red-900">
                              {d.label}
                            </span>
                          </div>
                          <div className="flex-1 sm:text-right">
                            <span className="text-[10px] text-red-600 font-medium italic bg-white px-3 py-1 rounded-lg border border-red-50 shadow-sm">
                              {d.observation || "Sem observação específica"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {log.generalObservation && (
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-orange-400"></div>
                    <p className="font-black uppercase text-gray-400 text-[8px] tracking-widest mb-2">
                      Observações Gerais do Conferente
                    </p>
                    <p className="text-[11px] font-medium text-gray-700 italic leading-relaxed">
                      "{log.generalObservation}"
                    </p>
                  </div>
                )}

                <div className="pt-2 flex justify-end">
                  <p className="text-[8px] font-mono text-gray-300 uppercase">
                    Protocolo: {log.id}
                  </p>
                </div>
              </div>
            );
          })}
          {novelties.length === 0 && (
            <div className="text-center py-32 bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-200">
              <AlertCircle className="w-12 h-12 text-gray-200 mx-auto mb-4" />
              <p className="text-xs font-black uppercase text-gray-400 tracking-widest">
                Nenhuma novidade registrada no período e filtros selecionados.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderSyntheticReport = (customPrefix?: string) => {
    const sourceLogs = customPrefix
      ? logs.filter((log) => {
          const matchPrefix = normalizePrefix(log.prefix) === normalizePrefix(customPrefix);
          const logMonth = parseLogDateToMonth(log.date);
          const matchMonth = !monthFilter || logMonth === monthFilter;
          return matchPrefix && matchMonth;
        })
      : filteredLogs;

    const stats = {
      total: sourceLogs.length,
      diario: sourceLogs.filter((l) => l.checklistType === "Diário").length,
      semanal: sourceLogs.filter((l) => l.checklistType === "Semanal").length,
      withIssues: sourceLogs.filter((l) =>
        String(l.itemsStatus || "").includes("CN"),
      ).length,
      ok: sourceLogs.filter(
        (l) => !String(l.itemsStatus || "").includes("CN"),
      ).length,
    };

    const vehiclesMap: Record<string, number> = {};
    const inspectorsMap: Record<string, number> = {};
    const canonicalPrefixes: Record<string, string> = {};

    sourceLogs.forEach((l) => {
      const norm = normalizePrefix(l.prefix);
      if (!canonicalPrefixes[norm]) canonicalPrefixes[norm] = l.prefix;

      const inspName = getInspector(l);
      vehiclesMap[norm] = (vehiclesMap[norm] || 0) + 1;
      inspectorsMap[inspName] = (inspectorsMap[inspName] || 0) + 1;
    });

    return (
      <div className="space-y-8">
        <div className="flex justify-between items-center border-b pb-4 print:pb-2">
          <div>
            <h3 className="text-xl font-black uppercase text-gray-900">
              Relatório Sintético de Gerenciamento
            </h3>
            <p className="text-xs font-bold text-gray-500 uppercase">
              Período: {monthFilter} |{" "}
              {customPrefix
                ? `Viatura: ${customPrefix}`
                : selectedPrefixes.size > 0
                  ? `${selectedPrefixes.size} Viaturas Selecionadas`
                  : "Geral"}
            </p>
          </div>
          <div className="text-right hidden print:block">
            <p className="text-[10px] font-black uppercase text-gray-400">
              Página <span className="page-number"></span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-3xl border border-blue-100">
            <p className="text-[9px] font-black text-blue-500 uppercase">
              Total Inspeções
            </p>
            <p className="text-2xl font-black text-blue-900">{stats.total}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-3xl border border-green-100">
            <p className="text-[9px] font-black text-green-500 uppercase">
              Total SN (OK)
            </p>
            <p className="text-2xl font-black text-green-900">{stats.ok}</p>
          </div>
          <div className="bg-red-50 p-4 rounded-3xl border border-red-100">
            <p className="text-[9px] font-black text-red-500 uppercase">
              Total CN (Avarias)
            </p>
            <p className="text-2xl font-black text-red-900">
              {stats.withIssues}
            </p>
          </div>
          <div className="bg-orange-50 p-4 rounded-3xl border border-orange-100">
            <p className="text-[9px] font-black text-orange-500 uppercase">
              Conformidade
            </p>
            <p className="text-2xl font-black text-orange-900">
              {stats.total ? ((stats.ok / stats.total) * 100).toFixed(1) : 0}%
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border rounded-2xl overflow-hidden">
            <div className="bg-gray-100 p-3 text-[10px] font-black uppercase">
              Uso da Frota (Top 10)
            </div>
            <table className="w-full text-[10px] text-left">
              <tbody className="divide-y">
                {Object.entries(vehiclesMap)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 10)
                  .map(([norm, count]) => (
                    <tr key={norm}>
                      <td className="p-2 font-bold uppercase">
                        {canonicalPrefixes[norm]}
                      </td>
                      <td className="p-2 text-right font-black text-blue-600">
                        {count}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="border rounded-2xl overflow-hidden">
            <div className="bg-gray-100 p-3 text-[10px] font-black uppercase">
              Atividade por Conferente (Top 10)
            </div>
            <table className="w-full text-[10px] text-left">
              <tbody className="divide-y">
                {Object.entries(inspectorsMap)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 10)
                  .map(([name, count]) => (
                    <tr key={name}>
                      <td className="p-2 font-bold uppercase">{name}</td>
                      <td className="p-2 text-right font-black text-green-600">
                        {count}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderAnalyticalReport = (customPrefix?: string) => {
    const listToRender = customPrefix
      ? logs.filter((log) => {
          const matchPrefix = normalizePrefix(log.prefix) === normalizePrefix(customPrefix);
          const logMonth = parseLogDateToMonth(log.date);
          const matchMonth = !monthFilter || logMonth === monthFilter;
          return matchPrefix && matchMonth;
        })
      : filteredLogs;

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center border-b pb-4 print:pb-2">
          <div>
            <h3 className="text-xl font-black uppercase text-gray-900">
              Relatório Analítico Detalhado
            </h3>
            <p className="text-xs font-bold text-gray-500 uppercase">
              Filtro:{" "}
              {customPrefix
                ? `Viatura: ${customPrefix}`
                : selectedPrefixes.size > 0
                  ? `${selectedPrefixes.size} Viaturas Selecionadas`
                  : "Geral"}{" "}
              | {monthFilter}
            </p>
          </div>
          <div className="text-right hidden print:block">
            <p className="text-[10px] font-black uppercase text-gray-400">
              Página <span className="page-number"></span>
            </p>
          </div>
        </div>

        <div className="overflow-x-auto border rounded-2xl">
          <table className="w-full text-[9px] text-left border-collapse">
            <thead className="bg-gray-100 font-black uppercase text-gray-400 border-b sticky top-0">
              <tr>
                <th className="p-2">Data/Hora</th>
                <th className="p-2">Viatura</th>
                <th className="p-2">KM</th>
                <th className="p-2">Tipo</th>
                <th className="p-2">Conferente</th>
                <th className="p-2">Status</th>
                <th className="p-2">Obs.</th>
              </tr>
            </thead>
            <tbody className="divide-y bg-white">
              {listToRender.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="p-2 whitespace-nowrap">
                    {new Date(log.date).toLocaleString("pt-BR")}
                  </td>
                  <td className="p-2 font-bold uppercase">{log.prefix}</td>
                  <td className="p-2">{log.km}</td>
                  <td className="p-2 uppercase">{log.checklistType}</td>
                  <td className="p-2 uppercase font-medium break-words min-w-[150px]">
                    {getInspector(log)}
                  </td>
                  <td
                    className={`p-2 font-black uppercase ${String(log.itemsStatus || "").includes("CN") ? "text-red-600" : "text-green-600"}`}
                  >
                    {log.itemsStatus || "SN"}
                  </td>
                  <td className="p-2 italic text-gray-500 truncate max-w-[150px]">
                    {log.generalObservation || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderFullReport = () => {
    const columns = [
      { id: "date", label: "Data/Hora" },
      { id: "prefix", label: "Viatura" },
      { id: "plate", label: "Placa" },
      { id: "km", label: "KM" },
      { id: "type", label: "Tipo" },
      { id: "inspector", label: "Conferente" },
      { id: "status", label: "Status" },
      { id: "obs", label: "Observações" },
      { id: "id", label: "Protocolo" },
      { id: "details", label: "Detalhes Itens" },
    ];

    const toggleColumn = (id: string) => {
      setVisibleColumns((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    const filteredByStatus = filteredLogs.filter((log) => {
      if (statusFilter === "all") return true;
      const status = (log.itemsStatus || "").toUpperCase();
      if (statusFilter === "ok") return !String(status).includes("CN");
      if (statusFilter === "cn") return String(status).includes("CN");
      return true;
    });

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center border-b pb-4 print:pb-2">
          <div>
            <h3 className="text-xl font-black uppercase text-gray-900">
              Relatório Completo Personalizável
            </h3>
            <p className="text-xs font-bold text-gray-500 uppercase">
              Filtro:{" "}
              {selectedPrefixes.size > 0
                ? `${selectedPrefixes.size} Viaturas Selecionadas`
                : "Geral"}{" "}
              | {monthFilter} | Status: {statusFilter.toUpperCase()}
            </p>
          </div>
          <div className="text-right hidden print:block">
            <p className="text-[10px] font-black uppercase text-gray-400">
              Página <span className="page-number"></span>
            </p>
          </div>
        </div>

        <div className="no-print space-y-4">
          <div className="bg-gray-50 p-4 rounded-2xl border space-y-3">
            <p className="text-[10px] font-black uppercase text-gray-400 flex items-center gap-2">
              <Filter className="w-3 h-3" /> Selecionar Colunas Visíveis
            </p>
            <div className="flex flex-wrap gap-2">
              {columns.map((col) => (
                <button
                  key={col.id}
                  onClick={() => toggleColumn(col.id)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase transition-all border ${
                    visibleColumns[col.id]
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                      : "bg-white text-gray-400 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {col.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <p className="text-[10px] font-black uppercase text-gray-400">
              Filtrar Status:
            </p>
            <div className="flex bg-gray-100 p-1 rounded-xl border">
              {(["all", "ok", "cn"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                    statusFilter === s
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {s === "all" ? "Todos" : s.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto border rounded-2xl">
          <table className="w-full text-[9px] text-left border-collapse">
            <thead className="bg-gray-100 font-black uppercase text-gray-400 border-b sticky top-0">
              <tr>
                {visibleColumns.date && <th className="p-2">Data/Hora</th>}
                {visibleColumns.prefix && <th className="p-2">Viatura</th>}
                {visibleColumns.plate && <th className="p-2">Placa</th>}
                {visibleColumns.km && <th className="p-2">KM</th>}
                {visibleColumns.type && <th className="p-2">Tipo</th>}
                {visibleColumns.inspector && (
                  <th className="p-2">Conferente</th>
                )}
                {visibleColumns.status && <th className="p-2">Status</th>}
                {visibleColumns.obs && <th className="p-2">Obs.</th>}
                {visibleColumns.id && <th className="p-2">Protocolo</th>}
                {visibleColumns.details && <th className="p-2">Detalhes</th>}
                <th className="p-2 no-print">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y bg-white">
              {filteredByStatus.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  {visibleColumns.date && (
                    <td className="p-2 whitespace-nowrap">
                      {new Date(log.date).toLocaleString("pt-BR")}
                    </td>
                  )}
                  {visibleColumns.prefix && (
                    <td className="p-2 font-bold uppercase">{log.prefix}</td>
                  )}
                  {visibleColumns.plate && (
                    <td className="p-2 font-mono uppercase">{log.plate}</td>
                  )}
                  {visibleColumns.km && <td className="p-2">{log.km}</td>}
                  {visibleColumns.type && (
                    <td className="p-2 uppercase">{log.checklistType}</td>
                  )}
                  {visibleColumns.inspector && (
                    <td className="p-2 uppercase font-medium break-words min-w-[150px]">
                      {getInspector(log)}
                    </td>
                  )}
                  {visibleColumns.status && (
                    <td
                      className={`p-2 font-black uppercase ${String(log.itemsStatus || "").includes("CN") ? "text-red-600" : "text-green-600"}`}
                    >
                      {log.itemsStatus || "SN"}
                    </td>
                  )}
                  {visibleColumns.obs && (
                    <td className="p-2 italic text-gray-500 truncate max-w-[150px]">
                      {log.generalObservation || "-"}
                    </td>
                  )}
                  {visibleColumns.id && (
                    <td className="p-2 font-mono text-[8px] text-gray-400">
                      {log.id}
                    </td>
                  )}
                  {visibleColumns.details && (
                    <td className="p-2 text-[8px] text-gray-400 truncate max-w-[150px]">
                      {log.itemsDetail || "-"}
                    </td>
                  )}
                  <td className="p-2 no-print">
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                      title="Ver Detalhes"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderMonthlyGroupedReport = () => {
    // Agrupar por prefixo normalizado
    const groupedData: Record<
      string,
      { canonicalPrefix: string; logs: LogEntry[] }
    > = {};

    filteredLogs.forEach((log) => {
      const norm = normalizePrefix(log.prefix);
      if (!groupedData[norm]) {
        groupedData[norm] = { canonicalPrefix: log.prefix, logs: [] };
      }
      groupedData[norm].logs.push(log);
    });

    // Ordenar logs dentro de cada grupo por data
    Object.values(groupedData).forEach((group) => {
      group.logs.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );
    });

    const sortedGroups = Object.entries(groupedData).sort((a, b) =>
      a[0].localeCompare(b[0]),
    );

    return (
      <div className="space-y-8">
        <div className="flex justify-between items-center border-b pb-4 print:pb-2">
          <div>
            <h3 className="text-xl font-black uppercase text-gray-900">
              Relatório Mensal Agrupado por Viatura
            </h3>
            <p className="text-xs font-bold text-gray-500 uppercase">
              Mês: {monthFilter} |{" "}
              {selectedPrefixes.size > 0
                ? `${selectedPrefixes.size} Viaturas Selecionadas`
                : "Todas as Viaturas"}
            </p>
          </div>
          <div className="text-right hidden print:block">
            <p className="text-[10px] font-black uppercase text-gray-400">
              Página <span className="page-number"></span>
            </p>
          </div>
        </div>

        {sortedGroups.length === 0 ? (
          <div className="text-center py-20 text-gray-400 font-black uppercase">
            Nenhum dado encontrado para o período.
          </div>
        ) : (
          <div className="space-y-10">
            {sortedGroups.map(([norm, group]) => (
              <div key={norm} className="space-y-4 print:break-inside-avoid">
                <div className="bg-gray-900 text-white px-6 py-3 rounded-2xl flex justify-between items-center shadow-lg">
                  <h4 className="font-black uppercase tracking-widest text-sm">
                    Viatura: {group.canonicalPrefix}
                  </h4>
                  <span className="text-[10px] font-bold opacity-70 uppercase">
                    {group.logs.length} Inspeções no mês
                  </span>
                </div>

                <div className="overflow-x-auto border rounded-2xl shadow-sm">
                  <table className="w-full text-[10px] text-left border-collapse">
                    <thead className="bg-gray-50 font-black uppercase text-gray-400 border-b">
                      <tr>
                        <th className="p-3">Data</th>
                        <th className="p-3">KM</th>
                        <th className="p-3">Tipo</th>
                        <th className="p-3">Conferente</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Observações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y bg-white">
                      {group.logs.map((log) => (
                        <tr
                          key={log.id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="p-3 font-bold">
                            {new Date(log.date).toLocaleDateString("pt-BR")}
                          </td>
                          <td className="p-3 font-mono">{log.km}</td>
                          <td className="p-3 uppercase">{log.checklistType}</td>
                          <td className="p-3 uppercase font-medium">
                            {getInspector(log)}
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-1 rounded-full font-black uppercase text-[9px] ${String(log.itemsStatus || "").includes("CN") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}
                            >
                              {log.itemsStatus || "SN"}
                            </span>
                          </td>
                          <td className="p-3 italic text-gray-500 max-w-[200px] truncate">
                            {log.generalObservation || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderHistoryReport = () => {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center border-b pb-4 print:pb-2">
          <div>
            <h3 className="text-xl font-black uppercase text-gray-900">
              Histórico de Registros (Auditoria)
            </h3>
            <p className="text-xs font-bold text-gray-500 uppercase">
              Filtro:{" "}
              {selectedPrefixes.size > 0
                ? `${selectedPrefixes.size} Viaturas Selecionadas`
                : "Geral"}{" "}
              | {monthFilter}
            </p>
          </div>
          <div className="flex items-center gap-2 no-print">
            <button
              onClick={() => window.print()}
              className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-lg hover:bg-blue-700 transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" /> Imprimir Lista
            </button>
          </div>
          <div className="text-right hidden print:block">
            <p className="text-[10px] font-black uppercase text-gray-400">
              Página <span className="page-number"></span>
            </p>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 bg-gray-50 rounded-2xl border overflow-hidden print:bg-white print:border-0 print:overflow-visible">
          <div className="bg-white p-2 border-b flex items-center gap-2 no-print">
            <Search className="w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Filtrar por Viatura ou Placa..."
              value={prefixSearch}
              onChange={(e) => setPrefixSearch(e.target.value)}
              className="bg-transparent text-xs font-bold outline-none flex-1"
            />
          </div>
          <div className="flex-1 overflow-auto print:overflow-visible">
            <table className="w-full text-[10px] text-left border-collapse">
              <thead className="sticky top-0 bg-gray-100 z-10 text-[9px] font-black text-gray-400 uppercase tracking-widest border-b print:static print:bg-white">
                <tr>
                  <th className="p-3">Data/Hora</th>
                  <th className="p-3">Viatura</th>
                  <th className="p-3">Inspetor</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Relatório</th>
                </tr>
              </thead>
              <tbody className="divide-y bg-white">
                {filteredLogs
                  .filter(
                    (l) =>
                      !prefixSearch ||
                      String(l.prefix)
                        .toLowerCase()
                        .includes(prefixSearch.toLowerCase()) ||
                      String(l.plate)
                        .toLowerCase()
                        .includes(prefixSearch.toLowerCase()),
                  )
                  .map((log, idx) => (
                    <tr
                      key={`${log.id}-${idx}`}
                      className="hover:bg-blue-50/50 transition-colors print:break-inside-avoid"
                    >
                      <td className="p-3 font-mono text-gray-500">
                        {new Date(log.date).toLocaleString("pt-BR")}
                      </td>
                      <td className="p-3 font-black text-gray-800 uppercase">
                        {log.prefix}
                        <span className="text-[8px] font-normal opacity-50 block">
                          {log.plate}
                        </span>
                      </td>
                      <td className="p-3 uppercase font-bold text-gray-600 break-words">
                        {getInspector(log)}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${String(log.itemsStatus).includes("CN") ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"}`}
                        >
                          {log.itemsStatus}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() =>
                              setViewingJsonData({
                                data: getFullData(log),
                                title: "Dados Originais (JSON)",
                                subtitle: `Protocolo: ${log.id} | Viatura: ${log.prefix}`,
                              })
                            }
                            className="p-2 bg-gray-100 hover:bg-blue-600 hover:text-white rounded-lg transition-all shadow-sm no-print"
                            title="Visualizar Dados Originais (JSON)"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="p-2 bg-gray-100 hover:bg-green-600 hover:text-white rounded-lg transition-all shadow-sm no-print"
                            title="Visualizar Relatório Formatado"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderSharedModals = () => (
    <>
      {showClosureModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="bg-blue-600 p-6 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5" />
                <h3 className="font-black text-xs uppercase tracking-widest">
                  Encerramento Mensal
                </h3>
              </div>
              <button
                onClick={() => setShowClosureModal(false)}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
                disabled={isClosingMonth}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="text-center space-y-2">
                <ShieldCheck className="w-12 h-12 text-blue-600 mx-auto" />
                <p className="text-[10px] font-bold text-gray-400 uppercase leading-relaxed">
                  Esta ação encerrará oficialmente as folhas de {monthFilter}{" "}
                  para a viatura {Array.from(selectedPrefixes)[0]}. Esta
                  assinatura é digital e será registrada na auditoria.
                </p>
              </div>

              {closureError && (
                <div className="p-4 bg-red-50 border-2 border-red-200 rounded-2xl text-center space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <p className="text-[10px] font-black text-red-700 leading-normal uppercase">
                    {closureError}
                  </p>
                  {closureError.includes("Acesso Negado") && (
                    <a
                      href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                        `Olá! Sou militar operacional do posto e gostaria de solicitar ao Administrador a permissão de Fechamento Mensal (Chefe dos Motoristas) para o meu usuário '${closureAuth.username}' no CheckViatura Pro.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white font-black rounded-lg text-[9px] uppercase tracking-wider transition-all w-full"
                    >
                      Solicitar Permissão
                    </a>
                  )}
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-500 uppercase ml-1">
                    Usuário
                  </label>
                  <input
                    type="text"
                    value={closureAuth.username}
                    onChange={(e) =>
                      setClosureAuth({
                        ...closureAuth,
                        username: e.target.value,
                      })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleMonthClosure();
                    }}
                    placeholder="USUÁRIO"
                    className="w-full border-2 rounded-2xl p-4 text-center font-black uppercase focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-500 uppercase ml-1">
                    Senha
                  </label>
                  <div className="relative">
                    <input
                      type={showClosurePassword ? "text" : "password"}
                      value={closureAuth.password}
                      onChange={(e) =>
                        setClosureAuth({
                          ...closureAuth,
                          password: e.target.value,
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleMonthClosure();
                      }}
                      placeholder="SENHA"
                      className="w-full border-2 rounded-2xl p-4 text-center font-black tracking-[4px] focus:border-blue-500 outline-none transition-all pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowClosurePassword(!showClosurePassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                    >
                      {showClosurePassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  onClick={handleMonthClosure}
                  disabled={isClosingMonth}
                  className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg hover:bg-blue-700 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isClosingMonth ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                  Assinar e Encerrar
                </button>

                <button
                  onClick={() => setShowClosureModal(false)}
                  className="w-full text-gray-400 font-bold text-[10px] uppercase hover:text-gray-600 py-2"
                  disabled={isClosingMonth}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSignatureModal && signatureRole && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="bg-purple-600 p-6 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5" />
                <h3 className="font-black text-xs uppercase tracking-widest">
                  Assinatura Digital
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowSignatureModal(false);
                  setSignatureRole(null);
                }}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
                disabled={isSigning}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="text-center space-y-2">
                <ShieldCheck className="w-12 h-12 text-purple-600 mx-auto" />
                <p className="text-[11px] font-black uppercase text-purple-700 tracking-wider">
                  {signatureRole.label}
                </p>
                <p className="text-[10px] font-bold text-gray-400 uppercase leading-relaxed">
                  Insira suas credenciais cadastradas no sistema para assinar este relatório digitalmente para {monthFilter}.
                </p>
              </div>

              {sigError && (
                <div className="p-4 bg-red-50 border-2 border-red-200 rounded-2xl text-center space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <p className="text-[10px] font-black text-red-700 leading-normal uppercase">
                    {sigError}
                  </p>
                  {sigError.includes("Acesso Negado") && (
                    <a
                      href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                        `Olá! Sou militar operacional e gostaria de solicitar ao Administrador do Sistema a permissão de assinatura para a função de '${signatureRole.label}' para o meu usuário '${sigAuth.username}' no CheckViatura Pro.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white font-black rounded-lg text-[9px] uppercase tracking-wider transition-all w-full"
                    >
                      Solicitar Permissão
                    </a>
                  )}
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-500 uppercase ml-1">
                    Usuário
                  </label>
                  <input
                    type="text"
                    value={sigAuth.username}
                    onChange={(e) =>
                      setSigAuth({
                        ...sigAuth,
                        username: e.target.value,
                      })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleConfirmSignature();
                    }}
                    placeholder="USUÁRIO"
                    className="w-full border-2 rounded-2xl p-4 text-center font-black uppercase focus:border-purple-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-500 uppercase ml-1">
                    Senha
                  </label>
                  <div className="relative">
                    <input
                      type={showSigPassword ? "text" : "password"}
                      value={sigAuth.password}
                      onChange={(e) =>
                        setSigAuth({
                          ...sigAuth,
                          password: e.target.value,
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleConfirmSignature();
                      }}
                      placeholder="SENHA"
                      className="w-full border-2 rounded-2xl p-4 text-center font-black tracking-[4px] focus:border-purple-500 outline-none transition-all pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSigPassword(!showSigPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                    >
                      {showSigPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  onClick={handleConfirmSignature}
                  disabled={isSigning}
                  className="w-full bg-purple-600 text-white font-black py-4 rounded-2xl shadow-lg hover:bg-purple-700 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSigning ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                  Confirmar Assinatura
                </button>

                <button
                  onClick={() => {
                    setShowSignatureModal(false);
                    setSignatureRole(null);
                  }}
                  className="w-full text-gray-400 font-bold text-[10px] uppercase hover:text-gray-600 py-2"
                  disabled={isSigning}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );

  const renderJsonView = (data: any, title: string, subtitle: string) => {
    return (
      <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between border-b pb-4 print:hidden">
          <div>
            <h3 className="text-xl font-black uppercase text-gray-900">
              {title}
            </h3>
            <p className="text-xs font-bold text-gray-500 uppercase">
              {subtitle}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                const blob = new Blob([JSON.stringify(data, null, 2)], {
                  type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${String(title || "").replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.json`;
                a.click();
              }}
              className="bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-lg hover:bg-green-700"
            >
              <Download className="w-4 h-4" /> Baixar JSON
            </button>
            <button
              onClick={() => window.print()}
              className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-lg hover:bg-blue-700"
            >
              <Printer className="w-4 h-4" /> Imprimir
            </button>
          </div>
        </div>

        <div className="bg-gray-900 p-8 rounded-[2.5rem] border-4 border-gray-800 shadow-2xl overflow-auto max-h-[70vh] print:max-h-none print:bg-white print:border-0 print:p-0">
          <pre className="text-green-400 font-mono text-sm whitespace-pre-wrap break-all leading-relaxed print:text-black print:text-[10px]">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      </div>
    );
  };

  if (viewingJsonData) {
    return (
      <div className="p-6 space-y-6 animate-in fade-in duration-300">
        <button
          onClick={() => setViewingJsonData(null)}
          className="flex items-center gap-2 text-xs font-black uppercase text-gray-400 hover:text-blue-600 transition-colors no-print"
        >
          <ChevronLeft className="w-4 h-4" /> Voltar
        </button>
        {renderJsonView(
          viewingJsonData.data,
          viewingJsonData.title,
          viewingJsonData.subtitle,
        )}
        {renderSharedModals()}
      </div>
    );
  }

  const renderFinalMonthlyBook = () => {
    const prefixesArray = Array.from(selectedPrefixes);

    if (prefixesArray.length === 0) {
      return (
        <div className="p-10 text-center flex flex-col items-center gap-4 text-gray-400 font-bold uppercase bg-white border border-dashed rounded-[2.5rem]">
          <AlertCircle className="w-12 h-12 text-blue-500 mb-2" />
          <h4 className="text-sm font-black uppercase text-gray-700">Nenhuma Viatura Selecionada</h4>
          <p className="text-xs text-gray-400 font-bold max-w-sm leading-relaxed">
            Selecione uma ou mais viaturas na lista à esquerda antes de gerar o Livro Mensal Final.
          </p>
        </div>
      );
    }

    if (!monthFilter) {
      return (
        <div className="p-10 text-center flex flex-col items-center gap-4 text-gray-400 font-bold uppercase bg-white border border-dashed rounded-[2.5rem]">
          <Calendar className="w-12 h-12 text-blue-500 mb-2" />
          <h4 className="text-sm font-black uppercase text-gray-700">Selecione o Mês de Referência</h4>
          <p className="text-xs text-gray-400 font-bold max-w-sm leading-relaxed">
            Selecione o mês de referência nos filtros superiores para calcular os dados correspondentes.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-8 font-sans">
        {/* Painel de Configurações do Livro - NO PRINT */}
        <div className="bg-gray-50 p-6 rounded-[2rem] border-2 border-gray-100 space-y-4 no-print shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl text-white">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-black uppercase text-gray-800">
                Sumário do Livro Mensal Final
              </h4>
              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mt-0.5 animate-pulse">
                Clique nos cards abaixo para incluir/remover relatórios da sequência
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            <div 
              onClick={() => setBookConfig({ ...bookConfig, includeDaily: !bookConfig.includeDaily })}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                bookConfig.includeDaily 
                  ? "bg-blue-50/50 border-blue-500 text-blue-900" 
                  : "bg-white border-gray-100 text-gray-400 hover:border-gray-200"
              }`}
            >
              <span className="text-[9px] font-black uppercase tracking-wider block">1. Ficha Diária</span>
              <span className="text-[13px] font-black uppercase mt-2">{bookConfig.includeDaily ? "Ativo" : "Inativo"}</span>
            </div>

            <div 
              onClick={() => setBookConfig({ ...bookConfig, includeJustifications: !bookConfig.includeJustifications })}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                bookConfig.includeJustifications 
                  ? "bg-blue-50/50 border-blue-500 text-blue-900" 
                  : "bg-white border-gray-100 text-gray-400 hover:border-gray-200"
              }`}
            >
              <span className="text-[9px] font-black uppercase tracking-wider block">2. Justificativas</span>
              <span className="text-[13px] font-black uppercase mt-2">{bookConfig.includeJustifications ? "Ativo" : "Inativo"}</span>
            </div>

            <div 
              onClick={() => setBookConfig({ ...bookConfig, includeWeekly: !bookConfig.includeWeekly })}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                bookConfig.includeWeekly 
                  ? "bg-blue-50/50 border-blue-500 text-blue-900" 
                  : "bg-white border-gray-100 text-gray-400 hover:border-gray-200"
              }`}
            >
              <span className="text-[9px] font-black uppercase tracking-wider block">3. Ficha Semanal</span>
              <span className="text-[13px] font-black uppercase mt-2">{bookConfig.includeWeekly ? "Ativo" : "Inativo"}</span>
            </div>

            <div 
              onClick={() => setBookConfig({ ...bookConfig, includeNovelties: !bookConfig.includeNovelties })}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                bookConfig.includeNovelties 
                  ? "bg-blue-50/50 border-blue-500 text-blue-900" 
                  : "bg-white border-gray-100 text-gray-400 hover:border-gray-200"
              }`}
            >
              <span className="text-[9px] font-black uppercase tracking-wider block">4. Novidades</span>
              <span className="text-[13px] font-black uppercase mt-2">{bookConfig.includeNovelties ? "Ativo" : "Inativo"}</span>
            </div>

            <div 
              onClick={() => setBookConfig({ ...bookConfig, includeSynthetic: !bookConfig.includeSynthetic })}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                bookConfig.includeSynthetic 
                  ? "bg-blue-50/50 border-blue-500 text-blue-900" 
                  : "bg-white border-gray-100 text-gray-400 hover:border-gray-200"
              }`}
            >
              <span className="text-[9px] font-black uppercase tracking-wider block">5. Sintético</span>
              <span className="text-[13px] font-black uppercase mt-2">{bookConfig.includeSynthetic ? "Ativo" : "Inativo"}</span>
            </div>

            <div 
              onClick={() => setBookConfig({ ...bookConfig, includeAnalytical: !bookConfig.includeAnalytical })}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                bookConfig.includeAnalytical 
                  ? "bg-blue-50/50 border-blue-500 text-blue-900" 
                  : "bg-white border-gray-100 text-gray-400 hover:border-gray-200"
              }`}
            >
              <span className="text-[9px] font-black uppercase tracking-wider block">6. Analítico</span>
              <span className="text-[13px] font-black uppercase mt-2">{bookConfig.includeAnalytical ? "Ativo" : "Inativo"}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-gray-100 no-print">
            <span className="text-[9px] font-black uppercase text-gray-400">Total de Viaturas Geradas:</span>
            <span className="bg-blue-100 text-blue-800 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
              {prefixesArray.length} Selecionadas
            </span>
          </div>
        </div>

        {/* Livro Sequencial de Páginas */}
        <div className="space-y-12 print:space-y-0 print:gap-0">
          {prefixesArray.map((prefix, idx) => {
            const vehicle = settings.vehicles?.find(
              (v) => normalizePrefix(v.prefix) === prefix
            );
            const isMoto = vehicle?.type === "MOTOCICLETA";
            const isAb = vehicle?.type === "AB/AÉREA";

            return (
              <div key={prefix} className="space-y-8 print:space-y-0">
                {/* Visual Section Indicator (No-Print) */}
                <div className="no-print bg-gradient-to-r from-blue-900 to-blue-700 p-6 rounded-3xl text-white shadow-md flex items-center justify-between">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-blue-200">
                      Viatura {idx + 1} de {prefixesArray.length}
                    </span>
                    <h3 className="text-xl font-black uppercase tracking-tight mt-1">
                      {prefix}
                    </h3>
                    <p className="text-xs text-blue-100 uppercase font-semibold mt-1">
                      {vehicle?.station ? `Posto d/ Serviço: ${vehicle.station}` : "Sem Posto Definido"} | Tipo: {vehicle?.type || "LEVE/PESADA"}
                    </p>
                  </div>
                  <div className="bg-white/10 px-4 py-2 rounded-2xl text-center">
                    <span className="text-[9px] font-extrabold uppercase block text-blue-200">Mês de Ref.</span>
                    <span className="text-xs font-black uppercase">{getMonthLabel(monthFilter)}</span>
                  </div>
                </div>

                {/* Daily Control Page (Ficha Diária) */}
                {bookConfig.includeDaily && (
                  <div className="bg-white print:p-0 relative print:break-inside-avoid shadow-sm print:shadow-none border rounded-[2rem] p-6 print:border-none print:rounded-none">
                    <div className="no-print mb-4 border-b pb-2 flex justify-between items-center bg-gray-50/50 p-3 rounded-xl">
                      <span className="text-[10px] font-black uppercase text-gray-500">Relatório Ficha de Controle Diário</span>
                      <span className="text-[8px] bg-green-100 text-green-800 px-2 py-0.5 rounded font-bold uppercase">Inserido</span>
                    </div>
                    {isMoto ? renderDailyControlMotosReport(prefix) : renderDailyControlReport(prefix)}
                    <div className="print:page-break-after-always print:break-after-page mt-8 no-print border-b-2 border-dashed border-gray-200" style={{ pageBreakAfter: "always" }} />
                  </div>
                )}

                {/* Justificativas Page */}
                {bookConfig.includeJustifications && (
                  <div className="bg-white print:p-0 relative print:break-inside-avoid shadow-sm print:shadow-none border rounded-[2rem] p-6 print:border-none print:rounded-none mt-8">
                    <div className="no-print mb-4 border-b pb-2 flex justify-between items-center bg-gray-50/50 p-3 rounded-xl">
                      <span className="text-[10px] font-black uppercase text-gray-500">Folha de Justificativas e Registros</span>
                      <span className="text-[8px] bg-green-100 text-green-800 px-2 py-0.5 rounded font-bold uppercase">Inserido</span>
                    </div>
                    {renderJustificationSheet("DIÁRIO", prefix, monthFilter)}
                    <div className="print:page-break-after-always print:break-after-page mt-8 no-print border-b-2 border-dashed border-gray-200" style={{ pageBreakAfter: "always" }} />
                  </div>
                )}

                {/* Weekly Control Page (Ficha Semanal) */}
                {bookConfig.includeWeekly && (
                  <div className="bg-white print:p-0 relative print:break-inside-avoid shadow-sm print:shadow-none border rounded-[2rem] p-6 print:border-none print:rounded-none mt-8">
                    <div className="no-print mb-4 border-b pb-2 flex justify-between items-center bg-gray-50/50 p-3 rounded-xl">
                      <span className="text-[10px] font-black uppercase text-gray-500">Relatório Ficha de Controle Semanal</span>
                      <span className="text-[8px] bg-green-100 text-green-800 px-2 py-0.5 rounded font-bold uppercase">Inserido</span>
                    </div>
                    {isMoto 
                      ? renderWeeklyControlReport("MOTOCICLETA", prefix)
                      : isAb 
                        ? renderWeeklyControlReport("AB/AÉREA", prefix)
                        : renderWeeklyControlReport("LEVE/PESADA", prefix)
                    }
                    <div className="print:page-break-after-always print:break-after-page mt-8 no-print border-b-2 border-dashed border-gray-200" style={{ pageBreakAfter: "always" }} />
                  </div>
                )}

                {/* Novelties Page */}
                {bookConfig.includeNovelties && (
                  <div className="bg-white print:p-0 relative print:break-inside-avoid shadow-sm print:shadow-none border rounded-[2rem] p-6 print:border-none print:rounded-none mt-8">
                    <div className="no-print mb-4 border-b pb-2 flex justify-between items-center bg-gray-50/50 p-3 rounded-xl">
                      <span className="text-[10px] font-black uppercase text-gray-500">Relatório de Novidades</span>
                      <span className="text-[8px] bg-green-100 text-green-800 px-2 py-0.5 rounded font-bold uppercase">Inserido</span>
                    </div>
                    {renderNoveltiesReport(prefix)}
                    <div className="print:page-break-after-always print:break-after-page mt-8 no-print border-b-2 border-dashed border-gray-200" style={{ pageBreakAfter: "always" }} />
                  </div>
                )}

                {/* Synthetic Page */}
                {bookConfig.includeSynthetic && (
                  <div className="bg-white print:p-0 relative print:break-inside-avoid shadow-sm print:shadow-none border rounded-[2rem] p-6 print:border-none print:rounded-none mt-8">
                    <div className="no-print mb-4 border-b pb-2 flex justify-between items-center bg-gray-50/50 p-3 rounded-xl">
                      <span className="text-[10px] font-black uppercase text-gray-500">Relatório Sintético de Gerenciamento</span>
                      <span className="text-[8px] bg-green-100 text-green-800 px-2 py-0.5 rounded font-bold uppercase">Inserido</span>
                    </div>
                    {renderSyntheticReport(prefix)}
                    <div className="print:page-break-after-always print:break-after-page mt-8 no-print border-b-2 border-dashed border-gray-200" style={{ pageBreakAfter: "always" }} />
                  </div>
                )}

                {/* Analytical Page */}
                {bookConfig.includeAnalytical && (
                  <div className="bg-white print:p-0 relative print:break-inside-avoid shadow-sm print:shadow-none border rounded-[2rem] p-6 print:border-none print:rounded-none mt-8">
                    <div className="no-print mb-4 border-b pb-2 flex justify-between items-center bg-gray-50/50 p-3 rounded-xl">
                      <span className="text-[10px] font-black uppercase text-gray-400">Relatório Analítico Detalhado</span>
                      <span className="text-[8px] bg-green-100 text-green-800 px-2 py-0.5 rounded font-bold uppercase">Inserido</span>
                    </div>
                    {renderAnalyticalReport(prefix)}
                    {idx < prefixesArray.length - 1 && (
                      <div className="print:page-break-after-always print:break-after-page mt-8 no-print border-b-2 border-dashed border-gray-200" style={{ pageBreakAfter: "always" }} />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (activeReport) {
    return (
      <div className="p-6 space-y-6 animate-in fade-in duration-300">
        <div className="flex items-center justify-between no-print">
          <button
            onClick={() => setActiveReport(null)}
            className="flex items-center gap-2 text-xs font-black uppercase text-gray-400 hover:text-blue-600 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Voltar aos Relatórios
          </button>
          <div className="flex gap-2">
            <button
              onClick={() =>
                setViewingJsonData({
                  data: {
                    reportType: activeReport,
                    date: new Date().toISOString(),
                    logs: filteredLogs.map((l) => ({
                      id: l.id,
                      date: l.date,
                      prefix: l.prefix,
                      plate: l.plate,
                      inspector: l.inspector,
                      status: l.itemsStatus,
                      fullData: getFullData(l),
                    })),
                  },
                  title: `Dados do Relatório ${(activeReport || "").toUpperCase()}`,
                  subtitle: `Total de Registros: ${filteredLogs.length}`,
                })
              }
              disabled={isGeneratingPdf}
              className="bg-orange-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-lg hover:bg-orange-700 disabled:opacity-50"
            >
              <Eye className="w-4 h-4" /> Visualizar JSON
            </button>
            <button
              onClick={() => generateReportPdf(false)}
              disabled={isGeneratingPdf}
              className="bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-lg hover:bg-green-700 disabled:opacity-50"
            >
              <Download className="w-4 h-4" /> Baixar PDF
            </button>
            <button
              onClick={handlePrint}
              className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-lg hover:bg-blue-700"
            >
              <Printer className="w-4 h-4" /> Imprimir
            </button>
          </div>
        </div>

        <div className="bg-white border rounded-3xl p-6 shadow-sm no-print">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2.5 rounded-2xl text-white shadow-lg">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase text-gray-900 leading-tight">
                  Painel de Justificativas
                </h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Lance ausências ou registros retroativos
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowJustificationModal(true)}
                className="bg-purple-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-lg hover:bg-purple-700 transition-all"
              >
                <AlertCircle className="w-4 h-4" /> Justificar Dia
              </button>
              <button
                onClick={() => setShowClosureModal(true)}
                className="bg-blue-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-lg hover:bg-black transition-all"
              >
                <Lock className="w-4 h-4" /> Fechamento Mensal
              </button>
            </div>
          </div>
        </div>

        {showJustificationAuthModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black uppercase text-gray-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-purple-600" />
                  Assinatura Digital
                </h3>
                <button
                  onClick={() => setShowJustificationAuthModal(false)}
                  className="text-gray-300 hover:text-gray-900 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="bg-purple-50 border border-purple-100 p-4 rounded-2xl">
                <p className="text-[10px] text-purple-800 font-bold uppercase leading-relaxed">
                  VALIDANDO REGISTRO PARA O DIA <span className="text-purple-600">{pendingJustification?.day.toString().padStart(2, "0")}</span>:
                  <br />
                  <span className="text-[9px] italic line-clamp-2 mt-1">"{pendingJustification?.text}"</span>
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-1">
                    Usuário (Chefe dos Motoristas)
                  </label>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Seu usuário"
                      value={justificationAuth.username}
                      onChange={(e) =>
                        setJustificationAuth({
                          ...justificationAuth,
                          username: e.target.value,
                        })
                      }
                      className="w-full border-2 rounded-2xl p-4 pl-12 text-sm font-bold focus:border-purple-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-1">
                    Senha Secreta
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="password"
                      placeholder="Sua senha"
                      value={justificationAuth.password}
                      onChange={(e) =>
                        setJustificationAuth({
                          ...justificationAuth,
                          password: e.target.value,
                        })
                      }
                      className="w-full border-2 rounded-2xl p-4 pl-12 text-sm font-bold focus:border-purple-500 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              <button
                disabled={isSigning}
                onClick={handleConfirmJustificationAuth}
                className="w-full bg-blue-900 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-black transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2 group"
              >
                {isSigning ? (
                   <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                   <ShieldCheck className="w-4 h-4 group-hover:scale-110 transition-transform" />
                )}
                {isSigning ? "VALIDANDO..." : "CONFIRMAR ASSINATURA"}
              </button>

              <p className="text-[9px] text-gray-400 text-center uppercase font-bold tracking-tighter">
                O registro será gravado com carimbo de tempo e HASH de integridade.
              </p>
            </div>
          </div>
        )}

        {showJustificationModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4 no-print">
            <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black uppercase text-gray-900 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-purple-600" />
                  Lançar Justificativa
                </h3>
                <button
                  onClick={() => setShowJustificationModal(false)}
                  className="text-gray-300 hover:text-gray-900 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="bg-purple-50 border border-purple-100 p-4 rounded-2xl">
                <p className="text-[10px] text-purple-800 font-bold uppercase leading-relaxed text-center">
                  Esta justificativa será registrada no banco de dados para o
                  mês de{" "}
                  <span className="text-purple-600">
                    {getMonthLabel(monthFilter)}
                  </span>
                  .
                </p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">
                      Viatura
                    </label>
                    <input
                      type="text"
                      value={
                        selectedPrefixes.size === 1
                          ? Array.from(selectedPrefixes)[0]
                          : "Selecione uma VTR"
                      }
                      disabled
                      className="w-full border-2 rounded-2xl p-4 bg-gray-50 font-black uppercase text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">
                      Para o Dia
                    </label>
                    <select
                      value={newJustification.date}
                      onChange={(e) => {
                        const selectedDate = e.target.value;
                        const prefix = Array.from(selectedPrefixes)[0];
                        
                        const [y, m, d] = selectedDate.split("-").map(Number);
                        const existing = justifications.find(
                          (j) =>
                            isDateMatch(j.date || (j as any).dateRef, y, m, d) &&
                            normalizePrefix(j.vehicleType) === normalizePrefix(prefix),
                        );
                        
                        setNewJustification({
                          ...newJustification,
                          date: selectedDate,
                          justification: existing ? existing.justification : "",
                        });
                      }}
                      className="w-full border-2 rounded-2xl p-4 text-sm font-bold focus:border-purple-500 outline-none transition-all bg-white"
                    >
                      <option value="">Selecione o Dia</option>
                      {(() => {
                        if (!monthFilter || selectedPrefixes.size !== 1)
                          return null;
                        const [year, monthNum] = monthFilter
                          .split("-")
                          .map(Number);
                        const daysInMonth = new Date(
                          year,
                          monthNum,
                          0,
                        ).getDate();
                        const prefix = Array.from(selectedPrefixes)[0];

                        // Dias que JÁ TÊM checklist
                        const logsThisMonth = logs.filter(
                          (log) =>
                            normalizePrefix(log.prefix) ===
                              normalizePrefix(prefix) &&
                            parseLogDateToMonth(log.date) === monthFilter,
                        );
                        const filledDays = new Set(
                          logsThisMonth.map((l) => new Date(l.date).getDate()),
                        );

                        return Array.from(
                          { length: daysInMonth },
                          (_, i) => i + 1,
                        )
                          .map((d) => {
                            const dStr = `${year}-${monthNum.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
                            return (
                              <option key={d} value={dStr}>
                                {d.toString().padStart(2, "0")} (
                                {getMonthLabel(monthFilter).split(" ")[0]})
                              </option>
                            );
                          });
                      })()}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">
                      Usuário (Chefe / Assinante)
                    </label>
                    <input
                      type="text"
                      placeholder="Seu usuário"
                      value={justificationAuth.username}
                      onChange={(e) =>
                        setJustificationAuth({
                          ...justificationAuth,
                          username: e.target.value,
                        })
                      }
                      className="w-full border-2 rounded-2xl p-4 text-sm font-bold focus:border-purple-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">
                      Senha Secreta
                    </label>
                    <input
                      type="password"
                      placeholder="Sua senha"
                      value={justificationAuth.password}
                      onChange={(e) =>
                        setJustificationAuth({
                          ...justificationAuth,
                          password: e.target.value,
                        })
                      }
                      className="w-full border-2 rounded-2xl p-4 text-sm font-bold focus:border-purple-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-1">
                    Justificativa / Motivo
                  </label>
                  <textarea
                    rows={4}
                    value={newJustification.justification}
                    onChange={(e) =>
                      setNewJustification({
                        ...newJustification,
                        justification: e.target.value,
                      })
                    }
                    placeholder="Ex: Não houve preenchimento devido a pane elétrica no tablet da viatura."
                    className="w-full border-2 rounded-2xl p-4 text-sm font-medium focus:border-purple-500 outline-none transition-all resize-none"
                  />
                </div>
              </div>

              <button
                onClick={async () => {
                  if (
                    !newJustification.date ||
                    !newJustification.justification ||
                    !justificationAuth.username ||
                    !justificationAuth.password ||
                    selectedPrefixes.size !== 1
                  ) {
                    alert(
                      "Preencha todos os campos obrigatórios (incluindo Usuário, Senha e data Ref) e selecione uma viatura.",
                    );
                    return;
                  }
                  const rawUrl = settings.googleSheetUrl;
                  if (!rawUrl) {
                    alert(
                      "URL do banco de dados não configurada nas configurações.",
                    );
                    return;
                  }

                  try {
                    const usersResp = await fetch(`${rawUrl}${rawUrl.includes('?') ? '&' : '?'}action=getUsers`);
                    const users = await usersResp.json();
                    const user = users.find((u: any) => 
                      u.username.toLowerCase() === justificationAuth.username.toLowerCase() && 
                      u.password.toString() === justificationAuth.password
                    );

                    if (!user) {
                      alert("Usuário ou Senha incorretos. A inserção de justificativas exige cadastro de chefe dos motoristas com senha.");
                      return;
                    }

                    // Validação de Permissão de Chefe dos Motoristas (com senha)
                    let userPerms = user.permissions || {};
                    if (typeof userPerms === 'string') {
                      try {
                        userPerms = JSON.parse(userPerms);
                      } catch (err) {
                        userPerms = {};
                      }
                    }

                    const isMaster = user.username.toLowerCase() === 'cavalieri';

                    if (!isMaster) {
                      if (userPerms.canSign !== true || userPerms.signAsChefeMotoristas !== true) {
                        alert("Acesso Negado: Seu usuário não tem permissão para assinar ou atuar como CHEFE DOS MOTORISTAS.\n\nEnvie uma mensagem para o Administrador do Sistema para solicitar essa permissão.");
                        return;
                      }
                    }

                    const prefix = Array.from(selectedPrefixes)[0];

                    const jData = {
                      action: "saveJustification",
                      id: crypto.randomUUID(),
                      date: newJustification.date,
                      dateRef: newJustification.date, // Add dateRef for script compatibility
                      type: activeReport || "GERAL",
                      vehicleType: prefix,
                      station: prefix,
                      justification: newJustification.justification,
                      author: `${user.rank || ''} ${user.name || user.username}`.trim(),
                      authorRank: user.rank || "CHEFE DOS MOTORISTAS",
                      createdAt: new Date().toISOString(),
                      month: monthFilter,
                      status: "SIGNED",
                    };

                    const url = `${rawUrl}${rawUrl.includes("?") ? "&" : "?"}action=saveJustification`;
                    await fetch(url, {
                      method: "POST",
                      mode: "no-cors",
                      body: JSON.stringify(jData),
                    });
                    alert("JUSTIFICATIVA REGISTRADA NO BANCO COM SUCESSO!");
                    setShowJustificationModal(false);
                    setNewJustification({
                      date: "",
                      justification: "",
                      author: "",
                      authorRank: "",
                    });
                    setJustificationAuth({
                      username: "",
                      password: "",
                    });
                    fetchJustifications();
                  } catch (e) {
                    alert("Erro ao salvar justificativa no banco de dados.");
                  }
                }}
                className="w-full bg-purple-600 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-purple-700 transition-all uppercase tracking-widest text-xs"
              >
                Registrar Justificativa
              </button>
            </div>
          </div>
        )}

        <div
          ref={reportRef}
          data-pdf-content="report"
          className="bg-white p-8 rounded-[2.5rem] border shadow-sm print:p-0 print:border-0 print:shadow-none relative overflow-hidden"
        >
          <Watermark />
          {activeReport === "fleet_dashboard" && (
            <FleetDashboard 
              logs={logs}
              settings={settings}
              justifications={justifications}
              onRefresh={() => fetchJustifications()}
              isLoading={isFetchingJustifications || isLoading}
              onUpdateVehicles={onUpdateVehicles}
            />
          )}
          {activeReport === "novelties" && renderNoveltiesReport()}
          {activeReport === "synthetic" && renderSyntheticReport()}
          {activeReport === "analytical" && renderAnalyticalReport()}
          {activeReport === "full" && renderFullReport()}
          {activeReport === "monthly_grouped" && renderMonthlyGroupedReport()}
          {activeReport === "history" && renderHistoryReport()}

          {activeReport === "daily_control" && renderDailyControlReport()}
          {activeReport === "daily_control_motos" &&
            renderDailyControlMotosReport()}
          {activeReport === "weekly_leves" &&
            renderWeeklyControlReport("LEVE/PESADA")}
          {activeReport === "weekly_motos" &&
            renderWeeklyControlReport("MOTOCICLETA")}
          {activeReport === "weekly_ab" &&
            renderWeeklyControlReport("AB/AÉREA")}
          {activeReport === "retroactive_logs" && renderRetroactiveLogsReport()}
          {activeReport === "final_monthly_book" && renderFinalMonthlyBook()}
          {/* Print Footer for Page Numbering */}
          <div className="hidden print:flex fixed bottom-0 left-0 right-0 h-8 items-center justify-between px-8 text-[8px] text-gray-400 border-t border-gray-100 bg-white">
            <span className="font-black uppercase">
              Relatório Gerencial - CheckViatura Pro
            </span>
            <span className="page-number font-black uppercase"></span>
          </div>
        </div>

        {selectedLog && (
          <div className="fixed inset-0 z-[250] bg-gray-900/90 backdrop-blur-md flex items-center justify-center p-0 no-print overflow-y-auto">
            <div className="bg-white w-full h-full sm:h-full sm:max-w-full rounded-none shadow-2xl overflow-hidden flex flex-col">
              <div className="bg-gray-900 p-4 flex flex-col sm:flex-row items-center justify-between text-white shrink-0 no-print gap-4">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="bg-blue-600 p-2 rounded-xl">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-xs uppercase tracking-widest leading-none">
                      Relatório de Auditoria
                    </h3>
                    <p className="text-[8px] text-gray-400 mt-1">
                      Protocolo: {selectedLog.id}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-end">
                  <button
                    onClick={() => {
                      const log = selectedLog;
                      setSelectedLog(null);
                      setViewingJsonData({
                        data: getFullData(log),
                        title: "Dados Originais (JSON)",
                        subtitle: `Protocolo: ${log.id} | Viatura: ${log.prefix}`,
                      });
                    }}
                    disabled={isGeneratingPdf}
                    className="flex-1 sm:flex-none bg-orange-600 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 shadow-lg hover:bg-orange-700 transition-all disabled:opacity-50"
                  >
                    <Eye className="w-4 h-4" />
                    Visualizar JSON
                  </button>
                  <button
                    onClick={() => generatePdf(false)}
                    disabled={isGeneratingPdf}
                    className="flex-1 sm:flex-none bg-green-600 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 shadow-lg hover:bg-green-700 transition-all disabled:opacity-50"
                  >
                    {isGeneratingPdf ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    Baixar PDF
                  </button>
                  <button
                    onClick={handlePrintMirror}
                    className="flex-1 sm:flex-none bg-blue-600 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 shadow-lg hover:bg-blue-700 transition-all"
                  >
                    <Printer className="w-4 h-4" />
                    <span className="hidden xs:inline">Imprimir</span>
                  </button>
                  <button
                    onClick={() => setSelectedLog(null)}
                    className="p-2 hover:bg-red-500 rounded-full transition-all"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div
                ref={printMirrorRef}
                className="flex-1 overflow-auto bg-white p-4 sm:p-8 print:p-0 print:overflow-visible"
              >
                <div
                  data-pdf-content="audit"
                  className="max-w-4xl mx-auto space-y-4 print:space-y-4"
                >
                  {(() => {
                    const mirrorData = getFullData(selectedLog);
                    if (!mirrorData)
                      return (
                        <div className="p-10 text-center font-bold text-red-500 uppercase">
                          Erro: Dados íntegros não encontrados no banco.
                        </div>
                      );

                    const originalInspectionDateTime = formatDate(
                      selectedLog.date,
                    );

                    // Fallback para imagens da viatura se não estiverem no log (otimização de tamanho)
                    const inspectionImages =
                      mirrorData.vehicleImages &&
                      mirrorData.vehicleImages.length > 0
                        ? mirrorData.vehicleImages
                        : settings?.vehicleImages || [];

                    const inspectionRatios =
                      mirrorData.vehicleImageRatios ||
                      settings?.vehicleImageRatios ||
                      [];
                    const hasInspectionImages = inspectionImages.some(
                      (img: string) => img && img !== "",
                    );

                    return (
                      <div className="flex flex-col gap-4">
                        <Header
                          title={
                            mirrorData.headerTitle || "Checklist de Viatura"
                          }
                          date={mirrorData.date || ""}
                          onDateChange={() => {}}
                          logoUrl1={mirrorData.headerLogoUrl1}
                          logoUrl2={mirrorData.headerLogoUrl2}
                          bgColor={mirrorData.headerBgColor}
                        />

                        <div className="px-4 py-2 space-y-6">
                          <section className="bg-gray-50 p-4 rounded-2xl border grid grid-cols-4 gap-4 print:grid-cols-4 shadow-inner">
                            <div className="flex flex-col">
                              <span className="text-[8px] font-black text-gray-400 uppercase">
                                Viatura
                              </span>
                              <span className="text-[11px] font-black uppercase text-gray-800">
                                {selectedLog.prefix || mirrorData.prefix}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[8px] font-black text-gray-400 uppercase">
                                Placa
                              </span>
                              <span className="text-[11px] font-black uppercase text-gray-800">
                                {selectedLog.plate || mirrorData.plate}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[8px] font-black text-gray-400 uppercase">
                                Ciclo
                              </span>
                              <span className="text-[11px] font-black uppercase text-blue-600">
                                {selectedLog.checklistType ||
                                  mirrorData.checklistType}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[8px] font-black text-gray-400 uppercase">
                                Odômetro
                              </span>
                              <span className="text-[11px] font-black uppercase text-gray-800">
                                {selectedLog.km || mirrorData.km} KM
                              </span>
                            </div>
                          </section>

                          {hasInspectionImages && (
                            <section className="space-y-3">
                              <h4 className="text-[10px] font-black uppercase text-gray-400 border-b pb-1">
                                Mapeamento Visual de Avarias
                              </h4>
                              <div className="grid grid-cols-3 gap-3 print:grid-cols-3">
                                {inspectionImages.map(
                                  (img: string, idx: number) => {
                                    if (!img || img === "") return null;
                                    const dmgs = (
                                      mirrorData.damages || []
                                    ).filter((d: any) => d.imageIndex === idx);
                                    const ratio =
                                      inspectionRatios[idx] || "landscape";
                                    return (
                                      <div
                                        key={idx}
                                        className={`relative bg-gray-50 border rounded-xl overflow-hidden shadow-sm ${ratio === "landscape" ? "aspect-video" : "aspect-[3/4]"}`}
                                      >
                                        <img
                                          src={img}
                                          className="w-full h-full object-contain"
                                          alt={`Vista ${idx}`}
                                          referrerPolicy="no-referrer"
                                        />
                                        {dmgs.map((d: any, dIdx: number) => (
                                          <div
                                            key={`dmg-${d.id || dIdx}-${dIdx}`}
                                            className="absolute w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-white shadow-sm -translate-x-1/2 -translate-y-1/2"
                                            style={{
                                              left: `${d.x}%`,
                                              top: `${d.y}%`,
                                            }}
                                          />
                                        ))}
                                      </div>
                                    );
                                  },
                                )}
                              </div>
                            </section>
                          )}

                          <section className="border rounded-2xl overflow-hidden shadow-sm">
                            <table className="w-full text-left text-[10px] border-collapse">
                              <thead className="bg-gray-100 uppercase font-black text-gray-500">
                                <tr>
                                  <th className="p-3">Item de Controle</th>
                                  <th className="p-3 text-center">Status</th>
                                  <th className="p-3">
                                    Observações / Evidências
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {(mirrorData.items || []).map(
                                  (it: any, i: number) => (
                                    <tr
                                      key={`item-${it.id || i}-${i}`}
                                      className={
                                        it.status === "CN" ? "bg-red-50/50" : ""
                                      }
                                    >
                                      <td className="p-3 font-bold text-gray-700">
                                        {it.label}
                                      </td>
                                      <td className="p-3 text-center">
                                        <span
                                          className={`px-2 py-0.5 rounded text-white font-black text-[9px] uppercase ${it.status === "CN" ? "bg-red-600" : it.status === "OK" || it.status === "SN" ? "bg-green-600" : "bg-gray-300"}`}
                                        >
                                          {it.status === "OK"
                                            ? "SN"
                                            : it.status}
                                        </span>
                                      </td>
                                      <td className="p-3 italic text-gray-500">
                                        {it.observation || "-"}
                                        {it.photos?.length > 0 && (
                                          <span className="ml-2 inline-flex items-center text-blue-600 font-bold text-[8px] uppercase tracking-tighter">
                                            [+ FOTOS]
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  ),
                                )}
                              </tbody>
                            </table>
                          </section>

                          {(selectedLog.generalObservation ||
                            mirrorData.generalObservation) && (
                            <section className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100 shadow-inner">
                              <span className="text-[8px] font-black text-gray-400 uppercase block mb-1">
                                Informações Gerais / Parecer do Inspetor
                              </span>
                              <p className="text-[11px] italic leading-relaxed text-gray-700 font-medium">
                                "
                                {selectedLog.generalObservation ||
                                  mirrorData.generalObservation}
                                "
                              </p>
                            </section>
                          )}

                          <Footer
                            signatureName={
                              mirrorData.signatureName || selectedLog.inspector
                            }
                            signatureRank={mirrorData.signatureRank || ""}
                            date={mirrorData.date}
                          />

                          <div className="text-center pt-2">
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                              Data/Hora Original da Inspeção:{" "}
                            </span>
                            <span className="text-[10px] font-black text-gray-700">
                              {originalInspectionDateTime}
                            </span>
                          </div>

                          <section className="space-y-4 pt-6 border-t break-before-page">
                            <h4 className="text-[10px] font-black uppercase text-gray-400 text-center tracking-widest">
                              Anexo de Evidências Fotográficas
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 print:grid-cols-2 gap-4">
                              {(mirrorData.items || [])
                                .filter(
                                  (i: any) => i.photos && i.photos.length > 0,
                                )
                                .map((item: any) =>
                                  item.photos.map((p: string, idx: number) => (
                                    <div
                                      key={`${item.id}-${idx}`}
                                      className="flex flex-col gap-1 break-inside-avoid"
                                    >
                                      <div className="relative aspect-square border-2 border-gray-100 rounded-2xl overflow-hidden bg-gray-50 shadow-sm">
                                        <img
                                          src={p}
                                          className="w-full h-full object-contain"
                                          alt={`Foto Item ${item.label}`}
                                          referrerPolicy="no-referrer"
                                        />
                                      </div>
                                      <div className="bg-gray-800 text-white text-[8px] p-2 rounded-lg font-black truncate uppercase tracking-tighter">
                                        Item: {item.label}
                                      </div>
                                    </div>
                                  )),
                                )}
                              {(mirrorData.photos || []).map(
                                (p: string, i: number) => (
                                  <div
                                    key={`g-${i}`}
                                    className="flex flex-col gap-1 break-inside-avoid"
                                  >
                                    <div className="relative aspect-square border-2 border-gray-100 rounded-2xl overflow-hidden bg-gray-50 shadow-sm">
                                      <img
                                        src={p}
                                        className="w-full h-full object-contain"
                                        alt="Evidência Geral"
                                        referrerPolicy="no-referrer"
                                      />
                                    </div>
                                    <div className="bg-blue-600 text-white text-[8px] p-2 rounded-lg font-black uppercase text-center tracking-tighter">
                                      Evidência Geral {i + 1}
                                    </div>
                                  </div>
                                ),
                              )}
                            </div>
                            {!mirrorData.items?.some(
                              (i: any) => i.photos?.length,
                            ) &&
                              !mirrorData.photos?.length && (
                                <div className="p-10 border-2 border-dashed rounded-3xl text-center text-[10px] font-black text-gray-300 uppercase">
                                  Nenhuma evidência fotográfica anexada a este
                                  protocolo.
                                </div>
                              )}
                          </section>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="hidden print:print-footer">
                  <span className="page-number"></span>
                  <span className="font-bold">
                    Protocolo Auditoria: {selectedLog.id}
                  </span>
                  <span className="italic">
                    Documento Gerado em: {new Date().toLocaleString("pt-BR")}
                  </span>
                </div>

                <div className="flex print:hidden justify-between text-[8px] font-black text-gray-400 uppercase p-6 border-t mt-4 bg-gray-50">
                  <span>ID Transação: {selectedLog.id}</span>
                  <span>
                    Reimpressão via Auditoria:{" "}
                    {new Date().toLocaleString("pt-BR")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        {renderSharedModals()}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      <div className="grid grid-cols-1 gap-4 no-print">
        <div className="bg-gray-50 p-6 rounded-3xl border space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h4 className="text-xs font-black uppercase text-gray-400 flex items-center gap-2">
              <Filter className="w-4 h-4" /> Filtros de Relatório
            </h4>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  onFetch(Array.from(selectedPrefixes).join(","), monthFilter)
                }
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50 active:scale-95"
              >
                {isLoading ? (
                  <BarChart className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Sincronizar Dados
              </button>
              <button
                onClick={() => {
                  setMonthFilter("");
                  setPostoFilter("");
                  setSelectedPrefixes(new Set());
                  setPrefixSearch("");
                  onFetch("", "");
                }}
                disabled={isLoading}
                className="bg-white border hover:bg-gray-100 text-gray-600 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase flex items-center justify-center transition-all disabled:opacity-50"
                title="Limpar Filtros"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-3 space-y-2 relative animate-in fade-in">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                Mês de Referência
              </label>
              <div className="relative">
                <select
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                  className="w-full border-2 rounded-2xl p-3 pr-10 text-sm font-bold outline-none focus:border-blue-500 bg-white shadow-sm appearance-none cursor-pointer"
                >
                  <option key="all-months" value="">
                    Todos os Meses ({logs.length})
                  </option>
                  {uniqueMonths.map((month) => (
                    <option key={month} value={month}>
                      {getMonthLabel(month)}
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Calendar className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            </div>

            <div className="lg:col-span-3 space-y-2 relative animate-in fade-in">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                Filtrar por Posto
              </label>
              <div className="relative">
                <select
                  value={postoFilter}
                  onChange={(e) => setPostoFilter(e.target.value)}
                  className="w-full border-2 rounded-2xl p-3 pr-10 text-sm font-bold outline-none focus:border-blue-500 bg-white shadow-sm appearance-none cursor-pointer"
                >
                  <option value="">Todos os Postos ({uniquePrefixes.length} VTRs)</option>
                  {uniqueStations.map((posto) => {
                    const vCount = uniquePrefixes.filter((p) => {
                      const v = settings.vehicles?.find((vtr) => normalizePrefix(vtr.prefix) === p);
                      return v && normalizePrefix(v.station) === normalizePrefix(posto);
                    }).length;
                    return (
                      <option key={posto} value={posto}>
                        {posto} ({vCount} VTRs)
                      </option>
                    );
                  })}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Filter className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                  Seleção de Viaturas ({selectedPrefixes.size} selecionadas)
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={selectAllPrefixes}
                    className="text-[9px] font-black uppercase text-blue-600 hover:underline animate-fade-in"
                  >
                    Selecionar Todas
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={deselectAllPrefixes}
                    className="text-[9px] font-black uppercase text-red-600 hover:underline animate-fade-in"
                  >
                    Desmarcar Todas
                  </button>
                </div>
              </div>

              <div className="relative mb-3">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Pesquisar viatura na lista..."
                  value={prefixSearch}
                  onChange={(e) => setPrefixSearch(e.target.value)}
                  className="w-full border-2 rounded-2xl p-3 pl-12 text-sm font-bold outline-none focus:border-blue-500 bg-white shadow-sm"
                />
              </div>

              <div className="bg-white border-2 rounded-2xl p-4 max-h-48 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 shadow-inner">
                {visiblePrefixes.map((prefix) => {
                  const vehicle = settings.vehicles?.find(
                    (v) => normalizePrefix(v.prefix) === prefix,
                  );
                  return (
                    <button
                      key={prefix}
                      onClick={() => togglePrefix(prefix)}
                      className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all border-2 text-center truncate ${
                        selectedPrefixes.has(prefix)
                          ? "bg-blue-600 border-blue-600 text-white shadow-md font-black"
                          : "bg-gray-50 border-gray-100 text-gray-400 hover:border-gray-300 font-bold"
                      }`}
                      title={vehicle?.station ? `Posto: ${vehicle.station}` : "Sem Posto"}
                    >
                      {prefix}
                    </button>
                  );
                })}
                {visiblePrefixes.length === 0 && (
                  <div className="col-span-full py-4 text-center text-[10px] font-bold text-gray-400 uppercase">
                    Nenhuma viatura encontrada com estes filtros.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-blue-600 p-6 rounded-[2rem] text-white shadow-xl flex flex-col md:flex-row items-center gap-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700"></div>
          <div className="bg-white/20 p-4 rounded-3xl backdrop-blur-md shadow-inner">
            <BarChart className="w-8 h-8" />
          </div>
          <div className="text-center md:text-left">
            <h4 className="text-lg font-black uppercase tracking-tight">
              Central de Inteligência e Relatórios
            </h4>
            <p className="text-xs text-blue-100 font-medium opacity-90 max-w-md">
              Selecione as viaturas e o período acima para gerar documentos
              analíticos e estatísticos de alta precisão.
            </p>
          </div>
        </div>
      </div>

      {filteredLogs.length === 0 ? (
        <div className="bg-white rounded-[2.5rem] border-2 border-dashed border-gray-200 p-20 text-center no-print">
          <AlertCircle className="w-16 h-16 text-gray-200 mx-auto mb-6" />
          <h4 className="text-lg font-black uppercase text-gray-400 tracking-widest mb-2">
            Nenhum registro encontrado
          </h4>
          <p className="text-xs font-bold text-gray-400 uppercase mb-8 max-w-md mx-auto">
            {logs.length === 0
              ? "Não há dados carregados do banco de dados. Verifique a conexão com o Google Sheets ou clique no botão abaixo."
              : "Nenhum registro corresponde aos filtros selecionados (mês ou viatura)."}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => onFetch("", "all")}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg transition-all disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2"
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
              />
              {isLoading ? "Sincronizando..." : "Sincronizar Dados Agora"}
            </button>
            {(monthFilter !== "all" || selectedPrefixes.size > 0) && (
              <button
                onClick={() => {
                  setMonthFilter("all");
                  setSelectedPrefixes(new Set());
                }}
                className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-8 py-3 rounded-2xl text-[10px] font-black uppercase transition-all active:scale-95"
              >
                Limpar Filtros
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 no-print">
          {[
            {
              id: "fleet_dashboard",
              title: "Dashboard de Frota",
              desc: "Visão em tempo real do status das viaturas e pendências.",
              icon: BarChart,
              color: "bg-blue-900 border-2 border-blue-400",
            },
            {
              id: "novelties",
              title: "Relatório de Novidades",
              desc: "Avarias e observações críticas.",
              icon: AlertCircle,
              color: "bg-red-500",
            },
            {
              id: "synthetic",
              title: "Relatório Sintético",
              desc: "Resumo estatístico e conformidade.",
              icon: PieChart,
              color: "bg-green-500",
            },
            {
              id: "analytical",
              title: "Relatório Analítico",
              desc: "Dados detalhados de todos os registros.",
              icon: List,
              color: "bg-purple-500",
            },
            {
              id: "full",
              title: "Relatório Completo",
              desc: "Todos os dados com seleção de colunas.",
              icon: FileText,
              color: "bg-orange-600",
            },
            {
              id: "monthly_grouped",
              title: "Relatório Mensal Agrupado",
              desc: "Agrupado por viatura (ABS20109 = ABS-20109).",
              icon: BarChart,
              color: "bg-blue-600",
            },
            {
              id: "history",
              title: "Histórico de Registros",
              desc: "Histórico completo vindo da Auditoria.",
              icon: Clock,
              color: "bg-indigo-600",
            },
            {
              id: "daily_control",
              title: "Ficha de Controle Diário",
              desc: "Matriz mensal (31 dias) - Ficha de Controle.",
              icon: Calendar,
              color: "bg-orange-500",
            },
            {
              id: "daily_control_motos",
              title: "Ficha de Controle Diário de Motos",
              desc: "Matriz mensal (31 dias) específica para motocicletas.",
              icon: Calendar,
              color: "bg-yellow-500",
            },
            {
              id: "weekly_leves",
              title: "Ficha Semanal Leves/Pesadas",
              desc: "Controle semanal para viaturas leves e pesadas.",
              icon: Calendar,
              color: "bg-emerald-600",
            },
            {
              id: "weekly_motos",
              title: "Ficha Semanal Motos",
              desc: "Controle semanal específico para motocicletas.",
              icon: Calendar,
              color: "bg-yellow-600",
            },
            {
              id: "weekly_ab",
              title: "Ficha Semanal AB/Aéreas",
              desc: "Controle semanal para viaturas tipo AB e Aéreas.",
              icon: Calendar,
              color: "bg-red-600",
            },
            {
              id: "retroactive_logs",
              title: "Relatório de Registros Retroativos",
              desc: "Checklists realizados fora do prazo regulamentar.",
              icon: Clock,
              color: "bg-blue-800",
            },
            {
              id: "final_monthly_book",
              title: "Livro Mensal Final",
              desc: "Arquivo único/consolidado contendo relatórios sequenciais das viaturas selecionadas.",
              icon: FileText,
              color: "bg-gradient-to-br from-blue-900 to-indigo-950 border-2 border-yellow-400 font-black",
            },
          ].map((report) => (
            <button
              key={report.id}
              onClick={() => setActiveReport(report.id as ReportType)}
              className="bg-white border p-6 rounded-3xl flex items-center gap-4 hover:border-blue-500 hover:shadow-md transition-all group text-left"
            >
              <div
                className={`${report.color} p-4 rounded-2xl text-white shadow-lg group-hover:scale-110 transition-transform`}
              >
                <report.icon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h5 className="text-sm font-black uppercase text-gray-900">
                  {report.title}
                </h5>
                <p className="text-[10px] text-gray-400 font-medium">
                  {report.desc}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 transition-colors" />
            </button>
          ))}
        </div>
      )}

      <div className="bg-gray-50 p-6 rounded-3xl border border-dashed text-center no-print">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
          Selecione um relatório acima para visualizar e imprimir
        </p>
      </div>

      {selectedLog && (
        <div className="fixed inset-0 z-[250] bg-gray-900/90 backdrop-blur-md flex items-center justify-center p-0 no-print overflow-y-auto">
          <div className="bg-white w-full h-full sm:h-full sm:max-w-full rounded-none shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-gray-900 p-4 flex flex-col sm:flex-row items-center justify-between text-white shrink-0 no-print gap-4">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="bg-blue-600 p-2 rounded-xl">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-xs uppercase tracking-widest leading-none">
                    Relatório de Auditoria
                  </h3>
                  <p className="text-[8px] text-gray-400 mt-1">
                    Protocolo: {selectedLog.id}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-end">
                <button
                  onClick={() => generatePdf(true)}
                  disabled={isGeneratingPdf}
                  className="flex-1 sm:flex-none bg-orange-600 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 shadow-lg hover:bg-orange-700 transition-all disabled:opacity-50"
                >
                  {isGeneratingPdf ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                  <span className="hidden xs:inline">Visualizar</span> PDF
                </button>
                <button
                  onClick={() => generatePdf(false)}
                  disabled={isGeneratingPdf}
                  className="flex-1 sm:flex-none bg-green-600 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 shadow-lg hover:bg-green-700 transition-all disabled:opacity-50"
                >
                  {isGeneratingPdf ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span className="hidden xs:inline">Baixar</span> PDF
                </button>
                <button
                  onClick={handlePrintMirror}
                  className="flex-1 sm:flex-none bg-blue-600 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 shadow-lg hover:bg-blue-700 transition-all"
                >
                  <Printer className="w-4 h-4" />
                  <span className="hidden xs:inline">Imprimir</span>
                </button>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-2 hover:bg-red-500 rounded-full transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div
              ref={printMirrorRef}
              className="flex-1 overflow-auto bg-white p-4 sm:p-8 print:p-0 print:overflow-visible relative"
            >
              <div
                data-pdf-content="audit"
                className="max-w-4xl mx-auto space-y-4 print:space-y-4 relative z-10"
              >
                <Watermark />
                {(() => {
                  const mirrorData = getFullData(selectedLog);
                  if (!mirrorData)
                    return (
                      <div className="p-10 text-center font-bold text-red-500 uppercase">
                        Erro: Dados íntegros não encontrados no banco.
                      </div>
                    );

                  const originalInspectionDateTime = formatDate(
                    selectedLog.date,
                  );

                  // Fallback para imagens da viatura se não estiverem no log (otimização de tamanho)
                  const inspectionImages =
                    mirrorData.vehicleImages &&
                    mirrorData.vehicleImages.length > 0
                      ? mirrorData.vehicleImages
                      : settings?.vehicleImages || [];

                  const inspectionRatios =
                    mirrorData.vehicleImageRatios ||
                    settings?.vehicleImageRatios ||
                    [];
                  const hasInspectionImages = inspectionImages.some(
                    (img: string) => img && img !== "",
                  );

                  return (
                    <div className="flex flex-col gap-4">
                      <Header
                        title={mirrorData.headerTitle || "Checklist de Viatura"}
                        date={mirrorData.date || ""}
                        onDateChange={() => {}}
                        logoUrl1={mirrorData.headerLogoUrl1}
                        logoUrl2={mirrorData.headerLogoUrl2}
                        bgColor={mirrorData.headerBgColor}
                      />

                      <div className="px-4 py-2 space-y-6">
                        <section className="bg-gray-50 p-4 rounded-2xl border grid grid-cols-4 gap-4 print:grid-cols-4 shadow-inner">
                          <div className="flex flex-col">
                            <span className="text-[8px] font-black text-gray-400 uppercase">
                              Viatura
                            </span>
                            <span className="text-[11px] font-black uppercase text-gray-800">
                              {selectedLog.prefix || mirrorData.prefix}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[8px] font-black text-gray-400 uppercase">
                              Placa
                            </span>
                            <span className="text-[11px] font-black uppercase text-gray-800">
                              {selectedLog.plate || mirrorData.plate}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[8px] font-black text-gray-400 uppercase">
                              Ciclo
                            </span>
                            <span className="text-[11px] font-black uppercase text-blue-600">
                              {selectedLog.checklistType ||
                                mirrorData.checklistType}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[8px] font-black text-gray-400 uppercase">
                              Odômetro
                            </span>
                            <span className="text-[11px] font-black uppercase text-gray-800">
                              {selectedLog.km || mirrorData.km} KM
                            </span>
                          </div>
                        </section>

                        {hasInspectionImages && (
                          <section className="space-y-3">
                            <h4 className="text-[10px] font-black uppercase text-gray-400 border-b pb-1">
                              Mapeamento Visual de Avarias
                            </h4>
                            <div className="grid grid-cols-3 gap-3 print:grid-cols-3">
                              {inspectionImages.map(
                                (img: string, idx: number) => {
                                  if (!img || img === "") return null;
                                  const dmgs = (
                                    mirrorData.damages || []
                                  ).filter((d: any) => d.imageIndex === idx);
                                  const ratio =
                                    inspectionRatios[idx] || "landscape";
                                  return (
                                    <div
                                      key={idx}
                                      className={`relative bg-gray-50 border rounded-xl overflow-hidden shadow-sm ${ratio === "landscape" ? "aspect-video" : "aspect-[3/4]"}`}
                                    >
                                      <img
                                        src={img}
                                        className="w-full h-full object-contain"
                                        alt={`Vista ${idx}`}
                                        referrerPolicy="no-referrer"
                                      />
                                      {dmgs.map((d: any) => (
                                        <div
                                          key={d.id}
                                          className="absolute w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-white shadow-sm -translate-x-1/2 -translate-y-1/2"
                                          style={{
                                            left: `${d.x}%`,
                                            top: `${d.y}%`,
                                          }}
                                        />
                                      ))}
                                    </div>
                                  );
                                },
                              )}
                            </div>
                          </section>
                        )}

                        <section className="border rounded-2xl overflow-hidden shadow-sm">
                          <table className="w-full text-left text-[10px] border-collapse">
                            <thead className="bg-gray-100 uppercase font-black text-gray-500">
                              <tr>
                                <th className="p-3">Item de Controle</th>
                                <th className="p-3 text-center">Status</th>
                                <th className="p-3">
                                  Observações / Evidências
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {(mirrorData.items || []).map(
                                (it: any, i: number) => (
                                  <tr
                                    key={i}
                                    className={
                                      it.status === "CN" ? "bg-red-50/50" : ""
                                    }
                                  >
                                    <td className="p-3 font-bold text-gray-700">
                                      {it.label}
                                    </td>
                                    <td className="p-3 text-center">
                                      <span
                                        className={`px-2 py-0.5 rounded text-white font-black text-[9px] uppercase ${it.status === "CN" ? "bg-red-600" : it.status === "OK" || it.status === "SN" ? "bg-green-600" : "bg-gray-300"}`}
                                      >
                                        {it.status === "OK" ? "SN" : it.status}
                                      </span>
                                    </td>
                                    <td className="p-3 italic text-gray-500">
                                      {it.observation || "-"}
                                      {it.photos?.length > 0 && (
                                        <span className="ml-2 inline-flex items-center text-blue-600 font-bold text-[8px] uppercase tracking-tighter">
                                          [+ FOTOS]
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                ),
                              )}
                            </tbody>
                          </table>
                        </section>

                        {(selectedLog.generalObservation ||
                          mirrorData.generalObservation) && (
                          <section className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100 shadow-inner">
                            <span className="text-[8px] font-black text-gray-400 uppercase block mb-1">
                              Informações Gerais / Parecer do Inspetor
                            </span>
                            <p className="text-[11px] italic leading-relaxed text-gray-700 font-medium">
                              "
                              {selectedLog.generalObservation ||
                                mirrorData.generalObservation}
                              "
                            </p>
                          </section>
                        )}

                        <Footer
                          signatureName={
                            mirrorData.signatureName || selectedLog.inspector
                          }
                          signatureRank={mirrorData.signatureRank || ""}
                          date={mirrorData.date}
                        />

                        <div className="text-center pt-2">
                          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                            Data/Hora Original da Inspeção:{" "}
                          </span>
                          <span className="text-[10px] font-black text-gray-700">
                            {originalInspectionDateTime}
                          </span>
                        </div>

                        <section className="space-y-4 pt-6 border-t break-before-page">
                          <h4 className="text-[10px] font-black uppercase text-gray-400 text-center tracking-widest">
                            Anexo de Evidências Fotográficas
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 print:grid-cols-2 gap-4">
                            {(mirrorData.items || [])
                              .filter(
                                (i: any) => i.photos && i.photos.length > 0,
                              )
                              .map((item: any) =>
                                item.photos.map((p: string, idx: number) => (
                                  <div
                                    key={`${item.id}-${idx}`}
                                    className="flex flex-col gap-1 break-inside-avoid"
                                  >
                                    <div className="relative aspect-square border-2 border-gray-100 rounded-2xl overflow-hidden bg-gray-50 shadow-sm">
                                      <img
                                        src={p}
                                        className="w-full h-full object-contain"
                                        alt={`Foto Item ${item.label}`}
                                        referrerPolicy="no-referrer"
                                      />
                                    </div>
                                    <div className="bg-gray-800 text-white text-[8px] p-2 rounded-lg font-black truncate uppercase tracking-tighter">
                                      Item: {item.label}
                                    </div>
                                  </div>
                                )),
                              )}
                            {(mirrorData.photos || []).map(
                              (p: string, i: number) => (
                                <div
                                  key={`g-${i}`}
                                  className="flex flex-col gap-1 break-inside-avoid"
                                >
                                  <div className="relative aspect-square border-2 border-gray-100 rounded-2xl overflow-hidden bg-gray-50 shadow-sm">
                                    <img
                                      src={p}
                                      className="w-full h-full object-contain"
                                      alt="Evidência Geral"
                                      referrerPolicy="no-referrer"
                                    />
                                  </div>
                                  <div className="bg-blue-600 text-white text-[8px] p-2 rounded-lg font-black uppercase text-center tracking-tighter">
                                    Evidência Geral {i + 1}
                                  </div>
                                </div>
                              ),
                            )}
                          </div>
                          {!mirrorData.items?.some(
                            (i: any) => i.photos?.length,
                          ) &&
                            !mirrorData.photos?.length && (
                              <div className="p-10 border-2 border-dashed rounded-3xl text-center text-[10px] font-black text-gray-300 uppercase">
                                Nenhuma evidência fotográfica anexada a este
                                protocolo.
                              </div>
                            )}
                        </section>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="hidden print:print-footer">
                <span className="page-number"></span>
                <span className="font-bold">
                  Protocolo Auditoria: {selectedLog.id}
                </span>
                <span className="italic">
                  Documento Gerado em: {new Date().toLocaleString("pt-BR")}
                </span>
              </div>

              <div className="flex print:hidden justify-between text-[8px] font-black text-gray-400 uppercase p-6 border-t mt-4 bg-gray-50">
                <span>ID Transação: {selectedLog.id}</span>
                <span>
                  Reimpressão via Auditoria:{" "}
                  {new Date().toLocaleString("pt-BR")}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {showClosureModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="bg-blue-600 p-6 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5" />
                <h3 className="font-black text-xs uppercase tracking-widest">
                  Encerramento Mensal
                </h3>
              </div>
              <button
                onClick={() => setShowClosureModal(false)}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
                disabled={isClosingMonth}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="text-center space-y-2">
                <ShieldCheck className="w-12 h-12 text-blue-600 mx-auto" />
                <p className="text-[10px] font-bold text-gray-400 uppercase leading-relaxed">
                  Esta ação encerrará oficialmente as folhas de {monthFilter}{" "}
                  para a viatura {Array.from(selectedPrefixes)[0]}. Esta
                  assinatura é digital e será registrada na auditoria.
                </p>
              </div>

              {closureError && (
                <div className="p-4 bg-red-50 border-2 border-red-200 rounded-2xl text-center space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <p className="text-[10px] font-black text-red-700 leading-normal uppercase">
                    {closureError}
                  </p>
                  {closureError.includes("Acesso Negado") && (
                    <a
                      href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                        `Olá! Sou militar operacional do posto e gostaria de solicitar ao Administrador a permissão de Fechamento Mensal (Chefe dos Motoristas) para o meu usuário '${closureAuth.username}' no CheckViatura Pro.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white font-black rounded-lg text-[9px] uppercase tracking-wider transition-all w-full"
                    >
                      Solicitar Permissão
                    </a>
                  )}
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-500 uppercase ml-1">
                    Usuário
                  </label>
                  <input
                    type="text"
                    value={closureAuth.username}
                    onChange={(e) =>
                      setClosureAuth({
                        ...closureAuth,
                        username: e.target.value,
                      })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleMonthClosure();
                    }}
                    placeholder="USUÁRIO"
                    className="w-full border-2 rounded-2xl p-4 text-center font-black uppercase focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-500 uppercase ml-1">
                    Senha
                  </label>
                  <div className="relative">
                    <input
                      type={showClosurePassword ? "text" : "password"}
                      value={closureAuth.password}
                      onChange={(e) =>
                        setClosureAuth({
                          ...closureAuth,
                          password: e.target.value,
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleMonthClosure();
                      }}
                      placeholder="SENHA"
                      className="w-full border-2 rounded-2xl p-4 text-center font-black tracking-[4px] focus:border-blue-500 outline-none transition-all pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowClosurePassword(!showClosurePassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                    >
                      {showClosurePassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  onClick={handleMonthClosure}
                  disabled={isClosingMonth}
                  className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg hover:bg-blue-700 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isClosingMonth ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                  Assinar e Encerrar
                </button>

                <button
                  onClick={() => setShowClosureModal(false)}
                  className="w-full text-gray-400 font-bold text-[10px] uppercase hover:text-gray-600 py-2"
                  disabled={isClosingMonth}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSignatureModal && signatureRole && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="bg-purple-600 p-6 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5" />
                <h3 className="font-black text-xs uppercase tracking-widest">
                  Assinatura Digital
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowSignatureModal(false);
                  setSignatureRole(null);
                }}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
                disabled={isSigning}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="text-center space-y-2">
                <ShieldCheck className="w-12 h-12 text-purple-600 mx-auto" />
                <p className="text-[11px] font-black uppercase text-purple-700 tracking-wider">
                  {signatureRole.label}
                </p>
                <p className="text-[10px] font-bold text-gray-400 uppercase leading-relaxed">
                  Insira suas credenciais cadastradas no sistema para assinar este relatório digitalmente para {monthFilter}.
                </p>
              </div>

              {sigError && (
                <div className="p-4 bg-red-50 border-2 border-red-200 rounded-2xl text-center space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <p className="text-[10px] font-black text-red-700 leading-normal uppercase">
                    {sigError}
                  </p>
                  {sigError.includes("Acesso Negado") && (
                    <a
                      href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                        `Olá! Sou militar operacional e gostaria de solicitar ao Administrador do Sistema a permissão de assinatura para a função de '${signatureRole.label}' para o meu usuário '${sigAuth.username}' no CheckViatura Pro.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white font-black rounded-lg text-[9px] uppercase tracking-wider transition-all w-full"
                    >
                      Solicitar Permissão
                    </a>
                  )}
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-500 uppercase ml-1">
                    Usuário
                  </label>
                  <input
                    type="text"
                    value={sigAuth.username}
                    onChange={(e) =>
                      setSigAuth({
                        ...sigAuth,
                        username: e.target.value,
                      })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleConfirmSignature();
                    }}
                    placeholder="USUÁRIO"
                    className="w-full border-2 rounded-2xl p-4 text-center font-black uppercase focus:border-purple-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-500 uppercase ml-1">
                    Senha
                  </label>
                  <div className="relative">
                    <input
                      type={showSigPassword ? "text" : "password"}
                      value={sigAuth.password}
                      onChange={(e) =>
                        setSigAuth({
                          ...sigAuth,
                          password: e.target.value,
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleConfirmSignature();
                      }}
                      placeholder="SENHA"
                      className="w-full border-2 rounded-2xl p-4 text-center font-black tracking-[4px] focus:border-purple-500 outline-none transition-all pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSigPassword(!showSigPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                    >
                      {showSigPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  onClick={handleConfirmSignature}
                  disabled={isSigning}
                  className="w-full bg-purple-600 text-white font-black py-4 rounded-2xl shadow-lg hover:bg-purple-700 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSigning ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                  Confirmar Assinatura
                </button>

                <button
                  onClick={() => {
                    setShowSignatureModal(false);
                    setSignatureRole(null);
                  }}
                  className="w-full text-gray-400 font-bold text-[10px] uppercase hover:text-gray-600 py-2"
                  disabled={isSigning}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
