
export type ChecklistType = 'Diário' | 'Semanal';
export type ItemStatus = 'OK' | 'CN' | 'PENDING';
export type VehicleOperationalStatus = 'OPERANDO' | 'RESERVA' | 'BAIXADA';
export type ItemFrequency = 'Diário' | 'Semanal' | 'Ambos';
export type AspectRatio = 'landscape' | 'portrait';
export type VehicleType = 'LEVE/PESADA' | 'MOTOCICLETA' | 'AB/AÉREA';

export interface GB {
  id: string;
  name: string;
}

export interface SGB {
  id: string;
  name: string;
  gbId: string;
}

export interface Station {
  id: string;
  name: string;
  sgbId: string;
}

export interface MaintenanceAlert {
  id: string;
  type: 'KM' | 'DATE';
  description: string;
  targetKm?: number;
  warnKmBefore?: number;
  targetDate?: string;
  warnDaysBefore?: number;
  status: 'ACTIVE' | 'DONE';
  createdAt: string;
  completedAt?: string;
  completedBy?: string;
}

export interface Vehicle {
  id: string;
  prefix: string;
  plate: string;
  type: VehicleType;
  station: string;
  sgb?: string;
  gb?: string;
  km?: string;
  status?: string;
  lastCheckId?: string;
  alerts?: MaintenanceAlert[];
}

export interface DamagePoint {
  id: string;
  x: number;
  y: number;
  imageIndex: number;
  description: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  status: ItemStatus;
  frequency: ItemFrequency;
  vehicleTypes: VehicleType[]; // Novos itens vinculados a tipos
  observation?: string;
  photos?: string[];
}

export interface InspectionData {
  id: string;
  date: string;
  prefix: string;
  checklistType: ChecklistType;
  plate: string;
  vehicleType?: VehicleType;
  station?: string;
  km: string;
  vehicleStatus?: VehicleOperationalStatus;
  items: ChecklistItem[];
  damages: DamagePoint[];
  photos: string[];
  vehicleImages: string[];
  vehicleImageRatios?: AspectRatio[];
  generalObservation: string;
  signatureName?: string;
  signatureRank?: string;
}

export interface UserPermissions {
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
  shouldChangePassword?: boolean;
}

export interface User {
  id: string;
  username: string;
  password?: string;
  name: string;
  rank?: string;
  permissions: UserPermissions;
  shouldChangePassword?: boolean;
}

export interface DocumentLink {
  id: string;
  name: string;
  url: string;
  category?: string;
  description?: string;
  params?: string; // Edit parameters or custom settings for the document link
}

export interface AppSettings {
  vehicleImages: string[];
  vehicleImageRatios?: AspectRatio[];
  defaultItems: Omit<ChecklistItem, 'status'>[];
  vehicles?: Vehicle[];
  stations?: Station[];
  users?: User[];
  sgbs?: SGB[];
  gbs?: GB[];
  documentLinks?: DocumentLink[]; // Persistent document links inside settings/database
  headerTitle?: string;
  reportTitle?: string;
  weeklyLevesTitle?: string;
  weeklyMotosTitle?: string;
  weeklyAbTitle?: string;
  dailyMotosTitle?: string;
  headerLogoUrl1?: string;
  headerLogoUrl2?: string;
  headerBgColor?: string;
  printScale?: number;
  googleSheetUrl?: string; 
  googleSpreadsheetId?: string;
  watermarkUrl?: string;
  settingsPassword?: string;
  appName?: string;
  appDescription?: string;
  developedBy?: string;
  stationOrder?: string[];
  dashboardCharts?: string[];
}

export interface AuditLog {
  id: string;
  date: string;
  user: string;
  action: string;
  details: string;
}

export interface Justification {
  id: string;
  date: string;
  dateRef?: string;
  type: string;
  vehicleType: string;
  station: string;
  justification: string;
  author: string;
  authorRank: string;
  createdAt: string;
  month: string; // ISO month string
  status: 'PENDING' | 'SIGNED';
}

export interface LogEntry {
  id: string;
  date: string;
  prefix: string;
  plate: string;
  checklistType: string;
  km: string;
  inspector: string;
  Inspetor?: string;
  inspetor?: string;
  conferente?: string;
  vehicleStatus?: string;
  itemsStatus: string; 
  itemsDetail?: string; // JSON string dos itens sem fotos
  fullData?: string;    // JSON string completo da inspeção (para reimpressão fiel)
  generalObservation?: string;
  screenshot?: string;   // Base64 da imagem do checklist preenchido
}
