
import { ChecklistItem, AspectRatio, VehicleType } from './types';

export const VEHICLE_TYPES: VehicleType[] = ['LEVE/PESADA', 'MOTOCICLETA', 'AB/AÉREA'];

export const INITIAL_CHECKLIST_ITEMS: Omit<ChecklistItem, 'status'>[] = [
  // --- CHECKLIST DIÁRIO (28 ITENS) ---
  { id: 'd1', label: 'DOCUMENTOS DO VEÍCULO E A FICHA DE COMBUSTÍVEL (CLRV, RIV, FCOMB, FCT)', frequency: 'Diário', vehicleTypes: [...VEHICLE_TYPES] },
  { id: 'd2', label: 'MANUTENÇÃO DE OPERAÇÃO DIÁRIA E SEMANAL', frequency: 'Diário', vehicleTypes: [...VEHICLE_TYPES] },
  { id: 'd3', label: 'CONFERIR SELOS DE INSPEÇÃO DE FREIOS E TROCAS DE ÓLEOS', frequency: 'Diário', vehicleTypes: ['LEVE/PESADA', 'AB/AÉREA'] },
  { id: 'd4', label: 'PLANO DE MANUTENÇÃO PREVENTIVA', frequency: 'Diário', vehicleTypes: [...VEHICLE_TYPES] },
  { id: 'd5', label: 'DOCUMENTAÇÃO DO MOTORISTA', frequency: 'Diário', vehicleTypes: [...VEHICLE_TYPES] },
  { id: 'd6', label: 'NÍVEL DE ÓLEO DO CARTER, DIREÇÃO HIDRÁULICA, SISTEMA HIDRÁULICO E CÂMBIO AUTOMÁTICO', frequency: 'Diário', vehicleTypes: ['LEVE/PESADA', 'AB/AÉREA'] },
  { id: 'd7', label: 'NÍVEIS DE ÁGUA (COMPLETANDO SE NECESSÁRIO)', frequency: 'Diário', vehicleTypes: ['LEVE/PESADA', 'AB/AÉREA'] },
  { id: 'd8', label: 'NÍVEL DE FLUÍDO DE FREIO', frequency: 'Diário', vehicleTypes: [...VEHICLE_TYPES] },
  { id: 'd9', label: 'VERIFICAR VAZAMENTOS EM GERAL', frequency: 'Diário', vehicleTypes: [...VEHICLE_TYPES] },
  { id: 'd10', label: 'ESTADO E TENSÃO DAS CORREIAS', frequency: 'Diário', vehicleTypes: ['LEVE/PESADA', 'AB/AÉREA'] },
  { id: 'd11', label: 'FIXAÇÃO DA BATERIA E RESPECTIVOS BORNES', frequency: 'Diário', vehicleTypes: [...VEHICLE_TYPES] },
  { id: 'd12', label: 'FUNCIONAR O VEÍCULO, VERIFICANDO BARULHOS ANORMAIS NO MOTOR', frequency: 'Diário', vehicleTypes: [...VEHICLE_TYPES] },
  { id: 'd13', label: 'FUNCIONAMENTO DOS MARCADORES E ALARMES DO PAINEL (TEMP, ÓLEO, AR FREIO, ETC)', frequency: 'Diário', vehicleTypes: [...VEHICLE_TYPES] },
  { id: 'd14', label: 'COMANDOS DO ACELERADOR', frequency: 'Diário', vehicleTypes: [...VEHICLE_TYPES] },
  { id: 'd15', label: 'EMBREAGEM E CÂMBIO/TRANSMISSÃO', frequency: 'Diário', vehicleTypes: ['LEVE/PESADA', 'AB/AÉREA'] },
  { id: 'd16', label: 'FUNCIONAMENTO DOS LIMPADORES DE PÁRA-BRISA E ESTADO DAS PALHETAS', frequency: 'Diário', vehicleTypes: ['LEVE/PESADA', 'AB/AÉREA'] },
  { id: 'd17', label: 'FUNCIONAMENTO DOS FREIOS', frequency: 'Diário', vehicleTypes: [...VEHICLE_TYPES] },
  { id: 'd18', label: 'SISTEMA ELÉTRICO (LANTERNA, SETA, FAROL, FREIO, EMERGÊNCIA, RÉ, BUZINA)', frequency: 'Diário', vehicleTypes: [...VEHICLE_TYPES] },
  { id: 'd19', label: 'PORTAS, FECHADURAS E MÁQUINAS DE VIDRO', frequency: 'Diário', vehicleTypes: ['LEVE/PESADA', 'AB/AÉREA'] },
  { id: 'd20', label: 'ESTADO DAS RODAS, PRISIONEIROS E PNEUS (PRESSÃO, DESGASTES E CORTES)', frequency: 'Diário', vehicleTypes: [...VEHICLE_TYPES] },
  { id: 'd21', label: 'VERIFICAR PNEU SOBRESSALENTE E SUAS CONDIÇÕES (QUANDO HOUVER)', frequency: 'Diário', vehicleTypes: ['LEVE/PESADA', 'AB/AÉREA'] },
  { id: 'd22', label: 'EQUIPAMENTOS OBRIGATÓRIOS (TRIÂNGULO, MACACO, CHAVE DE RODA)', frequency: 'Diário', vehicleTypes: ['LEVE/PESADA', 'AB/AÉREA'] },
  { id: 'd23', label: 'VERIFICAR A CARROCERIA QUANTO À AVARIAS E FIXAÇÃO DE PLACAS', frequency: 'Diário', vehicleTypes: [...VEHICLE_TYPES] },
  { id: 'd24', label: 'VERIFICAR O ESTADO DO CINTO DE SEGURANÇA', frequency: 'Diário', vehicleTypes: ['LEVE/PESADA', 'AB/AÉREA'] },
  { id: 'd25', label: 'VERIFICAR O ESTADO DO ESTOFAMENTO, DO FORRO E TAPETES', frequency: 'Diário', vehicleTypes: ['LEVE/PESADA', 'AB/AÉREA'] },
  { id: 'd26', label: 'ESPELHOS RETROVISORES INTERNOS E EXTERNOS', frequency: 'Diário', vehicleTypes: [...VEHICLE_TYPES] },
  { id: 'd27', label: 'EQUIPAMENTOS OPERACIONAIS ESPECÍFICOS (BOMBA, ESCADA, GERADOR, ETC)', frequency: 'Diário', vehicleTypes: ['AB/AÉREA', 'LEVE/PESADA'] },
  { id: 'd28', label: 'COMPLETAR O COMBUSTÍVEL SE NECESSÁRIO', frequency: 'Diário', vehicleTypes: [...VEHICLE_TYPES] },

  // --- CHECKLIST SEMANAL (18 ITENS) ---
  { id: 's1', label: 'REALIZAR INSPEÇÃO CONSTANTE NO CHECK LIST DIÁRIO', frequency: 'Semanal', vehicleTypes: [...VEHICLE_TYPES] },
  { id: 's2', label: 'CONFERIR SELOS DE TROCA DE OIL E INSPEÇÃO DE FREIOS (DATA E KM VENCIMENTOS)', frequency: 'Semanal', vehicleTypes: [...VEHICLE_TYPES] },
  { id: 's3', label: 'VERIFICAR O ESTADO E FIXAÇÃO DOS EXTINTORES', frequency: 'Semanal', vehicleTypes: [...VEHICLE_TYPES] },
  { id: 's4', label: 'EFETUAR LIMPEZA E FIXAÇÃO DOS TERMINAIS DAS BATERIAS', frequency: 'Semanal', vehicleTypes: [...VEHICLE_TYPES] },
  { id: 's5', label: 'COMPLETAR ÓLEO DA SIRENE BITONAL (2 GOTAS SAE 10W30 A CADA 15 DIAS)', frequency: 'Semanal', vehicleTypes: [...VEHICLE_TYPES] },
  { id: 's6', label: 'INSPECIONAR PARAFUSOS DAS FLANGES DO CARDAN E ENGRAXAR CRUZETAS', frequency: 'Semanal', vehicleTypes: ['LEVE/PESADA', 'AB/AÉREA'] },
  { id: 's7', label: 'INSPECIONAR AS CINTAS PROTETORAS DO CARDAN', frequency: 'Semanal', vehicleTypes: ['LEVE/PESADA', 'AB/AÉREA'] },
  { id: 's8', label: 'INSPECIONAR MOLAS, AMORTECEDORES, COXINS, COIFAS, CATRACAS E BATENTES', frequency: 'Semanal', vehicleTypes: [...VEHICLE_TYPES] },
  { id: 's9', label: 'TESTAR VÁLVULA DE DESCARGA AUTOMÁTICA DO RESERVATÓRIO DE AR (SE HOUVER)', frequency: 'Semanal', vehicleTypes: ['LEVE/PESADA', 'AB/AÉREA'] },
  { id: 's10', label: 'DRENAR O DECANTADOR DO ÓLEO DIESEL - DECANTADOR RACCOR (SE NECESSÁRIO)', frequency: 'Semanal', vehicleTypes: ['LEVE/PESADA', 'AB/AÉREA'] },
  { id: 's11', label: 'INSPECIONAR TUBULAÇÕES E MANGUEIRAS DE AR DO FREIO (VAZAMENTOS)', frequency: 'Semanal', vehicleTypes: ['LEVE/PESADA', 'AB/AÉREA'] },
  { id: 's12', label: 'APERTAR PARAFUSOS DA CARROÇARIA, ACESSÓRIOS, PARA-CHOQUE, COXIM E ESCAPE', frequency: 'Semanal', vehicleTypes: [...VEHICLE_TYPES] },
  { id: 's13', label: 'COMPLETAR ÓLEO LUBRIFICANTE DA BOMBA INJETORA (SE NECESSÁRIO)', frequency: 'Semanal', vehicleTypes: ['LEVE/PESADA', 'AB/AÉREA'] },
  { id: 's14', label: 'VERIFICAR SUPORTE DO MOTOR (TRAVESSA), ANALISANDO DANOS E TRINCAS', frequency: 'Semanal', vehicleTypes: ['LEVE/PESADA', 'AB/AÉREA'] },
  { id: 's15', label: 'INSPECIONAR FIXAÇÃO DA CÂMARA DE FREIOS', frequency: 'Semanal', vehicleTypes: ['LEVE/PESADA', 'AB/AÉREA'] },
  { id: 's16', label: 'TESTAR FUNCIONAMENTO DOS CONJUNTOS IMPLEMENTADOS (CARACTERÍSTICAS OPERACIONAIS)', frequency: 'Semanal', vehicleTypes: ['AB/AÉREA', 'LEVE/PESADA'] },
  { id: 's17', label: 'ATUALIZAR LANÇAMENTOS DE SERVICHOS, PEÇAS E ALTERAÇÕES NO RIV DA VTR', frequency: 'Semanal', vehicleTypes: [...VEHICLE_TYPES] },
  { id: 's18', label: 'LIMPEZA GERAL DA VIATURA COM APLICAÇÃO DE CERA SILICONE', frequency: 'Semanal', vehicleTypes: [...VEHICLE_TYPES] },
];

export const INITIAL_VEHICLE_IMAGES: string[] = [
  '', '', '', '', ''
];

export const INITIAL_VEHICLE_RATIOS: AspectRatio[] = [
  'landscape', 'landscape', 'landscape', 'landscape', 'landscape'
];

export const FIXED_GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycbwcoHQheEfYYQqJ7seMJ19t_RwBxW-0Iy2A2L--4A4w-p0XvXO8RSjotO587s1AhZC_/exec';
