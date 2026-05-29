export interface ProjectAddendum {
  id: string;
  projectId: string;
  number: string;
  description: string;
  rcNumber?: string;
  value: number;
  isApproved: boolean;
  createdAt: string;
  createdBy?: string;
  creatorName?: string;
}

export interface ScheduleActivity {
  id: string;
  projectId: string;
  name: string;
  responsible: string;
  startDate: string;
  endDate: string;
  predictedEndDate?: string;
  progress: number;
  status: 'pending' | 'in-progress' | 'completed' | 'delayed' | 'scheduled';
  dependencies?: string[];
  category?: string;
  order: number;
  isHidden: boolean;
  fieldInspectorId?: string;
  fieldInspectorName?: string;
}

export interface PhotoReportItem {
  id: string;
  projectId: string;
  url: string;
  caption: string;
  date: string;
}

export interface Project {
  id: string;
  name: string;
  client: string;
  contractNumber: string;
  description: string;
  status: 'not-started' | 'preliminary-study' | 'in-progress' | 'paused' | 'finished';
  progress: number;
  startDate: string;
  endDate: string;
  budget: number;
  spent: number;
  location: string;
  executingCompany: string;
  responsible: string;
  responsibleId?: string;
  image?: string;
  createdBy?: string;
  creatorName?: string;
  photoReport?: PhotoReportItem[];
  fieldInspectorId?: string;
  fieldInspectorName?: string;
}

export interface Resource {
  id: string;
  name: string;
  type: 'material' | 'equipment' | 'labor';
  quantity: number;
  unit: string;
  status: 'available' | 'in-use' | 'low-stock';
}

export interface WeeklyReport {
  id: string;
  projectId: string;
  projectName: string;
  weekEnding: string;
  status: 'draft' | 'submitted' | 'approved';
  fileName: string;
  fileSize: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface Measurement {
  id: string;
  projectId: string;
  projectName: string;
  date: string;
  value: number;
  description: string;
  status: 'pending' | 'approved' | 'paid';
  createdBy?: string;
  creatorName?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string;
  phone: string;
  accessLevel: string;
  palette?: string;
  isDarkMode?: boolean;
  projectId?: string;
  projectName?: string;
}

export interface Attachment {
  id: string;
  projectId: string;
  name: string;
  type: 'pdf' | 'image';
  url: string;
  uploadedAt: string;
  size?: string;
}

export interface StatusUpdate {
  id: string;
  projectId: string;
  date: string;
  message: string;
  author: string;
  createdBy?: string;
  creatorName?: string;
}

export interface MeasurementBulletin {
  id: string;
  projectId: string;
  projectName: string;
  contractNumber: string;
  rcNumber: string;
  sapItem: string;
  installation: string;
  supplier: string;
  value: number;
  date: string;
  status: 'pending' | 'approved' | 'paid';
  archived?: boolean;
  createdBy?: string;
  creatorName?: string;
}

export interface PlanningActivity {
  id: string;
  projectId: string;
  name: string;
  startMonth: number;
  startYear: number;
  endMonth: number;
  endYear: number;
  startDate?: string;
  endDate?: string;
  color: string;
  order: number;
  category?: string;
  description?: string;
  isHidden: boolean;
  fieldInspectorId?: string;
  fieldInspectorName?: string;
}

export interface FieldInspector {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  company?: string;
  createdAt: string;
  createdBy?: string;
  creatorName?: string;
  projectId?: string;
  projectName?: string;
}

export interface DailyWorkReport {
  id: string;
  projectId: string;
  projectName: string;
  date: string;
  weatherMorning: string; // e.g., "Sol", "Chuva", "Nublado"
  weatherAfternoon: string; // e.g., "Sol", "Chuva", "Nublado"
  climaDetails?: string;
  workConditions: 'normal' | 'parcial' | 'suspenso';
  servicesDone: string; // descrição dos serviços executados
  laborCount?: string; // quantidade de mão de obra
  equipmentsActive?: string; // equipamentos em uso
  occurrences?: string; // ocorrências relevantes
  inspectorId?: string; // fiscal associado ao relatório (opcional)
  inspectorName?: string;
  createdAt: string;
  createdBy: string;
  creatorName: string;

  // Novos campos adicionados:
  plannedProgress?: number; // % de obra planejado
  executedProgress?: number; // % de obra executado
  activityPeriod?: string; // período da atividade (ex: "Integral", "Diurno", "Noturno")
  projectStartDate?: string; // data de início da obra (pré-preenchido)
  projectEndDate?: string; // data de término da obra (pré-preenchido)
  ddsTheme?: string; // Tema do DDS
  ddsPhotoUrl?: string; // foto do DDS
  workforceList?: { id: string; role: string; quantity: number }[]; // quantidade de efetivo do dia em modelo de listagem
  companyLaborList?: { id: string; company: string; count: number; functions: string }[]; // listagem de empresa com quantidade de funcionarios e funções por funcionario
  servicePhotos?: { id: string; url: string; caption: string }[]; // fotos dos serviços sendo realizados
}

export interface ConsumptionRCRequest {
  id: string;
  projectId: string;
  projectName: string;
  requestDate: string;
  status: 'requested' | 'pending' | 'received' | 'returned' | 'canceled';
  rcNumber?: string;
  value: number;
  signedBulletin?: {
    name: string;
    url: string;
    size?: string;
  };
  observations: RCHistoryEntry[];
  createdBy: string;
  creatorName: string;
  createdAt: any;
}

export interface RCHistoryEntry {
  id: string;
  text: string;
  date: string;
  userName: string;
}

export interface Travel {
  id: string;
  name: string;
  cost: number;
  inspector: string;
  origin: string;
  destination: string;
  startDate: string;
  endDate: string;
  monthYear: string; // "YYYY-MM" format for easy monthly grouping
  createdAt?: any;
  createdBy?: string;
  creatorName?: string;
}

