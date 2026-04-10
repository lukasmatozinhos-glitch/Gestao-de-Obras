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
  status: 'not-started' | 'in-progress' | 'paused' | 'finished';
  progress: number;
  startDate: string;
  endDate: string;
  budget: number;
  spent: number;
  location: string;
  executingCompany: string;
  image?: string;
  createdBy?: string;
  photoReport?: PhotoReportItem[];
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
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string;
  phone: string;
  accessLevel: string;
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
}
