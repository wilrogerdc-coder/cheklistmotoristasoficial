import { LogEntry } from '../types';

export interface DateComponents {
  year: number;
  month: number;
  day: number;
  timestamp: number;
}

/**
 * Converte qualquer formato de data presente nos logs para componentes normalizados.
 * Suporta: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, ISO strings com timezone ou hora.
 */
export function parseDateComponents(dateInput: any): DateComponents | null {
  if (!dateInput) return null;
  const s = String(dateInput).trim();
  if (!s) return null;

  // Formato YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ss
  const dashMatchYMD = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (dashMatchYMD) {
    const year = parseInt(dashMatchYMD[1], 10);
    const month = parseInt(dashMatchYMD[2], 10);
    const day = parseInt(dashMatchYMD[3], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      const d = new Date(year, month - 1, day, 12, 0, 0);
      return { year, month, day, timestamp: d.getTime() };
    }
  }

  // Formato DD/MM/YYYY ou DD-MM-YYYY (comum no Brasil e no Sheets)
  const slashMatchDMY = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (slashMatchDMY) {
    const day = parseInt(slashMatchDMY[1], 10);
    const month = parseInt(slashMatchDMY[2], 10);
    const year = parseInt(slashMatchDMY[3], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      const d = new Date(year, month - 1, day, 12, 0, 0);
      return { year, month, day, timestamp: d.getTime() };
    }
  }

  // Fallback genérico com Date
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const day = d.getDate();
      return { year, month, day, timestamp: d.getTime() };
    }
  } catch (e) {}

  return null;
}

/**
 * Retorna a chave do mês no formato YYYY-MM (ex: "2026-09")
 */
export function getMonthKeyFromDate(dateInput: any): string {
  const comps = parseDateComponents(dateInput);
  if (!comps) return '';
  return `${comps.year}-${String(comps.month).padStart(2, '0')}`;
}

/**
 * Verifica se a data está dentro dos últimos N dias a partir de hoje.
 * Garante também a inclusão de todos os registros do mês corrente para não quebrar relatórios do mês.
 */
export function isWithinLastNDays(dateInput: any, days: number = 30): boolean {
  const comps = parseDateComponents(dateInput);
  if (!comps) return false;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // Se o log for do mês corrente, sempre incluir
  if (comps.year === currentYear && comps.month === currentMonth) {
    return true;
  }

  // Calcula a data de corte (N dias atrás às 00:00:00)
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - days);

  return comps.timestamp >= cutoff.getTime();
}

/**
 * Filtra os logs para manter os últimos 3 meses (mês atual + 2 meses anteriores).
 * Essa estratégia permite calcular com 100% de exatidão o KM rodado no Mês Atual
 * e no Mês Anterior, mantendo o carregamento ultrarrápido do Dashboard.
 */
export function filterLogsLast3Months(logs: LogEntry[]): LogEntry[] {
  if (!Array.isArray(logs) || logs.length === 0) return [];
  const now = new Date();
  // Primeiro dia de 2 meses atrás (00:00:00)
  const cutoffDate = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0);
  const cutoffTs = cutoffDate.getTime();

  return logs.filter(log => {
    if (!log || (!log.id && !(log as any).ID)) return false;
    const comps = parseDateComponents(log.date);
    if (!comps) return true;
    return comps.timestamp >= cutoffTs;
  });
}

/**
 * Filtra os logs para manter no máximo os últimos 30 dias (mais mês corrente).
 * Deixa o carregamento ultra leve e ágil.
 */
export function filterLogsLast30Days(logs: LogEntry[], days: number = 30): LogEntry[] {
  if (!Array.isArray(logs) || logs.length === 0) return [];

  return logs.filter(log => {
    if (!log || (!log.id && !(log as any).ID)) return false;
    return isWithinLastNDays(log.date, days);
  });
}

/**
 * Filtra logs respeitando filtros personalizados de data e mês.
 */
export function filterLogsBySelectedDates(
  logs: LogEntry[],
  options: {
    month?: string; // YYYY-MM
    startDate?: string; // YYYY-MM-DD
    endDate?: string; // YYYY-MM-DD
    prefix?: string;
  }
): LogEntry[] {
  if (!Array.isArray(logs)) return [];

  const { month, startDate, endDate, prefix } = options;

  let startTs: number | null = null;
  if (startDate) {
    const sComps = parseDateComponents(startDate);
    if (sComps) {
      const d = new Date(sComps.year, sComps.month - 1, sComps.day, 0, 0, 0);
      startTs = d.getTime();
    }
  }

  let endTs: number | null = null;
  if (endDate) {
    const eComps = parseDateComponents(endDate);
    if (eComps) {
      const d = new Date(eComps.year, eComps.month - 1, eComps.day, 23, 59, 59);
      endTs = d.getTime();
    }
  }

  const cleanPrefix = prefix ? prefix.trim().toLowerCase() : '';

  return logs.filter(log => {
    if (!log) return false;

    if (cleanPrefix) {
      const p = String(log.prefix || '').trim().toLowerCase();
      if (p !== cleanPrefix) return false;
    }

    if (month && month !== 'all') {
      const logMonth = getMonthKeyFromDate(log.date);
      if (logMonth !== month) return false;
    }

    if (startTs !== null || endTs !== null) {
      const comps = parseDateComponents(log.date);
      if (!comps) return false;
      if (startTs !== null && comps.timestamp < startTs) return false;
      if (endTs !== null && comps.timestamp > endTs) return false;
    }

    return true;
  });
}

/**
 * Gera lista de meses sugeridos (ano corrente e anterior + meses presentes nos dados).
 */
export function getAvailableMonthsList(logs: LogEntry[]): Array<{ value: string; label: string }> {
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const monthSet = new Set<string>();

  // Adicionar meses presentes nos logs
  if (Array.isArray(logs)) {
    logs.forEach(l => {
      const m = getMonthKeyFromDate(l.date);
      if (m) monthSet.add(m);
    });
  }

  // Adicionar meses dos últimos 12 meses para permitir seleção retroativa mesmo antes de carregar
  const now = new Date();
  for (let i = 0; i < 18; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthSet.add(key);
  }

  return Array.from(monthSet)
    .sort((a, b) => b.localeCompare(a))
    .map(key => {
      const [yearStr, monthStr] = key.split('-');
      const mNum = parseInt(monthStr, 10);
      const name = monthNames[mNum - 1] || monthStr;
      return {
        value: key,
        label: `${name}/${yearStr}`
      };
    });
}
