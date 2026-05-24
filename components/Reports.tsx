
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { LogEntry, AppSettings } from '../types';
import { Header } from './Header';
import { Footer } from './Footer';
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
  Clock,
  Loader2
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface ReportsProps {
  logs: LogEntry[];
  settings: AppSettings;
  onFetch: (prefix?: string, month?: string) => Promise<void>;
  isLoading?: boolean;
}

type ReportType = 'novelties' | 'synthetic' | 'analytical' | 'full' | 'monthly_grouped' | 'history' | 'daily_control' | 'daily_control_motos' | 'weekly_leves' | 'weekly_motos' | 'weekly_ab' | null;

export const Reports: React.FC<ReportsProps> = ({ logs, settings, onFetch, isLoading }) => {
  const [activeReport, setActiveReport] = useState<ReportType>(null);
  const [monthFilter, setMonthFilter] = useState<string>(''); // Vazio por padrão para mostrar tudo
  const [selectedPrefixes, setSelectedPrefixes] = useState<Set<string>>(new Set());
  const [prefixSearch, setPrefixSearch] = useState<string>('');

  // Carregamento inicial automático ao abrir a aba de relatórios
  React.useEffect(() => {
    // Removido o carregamento automático redundante que causava loop infinito em caso de erro.
    // O carregamento inicial agora é gerenciado pelo componente pai (Settings).
    console.log(`Reports montado. logs.length=${logs.length}, isLoading=${isLoading}`);
  }, []);
  
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    date: true,
    prefix: true,
    plate: true,
    km: true,
    type: true,
    inspector: true,
    status: true,
    obs: true,
    id: false,
    details: false
  });
  const [statusFilter, setStatusFilter] = useState<'all' | 'ok' | 'cn'>('all');
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [autoPrint, setAutoPrint] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [viewingJsonData, setViewingJsonData] = useState<{data: any, title: string, subtitle: string} | null>(null);
  const printMirrorRef = useRef<HTMLDivElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const normalizePrefix = (p: any) => String(p || '').replace(/[-\s]/g, '').toUpperCase();

  const getFullData = (log: LogEntry): any => {
    const rawData = log.fullData || (log as any).fulldata;
    if (!rawData) return null;
    if (typeof rawData === 'object') return rawData;
    if (typeof rawData === 'string' && rawData.trim().startsWith('{')) {
      try { 
        return JSON.parse(rawData); 
      } catch (e) {
        console.error("Erro parse fullData", e);
      }
    }
    return null;
  };

  const parseLogDateToMonth = (dateStr: string) => {
    if (!dateStr) return "";
    // Se for ISO (YYYY-MM-DD...)
    if (dateStr.includes('-') && dateStr.indexOf('-') === 4) {
      return dateStr.substring(0, 7);
    }
    // Se for pt-BR (DD/MM/YYYY...)
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length >= 3) {
        const month = parts[1].padStart(2, '0');
        const yearPart = parts[2].split(' ')[0];
        if (yearPart.length === 4) {
          return `${yearPart}-${month}`;
        }
      }
    }
    // Fallback para Date object se possível
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return d.toISOString().substring(0, 7);
      }
    } catch (e) {}
    return "";
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    // Se já parece formatado pt-BR (contém / e :)
    if (dateStr.includes('/') && dateStr.includes(':')) return dateStr;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString('pt-BR');
    } catch (e) { return dateStr; }
  };

  const handlePrintMirror = () => { if (printMirrorRef.current) window.print(); };

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
        backgroundColor: '#ffffff',
        width: element.scrollWidth,
        height: element.scrollHeight,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
        onclone: (clonedDoc) => {
          const clonedElement = clonedDoc.querySelector('[data-pdf-content="report"]') as HTMLElement || clonedDoc.querySelector('.bg-white.p-8.rounded-\\[2\\.5rem\\]') as HTMLElement;
          if (clonedElement) {
            clonedElement.style.overflow = 'visible';
            clonedElement.style.height = 'auto';
            clonedElement.style.maxHeight = 'none';
            clonedElement.style.borderRadius = '0';
            clonedElement.style.border = 'none';
            clonedElement.style.boxShadow = 'none';
          }
        }
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgProps = pdf.getImageProperties(imgData);
      const contentHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      let heightLeft = contentHeight;
      let position = 0;

      // Primeira página
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, contentHeight);
      heightLeft -= pdfHeight;

      // Páginas subsequentes
      while (heightLeft > 0) {
        position = heightLeft - contentHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, contentHeight);
        heightLeft -= pdfHeight;
      }
      
      const fileName = `Relatorio_${activeReport.toUpperCase()}_${new Date().toISOString().split('T')[0]}.pdf`;
      
      if (openInNewTab) {
        const blobUrl = pdf.output('bloburl');
        window.open(blobUrl, '_blank');
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
      const contentElement = element.querySelector('[data-pdf-content="audit"]') as HTMLElement || element.querySelector('.max-w-4xl') as HTMLElement || element;

      const canvas = await html2canvas(contentElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: contentElement.scrollWidth,
        height: contentElement.scrollHeight,
        windowWidth: contentElement.scrollWidth,
        windowHeight: contentElement.scrollHeight,
        onclone: (clonedDoc) => {
          // No clone, garantimos que o elemento capturado esteja totalmente expandido
          const clonedElement = clonedDoc.querySelector('[data-pdf-content="audit"]') as HTMLElement || clonedDoc.querySelector('.max-w-4xl') as HTMLElement;
          if (clonedElement) {
            clonedElement.style.overflow = 'visible';
            clonedElement.style.height = 'auto';
            clonedElement.style.maxHeight = 'none';
          }
        }
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgProps = pdf.getImageProperties(imgData);
      const contentHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      let heightLeft = contentHeight;
      let position = 0;

      // Primeira página
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, contentHeight);
      heightLeft -= pdfHeight;

      // Páginas subsequentes
      while (heightLeft > 0) {
        position = heightLeft - contentHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, contentHeight);
        heightLeft -= pdfHeight;
      }
      
      const fileName = `Relatorio_Auditoria_${selectedLog.prefix}_${String(selectedLog.date || '').replace(/[/\\?%*:|"<>]/g, '-')}.pdf`;
      
      if (openInNewTab) {
        const blobUrl = pdf.output('bloburl');
        window.open(blobUrl, '_blank');
      } else {
        pdf.save(fileName);
      }
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      alert("Ocorreu um erro ao gerar o arquivo PDF. Tente usar a opção de imprimir.");
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
    return String(log.inspector || log.Inspetor || log.inspetor || log.conferente || 'NÃO IDENTIFICADO').trim();
  };

  const uniquePrefixes = useMemo(() => {
    const prefixes = new Set<string>();
    logs.forEach(log => {
      const norm = normalizePrefix(log.prefix);
      if (norm) prefixes.add(norm);
    });
    return Array.from(prefixes).sort();
  }, [logs]);

  const uniqueMonths = useMemo(() => {
    const months = new Set<string>();
    logs.forEach(log => {
      const month = parseLogDateToMonth(log.date);
      if (month) months.add(month);
    });
    return Array.from(months).sort((a, b) => b.localeCompare(a)); // Mais recentes primeiro
  }, [logs]);

  const getMonthLabel = (monthStr: string) => {
    if (!monthStr) return "Todos os Meses";
    const [year, month] = monthStr.split('-');
    const months = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    return `${months[parseInt(month) - 1]}/${year}`;
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const logMonth = parseLogDateToMonth(log.date);
      const matchesMonth = !monthFilter || logMonth === monthFilter;
      
      const normLogPrefix = normalizePrefix(log.prefix);
      const matchesPrefix = selectedPrefixes.size === 0 || selectedPrefixes.has(normLogPrefix);
      
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
    setSelectedPrefixes(new Set(uniquePrefixes));
  };

  const deselectAllPrefixes = () => {
    setSelectedPrefixes(new Set());
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
          style={{ mixBlendMode: 'multiply' }}
        />
      </div>
    );
  };

  const renderDailyControlReport = () => {
    const prefixesArray = Array.from(selectedPrefixes);
    if (prefixesArray.length !== 1) {
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

    const selectedPrefix = prefixesArray[0];
    const vehicle = settings.vehicles?.find(v => normalizePrefix(v.prefix) === selectedPrefix);
    
    const [year, month] = monthFilter.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const days = Array.from({ length: 31 }, (_, i) => i + 1);

    const logsByDay: Record<number, LogEntry> = {};
    filteredLogs.forEach(log => {
      const d = new Date(log.date);
      if (d.getFullYear() === year && (d.getMonth() + 1) === month) {
        const dd = d.getDate();
        if (!logsByDay[dd] || new Date(log.date).getTime() > new Date(logsByDay[dd].date).getTime()) {
           logsByDay[dd] = log;
        }
      }
    });

    let reportItems: string[] = [];
    if (settings.defaultItems) {
      reportItems = settings.defaultItems
        .filter(item => 
          (item.frequency === 'Diário' || item.frequency === 'Ambos') && 
          (!vehicle || !item.vehicleTypes || item.vehicleTypes.includes(vehicle.type))
        )
        .map(i => i.label);
    }

    const displayItemsCount = 30;
    const displayItems = reportItems.slice(0, displayItemsCount);
    while (displayItems.length < displayItemsCount) displayItems.push('');

    let countOperando = 0, countBaixada = 0, countReserva = 0;
    Object.values(logsByDay).forEach(log => {
      if (log.vehicleStatus === 'OPERANDO') countOperando++;
      else if (log.vehicleStatus === 'BAIXADA') countBaixada++;
      else if (log.vehicleStatus === 'RESERVA') countReserva++;
    });

    return (
      <div className="space-y-1 mx-auto print:p-0 print:m-0 relative" style={{ maxWidth: '297mm' }}>
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
              {settings.headerLogoUrl1 && <img src={settings.headerLogoUrl1} className="h-12 object-contain" alt="Logo 1" />}
           </div>
           <div className="flex-1 bg-[#00e5ff] text-center flex flex-col items-center justify-center py-1">
              <h1 className="text-[11px] font-black uppercase leading-tight">
                 {settings.reportTitle || "Ficha de Controle do Check List Diário de Viaturas Leves e Pesadas"}
              </h1>
           </div>
           <div className="w-24 border-l border-black p-1 flex items-center justify-center bg-white">
              {settings.headerLogoUrl2 ? (
                <img src={settings.headerLogoUrl2} className="h-12 object-contain" alt="Logo 2" />
              ) : (
                <span className="text-[6px] font-black uppercase text-center text-gray-300">LOGO 2</span>
              )}
           </div>
        </div>

        <div className="grid grid-cols-5 border border-black text-[8px] font-black uppercase bg-white">
           <div className="border-r border-black px-1 py-0.5">Prefixo da VTR: <span className="ml-1 text-[9px]">{selectedPrefix}</span></div>
           <div className="border-r border-black px-1 py-0.5">Posto: <span className="ml-1 text-[9px]">{vehicle?.station}</span></div>
           <div className="border-r border-black px-1 py-0.5">GB: <span className="ml-1 text-[9px]">{vehicle?.gb}</span></div>
           <div className="border-r border-black px-1 py-0.5 text-center">Mês: <span className="ml-1 text-[9px]">{getMonthLabel(monthFilter).toUpperCase()}</span></div>
           <div className="px-1 py-0.5">Observações:</div>
        </div>

        <table className="w-full ficha-table border-collapse text-[7.5px] font-black">
          <thead>
            <tr className="bg-[#ffff00]">
              <th className="w-[150px] text-left px-2">DATA</th>
              {days.map(d => (
                <th key={d} className="w-[25px] text-center border-l border-black">{d}</th>
              ))}
            </tr>
            <tr className="bg-red-600 text-white">
              <th className="text-left px-2 uppercase">Item de Verificação Técnica</th>
              {days.map(d => <th key={d} className="border-l border-black"></th>)}
            </tr>
          </thead>
          <tbody>
            {displayItems.map((itemLabel, rowIdx) => (
              <tr key={rowIdx} className={itemLabel ? '' : 'h-4'}>
                <td className={`px-2 border border-black ${itemLabel ? '' : 'bg-gray-50'}`}>
                  {itemLabel ? `${rowIdx + 1}. ${itemLabel.slice(0, 50)}` : ''}
                </td>
                {days.map(d => {
                  if (d > daysInMonth) return <td key={d} className="bg-gray-200 border border-black"></td>;
                  const log = logsByDay[d];
                  let val = '';
                  let colorClass = '';
                  if (log) {
                    if (log.vehicleStatus === 'BAIXADA') {
                      val = 'BX';
                      colorClass = 'text-red-600';
                    } else if (log.vehicleStatus === 'RESERVA') {
                      val = 'RS';
                      colorClass = 'text-orange-600';
                    } else if (log.itemsDetail) {
                      try {
                        const details = JSON.parse(log.itemsDetail);
                        const itemStatus = details.find((det: any) => det.label === itemLabel)?.status;
                        if (itemStatus === 'SN' || itemStatus === 'OK') {
                          val = 'SN';
                        } else if (itemStatus === 'CN') {
                          val = 'CN';
                          colorClass = 'text-red-700 bg-red-50';
                        }
                      } catch(e) {}
                    }
                  }
                  return (
                    <td key={d} className={`text-center font-black border border-black ${colorClass}`}>
                      {val}
                    </td>
                  );
                })}
              </tr>
            ))}
            
            {/* Linha NOME - Ajustada para ser idêntica ao RE e evitar expansão */}
            <tr className="h-[60px]">
              <td className="bg-[#e8f5e9] text-center border border-black">
                 <div className="vertical-text mx-auto font-black text-[9px] tracking-widest h-[60px] flex items-center justify-center">NOME</div>
              </td>
              {days.map(d => {
                 if (d > daysInMonth) return <td key={d} className="bg-gray-200 border border-black"></td>;
                 const log = logsByDay[d];
                 const full = log ? getFullData(log) : null;
                 const name = full?.signatureName || '';
                 return (
                   <td key={d} className="p-0 border border-black overflow-hidden h-[60px]">
                      <div className="vertical-text mx-auto text-[7px] leading-tight font-black h-[60px] flex items-center justify-center uppercase overflow-hidden">
                         {name.split(' ').slice(-2).join(' ')}
                      </div>
                   </td>
                 );
              })}
            </tr>

            {/* Linha RE - Base de comparação e idêntica ao NOME */}
            <tr className="h-[60px]">
              <td className="bg-[#e8f5e9] text-center border border-black">
                 <div className="vertical-text mx-auto font-black text-[9px] tracking-widest h-[60px] flex items-center justify-center">RE</div>
              </td>
              {days.map(d => {
                 if (d > daysInMonth) return <td key={d} className="bg-gray-200 border border-black"></td>;
                 const log = logsByDay[d];
                 const full = log ? getFullData(log) : null;
                 const re = full?.signatureRank || '';
                 return (
                   <td key={d} className="p-0 border border-black overflow-hidden h-[60px]">
                      <div className="vertical-text mx-auto text-[8px] font-black h-[60px] flex items-center justify-center overflow-hidden">
                        {re}
                      </div>
                   </td>
                 );
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
                    <div className="w-16 border-r border-black px-1 font-bold">LEGENDA:</div>
                    <div className="w-10 border-r border-black px-1 text-center">OK</div>
                    <div className="flex-1 px-1">SEM NOVIDADES</div>
                 </div>
                 <div className="flex border border-black">
                    <div className="w-16 border-r border-black px-1"></div>
                    <div className="w-10 border-r border-black px-1 text-center">CN</div>
                    <div className="flex-1 px-1">COM NOVIDADES</div>
                 </div>
              </div>

              {/* Status do Mês Col 2 */}
              <div className="space-y-0.5">
                 <div className="text-center border-x border-t border-black bg-gray-100 py-0.5">STATUS DO MÊS</div>
                 <div className="grid grid-cols-3 border border-black">
                    <div className="border-r border-black px-1">OPERANDO</div>
                    <div className="border-r border-black px-1 text-center">{countOperando}</div>
                    <div className="px-1 text-right">DIAS</div>
                 </div>
                 <div className="grid grid-cols-3 border-x border-b border-black">
                    <div className="border-r border-black px-1">BAIXADA</div>
                    <div className="border-r border-black px-1 text-center">{countBaixada}</div>
                    <div className="px-1 text-right">DIAS</div>
                 </div>
                 <div className="grid grid-cols-3 border-x border-b border-black">
                    <div className="border-r border-black px-1">RESERVA</div>
                    <div className="border-r border-black px-1 text-center">{countReserva}</div>
                    <div className="px-1 text-right">DIAS</div>
                 </div>
              </div>

              {/* Assinaturas Motoristas Col 3 */}
              <div className="space-y-0.5">
                 <div className="flex justify-between border-x border-t border-black bg-gray-100 px-1 py-0.5">
                    <span>CH DOS MOTORISTAS</span>
                    <span>VISTO</span>
                 </div>
                 <div className="flex border border-black">
                    <div className="w-2/3 border-r border-black px-1 h-4 flex items-center">AMARELA</div>
                    <div className="flex-1"></div>
                 </div>
                 <div className="flex border-x border-b border-black">
                    <div className="w-2/3 border-r border-black px-1 h-4 flex items-center">AZUL</div>
                    <div className="flex-1"></div>
                 </div>
                 <div className="flex border-x border-b border-black">
                    <div className="w-2/3 border-r border-black px-1 h-4 flex items-center">VERDE</div>
                    <div className="flex-1"></div>
                 </div>
              </div>

              {/* Assinaturas Prontidão Col 4 */}
              <div className="space-y-0.5">
                 <div className="flex justify-between border-x border-t border-black bg-gray-100 px-1 py-0.5">
                    <span>CMT PRONTIDÃO</span>
                    <span>VISTO</span>
                 </div>
                 <div className="flex border border-black">
                    <div className="w-2/3 border-r border-black px-1 h-4 flex items-center">AMARELA</div>
                    <div className="flex-1"></div>
                 </div>
                 <div className="flex border-x border-b border-black">
                    <div className="w-2/3 border-r border-black px-1 h-4 flex items-center">AZUL</div>
                    <div className="flex-1"></div>
                 </div>
                 <div className="flex border-x border-b border-black">
                    <div className="w-2/3 border-r border-black px-1 h-4 flex items-center">VERDE</div>
                    <div className="flex-1"></div>
                 </div>
              </div>
           </div>

           {/* Final Signature Row */}
           <div className="grid grid-cols-2 mt-4 gap-12">
              <div className="border-t border-black pt-1 text-center">
                 <span className="block font-black">CMT POSTO</span>
              </div>
              <div className="border-t border-black pt-1 text-center">
                 <span className="block font-black">CMT S/GB</span>
              </div>
           </div>

           <div className="mt-2 flex justify-between items-center text-[7px] text-gray-400 no-print">
              <span>Página <span className="page-number"></span></span>
              <span>Protocolo de Emissão: {Math.random().toString(36).substring(7).toUpperCase()}</span>
           </div>
        </div>
      </div>

    );
  };

  const renderWeeklyControlReport = (vType: 'LEVE/PESADA' | 'MOTOCICLETA' | 'AB/AÉREA') => {
    const prefixesArray = Array.from(selectedPrefixes);
    if (prefixesArray.length !== 1) {
      return (
        <div className="p-10 text-center flex flex-col items-center gap-4">
          <AlertCircle className="w-12 h-12 text-blue-500" />
          <h4 className="text-sm font-black uppercase text-gray-700">Selecione uma única viatura para o relatório semanal</h4>
        </div>
      );
    }
    if (!monthFilter) {
      return (
        <div className="p-10 text-center flex flex-col items-center gap-4">
          <Calendar className="w-12 h-12 text-blue-500" />
          <h4 className="text-sm font-black uppercase text-gray-700">Selecione um Mês</h4>
        </div>
      );
    }

    const selectedPrefix = prefixesArray[0];
    const vehicle = settings.vehicles?.find(v => normalizePrefix(v.prefix) === selectedPrefix);
    const [year, month] = monthFilter.split('-').map(Number);
    const weeks = ['1ª SEMANA', '2ª SEMANA', '3ª SEMANA', '4ª SEMANA'];
    
    // Agrupa logs por semana (aproximado: 1-7, 8-14, 15-21, 22+)
    const logsByWeek: Record<number, LogEntry> = {};
    filteredLogs.forEach(log => {
      // FILTRO: Somente logs marcados explicitamente como "Semanal"
      if (log.checklistType !== 'Semanal') return;

      const d = new Date(log.date);
      if (d.getFullYear() === year && (d.getMonth() + 1) === month) {
        const day = d.getDate();
        let wIdx = 0;
        if (day <= 7) wIdx = 0;
        else if (day <= 14) wIdx = 1;
        else if (day <= 21) wIdx = 2;
        else wIdx = 3;
        
        // Pega o último log de cada semana
        if (!logsByWeek[wIdx] || d.getTime() > new Date(logsByWeek[wIdx].date).getTime()) {
          logsByWeek[wIdx] = log;
        }
      }
    });

    let reportItems: string[] = [];
    if (settings.defaultItems) {
      reportItems = settings.defaultItems
        .filter(item => 
          (item.frequency === 'Semanal' || item.frequency === 'Ambos') && 
          (!vehicle || !item.vehicleTypes || item.vehicleTypes.includes(vehicle.type))
        )
        .map(i => i.label);
    }

    const maxItems = vType === 'AB/AÉREA' ? 23 : (vType === 'MOTOCICLETA' ? 16 : 19);
    const displayItems = reportItems.slice(0, maxItems);
    while (displayItems.length < maxItems) displayItems.push('');

    const title = vType === 'AB/AÉREA' 
      ? (settings.weeklyAbTitle || 'TIPO AB E AÉREAS') 
      : (vType === 'MOTOCICLETA' ? (settings.weeklyMotosTitle || 'DE MOTOS') : (settings.weeklyLevesTitle || 'TIPO LEVES E PESADAS'));

    return (
      <div className="space-y-1 mx-auto print:p-0 print:m-0 relative" style={{ maxWidth: '210mm' }}>
        <style>{`
          @media print { @page { size: portrait; margin: 5mm; } }
          .ficha-table th, .ficha-table td { border: 1px solid black !important; padding: 2px !important; }
        `}</style>
        
        <div className="flex items-stretch border border-black bg-cyan-400 text-center py-1">
          <h1 className="w-full text-[10px] font-black uppercase">FICHA DE CONTROLE DO CHECK LIST SEMANAL DE VIATURAS {title}</h1>
        </div>

        <div className="grid grid-cols-5 border-x border-b border-black text-[7px] font-black uppercase bg-white">
          <div className="border-r border-black px-1 py-0.5">PREFIXO: {selectedPrefix}</div>
          <div className="border-r border-black px-1 py-0.5">POSTO: {vehicle?.station}</div>
          <div className="border-r border-black px-1 py-0.5">GB: {vehicle?.gb}</div>
          <div className="border-r border-black px-1 py-0.5">MÊS: {getMonthLabel(monthFilter).toUpperCase()}</div>
          <div className="px-1 py-0.5">OBSERVAÇÕES:</div>
        </div>

        <table className="w-full ficha-table border-collapse text-[8px] font-black">
          <thead>
            <tr className="bg-yellow-100">
              <th className="w-8 text-center bg-red-600 text-white">ITEM</th>
              <th className="text-left px-2">DESCRIÇÃO</th>
              {weeks.map(w => <th key={w} className="w-24 text-center">{w}</th>)}
              <th className="w-32 text-center">OBSERVAÇÕES</th>
            </tr>
          </thead>
          <tbody>
            {displayItems.map((label, idx) => (
              <tr key={idx} className="h-5">
                <td className="text-center bg-red-600 text-white border-black">{idx + 1}</td>
                <td className="px-2 border-black max-w-[200px] truncate">{label}</td>
                {weeks.map((_, wIdx) => {
                  const log = logsByWeek[wIdx];
                  let val = '';
                  if (log?.itemsDetail) {
                    try {
                      const details = JSON.parse(log.itemsDetail);
                      const status = details.find((d:any) => d.label === label)?.status;
                      val = status === 'SN' || status === 'OK' ? 'OK' : (status === 'CN' ? 'CN' : '');
                    } catch(e){}
                  }
                  return <td key={wIdx} className="text-center border-black">{val}</td>;
                })}
                <td className="border-black"></td>
              </tr>
            ))}

            {vType === 'LEVE/PESADA' && (
              <>
                {['LEITURA DO HODOMETRO (KM)', 'COMBUST GASTO (LITROS)', 'GASTOS COM PEÇAS (R$)', 'GASTOS C/ MÃO DE OBRA (R$)'].map((extra, eIdx) => (
                  <tr key={eIdx} className="h-10">
                    <td colSpan={2} className="bg-green-50 px-2 uppercase text-[7px]">{extra}</td>
                    {weeks.map((_, wIdx) => {
                      const log = logsByWeek[wIdx];
                      let val = '';
                      if (eIdx === 0) val = log?.km?.toString() || '';
                      return <td key={wIdx} className="text-center border-black">{val}</td>;
                    })}
                    <td className="border-black"></td>
                  </tr>
                ))}
              </>
            )}

            <tr className="h-10">
              <td colSpan={2} className="bg-green-50 px-2 text-center align-middle uppercase text-[7px]">NOME</td>
              {weeks.map((_, wIdx) => {
                const log = logsByWeek[wIdx];
                return <td key={wIdx} className="text-center border-black text-[6px]">{log ? getFullData(log)?.signatureName?.split(' ').slice(-2).join(' ') : ''}</td>;
              })}
              <td className="border-black"></td>
            </tr>
            <tr className="h-10">
              <td colSpan={2} className="bg-green-50 px-2 text-center align-middle uppercase text-[7px]">RE</td>
              {weeks.map((_, wIdx) => <td key={wIdx} className="text-center border-black text-[6px]">{logsByWeek[wIdx] ? getFullData(logsByWeek[wIdx])?.signatureRank : ''}</td>)}
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
              {['CH DOS MOTORISTAS AMARELA', 'CH DOS MOTORISTAS AZUL', 'CH DOS MOTORISTAS VERDE'].map(l => (
                <div key={l} className="flex border border-black"><div className="flex-1 px-1">{l}</div><div className="w-10 border-l border-black"></div></div>
              ))}
            </div>
            <div className="space-y-1">
               <div className="flex border border-black h-8 items-end px-1">CMT POSTO</div>
               <div className="flex border border-black h-8 items-end px-1">CMT S/GB</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderDailyControlMotosReport = () => {
    const prefixesArray = Array.from(selectedPrefixes);
    if (prefixesArray.length !== 1) {
      return (
        <div className="p-10 text-center flex flex-col items-center gap-4">
          <AlertCircle className="w-12 h-12 text-blue-500" />
          <h4 className="text-sm font-black uppercase text-gray-700">Selecione uma única motocicleta para gerar este relatório</h4>
          <p className="text-xs text-gray-400 font-bold uppercase max-w-sm">Este relatório matrix mensal é gerado individualmente por prefixo.</p>
        </div>
      );
    }

    if (!monthFilter) {
      return (
        <div className="p-10 text-center flex flex-col items-center gap-4">
          <Calendar className="w-12 h-12 text-blue-500" />
          <h4 className="text-sm font-black uppercase text-gray-700">Selecione um Mês de Referência</h4>
          <p className="text-xs text-gray-400 font-bold uppercase max-w-sm">A Ficha de Controle Diário de Motos é calculada para um mês civil completo.</p>
        </div>
      );
    }

    const selectedPrefix = prefixesArray[0];
    const vehicle = settings.vehicles?.find(v => normalizePrefix(v.prefix) === selectedPrefix);
    
    const [year, month] = monthFilter.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const days = Array.from({ length: 31 }, (_, i) => i + 1);

    const logsByDay: Record<number, LogEntry> = {};
    filteredLogs.forEach(log => {
      const logDate = new Date(log.date);
      if (logDate.getFullYear() === year && (logDate.getMonth() + 1) === month) {
        const day = logDate.getDate();
        if (!logsByDay[day] || new Date(log.date).getTime() > new Date(logsByDay[day].date).getTime()) {
           logsByDay[day] = log;
        }
      }
    });

    let reportItems: string[] = [];
    if (settings.defaultItems) {
      reportItems = settings.defaultItems
        .filter(item => 
          (item.frequency === 'Diário' || item.frequency === 'Ambos') && 
          (!vehicle || !item.vehicleTypes || item.vehicleTypes.includes(vehicle.type))
        )
        .map(i => i.label);
    }

    if (reportItems.length === 0) {
      const allLabels = new Set<string>();
      filteredLogs.forEach(log => {
        try {
          if (log.itemsDetail) {
            const details = JSON.parse(log.itemsDetail);
            details.forEach((d: any) => allLabels.add(d.label));
          }
        } catch(e) {}
      });
      reportItems = Array.from(allLabels);
    }

    const displayItemsCount = 30;
    const displayItems = reportItems.slice(0, displayItemsCount);
    while (displayItems.length < displayItemsCount) {
      displayItems.push('');
    }

    let countOperando = 0;
    let countBaixada = 0;
    let countReserva = 0;
    Object.values(logsByDay).forEach(log => {
      if (log.vehicleStatus === 'OPERANDO') countOperando++;
      else if (log.vehicleStatus === 'BAIXADA') countBaixada++;
      else if (log.vehicleStatus === 'RESERVA') countReserva++;
    });

    return (
      <div className="space-y-1 mx-auto print:p-0 print:m-0 relative" style={{ maxWidth: '297mm' }}>
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
              {settings.headerLogoUrl1 && <img src={settings.headerLogoUrl1} className="h-12 object-contain" alt="Logo 1" />}
           </div>
           <div className="flex-1 bg-yellow-400 text-center flex flex-col items-center justify-center py-1">
              <h1 className="text-[11px] font-black uppercase leading-tight">
                 {settings.dailyMotosTitle || 'Ficha de Controle do Check List Diário de Motocicletas'}
              </h1>
           </div>
           <div className="w-24 border-l border-black p-1 flex items-center justify-center bg-white">
              {settings.headerLogoUrl2 ? (
                <img src={settings.headerLogoUrl2} className="h-12 object-contain" alt="Logo 2" />
              ) : (
                <div className="text-[6px] font-black uppercase text-center text-gray-300">LOGO 2</div>
              )}
           </div>
        </div>

        <div className="grid grid-cols-5 border border-black text-[8px] font-black uppercase bg-white">
           <div className="border-r border-black px-1 py-0.5">Prefixo da Moto: <span className="ml-1 text-[9px]">{selectedPrefix}</span></div>
           <div className="border-r border-black px-1 py-0.5">Posto: <span className="ml-1 text-[9px]">{vehicle?.station}</span></div>
           <div className="border-r border-black px-1 py-0.5">GB: <span className="ml-1 text-[9px]">{vehicle?.gb}</span></div>
           <div className="border-r border-black px-1 py-0.5 text-center">Mês: <span className="ml-1 text-[9px]">{getMonthLabel(monthFilter).toUpperCase()}</span></div>
           <div className="px-1 py-0.5">Observações:</div>
        </div>

        <table className="w-full ficha-table border-collapse text-[7.5px] font-black">
          <thead>
            <tr className="bg-yellow-100">
              <th className="w-[150px] text-left px-2">DATA</th>
              {days.map(d => (
                <th key={d} className="w-[25px] text-center border-l border-black">{d}</th>
              ))}
            </tr>
            <tr className="bg-red-600 text-white">
              <th className="text-left px-2 uppercase">Item de Verificação Técnica (Motos)</th>
              {days.map(d => <th key={d} className="border-l border-black"></th>)}
            </tr>
          </thead>
          <tbody>
            {displayItems.map((itemLabel, rowIdx) => (
              <tr key={rowIdx} className={itemLabel ? '' : 'h-4'}>
                <td className={`px-2 border border-black ${itemLabel ? '' : 'bg-gray-50'}`}>
                  {itemLabel ? `${rowIdx + 1}. ${itemLabel.slice(0, 50)}` : ''}
                </td>
                {days.map(d => {
                  if (d > daysInMonth) return <td key={d} className="bg-gray-200 border border-black"></td>;
                  const log = logsByDay[d];
                  let val = '';
                  let colorClass = '';
                  if (log) {
                    if (log.vehicleStatus === 'BAIXADA') {
                      val = 'BX';
                      colorClass = 'text-red-600';
                    } else if (log.vehicleStatus === 'RESERVA') {
                      val = 'RS';
                      colorClass = 'text-orange-600';
                    } else if (log.itemsDetail) {
                      try {
                        const details = JSON.parse(log.itemsDetail);
                        const itemStatus = details.find((det: any) => det.label === itemLabel)?.status;
                        if (itemStatus === 'SN' || itemStatus === 'OK') {
                          val = 'SN';
                        } else if (itemStatus === 'CN') {
                          val = 'CN';
                          colorClass = 'text-red-700 bg-red-50';
                        }
                      } catch(e) {}
                    }
                  }
                  return (
                    <td key={d} className={`text-center font-black border border-black ${colorClass}`}>
                      {val}
                    </td>
                  );
                })}
              </tr>
            ))}
            
            <tr className="h-[60px]">
              <td className="bg-[#e8f5e9] text-center border border-black">
                 <div className="vertical-text mx-auto font-black text-[9px] tracking-widest h-[60px] flex items-center justify-center">NOME</div>
              </td>
              {days.map(d => {
                 if (d > daysInMonth) return <td key={d} className="bg-gray-200 border border-black"></td>;
                 const log = logsByDay[d];
                 const full = log ? getFullData(log) : null;
                 const name = full?.signatureName || '';
                 return (
                   <td key={d} className="p-0 border border-black overflow-hidden h-[60px]">
                      <div className="vertical-text mx-auto text-[7px] leading-tight font-black h-[60px] flex items-center justify-center uppercase overflow-hidden">
                         {name.split(' ').slice(-2).join(' ')}
                      </div>
                   </td>
                 );
              })}
            </tr>

            <tr className="h-[60px]">
              <td className="bg-[#e8f5e9] text-center border border-black">
                 <div className="vertical-text mx-auto font-black text-[9px] tracking-widest h-[60px] flex items-center justify-center">RE</div>
              </td>
              {days.map(d => {
                 if (d > daysInMonth) return <td key={d} className="bg-gray-200 border border-black"></td>;
                 const log = logsByDay[d];
                 const full = log ? getFullData(log) : null;
                 const re = full?.signatureRank || '';
                 return (
                   <td key={d} className="p-0 border border-black overflow-hidden h-[60px]">
                      <div className="vertical-text mx-auto text-[8px] font-black h-[60px] flex items-center justify-center overflow-hidden">
                        {re}
                      </div>
                   </td>
                 );
              })}
            </tr>
          </tbody>
        </table>

        {/* Footer */}
        <div className="mt-2 text-[8px] font-black uppercase">
           <div className="grid grid-cols-4 gap-4">
              <div className="space-y-0.5">
                 <div className="flex border border-black">
                    <div className="w-16 border-r border-black px-1 font-bold">LEGENDA:</div>
                    <div className="w-10 border-r border-black px-1 text-center">OK</div>
                    <div className="flex-1 px-1">SEM NOVIDADES</div>
                 </div>
                 <div className="flex border border-black">
                    <div className="w-16 border-r border-black px-1"></div>
                    <div className="w-10 border-r border-black px-1 text-center">CN</div>
                    <div className="flex-1 px-1">COM NOVIDADES</div>
                 </div>
              </div>

              <div className="space-y-0.5">
                 <div className="text-center border-x border-t border-black bg-gray-100 py-0.5">STATUS DO MÊS (MOTOS)</div>
                 <div className="grid grid-cols-3 border border-black">
                    <div className="border-r border-black px-1">OPERANDO</div>
                    <div className="border-r border-black px-1 text-center">{countOperando}</div>
                    <div className="px-1 text-right">DIAS</div>
                 </div>
                 <div className="grid grid-cols-3 border-x border-b border-black">
                    <div className="border-r border-black px-1">BAIXADA</div>
                    <div className="border-r border-black px-1 text-center">{countBaixada}</div>
                    <div className="px-1 text-right">DIAS</div>
                 </div>
                 <div className="grid grid-cols-3 border-x border-b border-black">
                    <div className="border-r border-black px-1">RESERVA</div>
                    <div className="border-r border-black px-1 text-center">{countReserva}</div>
                    <div className="px-1 text-right">DIAS</div>
                 </div>
              </div>

              <div className="space-y-0.5">
                 <div className="flex justify-between border-x border-t border-black bg-gray-100 px-1 py-0.5">
                    <span>CH DOS MOTOCICLISTAS</span>
                    <span>VISTO</span>
                 </div>
                 <div className="flex border border-black">
                    <div className="w-2/3 border-r border-black px-1 h-4 flex items-center">AMARELA</div>
                    <div className="flex-1"></div>
                 </div>
                 <div className="flex border-x border-b border-black">
                    <div className="w-2/3 border-r border-black px-1 h-4 flex items-center">AZUL</div>
                    <div className="flex-1"></div>
                 </div>
                 <div className="flex border-x border-b border-black">
                    <div className="w-2/3 border-r border-black px-1 h-4 flex items-center">VERDE</div>
                    <div className="flex-1"></div>
                 </div>
              </div>

              <div className="space-y-0.5">
                 <div className="flex justify-between border-x border-t border-black bg-gray-100 px-1 py-0.5">
                    <span>CMT PRONTIDÃO</span>
                    <span>VISTO</span>
                  </div>
                  <div className="flex border border-black">
                    <div className="w-2/3 border-r border-black px-1 h-4 flex items-center">AMARELA</div>
                    <div className="flex-1"></div>
                 </div>
                 <div className="flex border-x border-b border-black">
                    <div className="w-2/3 border-r border-black px-1 h-4 flex items-center">AZUL</div>
                    <div className="flex-1"></div>
                 </div>
                 <div className="flex border-x border-b border-black">
                    <div className="w-2/3 border-r border-black px-1 h-4 flex items-center">VERDE</div>
                    <div className="flex-1"></div>
                 </div>
              </div>
           </div>

           <div className="grid grid-cols-2 mt-4 gap-12">
              <div className="border-t border-black pt-1 text-center">
                 <span className="block font-black">CMT POSTO</span>
              </div>
              <div className="border-t border-black pt-1 text-center">
                 <span className="block font-black">CMT S/GB</span>
              </div>
           </div>
        </div>
      </div>
    );
  };

  const renderNoveltiesReport = () => {
    const novelties = filteredLogs.filter(log => String(log.itemsStatus || '').includes('CN') || (log.generalObservation && String(log.generalObservation).trim() !== ''));

    let totalCnItems = 0;
    novelties.forEach(log => {
      try {
        if (log.itemsDetail) {
          const details = JSON.parse(log.itemsDetail);
          totalCnItems += details.filter((d: any) => d.status === 'CN').length;
        }
      } catch (e) {}
    });

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center border-b pb-4 print:pb-2">
          <div>
            <h3 className="text-xl font-black uppercase text-gray-900 text-red-600">Relatório de Novidades Constatadas</h3>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Filtro: {selectedPrefixes.size > 0 ? Array.from(selectedPrefixes).join(', ') : 'Todas as Viaturas'} | {monthFilter}
            </p>
          </div>
          <div className="text-right hidden print:block">
             <p className="text-[10px] font-black uppercase text-gray-400">Página <span className="page-number"></span></p>
          </div>
        </div>

        {/* Resumo de Novidades */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 no-print">
          <div className="bg-red-50 border-2 border-red-100 p-4 rounded-3xl flex items-center gap-4">
            <div className="bg-red-600 p-3 rounded-2xl text-white shadow-lg">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-red-500 uppercase">Viaturas com Novidades</p>
              <p className="text-xl font-black text-red-900">{novelties.length}</p>
            </div>
          </div>
          <div className="bg-orange-50 border-2 border-orange-100 p-4 rounded-3xl flex items-center gap-4">
            <div className="bg-orange-600 p-3 rounded-2xl text-white shadow-lg">
              <List className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-orange-500 uppercase">Total de Itens "CN"</p>
              <p className="text-xl font-black text-orange-900">{totalCnItems}</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {novelties.map((log, idx) => {
            let cnItems: any[] = [];
            try {
              if (log.itemsDetail) {
                const details = JSON.parse(log.itemsDetail);
                cnItems = details.filter((d: any) => d.status === 'CN');
              }
            } catch (e) {}

            return (
              <div key={`${log.id}-${idx}`} className="border-2 rounded-[2rem] p-6 space-y-4 bg-white print:break-inside-avoid shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start border-b border-gray-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-red-600 text-white p-2 rounded-xl shadow-md">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black uppercase text-gray-900 tracking-tight">{log.prefix} <span className="text-gray-400 font-bold ml-1">({log.plate})</span></h4>
                      <p className="text-[9px] font-bold text-gray-400 uppercase">{new Date(log.date).toLocaleString('pt-BR')}</p>
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
                    <p className="font-black uppercase text-gray-400 text-[8px] tracking-widest mb-1">Conferente</p>
                    <p className="font-bold uppercase text-blue-700 bg-blue-50 px-3 py-1.5 rounded-xl inline-block">{getInspector(log)}</p>
                  </div>
                  <div>
                    <p className="font-black uppercase text-gray-400 text-[8px] tracking-widest mb-1">Tipo de Checklist</p>
                    <p className="font-bold text-gray-700 uppercase">{log.checklistType}</p>
                  </div>
                  <div>
                    <p className="font-black uppercase text-gray-400 text-[8px] tracking-widest mb-1">Odômetro</p>
                    <p className="font-bold text-gray-700 uppercase">{log.km} KM</p>
                  </div>
                </div>

                {cnItems.length > 0 && (
                  <div className="space-y-2">
                    <p className="font-black uppercase text-gray-400 text-[8px] tracking-widest">Detalhamento de Itens "CN"</p>
                    <div className="grid grid-cols-1 gap-2">
                      {cnItems.map((d: any, i: number) => (
                        <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between bg-red-50/30 p-3 rounded-2xl border border-red-100/50 gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                            <span className="font-black text-[10px] uppercase text-red-900">{d.label}</span>
                          </div>
                          <div className="flex-1 sm:text-right">
                            <span className="text-[10px] text-red-600 font-medium italic bg-white px-3 py-1 rounded-lg border border-red-50 shadow-sm">
                              {d.observation || 'Sem observação específica'}
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
                    <p className="font-black uppercase text-gray-400 text-[8px] tracking-widest mb-2">Observações Gerais do Conferente</p>
                    <p className="text-[11px] font-medium text-gray-700 italic leading-relaxed">"{log.generalObservation}"</p>
                  </div>
                )}
                
                <div className="pt-2 flex justify-end">
                   <p className="text-[8px] font-mono text-gray-300 uppercase">Protocolo: {log.id}</p>
                </div>
              </div>
            );
          })}
          {novelties.length === 0 && (
            <div className="text-center py-32 bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-200">
              <AlertCircle className="w-12 h-12 text-gray-200 mx-auto mb-4" />
              <p className="text-xs font-black uppercase text-gray-400 tracking-widest">Nenhuma novidade registrada no período e filtros selecionados.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderSyntheticReport = () => {
    const stats = {
      total: filteredLogs.length,
      diario: filteredLogs.filter(l => l.checklistType === 'Diário').length,
      semanal: filteredLogs.filter(l => l.checklistType === 'Semanal').length,
      withIssues: filteredLogs.filter(l => String(l.itemsStatus || '').includes('CN')).length,
      ok: filteredLogs.filter(l => !String(l.itemsStatus || '').includes('CN')).length,
    };

    const vehiclesMap: Record<string, number> = {};
    const inspectorsMap: Record<string, number> = {};
    const canonicalPrefixes: Record<string, string> = {};
    
    filteredLogs.forEach(l => {
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
            <h3 className="text-xl font-black uppercase text-gray-900">Relatório Sintético de Gerenciamento</h3>
            <p className="text-xs font-bold text-gray-500 uppercase">Período: {monthFilter} | {selectedPrefixes.size > 0 ? `${selectedPrefixes.size} Viaturas Selecionadas` : 'Geral'}</p>
          </div>
          <div className="text-right hidden print:block">
             <p className="text-[10px] font-black uppercase text-gray-400">Página <span className="page-number"></span></p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-3xl border border-blue-100">
            <p className="text-[9px] font-black text-blue-500 uppercase">Total Inspeções</p>
            <p className="text-2xl font-black text-blue-900">{stats.total}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-3xl border border-green-100">
            <p className="text-[9px] font-black text-green-500 uppercase">Total SN (OK)</p>
            <p className="text-2xl font-black text-green-900">{stats.ok}</p>
          </div>
          <div className="bg-red-50 p-4 rounded-3xl border border-red-100">
            <p className="text-[9px] font-black text-red-500 uppercase">Total CN (Avarias)</p>
            <p className="text-2xl font-black text-red-900">{stats.withIssues}</p>
          </div>
          <div className="bg-orange-50 p-4 rounded-3xl border border-orange-100">
            <p className="text-[9px] font-black text-orange-500 uppercase">Conformidade</p>
            <p className="text-2xl font-black text-orange-900">{stats.total ? ((stats.ok / stats.total) * 100).toFixed(1) : 0}%</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border rounded-2xl overflow-hidden">
            <div className="bg-gray-100 p-3 text-[10px] font-black uppercase">Uso da Frota (Top 10)</div>
            <table className="w-full text-[10px] text-left">
              <tbody className="divide-y">
                {Object.entries(vehiclesMap).sort((a,b) => b[1]-a[1]).slice(0, 10).map(([norm, count]) => (
                  <tr key={norm}>
                    <td className="p-2 font-bold uppercase">{canonicalPrefixes[norm]}</td>
                    <td className="p-2 text-right font-black text-blue-600">{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border rounded-2xl overflow-hidden">
            <div className="bg-gray-100 p-3 text-[10px] font-black uppercase">Atividade por Conferente (Top 10)</div>
            <table className="w-full text-[10px] text-left">
              <tbody className="divide-y">
                {Object.entries(inspectorsMap).sort((a,b) => b[1]-a[1]).slice(0, 10).map(([name, count]) => (
                  <tr key={name}>
                    <td className="p-2 font-bold uppercase">{name}</td>
                    <td className="p-2 text-right font-black text-green-600">{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderAnalyticalReport = () => {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center border-b pb-4 print:pb-2">
          <div>
            <h3 className="text-xl font-black uppercase text-gray-900">Relatório Analítico Detalhado</h3>
            <p className="text-xs font-bold text-gray-500 uppercase">Filtro: {selectedPrefixes.size > 0 ? `${selectedPrefixes.size} Viaturas Selecionadas` : 'Geral'} | {monthFilter}</p>
          </div>
          <div className="text-right hidden print:block">
             <p className="text-[10px] font-black uppercase text-gray-400">Página <span className="page-number"></span></p>
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
              {filteredLogs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="p-2 whitespace-nowrap">{new Date(log.date).toLocaleString('pt-BR')}</td>
                  <td className="p-2 font-bold uppercase">{log.prefix}</td>
                  <td className="p-2">{log.km}</td>
                  <td className="p-2 uppercase">{log.checklistType}</td>
                  <td className="p-2 uppercase font-medium break-words min-w-[150px]">{getInspector(log)}</td>
                  <td className={`p-2 font-black uppercase ${String(log.itemsStatus || '').includes('CN') ? 'text-red-600' : 'text-green-600'}`}>{log.itemsStatus || 'SN'}</td>
                  <td className="p-2 italic text-gray-500 truncate max-w-[150px]">{log.generalObservation || '-'}</td>
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
      { id: 'date', label: 'Data/Hora' },
      { id: 'prefix', label: 'Viatura' },
      { id: 'plate', label: 'Placa' },
      { id: 'km', label: 'KM' },
      { id: 'type', label: 'Tipo' },
      { id: 'inspector', label: 'Conferente' },
      { id: 'status', label: 'Status' },
      { id: 'obs', label: 'Observações' },
      { id: 'id', label: 'Protocolo' },
      { id: 'details', label: 'Detalhes Itens' },
    ];

    const toggleColumn = (id: string) => {
      setVisibleColumns(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const filteredByStatus = filteredLogs.filter(log => {
      if (statusFilter === 'all') return true;
      const status = (log.itemsStatus || '').toUpperCase();
      if (statusFilter === 'ok') return !String(status).includes('CN');
      if (statusFilter === 'cn') return String(status).includes('CN');
      return true;
    });

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center border-b pb-4 print:pb-2">
          <div>
            <h3 className="text-xl font-black uppercase text-gray-900">Relatório Completo Personalizável</h3>
            <p className="text-xs font-bold text-gray-500 uppercase">Filtro: {selectedPrefixes.size > 0 ? `${selectedPrefixes.size} Viaturas Selecionadas` : 'Geral'} | {monthFilter} | Status: {statusFilter.toUpperCase()}</p>
          </div>
          <div className="text-right hidden print:block">
             <p className="text-[10px] font-black uppercase text-gray-400">Página <span className="page-number"></span></p>
          </div>
        </div>

        <div className="no-print space-y-4">
          <div className="bg-gray-50 p-4 rounded-2xl border space-y-3">
            <p className="text-[10px] font-black uppercase text-gray-400 flex items-center gap-2">
              <Filter className="w-3 h-3" /> Selecionar Colunas Visíveis
            </p>
            <div className="flex flex-wrap gap-2">
              {columns.map(col => (
                <button
                  key={col.id}
                  onClick={() => toggleColumn(col.id)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase transition-all border ${
                    visibleColumns[col.id] 
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                      : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {col.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <p className="text-[10px] font-black uppercase text-gray-400">Filtrar Status:</p>
            <div className="flex bg-gray-100 p-1 rounded-xl border">
              {(['all', 'ok', 'cn'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                    statusFilter === s ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {s === 'all' ? 'Todos' : s.toUpperCase()}
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
                {visibleColumns.inspector && <th className="p-2">Conferente</th>}
                {visibleColumns.status && <th className="p-2">Status</th>}
                {visibleColumns.obs && <th className="p-2">Obs.</th>}
                {visibleColumns.id && <th className="p-2">Protocolo</th>}
                {visibleColumns.details && <th className="p-2">Detalhes</th>}
                <th className="p-2 no-print">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y bg-white">
              {filteredByStatus.map(log => (
                <tr key={log.id} className="hover:bg-gray-50">
                  {visibleColumns.date && <td className="p-2 whitespace-nowrap">{new Date(log.date).toLocaleString('pt-BR')}</td>}
                  {visibleColumns.prefix && <td className="p-2 font-bold uppercase">{log.prefix}</td>}
                  {visibleColumns.plate && <td className="p-2 font-mono uppercase">{log.plate}</td>}
                  {visibleColumns.km && <td className="p-2">{log.km}</td>}
                  {visibleColumns.type && <td className="p-2 uppercase">{log.checklistType}</td>}
                  {visibleColumns.inspector && <td className="p-2 uppercase font-medium break-words min-w-[150px]">{getInspector(log)}</td>}
                  {visibleColumns.status && (
                    <td className={`p-2 font-black uppercase ${String(log.itemsStatus || '').includes('CN') ? 'text-red-600' : 'text-green-600'}`}>
                      {log.itemsStatus || 'SN'}
                    </td>
                  )}
                  {visibleColumns.obs && <td className="p-2 italic text-gray-500 truncate max-w-[150px]">{log.generalObservation || '-'}</td>}
                  {visibleColumns.id && <td className="p-2 font-mono text-[8px] text-gray-400">{log.id}</td>}
                  {visibleColumns.details && (
                    <td className="p-2 text-[8px] text-gray-400 truncate max-w-[150px]">
                      {log.itemsDetail || '-'}
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
    const groupedData: Record<string, { canonicalPrefix: string, logs: LogEntry[] }> = {};
    
    filteredLogs.forEach(log => {
      const norm = normalizePrefix(log.prefix);
      if (!groupedData[norm]) {
        groupedData[norm] = { canonicalPrefix: log.prefix, logs: [] };
      }
      groupedData[norm].logs.push(log);
    });

    // Ordenar logs dentro de cada grupo por data
    Object.values(groupedData).forEach(group => {
      group.logs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    });

    const sortedGroups = Object.entries(groupedData).sort((a, b) => a[0].localeCompare(b[0]));

    return (
      <div className="space-y-8">
        <div className="flex justify-between items-center border-b pb-4 print:pb-2">
          <div>
            <h3 className="text-xl font-black uppercase text-gray-900">Relatório Mensal Agrupado por Viatura</h3>
            <p className="text-xs font-bold text-gray-500 uppercase">Mês: {monthFilter} | {selectedPrefixes.size > 0 ? `${selectedPrefixes.size} Viaturas Selecionadas` : 'Todas as Viaturas'}</p>
          </div>
          <div className="text-right hidden print:block">
             <p className="text-[10px] font-black uppercase text-gray-400">Página <span className="page-number"></span></p>
          </div>
        </div>

        {sortedGroups.length === 0 ? (
          <div className="text-center py-20 text-gray-400 font-black uppercase">Nenhum dado encontrado para o período.</div>
        ) : (
          <div className="space-y-10">
            {sortedGroups.map(([norm, group]) => (
              <div key={norm} className="space-y-4 print:break-inside-avoid">
                <div className="bg-gray-900 text-white px-6 py-3 rounded-2xl flex justify-between items-center shadow-lg">
                  <h4 className="font-black uppercase tracking-widest text-sm">Viatura: {group.canonicalPrefix}</h4>
                  <span className="text-[10px] font-bold opacity-70 uppercase">{group.logs.length} Inspeções no mês</span>
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
                      {group.logs.map(log => (
                        <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                          <td className="p-3 font-bold">{new Date(log.date).toLocaleDateString('pt-BR')}</td>
                          <td className="p-3 font-mono">{log.km}</td>
                          <td className="p-3 uppercase">{log.checklistType}</td>
                          <td className="p-3 uppercase font-medium">{getInspector(log)}</td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded-full font-black uppercase text-[9px] ${String(log.itemsStatus || '').includes('CN') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                              {log.itemsStatus || 'SN'}
                            </span>
                          </td>
                          <td className="p-3 italic text-gray-500 max-w-[200px] truncate">{log.generalObservation || '-'}</td>
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
            <h3 className="text-xl font-black uppercase text-gray-900">Histórico de Registros (Auditoria)</h3>
            <p className="text-xs font-bold text-gray-500 uppercase">Filtro: {selectedPrefixes.size > 0 ? `${selectedPrefixes.size} Viaturas Selecionadas` : 'Geral'} | {monthFilter}</p>
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
             <p className="text-[10px] font-black uppercase text-gray-400">Página <span className="page-number"></span></p>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 bg-gray-50 rounded-2xl border overflow-hidden print:bg-white print:border-0 print:overflow-visible">
          <div className="bg-white p-2 border-b flex items-center gap-2 no-print">
            <Search className="w-3.5 h-3.5 text-gray-400" />
            <input 
              type="text" 
              placeholder="Filtrar por Viatura ou Placa..." 
              value={prefixSearch} 
              onChange={e => setPrefixSearch(e.target.value)} 
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
                  .filter(l => 
                    !prefixSearch || 
                    String(l.prefix).toLowerCase().includes(prefixSearch.toLowerCase()) || 
                    String(l.plate).toLowerCase().includes(prefixSearch.toLowerCase())
                  )
                  .map((log, idx) => (
                  <tr key={`${log.id}-${idx}`} className="hover:bg-blue-50/50 transition-colors print:break-inside-avoid">
                    <td className="p-3 font-mono text-gray-500">{new Date(log.date).toLocaleString('pt-BR')}</td>
                    <td className="p-3 font-black text-gray-800 uppercase">
                      {log.prefix} 
                      <span className="text-[8px] font-normal opacity-50 block">{log.plate}</span>
                    </td>
                    <td className="p-3 uppercase font-bold text-gray-600 break-words">{getInspector(log)}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${String(log.itemsStatus).includes('CN') ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                        {log.itemsStatus}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => setViewingJsonData({
                            data: getFullData(log),
                            title: 'Dados Originais (JSON)',
                            subtitle: `Protocolo: ${log.id} | Viatura: ${log.prefix}`
                          })} 
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

  const renderJsonView = (data: any, title: string, subtitle: string) => {
    return (
      <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between border-b pb-4 print:hidden">
          <div>
            <h3 className="text-xl font-black uppercase text-gray-900">{title}</h3>
            <p className="text-xs font-bold text-gray-500 uppercase">{subtitle}</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => {
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${String(title || '').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
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
        {renderJsonView(viewingJsonData.data, viewingJsonData.title, viewingJsonData.subtitle)}
      </div>
    );
  }

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
              onClick={() => setViewingJsonData({
                data: {
                  reportType: activeReport,
                  date: new Date().toISOString(),
                  logs: filteredLogs.map(l => ({
                    id: l.id,
                    date: l.date,
                    prefix: l.prefix,
                    plate: l.plate,
                    inspector: l.inspector,
                    status: l.itemsStatus,
                    fullData: getFullData(l)
                  }))
                },
                title: `Dados do Relatório ${(activeReport || '').toUpperCase()}`,
                subtitle: `Total de Registros: ${filteredLogs.length}`
              })}
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

        <div ref={reportRef} data-pdf-content="report" className="bg-white p-8 rounded-[2.5rem] border shadow-sm print:p-0 print:border-0 print:shadow-none relative overflow-hidden">
          <Watermark />
          {activeReport === 'novelties' && renderNoveltiesReport()}
          {activeReport === 'synthetic' && renderSyntheticReport()}
          {activeReport === 'analytical' && renderAnalyticalReport()}
          {activeReport === 'full' && renderFullReport()}
          {activeReport === 'monthly_grouped' && renderMonthlyGroupedReport()}
          {activeReport === 'history' && renderHistoryReport()}
          
          {activeReport === 'daily_control' && renderDailyControlReport()}
          {activeReport === 'daily_control_motos' && renderDailyControlMotosReport()}
          {activeReport === 'weekly_leves' && renderWeeklyControlReport('LEVE/PESADA')}
          {activeReport === 'weekly_motos' && renderWeeklyControlReport('MOTOCICLETA')}
          {activeReport === 'weekly_ab' && renderWeeklyControlReport('AB/AÉREA')}
          {/* Print Footer for Page Numbering */}
          <div className="hidden print:flex fixed bottom-0 left-0 right-0 h-8 items-center justify-between px-8 text-[8px] text-gray-400 border-t border-gray-100 bg-white">
            <span className="font-black uppercase">Relatório Gerencial - CheckViatura Pro</span>
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
                        <h3 className="font-black text-xs uppercase tracking-widest leading-none">Relatório de Auditoria</h3>
                        <p className="text-[8px] text-gray-400 mt-1">Protocolo: {selectedLog.id}</p>
                      </div>
                   </div>
                   <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-end">
                      <button 
                        onClick={() => {
                          const log = selectedLog;
                          setSelectedLog(null);
                          setViewingJsonData({
                            data: getFullData(log),
                            title: 'Dados Originais (JSON)',
                            subtitle: `Protocolo: ${log.id} | Viatura: ${log.prefix}`
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
                        {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
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
                
                <div ref={printMirrorRef} className="flex-1 overflow-auto bg-white p-4 sm:p-8 print:p-0 print:overflow-visible">
                   <div data-pdf-content="audit" className="max-w-4xl mx-auto space-y-4 print:space-y-4">
                      {(() => {
                          const mirrorData = getFullData(selectedLog);
                          if (!mirrorData) return <div className="p-10 text-center font-bold text-red-500 uppercase">Erro: Dados íntegros não encontrados no banco.</div>;
                          
                          const originalInspectionDateTime = formatDate(selectedLog.date);
                          
                          // Fallback para imagens da viatura se não estiverem no log (otimização de tamanho)
                          const inspectionImages = (mirrorData.vehicleImages && mirrorData.vehicleImages.length > 0) 
                            ? mirrorData.vehicleImages 
                            : (settings?.vehicleImages || []);
                          
                          const inspectionRatios = mirrorData.vehicleImageRatios || (settings?.vehicleImageRatios || []);
                          const hasInspectionImages = inspectionImages.some((img: string) => img && img !== "");

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
                                      <div className="flex flex-col"><span className="text-[8px] font-black text-gray-400 uppercase">Viatura</span><span className="text-[11px] font-black uppercase text-gray-800">{selectedLog.prefix || mirrorData.prefix}</span></div>
                                      <div className="flex flex-col"><span className="text-[8px] font-black text-gray-400 uppercase">Placa</span><span className="text-[11px] font-black uppercase text-gray-800">{selectedLog.plate || mirrorData.plate}</span></div>
                                      <div className="flex flex-col"><span className="text-[8px] font-black text-gray-400 uppercase">Ciclo</span><span className="text-[11px] font-black uppercase text-blue-600">{selectedLog.checklistType || mirrorData.checklistType}</span></div>
                                      <div className="flex flex-col"><span className="text-[8px] font-black text-gray-400 uppercase">Odômetro</span><span className="text-[11px] font-black uppercase text-gray-800">{selectedLog.km || mirrorData.km} KM</span></div>
                                  </section>

                                  {hasInspectionImages && (
                                  <section className="space-y-3">
                                      <h4 className="text-[10px] font-black uppercase text-gray-400 border-b pb-1">Mapeamento Visual de Avarias</h4>
                                      <div className="grid grid-cols-3 gap-3 print:grid-cols-3">
                                          {inspectionImages.map((img: string, idx: number) => {
                                              if (!img || img === "") return null;
                                              const dmgs = (mirrorData.damages || []).filter((d: any) => d.imageIndex === idx);
                                              const ratio = inspectionRatios[idx] || 'landscape';
                                              return (
                                                  <div key={idx} className={`relative bg-gray-50 border rounded-xl overflow-hidden shadow-sm ${ratio === 'landscape' ? 'aspect-video' : 'aspect-[3/4]'}`}>
                                                      <img src={img} className="w-full h-full object-contain" alt={`Vista ${idx}`} referrerPolicy="no-referrer" />
                                                      {dmgs.map((d: any, dIdx: number) => (
                                                          <div 
                                                              key={`dmg-${d.id || dIdx}-${dIdx}`} 
                                                              className="absolute w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-white shadow-sm -translate-x-1/2 -translate-y-1/2" 
                                                              style={{ left: `${d.x}%`, top: `${d.y}%` }} 
                                                          />
                                                      ))}
                                                  </div>
                                              );
                                          })}
                                      </div>
                                  </section>
                                  )}

                                  <section className="border rounded-2xl overflow-hidden shadow-sm">
                                      <table className="w-full text-left text-[10px] border-collapse">
                                        <thead className="bg-gray-100 uppercase font-black text-gray-500">
                                          <tr><th className="p-3">Item de Controle</th><th className="p-3 text-center">Status</th><th className="p-3">Observações / Evidências</th></tr>
                                        </thead>
                                        <tbody className="divide-y">{ (mirrorData.items || []).map((it:any, i:number) => (
                                          <tr key={`item-${it.id || i}-${i}`} className={it.status==='CN'?'bg-red-50/50':''}>
                                              <td className="p-3 font-bold text-gray-700">{it.label}</td>
                                              <td className="p-3 text-center">
                                                  <span className={`px-2 py-0.5 rounded text-white font-black text-[9px] uppercase ${it.status==='CN'?'bg-red-600' : it.status === 'OK' || it.status === 'SN' ? 'bg-green-600' : 'bg-gray-300'}`}>
                                                      {it.status === 'OK' ? 'SN' : it.status}
                                                  </span>
                                              </td>
                                              <td className="p-3 italic text-gray-500">
                                                  {it.observation || '-'}
                                                  {it.photos?.length > 0 && <span className="ml-2 inline-flex items-center text-blue-600 font-bold text-[8px] uppercase tracking-tighter">[+ FOTOS]</span>}
                                              </td>
                                          </tr>
                                      ))}</tbody></table>
                                  </section>

                                  {(selectedLog.generalObservation || mirrorData.generalObservation) && (
                                      <section className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100 shadow-inner">
                                          <span className="text-[8px] font-black text-gray-400 uppercase block mb-1">Informações Gerais / Parecer do Inspetor</span>
                                          <p className="text-[11px] italic leading-relaxed text-gray-700 font-medium">
                                              "{selectedLog.generalObservation || mirrorData.generalObservation}"
                                          </p>
                                      </section>
                                  )}

                                  <Footer 
                                    signatureName={mirrorData.signatureName || selectedLog.inspector} 
                                    signatureRank={mirrorData.signatureRank || ""} 
                                    date={mirrorData.date} 
                                  />
                                  
                                  <div className="text-center pt-2">
                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Data/Hora Original da Inspeção: </span>
                                    <span className="text-[10px] font-black text-gray-700">{originalInspectionDateTime}</span>
                                  </div>

                                  <section className="space-y-4 pt-6 border-t break-before-page">
                                      <h4 className="text-[10px] font-black uppercase text-gray-400 text-center tracking-widest">Anexo de Evidências Fotográficas</h4>
                                      <div className="grid grid-cols-2 md:grid-cols-3 print:grid-cols-2 gap-4">
                                          {(mirrorData.items || []).filter((i: any) => i.photos && i.photos.length > 0).map((item: any) => 
                                              item.photos.map((p: string, idx: number) => (
                                                  <div key={`${item.id}-${idx}`} className="flex flex-col gap-1 break-inside-avoid">
                                                      <div className="relative aspect-square border-2 border-gray-100 rounded-2xl overflow-hidden bg-gray-50 shadow-sm">
                                                          <img src={p} className="w-full h-full object-contain" alt={`Foto Item ${item.label}`} referrerPolicy="no-referrer" />
                                                      </div>
                                                      <div className="bg-gray-800 text-white text-[8px] p-2 rounded-lg font-black truncate uppercase tracking-tighter">
                                                          Item: {item.label}
                                                      </div>
                                                  </div>
                                              ))
                                          )}
                                          {(mirrorData.photos || []).map((p: string, i: number) => (
                                              <div key={`g-${i}`} className="flex flex-col gap-1 break-inside-avoid">
                                                  <div className="relative aspect-square border-2 border-gray-100 rounded-2xl overflow-hidden bg-gray-50 shadow-sm">
                                                      <img src={p} className="w-full h-full object-contain" alt="Evidência Geral" referrerPolicy="no-referrer" />
                                                  </div>
                                                  <div className="bg-blue-600 text-white text-[8px] p-2 rounded-lg font-black uppercase text-center tracking-tighter">
                                                      Evidência Geral {i + 1}
                                                  </div>
                                              </div>
                                          ))}
                                      </div>
                                      {(!(mirrorData.items?.some((i: any) => i.photos?.length)) && !(mirrorData.photos?.length)) && (
                                          <div className="p-10 border-2 border-dashed rounded-3xl text-center text-[10px] font-black text-gray-300 uppercase">
                                              Nenhuma evidência fotográfica anexada a este protocolo.
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
                      <span className="font-bold">Protocolo Auditoria: {selectedLog.id}</span>
                      <span className="italic">Documento Gerado em: {new Date().toLocaleString('pt-BR')}</span>
                   </div>

                   <div className="flex print:hidden justify-between text-[8px] font-black text-gray-400 uppercase p-6 border-t mt-4 bg-gray-50">
                      <span>ID Transação: {selectedLog.id}</span>
                      <span>Reimpressão via Auditoria: {new Date().toLocaleString('pt-BR')}</span>
                   </div>
                </div>
             </div>
          </div>
        )}
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
                onClick={() => onFetch(Array.from(selectedPrefixes).join(','), monthFilter)}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50 active:scale-95"
              >
                {isLoading ? <BarChart className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Sincronizar Dados
              </button>
              <button 
                onClick={() => {
                  setMonthFilter('');
                  setSelectedPrefixes(new Set());
                  setPrefixSearch('');
                  onFetch('', '');
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
            <div className="lg:col-span-3 space-y-2 relative">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Mês de Referência</label>
              <div className="relative">
                <select 
                  value={monthFilter} 
                  onChange={e => setMonthFilter(e.target.value)}
                  className="w-full border-2 rounded-2xl p-3 pr-10 text-sm font-bold outline-none focus:border-blue-500 bg-white shadow-sm appearance-none cursor-pointer"
                >
                  <option key="all-months" value="">Todos os Meses ({logs.length})</option>
                  {uniqueMonths.map(month => (
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

            <div className="lg:col-span-9 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Seleção de Viaturas ({selectedPrefixes.size} selecionadas)</label>
                <div className="flex gap-2">
                  <button 
                    onClick={selectAllPrefixes}
                    className="text-[9px] font-black uppercase text-blue-600 hover:underline"
                  >
                    Selecionar Todas
                  </button>
                  <span className="text-gray-300">|</span>
                  <button 
                    onClick={deselectAllPrefixes}
                    className="text-[9px] font-black uppercase text-red-600 hover:underline"
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
                  onChange={e => setPrefixSearch(e.target.value)}
                  className="w-full border-2 rounded-2xl p-3 pl-12 text-sm font-bold outline-none focus:border-blue-500 bg-white shadow-sm"
                />
              </div>

              <div className="bg-white border-2 rounded-2xl p-4 max-h-48 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 shadow-inner">
                {uniquePrefixes
                  .filter(p => !prefixSearch || p.includes(normalizePrefix(prefixSearch)))
                  .map(prefix => (
                  <button
                    key={prefix}
                    onClick={() => togglePrefix(prefix)}
                    className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all border-2 text-center truncate ${
                      selectedPrefixes.has(prefix)
                        ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                        : 'bg-gray-50 border-gray-100 text-gray-400 hover:border-gray-300'
                    }`}
                  >
                    {prefix}
                  </button>
                ))}
                {uniquePrefixes.length === 0 && (
                  <div className="col-span-full py-4 text-center text-[10px] font-bold text-gray-400 uppercase">
                    Nenhuma viatura encontrada no banco.
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
            <h4 className="text-lg font-black uppercase tracking-tight">Central de Inteligência e Relatórios</h4>
            <p className="text-xs text-blue-100 font-medium opacity-90 max-w-md">Selecione as viaturas e o período acima para gerar documentos analíticos e estatísticos de alta precisão.</p>
          </div>
        </div>
      </div>

      {filteredLogs.length === 0 ? (
        <div className="bg-white rounded-[2.5rem] border-2 border-dashed border-gray-200 p-20 text-center no-print">
          <AlertCircle className="w-16 h-16 text-gray-200 mx-auto mb-6" />
          <h4 className="text-lg font-black uppercase text-gray-400 tracking-widest mb-2">Nenhum registro encontrado</h4>
          <p className="text-xs font-bold text-gray-400 uppercase mb-8 max-w-md mx-auto">
            {logs.length === 0 
              ? "Não há dados carregados do banco de dados. Verifique a conexão com o Google Sheets ou clique no botão abaixo." 
              : "Nenhum registro corresponde aos filtros selecionados (mês ou viatura)."}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => onFetch('', 'all')}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg transition-all disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? "Sincronizando..." : "Sincronizar Dados Agora"}
            </button>
            {(monthFilter !== 'all' || selectedPrefixes.size > 0) && (
              <button 
                onClick={() => {
                  setMonthFilter('all');
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
            { id: 'novelties', title: 'Relatório de Novidades', desc: 'Avarias e observações críticas.', icon: AlertCircle, color: 'bg-red-500' },
            { id: 'synthetic', title: 'Relatório Sintético', desc: 'Resumo estatístico e conformidade.', icon: PieChart, color: 'bg-green-500' },
            { id: 'analytical', title: 'Relatório Analítico', desc: 'Dados detalhados de todos os registros.', icon: List, color: 'bg-purple-500' },
            { id: 'full', title: 'Relatório Completo', desc: 'Todos os dados com seleção de colunas.', icon: FileText, color: 'bg-orange-600' },
            { id: 'monthly_grouped', title: 'Relatório Mensal Agrupado', desc: 'Agrupado por viatura (ABS20109 = ABS-20109).', icon: BarChart, color: 'bg-blue-600' },
            { id: 'history', title: 'Histórico de Registros', desc: 'Histórico completo vindo da Auditoria.', icon: Clock, color: 'bg-indigo-600' },
            { id: 'daily_control', title: 'Ficha de Controle Diário', desc: 'Matriz mensal (31 dias) - Ficha de Controle.', icon: Calendar, color: 'bg-orange-500' },
            { id: 'daily_control_motos', title: 'Ficha de Controle Diário de Motos', desc: 'Matriz mensal (31 dias) específica para motocicletas.', icon: Calendar, color: 'bg-yellow-500' },
            { id: 'weekly_leves', title: 'Ficha Semanal Leves/Pesadas', desc: 'Controle semanal para viaturas leves e pesadas.', icon: Calendar, color: 'bg-emerald-600' },
            { id: 'weekly_motos', title: 'Ficha Semanal Motos', desc: 'Controle semanal específico para motocicletas.', icon: Calendar, color: 'bg-yellow-600' },
            { id: 'weekly_ab', title: 'Ficha Semanal AB/Aéreas', desc: 'Controle semanal para viaturas tipo AB e Aéreas.', icon: Calendar, color: 'bg-red-600' },
          ].map(report => (
            <button 
              key={report.id}
              onClick={() => setActiveReport(report.id as ReportType)}
              className="bg-white border p-6 rounded-3xl flex items-center gap-4 hover:border-blue-500 hover:shadow-md transition-all group text-left"
            >
              <div className={`${report.color} p-4 rounded-2xl text-white shadow-lg group-hover:scale-110 transition-transform`}>
                <report.icon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h5 className="text-sm font-black uppercase text-gray-900">{report.title}</h5>
                <p className="text-[10px] text-gray-400 font-medium">{report.desc}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 transition-colors" />
            </button>
          ))}
        </div>
      )}

      <div className="bg-gray-50 p-6 rounded-3xl border border-dashed text-center no-print">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Selecione um relatório acima para visualizar e imprimir</p>
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
                      <h3 className="font-black text-xs uppercase tracking-widest leading-none">Relatório de Auditoria</h3>
                      <p className="text-[8px] text-gray-400 mt-1">Protocolo: {selectedLog.id}</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-end">
                    <button 
                      onClick={() => generatePdf(true)} 
                      disabled={isGeneratingPdf}
                      className="flex-1 sm:flex-none bg-orange-600 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 shadow-lg hover:bg-orange-700 transition-all disabled:opacity-50"
                    >
                      {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                      <span className="hidden xs:inline">Visualizar</span> PDF
                    </button>
                    <button 
                      onClick={() => generatePdf(false)} 
                      disabled={isGeneratingPdf}
                      className="flex-1 sm:flex-none bg-green-600 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 shadow-lg hover:bg-green-700 transition-all disabled:opacity-50"
                    >
                      {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
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
              
              <div ref={printMirrorRef} className="flex-1 overflow-auto bg-white p-4 sm:p-8 print:p-0 print:overflow-visible relative">
                 <div data-pdf-content="audit" className="max-w-4xl mx-auto space-y-4 print:space-y-4 relative z-10">
                    <Watermark />
                    {(() => {
                        const mirrorData = getFullData(selectedLog);
                        if (!mirrorData) return <div className="p-10 text-center font-bold text-red-500 uppercase">Erro: Dados íntegros não encontrados no banco.</div>;
                        
                        const originalInspectionDateTime = formatDate(selectedLog.date);
                        
                        // Fallback para imagens da viatura se não estiverem no log (otimização de tamanho)
                        const inspectionImages = (mirrorData.vehicleImages && mirrorData.vehicleImages.length > 0) 
                          ? mirrorData.vehicleImages 
                          : (settings?.vehicleImages || []);
                        
                        const inspectionRatios = mirrorData.vehicleImageRatios || (settings?.vehicleImageRatios || []);
                        const hasInspectionImages = inspectionImages.some((img: string) => img && img !== "");

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
                                    <div className="flex flex-col"><span className="text-[8px] font-black text-gray-400 uppercase">Viatura</span><span className="text-[11px] font-black uppercase text-gray-800">{selectedLog.prefix || mirrorData.prefix}</span></div>
                                    <div className="flex flex-col"><span className="text-[8px] font-black text-gray-400 uppercase">Placa</span><span className="text-[11px] font-black uppercase text-gray-800">{selectedLog.plate || mirrorData.plate}</span></div>
                                    <div className="flex flex-col"><span className="text-[8px] font-black text-gray-400 uppercase">Ciclo</span><span className="text-[11px] font-black uppercase text-blue-600">{selectedLog.checklistType || mirrorData.checklistType}</span></div>
                                    <div className="flex flex-col"><span className="text-[8px] font-black text-gray-400 uppercase">Odômetro</span><span className="text-[11px] font-black uppercase text-gray-800">{selectedLog.km || mirrorData.km} KM</span></div>
                                </section>

                                {hasInspectionImages && (
                                <section className="space-y-3">
                                    <h4 className="text-[10px] font-black uppercase text-gray-400 border-b pb-1">Mapeamento Visual de Avarias</h4>
                                    <div className="grid grid-cols-3 gap-3 print:grid-cols-3">
                                        {inspectionImages.map((img: string, idx: number) => {
                                            if (!img || img === "") return null;
                                            const dmgs = (mirrorData.damages || []).filter((d: any) => d.imageIndex === idx);
                                            const ratio = inspectionRatios[idx] || 'landscape';
                                            return (
                                                <div key={idx} className={`relative bg-gray-50 border rounded-xl overflow-hidden shadow-sm ${ratio === 'landscape' ? 'aspect-video' : 'aspect-[3/4]'}`}>
                                                    <img src={img} className="w-full h-full object-contain" alt={`Vista ${idx}`} referrerPolicy="no-referrer" />
                                                    {dmgs.map((d: any) => (
                                                        <div 
                                                            key={d.id} 
                                                            className="absolute w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-white shadow-sm -translate-x-1/2 -translate-y-1/2" 
                                                            style={{ left: `${d.x}%`, top: `${d.y}%` }} 
                                                        />
                                                    ))}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                                )}

                                <section className="border rounded-2xl overflow-hidden shadow-sm">
                                    <table className="w-full text-left text-[10px] border-collapse">
                                      <thead className="bg-gray-100 uppercase font-black text-gray-500">
                                        <tr><th className="p-3">Item de Controle</th><th className="p-3 text-center">Status</th><th className="p-3">Observações / Evidências</th></tr>
                                      </thead>
                                      <tbody className="divide-y">{ (mirrorData.items || []).map((it:any, i:number) => (
                                        <tr key={i} className={it.status==='CN'?'bg-red-50/50':''}>
                                            <td className="p-3 font-bold text-gray-700">{it.label}</td>
                                            <td className="p-3 text-center">
                                                <span className={`px-2 py-0.5 rounded text-white font-black text-[9px] uppercase ${it.status==='CN'?'bg-red-600' : it.status === 'OK' || it.status === 'SN' ? 'bg-green-600' : 'bg-gray-300'}`}>
                                                    {it.status === 'OK' ? 'SN' : it.status}
                                                </span>
                                            </td>
                                            <td className="p-3 italic text-gray-500">
                                                {it.observation || '-'}
                                                {it.photos?.length > 0 && <span className="ml-2 inline-flex items-center text-blue-600 font-bold text-[8px] uppercase tracking-tighter">[+ FOTOS]</span>}
                                            </td>
                                        </tr>
                                    ))}</tbody></table>
                                </section>

                                {(selectedLog.generalObservation || mirrorData.generalObservation) && (
                                    <section className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100 shadow-inner">
                                        <span className="text-[8px] font-black text-gray-400 uppercase block mb-1">Informações Gerais / Parecer do Inspetor</span>
                                        <p className="text-[11px] italic leading-relaxed text-gray-700 font-medium">
                                            "{selectedLog.generalObservation || mirrorData.generalObservation}"
                                        </p>
                                    </section>
                                )}

                                <Footer 
                                  signatureName={mirrorData.signatureName || selectedLog.inspector} 
                                  signatureRank={mirrorData.signatureRank || ""} 
                                  date={mirrorData.date} 
                                />
                                
                                <div className="text-center pt-2">
                                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Data/Hora Original da Inspeção: </span>
                                  <span className="text-[10px] font-black text-gray-700">{originalInspectionDateTime}</span>
                                </div>

                                <section className="space-y-4 pt-6 border-t break-before-page">
                                    <h4 className="text-[10px] font-black uppercase text-gray-400 text-center tracking-widest">Anexo de Evidências Fotográficas</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-3 print:grid-cols-2 gap-4">
                                        {(mirrorData.items || []).filter((i: any) => i.photos && i.photos.length > 0).map((item: any) => 
                                            item.photos.map((p: string, idx: number) => (
                                                <div key={`${item.id}-${idx}`} className="flex flex-col gap-1 break-inside-avoid">
                                                    <div className="relative aspect-square border-2 border-gray-100 rounded-2xl overflow-hidden bg-gray-50 shadow-sm">
                                                        <img src={p} className="w-full h-full object-contain" alt={`Foto Item ${item.label}`} referrerPolicy="no-referrer" />
                                                    </div>
                                                    <div className="bg-gray-800 text-white text-[8px] p-2 rounded-lg font-black truncate uppercase tracking-tighter">
                                                        Item: {item.label}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                        {(mirrorData.photos || []).map((p: string, i: number) => (
                                            <div key={`g-${i}`} className="flex flex-col gap-1 break-inside-avoid">
                                                <div className="relative aspect-square border-2 border-gray-100 rounded-2xl overflow-hidden bg-gray-50 shadow-sm">
                                                    <img src={p} className="w-full h-full object-contain" alt="Evidência Geral" referrerPolicy="no-referrer" />
                                                </div>
                                                <div className="bg-blue-600 text-white text-[8px] p-2 rounded-lg font-black uppercase text-center tracking-tighter">
                                                    Evidência Geral {i + 1}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {(!(mirrorData.items?.some((i: any) => i.photos?.length)) && !(mirrorData.photos?.length)) && (
                                        <div className="p-10 border-2 border-dashed rounded-3xl text-center text-[10px] font-black text-gray-300 uppercase">
                                            Nenhuma evidência fotográfica anexada a este protocolo.
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
                    <span className="font-bold">Protocolo Auditoria: {selectedLog.id}</span>
                    <span className="italic">Documento Gerado em: {new Date().toLocaleString('pt-BR')}</span>
                 </div>

                 <div className="flex print:hidden justify-between text-[8px] font-black text-gray-400 uppercase p-6 border-t mt-4 bg-gray-50">
                    <span>ID Transação: {selectedLog.id}</span>
                    <span>Reimpressão via Auditoria: {new Date().toLocaleString('pt-BR')}</span>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
