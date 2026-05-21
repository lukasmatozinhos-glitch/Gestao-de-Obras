/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, Component } from 'react';
import { GripVertical, LayoutDashboard, 
  HardHat, 
  ClipboardList, 
  BarChart3, 
  Settings, 
  Bell, 
  Search, 
  Plus, 
  MoreVertical,
  Calendar,
  MapPin,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Menu,
  X,
  FileText,
  Upload,
  FilePlus,
  Download,
  Trash2,
  Pencil,
  DollarSign,
  Receipt,
  ArrowUpRight,
  Camera,
  Link,
  User,
  Briefcase,
  Mail,
  Phone,
  ShieldCheck,
  LogOut,
  History,
  MessageSquare,
  FileDown,
  Eye,
  Sun,
  Moon,
  ChevronUp,
  ChevronDown,
  DownloadCloud,
  UploadCloud,
  EyeOff
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db, auth, getStorageInstance } from './firebase';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  setDoc, 
  getDoc,
  increment,
  query,
  where,
  or,
  orderBy,
  getDocFromServer
} from 'firebase/firestore';
import { 
  ref as storageRef, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie,
  Legend
} from 'recharts';
import { MOCK_PROJECTS, MOCK_RESOURCES, MOCK_REPORTS, MOCK_MEASUREMENTS, MOCK_ATTACHMENTS, MOCK_STATUS_UPDATES } from './constants';
import html2canvas from 'html2canvas';
import { Project, WeeklyReport, Measurement, UserProfile, Attachment, StatusUpdate, PhotoReportItem, MeasurementBulletin, ProjectAddendum, ScheduleActivity, PlanningActivity, ConsumptionRCRequest, RCHistoryEntry, Travel } from './types';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

// Logo Base64 placeholder - o usuário deve substituir pelo conteúdo real da imagem enviada
// Este valor é usado como marca d'água no canto inferior esquerdo
const AXIA_LOGO_BASE64 = "" as string; 

const Logo = ({ size = 40, className = "" }: { size?: number, className?: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 100 100" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Axia Logo Integration */}
    <path d="M50 20L20 80H35L50 50L65 80H80L50 20Z" fill="currentColor" />
    <path d="M70 40L85 40V80H40V70H70V40Z" fill="currentColor" opacity="0.8" />
    <path d="M40 60L50 40L60 60H40Z" fill="white" />
  </svg>
);

const DEFAULT_USER: UserProfile = {
  id: '1',
  name: 'Eng. Ricardo Silva',
  email: 'ricardo.silva@axiaenergia.com.br',
  role: 'Gestor de Projetos Sênior',
  avatar: 'https://picsum.photos/seed/ricardo/200/200',
  phone: '+55 (31) 98765-4321',
  accessLevel: 'Administrador de Sistema'
};

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  
  // If it's a quota error, we don't want to crash the whole app with an uncaught exception
  // as we already handle the UI feedback via global state/localStorage
  if (errInfo.error.includes('Quota exceeded')) {
    return;
  }
  
  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('darkMode');
      return saved === 'true';
    }
    return false;
  });
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('firestore_quota_extrapolated') === 'true';
    }
    return false;
  });
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile>(DEFAULT_USER);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showHiddenActivities, setShowHiddenActivities] = useState(false);
  const getMonthIndex = (absMonth: number, visibleMonths: { absMonth: number }[]) => {
    return visibleMonths.findIndex(m => m.absMonth === absMonth);
  };

  const getMonthPosition = (absMonth: number, visibleMonths: { absMonth: number }[], width: number = MONTH_WIDTH) => {
    const index = getMonthIndex(absMonth, visibleMonths);
    if (index !== -1) return index * width;
    
    // If month is hidden, find the nearest previous visible month
    const prevVisible = [...visibleMonths].reverse().find(m => m.absMonth < absMonth);
    if (prevVisible) {
      const prevIndex = visibleMonths.findIndex(m => m.absMonth === prevVisible.absMonth);
      return (prevIndex + 1) * width;
    }
    
    return 0;
  };
  const [showTodayLine, setShowTodayLine] = useState(true);
  const [hiddenMonths, setHiddenMonths] = useState<string[]>([]);

  const toggleMonthVisibility = (monthYear: string) => {
    setHiddenMonths(prev => 
      prev.includes(monthYear) 
        ? prev.filter(m => m !== monthYear) 
        : [...prev, monthYear]
    );
  };

  const showAllMonths = () => setHiddenMonths([]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth < 1024) setIsSidebarOpen(false);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [statusUpdates, setStatusUpdates] = useState<StatusUpdate[]>([]);
  const [photoReports, setPhotoReports] = useState<PhotoReportItem[]>([]);
  const [measurementBulletins, setMeasurementBulletins] = useState<MeasurementBulletin[]>([]);
  const [addendums, setAddendums] = useState<ProjectAddendum[]>([]);
  const [activities, setActivities] = useState<ScheduleActivity[]>([]);
  const [planningActivities, setPlanningActivities] = useState<PlanningActivity[]>([]);

  const [travels, setTravels] = useState<Travel[]>([]);
  const [isAddingTravel, setIsAddingTravel] = useState(false);
  const [editingTravel, setEditingTravel] = useState<Travel | null>(null);
  const [travelToDelete, setTravelToDelete] = useState<Travel | null>(null);
  const [newTravel, setNewTravel] = useState({
    name: '',
    cost: 0,
    inspector: '',
    origin: '',
    destination: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [searchTravelQuery, setSearchTravelQuery] = useState('');
  const [filterInspector, setFilterInspector] = useState('');

  const [consumptionRCRequests, setConsumptionRCRequests] = useState<ConsumptionRCRequest[]>([]);
  const [isAddingRCRequest, setIsAddingRCRequest] = useState(false);
  const [isUpdatingRCStatus, setIsUpdatingRCStatus] = useState<string | null>(null);
  const [tempRCNumber, setTempRCNumber] = useState('');
  const [newRCRequest, setNewRCRequest] = useState({
    projectId: '',
    requestDate: new Date().toISOString().split('T')[0],
    value: 0,
    signedBulletin: null as { name: string; url: string; size?: string } | null,
  });
  const [requestToDelete, setRequestToDelete] = useState<string | null>(null);
  const [newRCObservation, setNewRCObservation] = useState('');
  const [viewingRCRequest, setViewingRCRequest] = useState<ConsumptionRCRequest | null>(null);
  const [selectedScheduleProjectId, setSelectedScheduleProjectId] = useState<string>('');
  const [selectedPlanningProjectId, setSelectedPlanningProjectId] = useState<string>('');
  const [planningViewMonths, setPlanningViewMonths] = useState<number | 'auto'>('auto');
  const [planningViewScale, setPlanningViewScale] = useState<'month' | 'week'>('month');
  const [useRelativePlanningMonths, setUseRelativePlanningMonths] = useState(false);
  const [isAddingActivity, setIsAddingActivity] = useState(false);
  const [isAddingPlanningActivity, setIsAddingPlanningActivity] = useState(false);
  const [editingActivity, setEditingActivity] = useState<ScheduleActivity | null>(null);
  const [editingPlanningActivity, setEditingPlanningActivity] = useState<PlanningActivity | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const planningRef = useRef<HTMLDivElement>(null);
  const [newActivity, setNewActivity] = useState<Omit<ScheduleActivity, 'id' | 'projectId'>>({
    name: '',
    responsible: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    predictedEndDate: '',
    progress: 0,
    status: 'pending',
    category: '',
    order: activities.length,
    isHidden: false
  });
  const [newPlanningActivity, setNewPlanningActivity] = useState<Omit<PlanningActivity, 'id' | 'projectId'>>({
    name: '',
    startMonth: new Date().getMonth(),
    startYear: new Date().getFullYear(),
    endMonth: (new Date().getMonth() + 1) % 12,
    endYear: new Date().getMonth() === 11 ? new Date().getFullYear() + 1 : new Date().getFullYear(),
    startDate: '',
    endDate: '',
    color: '#0033FF',
    order: planningActivities.length,
    category: '',
    description: '',
    isHidden: false
  });
  const [useSpecificPlanningDates, setUseSpecificPlanningDates] = useState(false);

  // States for Fiscal Planning
  const [fiscalPlanningActivities, setFiscalPlanningActivities] = useState<PlanningActivity[]>([]);
  const [isAddingFiscalPlanningActivity, setIsAddingFiscalPlanningActivity] = useState(false);
  const [editingFiscalPlanningActivity, setEditingFiscalPlanningActivity] = useState<PlanningActivity | null>(null);
  const [fiscalPlanningViewMonths, setFiscalPlanningViewMonths] = useState<number | 'auto'>('auto');
  const [fiscalPlanningViewScale, setFiscalPlanningViewScale] = useState<'month' | 'week'>('month');
  const [newFiscalPlanningActivity, setNewFiscalPlanningActivity] = useState<Omit<PlanningActivity, 'id'>>({
    projectId: '',
    name: '',
    startMonth: new Date().getMonth(),
    startYear: new Date().getFullYear(),
    endMonth: (new Date().getMonth() + 1) % 12,
    endYear: new Date().getMonth() === 11 ? new Date().getFullYear() + 1 : new Date().getFullYear(),
    startDate: '',
    endDate: '',
    color: '#0033FF',
    order: 0,
    category: '',
    description: '',
    isHidden: false
  });
  const [useSpecificFiscalDates, setUseSpecificFiscalDates] = useState(false);

  useEffect(() => {
    if (editingFiscalPlanningActivity) {
      setUseSpecificFiscalDates(!!(editingFiscalPlanningActivity.startDate || editingFiscalPlanningActivity.endDate));
      setNewFiscalPlanningActivity({
        projectId: editingFiscalPlanningActivity.projectId || '',
        name: editingFiscalPlanningActivity.name,
        startMonth: editingFiscalPlanningActivity.startMonth,
        startYear: editingFiscalPlanningActivity.startYear,
        endMonth: editingFiscalPlanningActivity.endMonth,
        endYear: editingFiscalPlanningActivity.endYear,
        startDate: editingFiscalPlanningActivity.startDate || '',
        endDate: editingFiscalPlanningActivity.endDate || '',
        color: editingFiscalPlanningActivity.color,
        order: editingFiscalPlanningActivity.order,
        category: editingFiscalPlanningActivity.category || '',
        description: editingFiscalPlanningActivity.description || '',
        isHidden: !!editingFiscalPlanningActivity.isHidden
      });
    }
  }, [editingFiscalPlanningActivity]);

  useEffect(() => {
    if (editingPlanningActivity) {
      setUseSpecificPlanningDates(!!(editingPlanningActivity.startDate || editingPlanningActivity.endDate));
      setNewPlanningActivity({
        id: editingPlanningActivity.id,
        projectId: editingPlanningActivity.projectId,
        name: editingPlanningActivity.name,
        startMonth: editingPlanningActivity.startMonth,
        startYear: editingPlanningActivity.startYear,
        endMonth: editingPlanningActivity.endMonth,
        endYear: editingPlanningActivity.endYear,
        startDate: editingPlanningActivity.startDate || '',
        endDate: editingPlanningActivity.endDate || '',
        color: editingPlanningActivity.color,
        order: editingPlanningActivity.order,
        category: editingPlanningActivity.category || '',
        description: editingPlanningActivity.description || '',
        isHidden: !!editingPlanningActivity.isHidden
      } as any);
    }
  }, [editingPlanningActivity]);

  const [newBulletin, setNewBulletin] = useState({
    projectId: '',
    rcNumber: '',
    sapItem: '',
    installation: '',
    supplier: '',
    value: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [registeredUsers, setRegisteredUsers] = useState<UserProfile[]>([]);
  const [isUpdatingUser, setIsUpdatingUser] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [showAddProject, setShowAddProject] = useState(false);
  const [isGlobalTimelineExpanded, setIsGlobalTimelineExpanded] = useState(false);
  const [viewingProject, setViewingProject] = useState<Project | null>(null);
  useEffect(() => {
    if (viewingProject) {
      const updatedProject = projects.find(p => p.id === viewingProject.id);
      if (updatedProject) {
        setViewingProject(updatedProject);
      }
    }
  }, [projects]);

  const viewingProjectStats = useMemo(() => {
    if (!viewingProject) return { addendumsSum: 0, totalBudget: 0, usage: 0, balance: 0 };
    const projectAddendums = addendums.filter(a => a.projectId === viewingProject.id);
    const addendumsSum = projectAddendums.reduce((sum, a) => sum + (Number(a.value) || 0), 0);
    const baseBudget = Number(viewingProject.budget) || 0;
    const totalBudget = baseBudget + addendumsSum;
    const spent = Number(viewingProject.spent) || 0;
    const usage = totalBudget > 0 ? (spent / totalBudget) * 100 : 0;
    const balance = totalBudget - spent;

    return {
      addendumsSum,
      totalBudget,
      usage,
      balance
    };
  }, [viewingProject, addendums]);

  const projectsWithTotals = useMemo(() => {
    return projects.map(project => {
      const pAddendums = addendums.filter(a => a.projectId === project.id);
      const addendumsSum = pAddendums.reduce((sum, a) => sum + (Number(a.value) || 0), 0);
      const totalBudget = (Number(project.budget) || 0) + addendumsSum;
      const usage = totalBudget > 0 ? ((project.spent || 0) / totalBudget) * 100 : 0;
      const balance = totalBudget - (project.spent || 0);
      return {
        ...project,
        totalBudget,
        addendumsSum,
        usage,
        balance
      };
    });
  }, [projects, addendums]);
  const [currentPalette, setCurrentPalette] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('currentPalette') || 'ocean';
    }
    return 'ocean';
  });

  const palettes = [
    { id: 'forest', name: 'Floresta (Verde)', primary: '#10B981', secondary: '#1E293B', accent: '#34D399' },
    { id: 'original', name: 'Original (Ouro)', primary: '#C5A059', secondary: '#1A1A1A', accent: '#E5C76B' },
    { id: 'ocean', name: 'Oceano (Azul)', primary: '#0033FF', secondary: '#001A80', accent: '#00BFFF' },
    { id: 'royal', name: 'Real (Roxo)', primary: '#8B5CF6', secondary: '#111827', accent: '#A78BFA' },
    { id: 'sunset', name: 'Pôr do Sol (Laranja)', primary: '#F59E0B', secondary: '#451A03', accent: '#FBBF24' },
  ];

  useEffect(() => {
    const palette = palettes.find(p => p.id === currentPalette) || palettes[0];
    const root = document.documentElement;
    root.style.setProperty('--axia-primary', palette.primary);
    root.style.setProperty('--axia-secondary', palette.secondary);
    root.style.setProperty('--axia-accent', palette.accent);
    localStorage.setItem('currentPalette', currentPalette);
  }, [currentPalette]);

  useEffect(() => {
    if (currentUser && currentUser.palette && currentUser.palette !== currentPalette) {
      setCurrentPalette(currentUser.palette);
    }
  }, [currentUser.palette]);

  useEffect(() => {
    if (currentUser && currentUser.isDarkMode !== undefined && currentUser.isDarkMode !== isDarkMode) {
      setIsDarkMode(currentUser.isDarkMode);
    }
  }, [currentUser.isDarkMode]);

  const handleSaveSettings = async () => {
    try {
      const userRef = doc(db, 'users', currentUser.id);
      await updateDoc(userRef, {
        palette: currentPalette,
        isDarkMode: isDarkMode
      });
      setCurrentUser({ ...currentUser, palette: currentPalette, isDarkMode: isDarkMode });
      showNotification('Configurações salvas com sucesso no seu perfil.');
    } catch (error) {
      console.error('Error saving settings:', error);
      showNotification('Erro ao salvar no perfil. Salvando localmente...');
      localStorage.setItem('currentPalette', currentPalette);
      localStorage.setItem('darkMode', isDarkMode.toString());
    }
  };
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editingMeasurement, setEditingMeasurement] = useState<Measurement | null>(null);
  const [projectDetailTab, setProjectDetailTab] = useState<'details' | 'attachments' | 'history' | 'photos' | 'addendums'>('details');
  const [settingsTab, setSettingsTab] = useState<'general' | 'appearance' | 'security' | 'users'>('general');
  const [notification, setNotification] = useState<string | null>(null);
  const [imageEditingProjectId, setImageEditingProjectId] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isUpdatingProgress, setIsUpdatingProgress] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isAddingBulletin, setIsAddingBulletin] = useState(false);
  const [isUploadingReport, setIsUploadingReport] = useState(false);
  const [tempProgress, setTempProgress] = useState(0);
  const [isAddingPhoto, setIsAddingPhoto] = useState(false);
  const [isAddingAddendum, setIsAddingAddendum] = useState(false);
  const [showArchivedBulletins, setShowArchivedBulletins] = useState(false);
  const [isSubmittingPhoto, setIsSubmittingPhoto] = useState(false);
  const [newPhoto, setNewPhoto] = useState({ url: '', caption: '' });
  const [newAddendum, setNewAddendum] = useState({
    number: '',
    description: '',
    rcNumber: '',
    value: '',
    isApproved: false
  });
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);

  const photoFileInputRef = useRef<HTMLInputElement>(null);

  const handleQuickProgressUpdate = async () => {
    if (!viewingProject) return;
    try {
      const projectRef = doc(db, 'projects', viewingProject.id);
      await updateDoc(projectRef, { progress: tempProgress });
      setViewingProject({ ...viewingProject, progress: tempProgress });
      showNotification('Progresso atualizado!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `projects/${viewingProject.id}`);
    } finally {
      setIsUpdatingProgress(false);
    }
  };

  const handleAddPhoto = async () => {
    if (!viewingProject || !newPhoto.url || isSubmittingPhoto) return;
    setIsSubmittingPhoto(true);
    try {
      const photoData: PhotoReportItem = {
        id: Date.now().toString(),
        projectId: viewingProject.id,
        url: newPhoto.url,
        caption: newPhoto.caption,
        date: new Date().toISOString(),
      };
      await setDoc(doc(db, 'photoReports', photoData.id), photoData);
      setNewPhoto({ url: '', caption: '' });
      showNotification('Foto adicionada ao relatório!');
      setIsAddingPhoto(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'photoReports');
    } finally {
      setIsSubmittingPhoto(false);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    try {
      await deleteDoc(doc(db, 'photoReports', photoId));
      showNotification('Foto removida!');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `photoReports/${photoId}`);
    }
  };

  const handleAddAddendum = async () => {
    if (!viewingProject || !newAddendum.number || !newAddendum.description || !newAddendum.value) {
      showNotification('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    try {
      const addendumId = `add-${Date.now()}`;
      
      // Safe parsing for Brazilian number formats (dots as thousands, comma as decimal)
      let cleanValue = newAddendum.value.toString()
        .replace(/\./g, '')
        .replace(',', '.');
      
      const parsedValue = parseFloat(cleanValue);
      
      if (isNaN(parsedValue)) {
        showNotification('O valor do aditivo deve ser um número válido.');
        return;
      }

      const addendum: ProjectAddendum = {
        id: addendumId,
        projectId: viewingProject.id,
        number: newAddendum.number,
        description: newAddendum.description,
        rcNumber: newAddendum.rcNumber,
        value: parsedValue,
        isApproved: newAddendum.isApproved,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'projectAddendums', addendumId), addendum);
      
      setNewAddendum({ number: '', description: '', rcNumber: '', value: '', isApproved: false });
      setIsAddingAddendum(false);
      showNotification('Aditivo registrado e orçamento atualizado!');
    } catch (error) {
      console.error('Error adding addendum:', error);
      handleFirestoreError(error, OperationType.WRITE, 'projectAddendums');
    }
  };

  const handleDeleteAddendum = async (addendum: ProjectAddendum) => {
    try {
      if (!addendum || !addendum.id || !addendum.projectId) return;

      await deleteDoc(doc(db, 'projectAddendums', addendum.id));
      
      showNotification('Aditivo excluído e orçamento recalculado.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `projectAddendums/${addendum.id}`);
    }
  };

  const handleToggleAddendumApproval = async (addendum: ProjectAddendum) => {
    if (!addendum.id) {
      console.error('Addendum ID is missing');
      return;
    }
    try {
      await updateDoc(doc(db, 'projectAddendums', addendum.id), {
        isApproved: !addendum.isApproved
      });
      showNotification(`Aditivo marcado como ${!addendum.isApproved ? 'Realizado' : 'Pendente'}.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `projectAddendums/${addendum.id}`);
    }
  };

  const formatInputDate = (dateStr: string) => {
    if (!dateStr) return '-';
    // split to avoid UTC timezone shifts
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const handleAddActivity = async (activity: Omit<ScheduleActivity, 'id' | 'projectId'>) => {
    if (!selectedScheduleProjectId) {
      showNotification('Selecione um projeto primeiro.');
      return;
    }
    try {
      const activityId = `act-${Date.now()}`;
      const newActivity: ScheduleActivity = {
        ...activity,
        id: activityId,
        projectId: selectedScheduleProjectId,
        isHidden: activity.isHidden ?? false
      };
      await setDoc(doc(db, 'scheduleActivities', activityId), newActivity);
      showNotification('Atividade adicionada com sucesso!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'scheduleActivities');
    }
  };

  const handleUpdateActivity = async (id: string, updates: Partial<ScheduleActivity>) => {
    try {
      await updateDoc(doc(db, 'scheduleActivities', id), updates);
      showNotification('Atividade atualizada.');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `scheduleActivities/${id}`);
    }
  };

  const handleDeleteActivity = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'scheduleActivities', id));
      showNotification('Atividade removida.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `scheduleActivities/${id}`);
    }
  };

  const handleToggleActivityVisibility = async (activity: ScheduleActivity) => {
    try {
      await updateDoc(doc(db, 'scheduleActivities', activity.id), { 
        isHidden: !activity.isHidden 
      });
      showNotification(activity.isHidden ? 'Atividade agora está visível.' : 'Atividade ocultada.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `scheduleActivities/${activity.id}`);
    }
  };

  const handleMoveActivity = async (activity: ScheduleActivity, direction: 'up' | 'down') => {
    const projectActivities = activities
      .filter(a => a.projectId === activity.projectId)
      .sort((a, b) => a.order - b.order);
    
    const currentIndex = projectActivities.findIndex(a => a.id === activity.id);
    if (direction === 'up' && currentIndex > 0) {
      const prevActivity = projectActivities[currentIndex - 1];
      try {
        await updateDoc(doc(db, 'scheduleActivities', activity.id), { order: prevActivity.order });
        await updateDoc(doc(db, 'scheduleActivities', prevActivity.id), { order: activity.order });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `scheduleActivities/${activity.id}`);
      }
    } else if (direction === 'down' && currentIndex < projectActivities.length - 1) {
      const nextActivity = projectActivities[currentIndex + 1];
      try {
        await updateDoc(doc(db, 'scheduleActivities', activity.id), { order: nextActivity.order });
        await updateDoc(doc(db, 'scheduleActivities', nextActivity.id), { order: activity.order });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `scheduleActivities/${activity.id}`);
      }
    }
  };

  const currentProjectPlanningActivities = useMemo(() => {
    return planningActivities
      .filter(a => a.projectId === selectedPlanningProjectId && (showHiddenActivities || !a.isHidden))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [planningActivities, selectedPlanningProjectId, showHiddenActivities]);

  const planningTimelineData = useMemo(() => {
    if (!selectedPlanningProjectId) return null;
    
    const relevantActivities = planningActivities.filter(a => a.projectId === selectedPlanningProjectId);
    const today = new Date();
    const todayAbs = today.getFullYear() * 12 + today.getMonth();

    // Start anchor should be consistent: the first activity's start.
    // If no activities are present, default to today.
    let baseMinAbs = todayAbs;
    if (relevantActivities.length > 0) {
      baseMinAbs = Math.min(...relevantActivities.map(a => a.startYear * 12 + a.startMonth));
    }
    
    const startAbs = baseMinAbs;
    let endAbs: number;

    if (planningViewMonths === 'auto') {
      let baseMaxAbs = todayAbs;
      if (relevantActivities.length > 0) {
        baseMaxAbs = Math.max(todayAbs, ...relevantActivities.map(a => a.endYear * 12 + a.endMonth));
      }
      endAbs = baseMaxAbs + 1; // 1 month padding at the end
    } else {
      endAbs = startAbs + (planningViewMonths as number) - 1;
    }

    const numMonths = endAbs - startAbs + 1;
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const exactTodayAbs = todayAbs + (today.getDate() - 1) / daysInMonth;
    
    // Filter visible months
    const allMonths: { absMonth: number; year: number; month: number }[] = [];
    for (let i = 0; i < numMonths; i++) {
      const absMonth = startAbs + i;
      allMonths.push({
        absMonth,
        year: Math.floor(absMonth / 12),
        month: absMonth % 12
      });
    }

    const visibleMonths = allMonths.filter(m => !hiddenMonths.includes(`${m.year}-${m.month}`));
    
    // Group visible months by year
    const years: { year: number; monthsCount: number }[] = [];
    visibleMonths.forEach(m => {
      const lastYear = years[years.length - 1];
      if (lastYear && lastYear.year === m.year) {
        lastYear.monthsCount++;
      } else {
        years.push({ year: m.year, monthsCount: 1 });
      }
    });
    
    return {
      startAbs,
      endAbs,
      numMonths: visibleMonths.length,
      todayAbs,
      exactTodayAbs,
      years,
      visibleMonths,
      allMonths
    };
  }, [selectedPlanningProjectId, planningActivities, planningViewMonths, hiddenMonths]);

  const fiscalPlanningTimelineData = useMemo(() => {
    const today = new Date();
    const todayAbs = today.getFullYear() * 12 + today.getMonth();

    // Start anchor should be the first activity's start.
    // If no activities exist, default to today.
    let baseMinAbs = todayAbs;
    if (fiscalPlanningActivities.length > 0) {
      baseMinAbs = Math.min(...fiscalPlanningActivities.map(a => a.startYear * 12 + a.startMonth));
    }
    
    const startAbs = baseMinAbs;
    let endAbs: number;

    if (fiscalPlanningViewMonths === 'auto') {
      let baseMaxAbs = todayAbs;
      if (fiscalPlanningActivities.length > 0) {
        baseMaxAbs = Math.max(todayAbs, ...fiscalPlanningActivities.map(a => a.endYear * 12 + a.endMonth));
      }
      endAbs = baseMaxAbs + 1; // 1 month padding at the end
    } else {
      endAbs = startAbs + (fiscalPlanningViewMonths as number) - 1;
    }

    const numMonths = endAbs - startAbs + 1;
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const exactTodayAbs = todayAbs + (today.getDate() - 1) / daysInMonth;
    
    // Filter visible months using the shared hiddenMonths state
    const allMonths: { absMonth: number; year: number; month: number }[] = [];
    for (let i = 0; i < numMonths; i++) {
      const absMonth = startAbs + i;
      allMonths.push({
        absMonth,
        year: Math.floor(absMonth / 12),
        month: absMonth % 12
      });
    }

    const visibleMonths = allMonths.filter(m => !hiddenMonths.includes(`${m.year}-${m.month}`));
    
    // Group visible months by year
    const years: { year: number; monthsCount: number }[] = [];
    visibleMonths.forEach(m => {
      const lastYear = years[years.length - 1];
      if (lastYear && lastYear.year === m.year) {
        lastYear.monthsCount++;
      } else {
        years.push({ year: m.year, monthsCount: 1 });
      }
    });
    
    return {
      startAbs,
      endAbs,
      numMonths: visibleMonths.length,
      todayAbs,
      exactTodayAbs,
      years,
      visibleMonths,
      allMonths
    };
  }, [fiscalPlanningActivities, fiscalPlanningViewMonths, hiddenMonths]);

  const scheduleTimelineData = useMemo(() => {
    if (!selectedScheduleProjectId) return null;
    
    // Filter activities based on visibility settings
    const relevantActivities = activities.filter(a => 
      a.projectId === selectedScheduleProjectId && 
      (showHiddenActivities || !a.isHidden)
    );
    const today = new Date();
    const todayAbs = today.getFullYear() * 12 + today.getMonth();

    let baseMinAbs = todayAbs;
    if (relevantActivities.length > 0) {
      const startDates = relevantActivities.map(a => {
        const d = new Date(a.startDate);
        return d.getFullYear() * 12 + d.getMonth();
      });
      baseMinAbs = Math.min(...startDates);
    }
    
    const startAbs = baseMinAbs;
    let baseMaxAbs = todayAbs;
    if (relevantActivities.length > 0) {
      const endDates = relevantActivities.map(a => {
        const d = new Date(a.endDate);
        return d.getFullYear() * 12 + d.getMonth();
      });
      baseMaxAbs = Math.max(todayAbs, ...endDates);
    }
    const endAbs = baseMaxAbs + 1;

    const numMonths = endAbs - startAbs + 1;
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const exactTodayAbs = todayAbs + (today.getDate() - 1) / daysInMonth;
    
    const years: { year: number; monthsCount: number }[] = [];
    for (let i = 0; i < numMonths; i++) {
      const absMonth = startAbs + i;
      const year = Math.floor(absMonth / 12);
      const lastYear = years[years.length - 1];
      if (lastYear && lastYear.year === year) {
        lastYear.monthsCount++;
      } else {
        years.push({ year, monthsCount: 1 });
      }
    }
    
    return {
      startAbs,
      endAbs,
      numMonths,
      todayAbs,
      exactTodayAbs,
      years
    };
  }, [selectedScheduleProjectId, activities]);

  const MONTH_WIDTH = 100;
  const PLANNING_COLUMN_WIDTH = planningViewScale === 'month' ? 100 : 40;
  const PLANNING_MONTH_COLUMNS = planningViewScale === 'month' ? 1 : 4;
  const PLANNING_MONTH_WIDTH = PLANNING_COLUMN_WIDTH * PLANNING_MONTH_COLUMNS;

  const handleReorderPlanningActivities = async (newOrder: PlanningActivity[]) => {
    // We only update the order field in Firestore. 
    // The local state will be updated via onSnapshot
    try {
      const updatePromises = newOrder.map((activity, index) => {
        if (activity.order === index) return Promise.resolve();
        return updateDoc(doc(db, 'planningActivities', activity.id), {
          order: index
        });
      });
      await Promise.all(updatePromises);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'planningActivities');
    }
  };

  const handleSavePlanningActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanningProjectId) return;

    const dataToSave = {
      ...newPlanningActivity,
      isHidden: newPlanningActivity.isHidden ?? false
    };

    try {
      if (editingPlanningActivity) {
        await updateDoc(doc(db, 'planningActivities', editingPlanningActivity.id), dataToSave);
        showNotification('Atividade do planejamento atualizada!');
      } else {
        const id = `plan-${Date.now()}`;
        await setDoc(doc(db, 'planningActivities', id), {
          ...dataToSave,
          id,
          projectId: selectedPlanningProjectId,
          order: planningActivities.filter(a => a.projectId === selectedPlanningProjectId).length
        });
        showNotification('Atividade adicionada ao planejamento!');
      }
      setIsAddingPlanningActivity(false);
      setEditingPlanningActivity(null);
      setUseSpecificPlanningDates(false);
      setNewPlanningActivity({
        id: '',
        projectId: selectedPlanningProjectId,
        name: '',
        startMonth: new Date().getMonth(),
        startYear: new Date().getFullYear(),
        endMonth: (new Date().getMonth() + 1) % 12,
        endYear: new Date().getMonth() === 11 ? new Date().getFullYear() + 1 : new Date().getFullYear(),
        startDate: '',
        endDate: '',
        color: '#0033FF',
        order: planningActivities.filter(a => a.projectId === selectedPlanningProjectId).length,
        category: '',
        description: '',
        isHidden: false
      } as any);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'planningActivities');
    }
  };

  const handleDeletePlanningActivity = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'planningActivities', id));
      showNotification('Atividade removida do planejamento.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `planningActivities/${id}`);
    }
  };

  const handleAddTravel = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const monthYear = newTravel.startDate.substring(0, 7); // e.g. "2026-05"
      const travelRef = doc(collection(db, 'travels'));
      const travelData = {
        id: travelRef.id,
        name: newTravel.name,
        cost: Number(newTravel.cost) || 0,
        inspector: newTravel.inspector,
        origin: newTravel.origin,
        destination: newTravel.destination,
        startDate: newTravel.startDate,
        endDate: newTravel.endDate,
        monthYear,
      };

      await setDoc(travelRef, travelData);
      showNotification('Viagem salva com sucesso!');
      setIsAddingTravel(false);
      setNewTravel({
        name: '',
        cost: 0,
        inspector: '',
        origin: '',
        destination: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
      });
    } catch (error) {
      console.error('Error adding travel:', error);
      handleFirestoreError(error, OperationType.WRITE, 'travels');
    }
  };

  const handleEditTravel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTravel) return;
    try {
      const monthYear = newTravel.startDate.substring(0, 7);
      const travelRef = doc(db, 'travels', editingTravel.id);
      await updateDoc(travelRef, {
        id: editingTravel.id,
        name: newTravel.name,
        cost: Number(newTravel.cost) || 0,
        inspector: newTravel.inspector,
        origin: newTravel.origin,
        destination: newTravel.destination,
        startDate: newTravel.startDate,
        endDate: newTravel.endDate,
        monthYear,
      });
      showNotification('Viagem atualizada com sucesso!');
      setEditingTravel(null);
      setIsAddingTravel(false);
      setNewTravel({
        name: '',
        cost: 0,
        inspector: '',
        origin: '',
        destination: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
      });
    } catch (error) {
      console.error('Error updating travel:', error);
      handleFirestoreError(error, OperationType.WRITE, `travels/${editingTravel.id}`);
    }
  };

  const exportTravelsToPDF = () => {
    try {
      showNotification('Iniciando geração do PDF de viagens...');
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Apply watermark first
      addWatermark(doc);

      // Header representing company brand
      doc.setFillColor(248, 250, 252);
      doc.rect(0, 0, pageWidth, 35, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.line(0, 35, pageWidth, 35);
      
      // Logo "Axia Energia"
      drawPDFLogo(doc, 20, 15);
      
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('CONTROLE DE VIAGENS', pageWidth - 15, 15, { align: 'right' });
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth - 15, 22, { align: 'right' });
      
      let filterDetails = '';
      if (searchTravelQuery) filterDetails += `Busca: "${searchTravelQuery}"`;
      if (filterInspector) filterDetails += (filterDetails ? ' | ' : '') + `Fiscal: ${filterInspector}`;
      if (filterDetails) {
        doc.text(`Filtros ativos: ${filterDetails}`, pageWidth - 15, 27, { align: 'right' });
      }

      // Filter travels following same logic as UI
      const filteredTravels = travels.filter(t => {
        const matchesSearch = 
          (t.name?.toLowerCase().includes(searchTravelQuery.toLowerCase()) || false) ||
          (t.origin?.toLowerCase().includes(searchTravelQuery.toLowerCase()) || false) ||
          (t.destination?.toLowerCase().includes(searchTravelQuery.toLowerCase()) || false);
        
        const matchesInspector = !filterInspector || t.inspector === filterInspector;
        
        return matchesSearch && matchesInspector;
      });

      if (filteredTravels.length === 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text('Nenhuma viagem registrada ou correspondente aos filtros.', 20, 55);
        doc.save(`controle_viagens_${new Date().toISOString().split('T')[0]}.pdf`);
        showNotification('PDF gerado com aviso de lista vazia.');
        return;
      }

      const totalCost = filteredTravels.reduce((acc, curr) => acc + (Number(curr.cost) || 0), 0);
      const travelCount = filteredTravels.length;
      const averageCost = travelCount > 0 ? totalCost / travelCount : 0;

      const formatBRL = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
      };

      // Summary indicators inside PDF (elegant card)
      doc.setFillColor(241, 245, 249); // slate-100 fallback
      doc.rect(15, 42, pageWidth - 30, 22, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.rect(15, 42, pageWidth - 30, 22, 'S');

      // Visual dividers for columns in the summary card
      doc.line(75, 45, 75, 61);
      doc.line(135, 45, 135, 61);

      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.text('TOTAL DE VIAGENS', 25, 49);
      doc.text('CUSTO ACUMULADO', 85, 49);
      doc.text('MÉDIA POR VIAGEM', 145, 49);

      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text(String(travelCount), 25, 57);
      doc.text(formatBRL(totalCost), 85, 57);
      doc.text(formatBRL(averageCost), 145, 57);

      // Group by Month Year
      const grouped: { [key: string]: Travel[] } = {};
      filteredTravels.forEach(t => {
        const key = t.monthYear || 'Sem data';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(t);
      });

      const sortedMonthKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
      
      const formatMonthYearStr = (myStr: string) => {
        if (myStr === 'Sem data') return 'Sem data';
        const [year, month] = myStr.split('-');
        const monthNames = [
          'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
          'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        const monthIndex = parseInt(month, 10) - 1;
        if (monthIndex >= 0 && monthIndex < 12) {
          return `${monthNames[monthIndex]} de ${year}`;
        }
        return myStr;
      };

      const formatDateBR = (dateStr: string) => {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return dateStr;
      };

      let currentY = 72;

      sortedMonthKeys.forEach((monthYearKey) => {
        const monthTravels = grouped[monthYearKey].sort((a,b) => a.startDate.localeCompare(b.startDate));
        const monthTotalCost = monthTravels.reduce((acc, curr) => acc + (Number(curr.cost) || 0), 0);

        // Check if we need a new page for this month header + table. If Y is very low on page, add page
        if (currentY > pageHeight - 50) {
          doc.addPage();
          addWatermark(doc);
          currentY = 20;
        }

        // Section Title
        doc.setFillColor(248, 250, 252);
        doc.rect(15, currentY, pageWidth - 30, 8, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.line(15, currentY, pageWidth - 15, currentY);
        doc.line(15, currentY + 8, pageWidth - 15, currentY + 8);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(`${formatMonthYearStr(monthYearKey).toUpperCase()}`, 18, currentY + 6);
        
        doc.setFontSize(9);
        doc.setTextColor(16, 185, 129); // emerald-500 equivalent color green
        doc.text(`Total do Mês: ${formatBRL(monthTotalCost)}`, pageWidth - 18, currentY + 5.5, { align: 'right' });

        currentY += 12;

        const tableBody = monthTravels.map(travel => [
          travel.name || '',
          `${travel.origin || ''} -> ${travel.destination || ''}`,
          travel.inspector || '',
          `${formatDateBR(travel.startDate)} - ${formatDateBR(travel.endDate)}`,
          formatBRL(travel.cost)
        ]);

        autoTable(doc, {
          startY: currentY,
          head: [['NOME DA VIAGEM', 'ROTEIRO', 'FISCAL', 'PERÍODO', 'CUSTO']],
          body: tableBody,
          theme: 'striped',
          styles: { 
            fontSize: 8.5, 
            cellPadding: 4, 
            font: 'helvetica', 
            valign: 'middle',
            overflow: 'linebreak'
          },
          headStyles: { 
            fillColor: [15, 23, 42], // Elegante Slate-900 corporativo para cabeçalho
            textColor: [255, 255, 255], 
            fontStyle: 'bold',
            fontSize: 9,
            cellPadding: 4
          },
          alternateRowStyles: {
            fillColor: [250, 251, 253] // Fundo alternado sutil para leitura profissional
          },
          columnStyles: {
            0: { cellWidth: 40 },
            1: { cellWidth: 45 },
            2: { cellWidth: 35 },
            3: { cellWidth: 32 },
            4: { cellWidth: 28, halign: 'right' }
          },
          margin: { left: 15, right: 15 },
          didDrawPage: (data) => {
            // Apply watermark on dynamically generated pages
            if (data.pageNumber > 1) {
              addWatermark(doc);
            }
          }
        });

        currentY = (doc as any).lastAutoTable.finalY + 12;
      });

      doc.save(`Controle_Viagens_${new Date().toISOString().split('T')[0]}.pdf`);
      showNotification('PDF de Controle de Viagens gerado com sucesso!');
    } catch (e) {
      console.error('Error creating Travels PDF:', e);
      showNotification('Erro ao gerar PDF. Verifique os dados.');
    }
  };

  const confirmDeleteTravel = async () => {
    if (!travelToDelete) return;
    try {
      await deleteDoc(doc(db, 'travels', travelToDelete.id));
      showNotification('Viagem excluída com sucesso!');
      setTravelToDelete(null);
    } catch (error) {
      console.error('Error deleting travel:', error);
      handleFirestoreError(error, OperationType.DELETE, `travels/${travelToDelete.id}`);
    }
  };

  const handleTogglePlanningActivityVisibility = async (activity: PlanningActivity) => {
    try {
      await updateDoc(doc(db, 'planningActivities', activity.id), { 
        isHidden: !activity.isHidden 
      });
      showNotification(activity.isHidden ? 'Atividade agora está visível.' : 'Atividade ocultada.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `planningActivities/${activity.id}`);
    }
  };

  const handleMovePlanningActivity = async (activity: PlanningActivity, direction: 'up' | 'down') => {
    const projectActivities = planningActivities
      .filter(a => a.projectId === activity.projectId)
      .sort((a, b) => a.order - b.order);
    
    const currentIndex = projectActivities.findIndex(a => a.id === activity.id);
    if (direction === 'up' && currentIndex > 0) {
      const prevActivity = projectActivities[currentIndex - 1];
      try {
        await updateDoc(doc(db, 'planningActivities', activity.id), { order: prevActivity.order });
        await updateDoc(doc(db, 'planningActivities', prevActivity.id), { order: activity.order });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `planningActivities/${activity.id}`);
      }
    } else if (direction === 'down' && currentIndex < projectActivities.length - 1) {
      const nextActivity = projectActivities[currentIndex + 1];
      try {
        await updateDoc(doc(db, 'planningActivities', activity.id), { order: nextActivity.order });
        await updateDoc(doc(db, 'planningActivities', nextActivity.id), { order: activity.order });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `planningActivities/${activity.id}`);
      }
    }
  };

  const handleReorderFiscalPlanningActivities = async (newOrder: PlanningActivity[]) => {
    try {
      const updatePromises = newOrder.map((activity, index) => {
        if (activity.order === index) return Promise.resolve();
        return updateDoc(doc(db, 'fiscalPlanningActivities', activity.id), {
          order: index
        });
      });
      await Promise.all(updatePromises);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'fiscalPlanningActivities');
    }
  };

  const handleSaveFiscalPlanningActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSave = {
      ...newFiscalPlanningActivity,
      isHidden: newFiscalPlanningActivity.isHidden ?? false
    };

    try {
      if (editingFiscalPlanningActivity) {
        await updateDoc(doc(db, 'fiscalPlanningActivities', editingFiscalPlanningActivity.id), dataToSave);
        showNotification('Atividade do planejamento anual atualizada!');
      } else {
        const id = `fiscal-${Date.now()}`;
        await setDoc(doc(db, 'fiscalPlanningActivities', id), {
          ...dataToSave,
          id,
          order: fiscalPlanningActivities.length
        });
        showNotification('Atividade adicionada ao planejamento anual!');
      }
      setIsAddingFiscalPlanningActivity(false);
      setEditingFiscalPlanningActivity(null);
      setUseSpecificFiscalDates(false);
      setNewFiscalPlanningActivity({
        projectId: '',
        name: '',
        startMonth: new Date().getMonth(),
        startYear: new Date().getFullYear(),
        endMonth: (new Date().getMonth() + 1) % 12,
        endYear: new Date().getMonth() === 11 ? new Date().getFullYear() + 1 : new Date().getFullYear(),
        startDate: '',
        endDate: '',
        color: '#0033FF',
        order: fiscalPlanningActivities.length,
        category: '',
        description: '',
        isHidden: false
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'fiscalPlanningActivities');
    }
  };

  const handleDeleteFiscalPlanningActivity = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'fiscalPlanningActivities', id));
      showNotification('Atividade removida do planejamento anual.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `fiscalPlanningActivities/${id}`);
    }
  };

  const handleToggleFiscalPlanningActivityVisibility = async (activity: PlanningActivity) => {
    try {
      await updateDoc(doc(db, 'fiscalPlanningActivities', activity.id), { 
        isHidden: !activity.isHidden 
      });
      showNotification(activity.isHidden ? 'Atividade agora está visível.' : 'Atividade ocultada.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `fiscalPlanningActivities/${activity.id}`);
    }
  };

  const handleMoveFiscalPlanningActivity = async (activity: PlanningActivity, direction: 'up' | 'down') => {
    const sortedActivities = [...fiscalPlanningActivities].sort((a, b) => a.order - b.order);
    const currentIndex = sortedActivities.findIndex(a => a.id === activity.id);
    
    if (direction === 'up' && currentIndex > 0) {
      const prevActivity = sortedActivities[currentIndex - 1];
      try {
        await updateDoc(doc(db, 'fiscalPlanningActivities', activity.id), { order: prevActivity.order });
        await updateDoc(doc(db, 'fiscalPlanningActivities', prevActivity.id), { order: activity.order });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `fiscalPlanningActivities/${activity.id}`);
      }
    } else if (direction === 'down' && currentIndex < sortedActivities.length - 1) {
      const nextActivity = sortedActivities[currentIndex + 1];
      try {
        await updateDoc(doc(db, 'fiscalPlanningActivities', activity.id), { order: nextActivity.order });
        await updateDoc(doc(db, 'fiscalPlanningActivities', nextActivity.id), { order: activity.order });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `fiscalPlanningActivities/${activity.id}`);
      }
    }
  };

  const oklchToRgb = (l: number, c: number, h: number, alpha: number = 1): string => {
    const theta = (h * Math.PI) / 180;
    const a = c * Math.cos(theta);
    const b = c * Math.sin(theta);
    return oklabToRgb(l, a, b, alpha);
  };

  const oklabToRgb = (L: number, a: number, b: number, alpha: number = 1): string => {
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.291485548 * b;

    const l = Math.max(0, l_ * l_ * l_);
    const m = Math.max(0, m_ * m_ * m_);
    const s = Math.max(0, s_ * s_ * s_);

    const r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const bComp = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

    const f = (val: number) => {
      if (val <= 0.0031308) return 12.92 * val;
      return 1.055 * Math.pow(val, 1 / 2.4) - 0.055;
    };

    const R = Math.round(Math.max(0, Math.min(1, f(r))) * 255);
    const G = Math.round(Math.max(0, Math.min(1, f(g))) * 255);
    const B = Math.round(Math.max(0, Math.min(1, f(bComp))) * 255);

    return alpha === 1 || alpha === undefined ? `rgb(${R}, ${G}, ${B})` : `rgba(${R}, ${G}, ${B}, ${alpha})`;
  };

  const parseAndConvertColor = (colorStr: string): string => {
    if (typeof colorStr !== 'string') return colorStr;
    
    let result = colorStr;
    
    // Match oklch(...)
    const oklchRegex = /oklch\(([^)]+)\)/gi;
    result = result.replace(oklchRegex, (match, p1) => {
      try {
        const parts = p1.trim().split(/[\s,+/]+/);
        if (parts.length >= 3) {
          let l = parseFloat(parts[0]);
          if (parts[0].includes('%')) l = parseFloat(parts[0]) / 100;
          let c = parseFloat(parts[1]);
          if (parts[1].includes('%')) c = parseFloat(parts[1]) / 100;
          let h = parseFloat(parts[2]);
          let alpha = 1;
          if (parts.length >= 4) {
            const aPart = parts[3];
            if (aPart.includes('%')) {
              alpha = parseFloat(aPart) / 100;
            } else {
              alpha = parseFloat(aPart);
            }
          }
          return oklchToRgb(l, c, h, alpha);
        }
      } catch (e) {
        console.warn('Error parsing oklch', match, e);
      }
      return 'rgb(71, 85, 105)';
    });

    // Match oklab(...)
    const oklabRegex = /oklab\(([^)]+)\)/gi;
    result = result.replace(oklabRegex, (match, p1) => {
      try {
        const parts = p1.trim().split(/[\s,+/]+/);
        if (parts.length >= 3) {
          let l = parseFloat(parts[0]);
          if (parts[0].includes('%')) l = parseFloat(parts[0]) / 100;
          let a = parseFloat(parts[1]);
          let b = parseFloat(parts[2]);
          let alpha = 1;
          if (parts.length >= 4) {
            const aPart = parts[3];
            if (aPart.includes('%')) {
              alpha = parseFloat(aPart) / 100;
            } else {
              alpha = parseFloat(aPart);
            }
          }
          return oklabToRgb(l, a, b, alpha);
        }
      } catch (e) {
        console.warn('Error parsing oklab', match, e);
      }
      return 'rgb(30, 41, 59)';
    });

    return result;
  };

  const patchGetComputedStyle = (win: any) => {
    if (!win || win.__isStylePatched) return () => {};
    const originalGetComputedStyle = win.getComputedStyle;
    
    win.getComputedStyle = function(el: any, pseudoElt?: any) {
      const style = originalGetComputedStyle.call(win, el, pseudoElt);
      if (!style) return style;
      
      return new Proxy(style, {
        get(target, prop) {
          if (prop === 'getPropertyValue') {
            return function(propertyName: string) {
              const val = target.getPropertyValue(propertyName);
              if (typeof val === 'string' && (val.includes('oklch') || val.includes('oklab'))) {
                return parseAndConvertColor(val);
              }
              return val;
            };
          }
          const val = Reflect.get(target, prop);
          if (typeof val === 'function') {
            return val.bind(target);
          }
          if (typeof val === 'string' && (val.includes('oklch') || val.includes('oklab'))) {
            return parseAndConvertColor(val);
          }
          return val;
        }
      });
    };
    
    win.__isStylePatched = true;
    
    return () => {
      win.getComputedStyle = originalGetComputedStyle;
      delete win.__isStylePatched;
    };
  };

  const getCleanedStyles = () => {
    let combinedStyles = '';
    
    // Grab text content from all <style> tags
    document.querySelectorAll('style').forEach((styleTag) => {
      combinedStyles += (styleTag.textContent || '') + '\n';
    });
    
    // Grab rules from linked stylesheets
    for (let i = 0; i < document.styleSheets.length; i++) {
      const sheet = document.styleSheets[i];
      try {
        const rules = sheet.cssRules || sheet.rules;
        if (rules) {
          for (let j = 0; j < rules.length; j++) {
            combinedStyles += rules[j].cssText + '\n';
          }
        }
      } catch (e) {
        // Cross-origin rules might fail access, but relative stylesheets won't
      }
    }

    // Replace all oklch / oklab values with safe neutral colors to prevent parser crashing
    return combinedStyles
      .replace(/oklch\([^)]+\)/gi, '#475569')
      .replace(/oklab\([^)]+\)/gi, '#1e293b');
  };

  const exportPlanningToPDF = async (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const relevantActivities = currentProjectPlanningActivities;
    const doc = new jsPDF('p', 'mm', 'a4');
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    // Header
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.line(0, 40, 210, 40);
    
    // Logo
    drawPDFLogo(doc, 15, 18);
    addWatermark(doc);
    
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('PLANEJAMENTO DE OBRA', 195, 20, { align: 'right' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(project.name.toUpperCase(), 195, 28, { align: 'right' });

    // Project Info
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.text(`Cliente: ${project.client}`, 15, 52);
    doc.text(`Responsável: ${project.responsible || project.creatorName || ''}`, 15, 57);
    doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 15, 62);

    // Table
    const tableData = relevantActivities
      .map(a => [
        (a.name || '').toUpperCase() + (a.category ? ` (${a.category.toUpperCase()})` : ''),
        `${monthNames[a.startMonth]}/${a.startYear} - ${monthNames[a.endMonth]}/${a.endYear}`
      ]);

    autoTable(doc, {
      startY: 75,
      head: [['ATIVIDADE', 'PERÍODO PREVISTO']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [0, 51, 255], textColor: [255, 255, 255] },
      styles: { fontSize: 10 }
    });

    // Add Planning Visual if Ref exists
    if (planningRef.current) {
      const clearPatchWin = patchGetComputedStyle(window);
      let clearPatchClone = () => {};
      try {
        const numMonths = planningTimelineData?.numMonths || 12;
        const exportWidth = 450 + (numMonths * PLANNING_MONTH_WIDTH) + 120;

        const cleanedCSS = getCleanedStyles();

        const canvas = await html2canvas(planningRef.current, {
          scale: 3,
          useCORS: true,
          logging: false,
          width: exportWidth,
          backgroundColor: '#FFFFFF',
          onclone: (clonedDoc) => {
            const cloneWin = clonedDoc.defaultView;
            if (cloneWin) {
              clearPatchClone = patchGetComputedStyle(cloneWin);
            }
            // Remove all existing style and link tags to prevent html2canvas's own parser from reading the raw/broken style sheets
            clonedDoc.querySelectorAll('style, link[rel="stylesheet"]').forEach((el) => {
              el.remove();
            });

            // Create a single clean <style> tag with our sanitized CSS!
            const styleEl = clonedDoc.createElement('style');
            styleEl.textContent = cleanedCSS;
            clonedDoc.head.appendChild(styleEl);

            const chartDiv = clonedDoc.getElementById('planning-chart');
            if (chartDiv) {
              // Add a beautiful logo header to the cloned document for the export
              const header = clonedDoc.createElement('div');
              header.style.backgroundColor = '#f8fafc';
              header.style.width = '100%';
              header.style.height = '140px';
              header.style.display = 'flex';
              header.style.justifyContent = 'space-between';
              header.style.alignItems = 'center';
              header.style.padding = '0 60px';
              header.style.borderBottom = '4px solid #0033ff';
              header.style.marginBottom = '40px';
              
              const logoContainer = clonedDoc.createElement('div');
              logoContainer.style.display = 'flex';
              logoContainer.style.flexDirection = 'column';
              
              const logoTitle = clonedDoc.createElement('h1');
              logoTitle.innerText = 'AXIA';
              logoTitle.style.color = '#0033ff';
              logoTitle.style.fontSize = '48px';
              logoTitle.style.fontWeight = '900';
              logoTitle.style.margin = '0';
              logoTitle.style.letterSpacing = '-2px';
              
              const logoSub = clonedDoc.createElement('p');
              logoSub.innerText = 'ENERGIA';
              logoSub.style.color = '#64748b';
              logoSub.style.fontSize = '12px';
              logoSub.style.fontWeight = 'bold';
              logoSub.style.margin = '-5px 0 0 0';
              logoSub.style.letterSpacing = '5px';
              
              logoContainer.appendChild(logoTitle);
              logoContainer.appendChild(logoSub);
              
              const infoContainer = clonedDoc.createElement('div');
              infoContainer.style.textAlign = 'right';
              
              const docTitle = clonedDoc.createElement('h2');
              docTitle.innerText = 'PLANEJAMENTO MENSAL';
              docTitle.style.color = '#0f172a';
              docTitle.style.fontSize = '32px';
              docTitle.style.fontWeight = 'bold';
              docTitle.style.margin = '0';
              
              const projectTitle = clonedDoc.createElement('p');
              projectTitle.innerText = `PROJETO: ${project.name.toUpperCase()}`;
              projectTitle.style.color = '#64748b';
              projectTitle.style.fontSize = '16px';
              projectTitle.style.margin = '5px 0 0 0';
              
              infoContainer.appendChild(docTitle);
              infoContainer.appendChild(projectTitle);
              
              header.appendChild(logoContainer);
              header.appendChild(infoContainer);
              chartDiv.prepend(header);

              chartDiv.style.width = `${exportWidth}px`; 
              chartDiv.style.padding = '80px 60px';
              chartDiv.style.backgroundColor = '#ffffff';
              chartDiv.style.borderRadius = '0';
              chartDiv.style.border = 'none';
              chartDiv.style.overflow = 'visible';

              const hideElements = chartDiv.querySelectorAll('.export-hide');
              hideElements.forEach(el => (el as HTMLElement).style.display = 'none');
            }

            const elements = chartDiv ? chartDiv.querySelectorAll('*') : [];
            const isModernColor = (val: any) => val && typeof val === 'string' && (val.includes('oklch') || val.includes('oklab'));
            const targetColorProps = ['color', 'background-color', 'border-color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color', 'outline-color', 'box-shadow'];
            
            elements.forEach((node) => {
              const el = node as HTMLElement;
              const style = window.getComputedStyle(el);

              // Scale fonts for high-res export
              if (el.tagName === 'SPAN' || el.tagName === 'DIV' || el.tagName === 'P') {
                const fontSize = parseFloat(style.fontSize);
                if (fontSize < 12) el.style.fontSize = '14px';
              }
              
              // Handle bars specifically
              if (el.classList.contains('h-14')) {
                el.style.height = '80px'; 
                el.style.display = 'flex';
                el.style.alignItems = 'center';
              }
              if (el.classList.contains('h-8')) {
                el.style.height = '50px'; 
                el.style.top = '15px';
                el.style.overflow = 'visible';
                el.style.display = 'flex';
                el.style.alignItems = 'center';
                el.style.justifyContent = 'flex-start';
                
                const textSpan = el.querySelector('span');
                if (textSpan) {
                  textSpan.style.fontSize = '14px';
                  textSpan.style.fontWeight = '900';
                  textSpan.style.overflow = 'hidden';
                  textSpan.style.textOverflow = 'ellipsis';
                  textSpan.style.whiteSpace = 'nowrap';
                  textSpan.style.width = '100%';
                  textSpan.style.maxWidth = '100%';
                  textSpan.style.display = 'block';
                  textSpan.style.lineHeight = '50px';
                  textSpan.style.padding = '0 15px';
                }
              }

              if (el.classList.contains('w-[280px]')) {
                el.style.width = '450px';
              }

              // Thoroughly strip modern colors
              targetColorProps.forEach((prop) => {
                const value = style.getPropertyValue(prop);
                if (isModernColor(value)) {
                  if (prop === 'color') {
                    el.style.color = el.classList.contains('text-white') ? '#ffffff' : '#1e293b';
                  } else if (prop === 'background-color') {
                    el.style.backgroundColor = el.classList.contains('bg-white') ? '#ffffff' : 'transparent';
                  } else if (prop === 'box-shadow') {
                    el.style.boxShadow = 'none';
                  } else {
                    el.style.setProperty(prop, 'transparent', 'important');
                  }
                }
              });

              if (el.classList.contains('bg-hatched-red')) {
                el.style.backgroundImage = 'repeating-linear-gradient(45deg, #ef4444, #ef4444 10px, #dc2626 10px, #dc2626 20px)';
                el.style.backgroundColor = '#ef4444';
              }
            });
          }
        });

        const imgData = canvas.toDataURL('image/png', 1.0);
        doc.addPage('a4', 'l');
        addWatermark(doc);
        
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const imgProps = doc.getImageProperties(imgData);
        const imgRatio = imgProps.width / imgProps.height;
        
        const maxWidth = pageWidth;
        const maxHeight = pageHeight - 10; 
        
        let finalWidth = maxWidth;
        let finalHeight = maxWidth / imgRatio;
        
        if (finalHeight > maxHeight) {
          finalHeight = maxHeight;
          finalWidth = maxHeight * imgRatio;
        }
        
        const xPos = (pageWidth - finalWidth) / 2;
        const yPos = 8 + (maxHeight - finalHeight) / 2;

        doc.setTextColor(0, 51, 255);
        doc.setFontSize(10);
        doc.text(`CRONOGRAMA MENSAL (VISUAL): ${(project.name || '').toUpperCase()}`, pageWidth / 2, 6, { align: 'center' });
        
        doc.addImage(imgData, 'PNG', xPos, yPos, finalWidth, finalHeight, undefined, 'FAST');
      } catch (err) {
        console.error('Error capturing planning chart:', err);
      } finally {
        clearPatchWin();
        clearPatchClone();
      }
    }

    doc.save(`planejamento_${project.name.toLowerCase().replace(/\s+/g, '_')}.pdf`);
    
    // Add watermark and footer to all pages
    const pageCountTotal = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCountTotal; i++) {
      doc.setPage(i);
      addWatermark(doc);
    }
    
    showNotification('Planejamento exportado com sucesso!');
  };

  const exportPlanningToPNG = async (projectId: string) => {
    const element = planningRef.current;
    if (!element) return;

    const clearPatchWin = patchGetComputedStyle(window);
    let clearPatchClone = () => {};
    try {
      const numMonths = planningTimelineData?.numMonths || 12;
      const exportWidth = 450 + (numMonths * PLANNING_MONTH_WIDTH) + 120;

      const cleanedCSS = getCleanedStyles();

      const canvas = await html2canvas(element, { 
        scale: 3,
        useCORS: true,
        width: exportWidth,
        backgroundColor: '#FFFFFF',
        onclone: (clonedDoc) => {
          const cloneWin = clonedDoc.defaultView;
          if (cloneWin) {
            clearPatchClone = patchGetComputedStyle(cloneWin);
          }
          // Remove all existing style and link tags to prevent html2canvas's own parser from reading the raw/broken style sheets
          clonedDoc.querySelectorAll('style, link[rel="stylesheet"]').forEach((el) => {
            el.remove();
          });

          // Create a single clean <style> tag with our sanitized CSS!
          const styleEl = clonedDoc.createElement('style');
          styleEl.textContent = cleanedCSS;
          clonedDoc.head.appendChild(styleEl);

          const chartDiv = clonedDoc.getElementById('planning-chart');
          if (chartDiv) {
            // Add a beautiful logo header to the cloned document for the export
            const header = clonedDoc.createElement('div');
            header.style.backgroundColor = '#f8fafc';
            header.style.width = '100%';
            header.style.height = '140px';
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'center';
            header.style.padding = '0 60px';
            header.style.borderBottom = '4px solid #0033ff';
            header.style.marginBottom = '40px';
            
            const logoContainer = clonedDoc.createElement('div');
            logoContainer.style.display = 'flex';
            logoContainer.style.flexDirection = 'column';
            
            const logoTitle = clonedDoc.createElement('h1');
            logoTitle.innerText = 'AXIA';
            logoTitle.style.color = '#0033ff';
            logoTitle.style.fontSize = '48px';
            logoTitle.style.fontWeight = '900';
            logoTitle.style.margin = '0';
            logoTitle.style.letterSpacing = '-2px';
            
            const logoSub = clonedDoc.createElement('p');
            logoSub.innerText = 'ENERGIA';
            logoSub.style.color = '#64748b';
            logoSub.style.fontSize = '12px';
            logoSub.style.fontWeight = 'bold';
            logoSub.style.margin = '-5px 0 0 0';
            logoSub.style.letterSpacing = '5px';
            
            logoContainer.appendChild(logoTitle);
            logoContainer.appendChild(logoSub);
            
            const infoContainer = clonedDoc.createElement('div');
            infoContainer.style.textAlign = 'right';
            
            const docTitle = clonedDoc.createElement('h2');
            docTitle.innerText = 'PLANEJAMENTO MENSAL';
            docTitle.style.color = '#0f172a';
            docTitle.style.fontSize = '32px';
            docTitle.style.fontWeight = 'bold';
            docTitle.style.margin = '0';
            
            const projectTitleText = clonedDoc.createElement('p');
            projectTitleText.innerText = `PROJETO: ${(projects.find(p => p.id === projectId)?.name || '').toUpperCase()}`;
            projectTitleText.style.color = '#64748b';
            projectTitleText.style.fontSize = '16px';
            projectTitleText.style.margin = '5px 0 0 0';
            
            infoContainer.appendChild(docTitle);
            infoContainer.appendChild(projectTitleText);
            
            header.appendChild(logoContainer);
            header.appendChild(infoContainer);
            chartDiv.prepend(header);

            chartDiv.style.width = `${exportWidth}px`;
            chartDiv.style.padding = '80px 60px';
            chartDiv.style.backgroundColor = '#ffffff';
            chartDiv.style.borderRadius = '0';
            chartDiv.style.border = 'none';
            chartDiv.style.overflow = 'visible';
          }

          const elements = chartDiv ? chartDiv.querySelectorAll('*') : [];
          const isModernColor = (val: any) => val && typeof val === 'string' && (val.includes('oklch') || val.includes('oklab'));
          const targetColorProps = ['color', 'background-color', 'border-color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color', 'outline-color', 'box-shadow'];
          
          elements.forEach((node) => {
            const el = node as HTMLElement;
            const style = window.getComputedStyle(el);

            // Scale fonts for high-res export
            if (el.tagName === 'SPAN' || el.tagName === 'DIV' || el.tagName === 'P') {
              const fontSize = parseFloat(style.fontSize);
              if (fontSize < 12) el.style.fontSize = '14px';
            }
            
            // Handle bars specifically
            if (el.classList.contains('h-14')) {
              el.style.height = '80px'; 
              el.style.display = 'flex';
              el.style.alignItems = 'center';
            }
            if (el.classList.contains('h-8')) {
              el.style.height = '50px'; 
              el.style.top = '15px';
              el.style.overflow = 'visible';
              el.style.display = 'flex';
              el.style.alignItems = 'center';
              el.style.justifyContent = 'flex-start';
              
              const textSpan = el.querySelector('span');
              if (textSpan) {
                textSpan.style.fontSize = '14px';
                textSpan.style.fontWeight = '900';
                textSpan.style.overflow = 'hidden';
                textSpan.style.textOverflow = 'ellipsis';
                textSpan.style.whiteSpace = 'nowrap';
                textSpan.style.width = '100%';
                textSpan.style.maxWidth = '100%';
                textSpan.style.display = 'block';
                textSpan.style.lineHeight = '50px';
                textSpan.style.padding = '0 15px';
              }
            }

            if (el.classList.contains('w-[280px]')) {
              el.style.width = '450px';
            }

            // Thoroughly strip modern colors
            targetColorProps.forEach((prop) => {
              const value = style.getPropertyValue(prop);
              if (isModernColor(value)) {
                if (prop === 'color') {
                  el.style.color = el.classList.contains('text-white') ? '#ffffff' : '#1e293b';
                } else if (prop === 'background-color') {
                  el.style.backgroundColor = el.classList.contains('bg-white') ? '#ffffff' : 'transparent';
                } else if (prop === 'box-shadow') {
                  el.style.boxShadow = 'none';
                } else {
                  el.style.setProperty(prop, 'transparent', 'important');
                }
              }
            });

            if (el.classList.contains('bg-hatched-red')) {
              el.style.backgroundImage = 'repeating-linear-gradient(45deg, #ef4444, #ef4444 10px, #dc2626 10px, #dc2626 20px)';
              el.style.backgroundColor = '#ef4444';
            }
          });
        }
      });
      const link = document.createElement('a');
      link.download = `Planejamento_${projects.find(p => p.id === projectId)?.name}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
      showNotification('Imagem de planejamento gerada!');
    } catch (error) {
      console.error('Export error:', error);
      showNotification('Erro ao gerar PNG.');
    } finally {
      clearPatchWin();
      clearPatchClone();
    }
  };

  const exportScheduleToPDF = async (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const projectActivities = activities.filter(a => a.projectId === projectId && !a.isHidden);
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // Header
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.line(0, 40, 210, 40);
    
    // Logo
    drawPDFLogo(doc, 15, 18);
    addWatermark(doc);
    
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('CRONOGRAMA DE OBRA', 195, 20, { align: 'right' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(project.name.toUpperCase(), 195, 28, { align: 'right' });

    // Project Info
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.text(`Cliente: ${project.client}`, 15, 52);
    doc.text(`Responsável: ${project.responsible || project.creatorName || ''}`, 15, 57);
    doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 15, 62);

    // Table (Without Progress column as requested)
    const tableData = projectActivities.map(a => [
      (a.name || '').toUpperCase(),
      a.responsible,
      `${formatInputDate(a.startDate)} - ${formatInputDate(a.endDate)}`,
      a.status === 'completed' ? 'CONCLUÍDO' : 
      a.status === 'in-progress' ? 'EM ANDAMENTO' : 
      a.status === 'scheduled' ? 'PROGRAMADO' :
      a.status === 'delayed' ? `ATRASADA (Nova Prev: ${formatInputDate(a.predictedEndDate || '')})` : 'PENDENTE'
    ]);

    autoTable(doc, {
      startY: 75,
      head: [['ATIVIDADE', 'RESPONSÁVEL', 'PERÍODO', 'STATUS']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [0, 51, 255], textColor: [255, 255, 255] },
      styles: { fontSize: 8 }
    });

    // Add Timeline Visual if Ref exists
    if (timelineRef.current) {
      const clearPatchWin = patchGetComputedStyle(window);
      let clearPatchClone = () => {};
      try {
        const numMonths = 12; // Execution is fixed to roughly 1 year or window
        const exportWidth = 450 + (numMonths * MONTH_WIDTH) + 120;

        const cleanedCSS = getCleanedStyles();

        const canvas = await html2canvas(timelineRef.current, {
          scale: 3,
          useCORS: true,
          logging: false,
          width: exportWidth,
          backgroundColor: '#FFFFFF',
          onclone: (clonedDoc) => {
            const cloneWin = clonedDoc.defaultView;
            if (cloneWin) {
              clearPatchClone = patchGetComputedStyle(cloneWin);
            }
            // Remove all existing style and link tags to prevent html2canvas's own parser from reading the raw/broken style sheets
            clonedDoc.querySelectorAll('style, link[rel="stylesheet"]').forEach((el) => {
              el.remove();
            });

            // Create a single clean <style> tag with our sanitized CSS!
            const styleEl = clonedDoc.createElement('style');
            styleEl.textContent = cleanedCSS;
            clonedDoc.head.appendChild(styleEl);

            const container = clonedDoc.getElementById('timeline-container');
            if (container) {
              // Add a beautiful logo header to the cloned document for the export
              const header = clonedDoc.createElement('div');
              header.style.backgroundColor = '#f8fafc';
              header.style.width = '100%';
              header.style.height = '140px';
              header.style.display = 'flex';
              header.style.justifyContent = 'space-between';
              header.style.alignItems = 'center';
              header.style.padding = '0 60px';
              header.style.borderBottom = '4px solid #0033ff';
              header.style.marginBottom = '40px';
              
              const logoContainer = clonedDoc.createElement('div');
              logoContainer.style.display = 'flex';
              logoContainer.style.flexDirection = 'column';
              
              const logoTitle = clonedDoc.createElement('h1');
              logoTitle.innerText = 'AXIA';
              logoTitle.style.color = '#0033ff';
              logoTitle.style.fontSize = '48px';
              logoTitle.style.fontWeight = '900';
              logoTitle.style.margin = '0';
              logoTitle.style.letterSpacing = '-2px';
              
              const logoSub = clonedDoc.createElement('p');
              logoSub.innerText = 'ENERGIA';
              logoSub.style.color = '#64748b';
              logoSub.style.fontSize = '12px';
              logoSub.style.fontWeight = 'bold';
              logoSub.style.margin = '-5px 0 0 0';
              logoSub.style.letterSpacing = '5px';
              
              logoContainer.appendChild(logoTitle);
              logoContainer.appendChild(logoSub);
              
              const infoContainer = clonedDoc.createElement('div');
              infoContainer.style.textAlign = 'right';
              
              const docTitle = clonedDoc.createElement('h2');
              docTitle.innerText = 'CRONOGRAMA DE EXECUÇÃO';
              docTitle.style.color = '#0f172a';
              docTitle.style.fontSize = '32px';
              docTitle.style.fontWeight = 'bold';
              docTitle.style.margin = '0';
              
              const projectTitle = clonedDoc.createElement('p');
              projectTitle.innerText = `PROJETO: ${project.name.toUpperCase()}`;
              projectTitle.style.color = '#64748b';
              projectTitle.style.fontSize = '16px';
              projectTitle.style.margin = '5px 0 0 0';
              
              infoContainer.appendChild(docTitle);
              infoContainer.appendChild(projectTitle);
              
              header.appendChild(logoContainer);
              header.appendChild(infoContainer);
              container.prepend(header);

              container.style.width = `${exportWidth}px`; 
              container.style.padding = '80px 60px';
              container.style.backgroundColor = '#ffffff';
              container.style.borderRadius = '0';
              container.style.border = 'none';
              container.style.overflow = 'visible';
            }

            const elements = container ? container.querySelectorAll('*') : [];
            const isModernColor = (val: any) => val && typeof val === 'string' && (val.includes('oklch') || val.includes('oklab'));
            const targetColorProps = ['color', 'background-color', 'border-color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color', 'outline-color', 'box-shadow'];
            
            elements.forEach((node) => {
              const el = node as HTMLElement;
              const style = window.getComputedStyle(el);

              // Scale fonts
              if (el.tagName === 'SPAN' || el.tagName === 'DIV' || el.tagName === 'P') {
                const fontSize = parseFloat(style.fontSize);
                if (fontSize < 12) el.style.fontSize = '14px';
              }
              
              if (el.classList.contains('h-14')) {
                el.style.height = '80px'; 
                el.style.display = 'flex';
                el.style.alignItems = 'center';
              }
              if (el.classList.contains('h-8')) {
                el.style.height = '50px'; 
                el.style.top = '15px';
                el.style.overflow = 'visible';
                el.style.display = 'flex';
                el.style.alignItems = 'center';
                el.style.justifyContent = 'flex-start';
                
                const textSpan = el.querySelector('span');
                if (textSpan) {
                  textSpan.style.fontSize = '14px';
                  textSpan.style.fontWeight = '900';
                  textSpan.style.overflow = 'hidden';
                  textSpan.style.textOverflow = 'ellipsis';
                  textSpan.style.whiteSpace = 'nowrap';
                  textSpan.style.width = '100%';
                  textSpan.style.maxWidth = '100%';
                  textSpan.style.display = 'block';
                  textSpan.style.lineHeight = '50px';
                  textSpan.style.padding = '0 15px';
                }
              }

              if (el.classList.contains('w-[320px]')) {
                el.style.width = '450px';
              }

              // Strip modern colors
              targetColorProps.forEach((prop) => {
                const value = style.getPropertyValue(prop);
                if (isModernColor(value)) {
                  if (prop === 'color') {
                    el.style.color = el.classList.contains('text-white') ? '#ffffff' : '#1e293b';
                  } else if (prop === 'background-color') {
                    el.style.backgroundColor = el.classList.contains('bg-white') ? '#ffffff' : 'transparent';
                  } else if (prop === 'box-shadow') {
                    el.style.boxShadow = 'none';
                  } else {
                    el.style.setProperty(prop, 'transparent', 'important');
                  }
                }
              });

              if (el.classList.contains('bg-hatched-red')) {
                el.style.backgroundImage = 'repeating-linear-gradient(45deg, #ef4444, #ef4444 10px, #dc2626 10px, #dc2626 20px)';
                el.style.backgroundColor = '#ef4444';
              }
            });
          }
        });

        const imgData = canvas.toDataURL('image/png', 1.0);
        
        // Use landscape for the chart
        doc.addPage('a4', 'l');
        addWatermark(doc);
        
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 0; 
        
        const imgProps = doc.getImageProperties(imgData);
        const imgRatio = imgProps.width / imgProps.height;
        
        const maxWidth = pageWidth;
        const maxHeight = pageHeight - 10; 
        
        let finalWidth = maxWidth;
        let finalHeight = maxWidth / imgRatio;
        
        if (finalHeight > maxHeight) {
          finalHeight = maxHeight;
          finalWidth = maxHeight * imgRatio;
        }
        
        const xPos = (pageWidth - finalWidth) / 2;
        const yPos = 8 + (maxHeight - finalHeight) / 2;

        doc.setTextColor(0, 51, 255);
        doc.setFontSize(10);
        doc.text(`CRONOGRAMA VISUAL: ${(project.name || '').toUpperCase()}`, pageWidth / 2, 6, { align: 'center' });
        
        doc.addImage(imgData, 'PNG', xPos, yPos, finalWidth, finalHeight, undefined, 'FAST');
      } catch (err) {
        console.error('Error capturing timeline:', err);
      } finally {
        clearPatchWin();
        clearPatchClone();
      }
    }

    doc.save(`cronograma_${project.name.toLowerCase().replace(/\s+/g, '_')}.pdf`);
    
    // Add watermark to all pages
    const pageCountTotal = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCountTotal; i++) {
      doc.setPage(i);
      addWatermark(doc);
    }
    
    showNotification('Cronograma exportado com sucesso!');
  };

  const exportScheduleToPNG = async (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project || !timelineRef.current) return;

    const clearPatchWin = patchGetComputedStyle(window);
    let clearPatchClone = () => {};
    try {
      const numMonths = 12;
      const exportWidth = 450 + (numMonths * MONTH_WIDTH) + 120;

      const cleanedCSS = getCleanedStyles();

      const canvas = await html2canvas(timelineRef.current, {
        scale: 3,
        useCORS: true,
        logging: false,
        width: exportWidth,
        backgroundColor: '#FFFFFF',
        onclone: (clonedDoc) => {
          const cloneWin = clonedDoc.defaultView;
          if (cloneWin) {
            clearPatchClone = patchGetComputedStyle(cloneWin);
          }
          // Remove all existing style and link tags to prevent html2canvas's own parser from reading the raw/broken style sheets
          clonedDoc.querySelectorAll('style, link[rel="stylesheet"]').forEach((el) => {
            el.remove();
          });

          // Create a single clean <style> tag with our sanitized CSS!
          const styleEl = clonedDoc.createElement('style');
          styleEl.textContent = cleanedCSS;
          clonedDoc.head.appendChild(styleEl);

          const container = clonedDoc.getElementById('timeline-container');
          if (container) {
            // Add a beautiful logo header to the cloned document for the export
            const header = clonedDoc.createElement('div');
            header.style.backgroundColor = '#f8fafc';
            header.style.width = '100%';
            header.style.height = '140px';
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'center';
            header.style.padding = '0 60px';
            header.style.borderBottom = '4px solid #0033ff';
            header.style.marginBottom = '40px';
            
            const logoContainer = clonedDoc.createElement('div');
            logoContainer.style.display = 'flex';
            logoContainer.style.flexDirection = 'column';
            
            const logoTitle = clonedDoc.createElement('h1');
            logoTitle.innerText = 'AXIA';
            logoTitle.style.color = '#0033ff';
            logoTitle.style.fontSize = '48px';
            logoTitle.style.fontWeight = '900';
            logoTitle.style.margin = '0';
            logoTitle.style.letterSpacing = '-2px';
            
            const logoSub = clonedDoc.createElement('p');
            logoSub.innerText = 'ENERGIA';
            logoSub.style.color = '#64748b';
            logoSub.style.fontSize = '12px';
            logoSub.style.fontWeight = 'bold';
            logoSub.style.margin = '-5px 0 0 0';
            logoSub.style.letterSpacing = '5px';
            
            logoContainer.appendChild(logoTitle);
            logoContainer.appendChild(logoSub);
            
            const infoContainer = clonedDoc.createElement('div');
            infoContainer.style.textAlign = 'right';
            
            const docTitle = clonedDoc.createElement('h2');
            docTitle.innerText = 'CRONOGRAMA DE EXECUÇÃO';
            docTitle.style.color = '#0f172a';
            docTitle.style.fontSize = '32px';
            docTitle.style.fontWeight = 'bold';
            docTitle.style.margin = '0';
            
            const projectTitleText = clonedDoc.createElement('p');
            projectTitleText.innerText = `PROJETO: ${(project.name || '').toUpperCase()}`;
            projectTitleText.style.color = '#64748b';
            projectTitleText.style.fontSize = '16px';
            projectTitleText.style.margin = '5px 0 0 0';
            
            infoContainer.appendChild(docTitle);
            infoContainer.appendChild(projectTitleText);
            
            header.appendChild(logoContainer);
            header.appendChild(infoContainer);
            container.prepend(header);

            container.style.width = `${exportWidth}px`; 
            container.style.padding = '80px 60px';
            container.style.backgroundColor = '#ffffff';
            container.style.borderRadius = '0';
            container.style.border = 'none';
            container.style.overflow = 'visible';
          }

          const elements = container ? container.querySelectorAll('*') : [];
          const isModernColor = (val: any) => val && typeof val === 'string' && (val.includes('oklch') || val.includes('oklab'));
          const targetColorProps = ['color', 'background-color', 'border-color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color', 'outline-color', 'box-shadow'];
          
          elements.forEach((node) => {
            const el = node as HTMLElement;
            const style = window.getComputedStyle(el);

            // Scale fonts
            if (el.tagName === 'SPAN' || el.tagName === 'DIV' || el.tagName === 'P') {
              const fontSize = parseFloat(style.fontSize);
              if (fontSize < 12) el.style.fontSize = '14px';
            }
            
            if (el.classList.contains('h-14')) {
              el.style.height = '80px'; 
              el.style.display = 'flex';
              el.style.alignItems = 'center';
            }
            if (el.classList.contains('h-8')) {
              el.style.height = '50px'; 
              el.style.top = '15px';
              el.style.overflow = 'visible';
              el.style.display = 'flex';
              el.style.alignItems = 'center';
              el.style.justifyContent = 'flex-start';
              
              const textSpan = el.querySelector('span');
              if (textSpan) {
                textSpan.style.fontSize = '14px';
                textSpan.style.fontWeight = '900';
                textSpan.style.overflow = 'hidden';
                textSpan.style.textOverflow = 'ellipsis';
                textSpan.style.whiteSpace = 'nowrap';
                textSpan.style.width = '100%';
                textSpan.style.maxWidth = '100%';
                textSpan.style.display = 'block';
                textSpan.style.lineHeight = '50px';
                textSpan.style.padding = '0 15px';
              }
            }

            if (el.classList.contains('w-[320px]')) {
              el.style.width = '450px';
            }

            // Strip modern colors
            targetColorProps.forEach((prop) => {
              const value = style.getPropertyValue(prop);
              if (isModernColor(value)) {
                if (prop === 'color') {
                  el.style.color = el.classList.contains('text-white') ? '#ffffff' : '#1e293b';
                } else if (prop === 'background-color') {
                  el.style.backgroundColor = el.classList.contains('bg-white') ? '#ffffff' : 'transparent';
                } else if (prop === 'box-shadow') {
                  el.style.boxShadow = 'none';
                } else {
                  el.style.setProperty(prop, 'transparent', 'important');
                }
              }
            });

            if (el.classList.contains('bg-hatched-red')) {
              el.style.backgroundImage = 'repeating-linear-gradient(45deg, #ef4444, #ef4444 10px, #dc2626 10px, #dc2626 20px)';
              el.style.backgroundColor = '#ef4444';
            }
          });
        }
      });

      const imgData = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.href = imgData;
      link.download = `grafico_cronograma_${project.name.toLowerCase().replace(/\s+/g, '_')}.png`;
      link.click();
      showNotification('Gráfico exportado com sucesso!');
    } catch (err) {
      console.error('Error exporting PNG:', err);
      showNotification('Erro ao exportar PNG');
    } finally {
      clearPatchWin();
      clearPatchClone();
    }
  };

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !viewingProject) return;

    // Check file size (e.g., 10MB limit for original file, we will compress)
    if (file.size > 10 * 1024 * 1024) {
      showNotification('A foto é muito grande. O limite é 10MB.');
      return;
    }

    setIsUploadingPhoto(true);
    try {
      showNotification('Comprimindo foto...');
      // Compress to avoid 1MB Firestore limit. Increased quality and resolution for better PDF results.
      const compressedBase64 = await compressImage(file, 1280, 1280, 0.8);
      
      setNewPhoto(prev => ({ ...prev, url: compressedBase64 }));
      showNotification('Foto carregada com sucesso!');
    } catch (error: any) {
      console.error('Error processing photo:', error);
      showNotification('Erro ao processar foto. Tente novamente.');
    } finally {
      setIsUploadingPhoto(false);
      // Reset input value to allow selecting the same file again
      if (e.target) e.target.value = '';
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', isDarkMode.toString());
  }, [isDarkMode]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        if (quotaExceeded) {
          setIsAuthReady(true);
          return;
        }
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setCurrentUser({ 
              ...DEFAULT_USER,
              ...data,
              id: user.uid,
              name: data.name || 'Usuário',
              accessLevel: data.accessLevel || 'Usuário Padrão'
            } as UserProfile);
            setIsLoggedIn(true);
          } else {
            console.warn('User authenticated but profile not found in Firestore');
            setIsLoggedIn(false);
          }
        } catch (error) {
          if (error instanceof Error && error.message.includes('Quota exceeded')) {
            localStorage.setItem('firestore_quota_extrapolated', 'true');
            setQuotaExceeded(true);
          }
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
        } finally {
          setIsAuthReady(true);
        }
      } else {
        setIsLoggedIn(false);
        setIsAuthReady(true);
      }
    });

    // Remove connection test to save quota reads
    // const testConnection = async () => { ... }
    
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isLoggedIn || !isAuthReady || quotaExceeded) return;

    const isManager = currentUser.accessLevel === 'Administrador de Sistema' || currentUser.accessLevel === 'Gestor';
    const projectsQuery = isManager 
      ? collection(db, 'projects') 
      : query(
          collection(db, 'projects'), 
          or(
            where('createdBy', '==', currentUser.id),
            where('responsibleId', '==', currentUser.id)
          )
        );

    const unsubProjects = onSnapshot(projectsQuery, (snapshot) => {
      setProjects(snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          name: data.name || '',
          budget: Number(data.budget) || 0,
          spent: Number(data.spent) || 0,
          progress: Number(data.progress) || 0,
          status: data.status || 'not-started',
          startDate: data.startDate || '',
          endDate: data.endDate || '',
          responsible: data.responsible || '',
          responsibleId: data.responsibleId || ''
        } as Project;
      }));
    }, (error) => {
      if (error.message.includes('Quota exceeded')) {
        localStorage.setItem('firestore_quota_extrapolated', 'true');
        setQuotaExceeded(true);
      }
      handleFirestoreError(error, OperationType.LIST, 'projects');
    });

    const unsubReports = onSnapshot(collection(db, 'reports'), (snapshot) => {
      setReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WeeklyReport)));
    }, (error) => {
      if (error.message.includes('Quota exceeded')) {
        localStorage.setItem('firestore_quota_extrapolated', 'true');
        setQuotaExceeded(true);
      }
      handleFirestoreError(error, OperationType.LIST, 'reports');
    });

    const unsubMeasurements = onSnapshot(collection(db, 'measurements'), (snapshot) => {
      setMeasurements(snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          value: Number(data.value) || 0,
          date: data.date || '',
          status: data.status || 'pending'
        } as Measurement;
      }));
    }, (error) => {
      if (error.message.includes('Quota exceeded')) {
        localStorage.setItem('firestore_quota_extrapolated', 'true');
        setQuotaExceeded(true);
      }
      handleFirestoreError(error, OperationType.LIST, 'measurements');
    });

    const unsubAttachments = onSnapshot(collection(db, 'attachments'), (snapshot) => {
      setAttachments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Attachment)));
    }, (error) => {
      if (error.message.includes('Quota exceeded')) {
        localStorage.setItem('firestore_quota_extrapolated', 'true');
        setQuotaExceeded(true);
      }
      handleFirestoreError(error, OperationType.LIST, 'attachments');
    });

    const unsubStatusUpdates = onSnapshot(query(collection(db, 'statusUpdates'), orderBy('date', 'desc')), (snapshot) => {
      setStatusUpdates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StatusUpdate)));
    }, (error) => {
      if (error.message.includes('Quota exceeded')) {
        localStorage.setItem('firestore_quota_extrapolated', 'true');
        setQuotaExceeded(true);
      }
      handleFirestoreError(error, OperationType.LIST, 'statusUpdates');
    });

    const unsubPhotoReports = onSnapshot(collection(db, 'photoReports'), (snapshot) => {
      setPhotoReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PhotoReportItem)));
    }, (error) => {
      if (error.message.includes('Quota exceeded')) {
        localStorage.setItem('firestore_quota_extrapolated', 'true');
        setQuotaExceeded(true);
      }
      handleFirestoreError(error, OperationType.LIST, 'photoReports');
    });

    const unsubBulletins = onSnapshot(collection(db, 'measurementBulletins'), (snapshot) => {
      setMeasurementBulletins(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MeasurementBulletin)));
    }, (error) => {
      if (error.message.includes('Quota exceeded')) {
        localStorage.setItem('firestore_quota_extrapolated', 'true');
        setQuotaExceeded(true);
      }
      handleFirestoreError(error, OperationType.LIST, 'measurementBulletins');
    });

    const unsubAddendums = onSnapshot(collection(db, 'projectAddendums'), (snapshot) => {
      setAddendums(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProjectAddendum)));
    }, (error) => {
      if (error.message.includes('Quota exceeded')) {
        localStorage.setItem('firestore_quota_extrapolated', 'true');
        setQuotaExceeded(true);
      }
      handleFirestoreError(error, OperationType.LIST, 'projectAddendums');
    });

    const unsubActivities = onSnapshot(query(collection(db, 'scheduleActivities'), orderBy('order', 'asc')), (snapshot) => {
      setActivities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ScheduleActivity)));
    }, (error) => {
      if (error.message.includes('Quota exceeded')) {
        localStorage.setItem('firestore_quota_extrapolated', 'true');
        setQuotaExceeded(true);
      }
      handleFirestoreError(error, OperationType.LIST, 'scheduleActivities');
    });

    const unsubPlanning = onSnapshot(query(collection(db, 'planningActivities'), orderBy('order', 'asc')), (snapshot) => {
      setPlanningActivities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlanningActivity)));
    }, (error) => {
      if (error.message.includes('Quota exceeded')) {
        localStorage.setItem('firestore_quota_extrapolated', 'true');
        setQuotaExceeded(true);
      }
      handleFirestoreError(error, OperationType.LIST, 'planningActivities');
    });

    const unsubFiscalPlanning = onSnapshot(query(collection(db, 'fiscalPlanningActivities'), orderBy('order', 'asc')), (snapshot) => {
      setFiscalPlanningActivities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlanningActivity)));
    }, (error) => {
      if (error.message.includes('Quota exceeded')) {
        localStorage.setItem('firestore_quota_extrapolated', 'true');
        setQuotaExceeded(true);
      }
      handleFirestoreError(error, OperationType.LIST, 'fiscalPlanningActivities');
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setRegisteredUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile)));
    }, (error) => {
      if (error.message.includes('Quota exceeded')) {
        localStorage.setItem('firestore_quota_extrapolated', 'true');
        setQuotaExceeded(true);
      }
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    const unsubRCRequests = onSnapshot(collection(db, 'consumptionRCRequests'), (snapshot) => {
      setConsumptionRCRequests(snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          value: Number(data.value) || 0,
          status: data.status || 'requested',
          createdAt: data.createdAt || { toDate: () => new Date() }
        } as ConsumptionRCRequest;
      }));
    }, (error) => {
      if (error.message.includes('Quota exceeded')) {
        localStorage.setItem('firestore_quota_extrapolated', 'true');
        setQuotaExceeded(true);
      }
      handleFirestoreError(error, OperationType.LIST, 'consumptionRCRequests');
    });

    const unsubTravels = onSnapshot(collection(db, 'travels'), (snapshot) => {
      setTravels(snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          cost: Number(data.cost) || 0,
        } as Travel;
      }));
    }, (error) => {
      if (error.message.includes('Quota exceeded')) {
        localStorage.setItem('firestore_quota_extrapolated', 'true');
        setQuotaExceeded(true);
      }
      handleFirestoreError(error, OperationType.LIST, 'travels');
    });

    return () => {
      unsubProjects();
      unsubReports();
      unsubMeasurements();
      unsubAttachments();
      unsubStatusUpdates();
      unsubPhotoReports();
      unsubBulletins();
      unsubAddendums();
      unsubActivities();
      unsubPlanning();
      unsubFiscalPlanning();
      unsubUsers();
      unsubRCRequests();
      unsubTravels();
    };
  }, [isLoggedIn, isAuthReady]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showNotification = (msg: string) => setNotification(msg);

  const compressImage = (file: File, maxWidth: number, maxHeight: number, quality: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height *= maxWidth / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width *= maxHeight / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  // Dashboard Data Calculations
  const projectsByClient = projectsWithTotals.reduce((acc: any, project) => {
    acc[project.client] = (acc[project.client] || 0) + 1;
    return acc;
  }, {});

  const projectsByClientData = Object.keys(projectsByClient).map(client => ({
    name: client,
    value: projectsByClient[client]
  }));

  const budgetByClient = projectsWithTotals.reduce((acc: any, project) => {
    acc[project.client] = (acc[project.client] || 0) + (project.totalBudget || 0);
    return acc;
  }, {});

  const budgetByClientData = Object.keys(budgetByClient).map(client => ({
    name: client,
    value: budgetByClient[client]
  }));

  const statusCounts = {
    'not-started': projectsWithTotals.filter(p => p.status === 'not-started').length,
    'preliminary-study': projectsWithTotals.filter(p => p.status === 'preliminary-study').length,
    'in-progress': projectsWithTotals.filter(p => p.status === 'in-progress').length,
    'paused': projectsWithTotals.filter(p => p.status === 'paused').length,
    'finished': projectsWithTotals.filter(p => p.status === 'finished').length,
  };

  const totalPendingRCValue = useMemo(() => {
    return consumptionRCRequests
      .filter(r => r.status !== 'received' && r.status !== 'canceled')
      .reduce((acc, r) => acc + (r.value || 0), 0);
  }, [consumptionRCRequests]);

  const { timelineData, timelineWindow } = useMemo(() => {
    const validProjects = projects.filter(p => p.startDate && p.endDate);
    if (validProjects.length === 0) return { timelineData: [], timelineWindow: null };

    const startTimes = validProjects.map(p => {
      const d = new Date(p.startDate);
      return isNaN(d.getTime()) ? null : d.getTime();
    }).filter((t): t is number => t !== null);
    
    const endTimes = validProjects.map(p => {
      const d = new Date(p.endDate);
      return isNaN(d.getTime()) ? null : d.getTime();
    }).filter((t): t is number => t !== null);

    if (startTimes.length === 0 || endTimes.length === 0) return { timelineData: [], timelineWindow: null };
    
    const minStart = Math.min(...startTimes) - (15 * 24 * 60 * 60 * 1000);
    const maxEnd = Math.max(...endTimes) + (15 * 24 * 60 * 60 * 1000);
    const totalDuration = maxEnd - minStart;

    const data = validProjects.map(p => {
      const start = new Date(p.startDate);
      const end = new Date(p.endDate);
      const startTime = start.getTime();
      const endTime = end.getTime();
      const duration = endTime - startTime;
      
      return {
        name: p.name,
        start: start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        end: end.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        left: ((startTime - minStart) / totalDuration) * 100,
        width: Math.max(2, (duration / totalDuration) * 100),
        status: p.status,
        startTime
      };
    }).sort((a, b) => a.startTime - b.startTime);

    return { 
      timelineData: data, 
      timelineWindow: { minStart, maxEnd, totalDuration } 
    };
  }, [projects]);

  const CHART_COLORS = ['#0F172A', '#F97316', '#10B981', '#64748B', '#8B5CF6', '#EC4899'];

  // New Project Form State
  const [newProject, setNewProject] = useState({
    name: '',
    client: '',
    contractNumber: '',
    description: '',
    budget: '',
    location: '',
    startDate: '',
    endDate: '',
    executingCompany: '',
    responsible: '',
    responsibleId: '',
    status: 'not-started' as Project['status'],
    progress: 0
  });

  const [newMeasurement, setNewMeasurement] = useState({
    projectId: '',
    date: '',
    value: '',
    description: ''
  });

  const [newStatusUpdate, setNewStatusUpdate] = useState({
    projectId: '',
    message: ''
  });

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingProject) {
        const projectRef = doc(db, 'projects', editingProject.id);
        const updatedData = { 
          ...newProject, 
          budget: Number(newProject.budget),
          progress: Number(newProject.progress)
        };
        await updateDoc(projectRef, updatedData);
        showNotification('Projeto atualizado com sucesso!');
        setEditingProject(null);
      } else {
        const projectId = `proj-${Date.now()}`;
        const project: Project = {
          id: projectId,
          name: newProject.name,
          client: newProject.client,
          contractNumber: newProject.contractNumber,
          description: newProject.description,
          status: newProject.status,
          progress: Number(newProject.progress) || 0,
          startDate: newProject.startDate,
          endDate: newProject.endDate,
          budget: Number(newProject.budget),
          spent: 0,
          location: newProject.location,
          executingCompany: newProject.executingCompany,
          responsible: newProject.responsible,
          responsibleId: newProject.responsibleId,
          image: `https://picsum.photos/seed/${newProject.name}/800/600`,
          createdBy: currentUser?.id || '',
          creatorName: currentUser?.name || 'Sistema'
        };
        await setDoc(doc(db, 'projects', projectId), project);
        showNotification('Novo projeto cadastrado com sucesso!');
      }
      
      setShowAddProject(false);
      setNewProject({
        name: '',
        client: '',
        contractNumber: '',
        description: '',
        budget: '',
        location: '',
        startDate: '',
        endDate: '',
        executingCompany: '',
        responsible: '',
        status: 'not-started',
        progress: 0
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'projects');
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'projects', id));
      
      if (viewingProject?.id === id) {
        setViewingProject(null);
      }
      
      setProjectToDelete(null);
      showNotification('Obra excluída com sucesso!');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `projects/${id}`);
    }
  };

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'pdf' | 'image') => {
    const file = e.target.files?.[0];
    if (!file || !viewingProject) return;

    if (file.size > 0.8 * 1024 * 1024) {
      showNotification('O arquivo é muito grande. O limite para anexos diretos no banco de dados é de 800KB para garantir o funcionamento.');
      return;
    }

    setIsUploadingAttachment(true);
    try {
      let url = '';
      let displaySize = (file.size / (1024 * 1024)).toFixed(2) + ' MB';

      if (type === 'image') {
        showNotification('Comprimindo imagem...');
        url = await compressImage(file, 1280, 1280, 0.8);
        // Recalculate size roughly from base64 (approx 4/3 of binary)
        const base64Length = url.length - url.indexOf(',') - 1;
        displaySize = (base64Length / (1024 * 1024)).toFixed(2) + ' MB';
      } else {
        showNotification('Lendo arquivo...');
        url = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target?.result as string);
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(file);
        });
      }

      const attachmentId = Math.random().toString(36).substr(2, 9);
      const newAttachment: Attachment = {
        id: attachmentId,
        projectId: viewingProject.id,
        name: file.name,
        type: type,
        url: url,
        uploadedAt: new Date().toLocaleString('pt-BR'),
        size: displaySize
      };

      await setDoc(doc(db, 'attachments', attachmentId), newAttachment);
      showNotification(`${type === 'pdf' ? 'PDF' : 'Foto'} anexado com sucesso!`);
    } catch (error) {
      console.error('Error uploading attachment:', error);
      handleFirestoreError(error, OperationType.WRITE, 'attachments');
    } finally {
      setIsUploadingAttachment(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleDeleteAttachment = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'attachments', id));
      showNotification('Anexo removido com sucesso.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `attachments/${id}`);
    }
  };

  const startEditing = (project: Project) => {
    setEditingProject(project);
    setNewProject({
      name: project.name || '',
      client: project.client || '',
      contractNumber: project.contractNumber || '',
      description: project.description || '',
      budget: (project.budget ?? 0).toString(),
      location: project.location || '',
      startDate: project.startDate || '',
      endDate: project.endDate || '',
      executingCompany: project.executingCompany || '',
      responsible: project.responsible || '',
      responsibleId: project.responsibleId || '',
      status: project.status || 'not-started',
      progress: project.progress ?? 0
    });
    setShowAddProject(true);
    setViewingProject(null);
  };

  const handleAddMeasurement = async (e: React.FormEvent) => {
    e.preventDefault();
    const project = projects.find(p => p.id === newMeasurement.projectId);
    if (!project) return;

    try {
      if (editingMeasurement) {
        const oldValue = editingMeasurement.value;
        const newValue = Number(newMeasurement.value);
        const diff = newValue - oldValue;

        const measurementRef = doc(db, 'measurements', editingMeasurement.id);
        await updateDoc(measurementRef, {
          projectId: newMeasurement.projectId,
          projectName: project.name,
          date: newMeasurement.date,
          value: newValue,
          description: newMeasurement.description
        });

        // Update project spent value
        const projectRef = doc(db, 'projects', project.id);
        await updateDoc(projectRef, { spent: project.spent + diff });

        setEditingMeasurement(null);
        showNotification('Medição atualizada com sucesso!');
      } else {
        const measurementId = `meas-${Date.now()}`;
        const measurement: Measurement = {
          id: measurementId,
          projectId: newMeasurement.projectId,
          projectName: project.name,
          date: newMeasurement.date,
          value: Number(newMeasurement.value),
          description: newMeasurement.description,
          status: 'pending'
        };

        await setDoc(doc(db, 'measurements', measurementId), measurement);
        
        // Update project spent value
        const projectRef = doc(db, 'projects', project.id);
        await updateDoc(projectRef, { spent: project.spent + Number(newMeasurement.value) });
        
        showNotification('Medição registrada com sucesso!');
      }

      setNewMeasurement({
        projectId: '',
        date: '',
        value: '',
        description: ''
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'measurements');
    }
  };

  const startEditingMeasurement = (measurement: Measurement) => {
    setEditingMeasurement(measurement);
    setNewMeasurement({
      projectId: measurement.projectId,
      date: measurement.date,
      value: (measurement.value ?? 0).toString(),
      description: measurement.description || ''
    });
  };

  const handleDeleteMeasurement = async (measurement: Measurement) => {
    try {
      await deleteDoc(doc(db, 'measurements', measurement.id));
      
      // Update project spent value
      const project = projects.find(p => p.id === measurement.projectId);
      if (project) {
        const projectRef = doc(db, 'projects', project.id);
        await updateDoc(projectRef, { spent: Math.max(0, project.spent - measurement.value) });
      }
      
      showNotification('Medição excluída com sucesso!');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `measurements/${measurement.id}`);
    }
  };

  const handleAddBulletin = async (e: React.FormEvent) => {
    e.preventDefault();
    const project = projects.find(p => p.id === newBulletin.projectId);
    if (!project) return;

    setIsAddingBulletin(true);
    try {
      const bulletinId = `bull-${Date.now()}`;
      const bulletin: MeasurementBulletin = {
        id: bulletinId,
        projectId: newBulletin.projectId,
        projectName: project.name,
        contractNumber: project.contractNumber,
        rcNumber: newBulletin.rcNumber,
        sapItem: newBulletin.sapItem,
        installation: newBulletin.installation,
        supplier: newBulletin.supplier,
        value: Number(newBulletin.value),
        date: newBulletin.date,
        status: 'pending'
      };

      await setDoc(doc(db, 'measurementBulletins', bulletinId), bulletin);
      
      // Generate PDF
      generateBulletinPDF(bulletin);
      
      setNewBulletin({
        projectId: '',
        rcNumber: '',
        sapItem: '',
        installation: '',
        supplier: '',
        value: '',
        date: new Date().toISOString().split('T')[0]
      });
      
      showNotification('Boletim de Medição registrado com sucesso!');
    } catch (error) {
      console.error('Error adding bulletin:', error);
      handleFirestoreError(error, OperationType.WRITE, 'measurementBulletins');
    } finally {
      setIsAddingBulletin(false);
    }
  };

  const handleDeleteBulletin = async (bulletin: MeasurementBulletin) => {
    try {
      await deleteDoc(doc(db, 'measurementBulletins', bulletin.id));
      showNotification('Boletim excluído com sucesso!');
    } catch (error) {
      console.error('Error deleting bulletin:', error);
      handleFirestoreError(error, OperationType.DELETE, `measurementBulletins/${bulletin.id}`);
    }
  };

  const handleToggleArchiveBulletin = async (bulletin: MeasurementBulletin) => {
    try {
      const bulletinRef = doc(db, 'measurementBulletins', bulletin.id);
      await updateDoc(bulletinRef, {
        archived: !bulletin.archived
      });
      showNotification(bulletin.archived ? 'Boletim desarquivado!' : 'Boletim arquivado com sucesso!');
    } catch (error) {
      console.error('Error archiving bulletin:', error);
      handleFirestoreError(error, OperationType.WRITE, `measurementBulletins/${bulletin.id}`);
    }
  };

  const handleAddRCRequest = async () => {
    if (!newRCRequest.projectId) {
      showNotification('Selecione uma obra.');
      return;
    }
    
    const project = projects.find(p => p.id === newRCRequest.projectId);
    if (!project) return;

    try {
      const requestData: Omit<ConsumptionRCRequest, 'id'> = {
        projectId: newRCRequest.projectId,
        projectName: project.name,
        requestDate: newRCRequest.requestDate,
        value: newRCRequest.value,
        signedBulletin: newRCRequest.signedBulletin || undefined,
        status: 'requested',
        observations: [{
          id: Math.random().toString(36).substr(2, 9),
          text: 'Solicitação inicial de RC de Consumo criada.',
          date: new Date().toLocaleString('pt-BR'),
          userName: currentUser?.name || 'Sistema'
        }],
        createdBy: currentUser?.id || '',
        creatorName: currentUser?.name || 'Sistema',
        createdAt: new Date().toISOString()
      };
      
      await addDoc(collection(db, 'consumptionRCRequests'), requestData);
      showNotification('Solicitação de RC criada com sucesso!');
      setIsAddingRCRequest(false);
      setNewRCRequest({
        projectId: '',
        requestDate: new Date().toISOString().split('T')[0],
        value: 0,
        signedBulletin: null,
      });
    } catch (error) {
      console.error('Error adding RC request:', error);
      handleFirestoreError(error, OperationType.WRITE, 'consumptionRCRequests');
    }
  };

  const handleUpdateRCStatus = async (request: ConsumptionRCRequest, newStatus: ConsumptionRCRequest['status'], rcNumber?: string) => {
    try {
      const requestRef = doc(db, 'consumptionRCRequests', request.id);
      const updateData: any = { status: newStatus };
      
      let observationText = '';
      if (newStatus === 'pending') observationText = 'Status alterado para Pendente.';
      if (newStatus === 'requested') observationText = 'Status alterado para Solicitado.';
      if (newStatus === 'returned') observationText = 'RC Devolvida para correção/ajuste.';
      if (newStatus === 'canceled') observationText = 'Solicitação de RC Cancelada.';
      if (newStatus === 'received') {
        observationText = `RC Recebida. Número: ${rcNumber}`;
        updateData.rcNumber = rcNumber;
      }
      
      const newObservation: RCHistoryEntry = {
        id: Math.random().toString(36).substr(2, 9),
        text: observationText,
        date: new Date().toLocaleString('pt-BR'),
        userName: currentUser?.name || 'Sistema'
      };
      
      const currentObservations = request.observations || [];
      updateData.observations = [...currentObservations, newObservation];
      
      await updateDoc(requestRef, updateData);
      
      // Update the viewing request to reflect changes immediately
      if (viewingRCRequest && viewingRCRequest.id === request.id) {
        setViewingRCRequest({ ...request, ...updateData });
      }
      
      showNotification('Status atualizado!');
    } catch (error) {
      console.error('Error updating RC status:', error);
      handleFirestoreError(error, OperationType.WRITE, `consumptionRCRequests/${request.id}`);
    }
  };

  const handleAddRCObservation = async (request: ConsumptionRCRequest) => {
    if (!newRCObservation.trim()) return;
    
    try {
      const requestRef = doc(db, 'consumptionRCRequests', request.id);
      const newObservation: RCHistoryEntry = {
        id: Math.random().toString(36).substr(2, 9),
        text: newRCObservation,
        date: new Date().toLocaleString('pt-BR'),
        userName: currentUser?.name || 'Sistema'
      };
      
      const updatedObservations = [...(request.observations || []), newObservation];
      
      await updateDoc(requestRef, {
        observations: updatedObservations
      });
      
      if (viewingRCRequest && viewingRCRequest.id === request.id) {
        setViewingRCRequest({ ...request, observations: updatedObservations });
      }
      
      setNewRCObservation('');
      showNotification('Observação adicionada!');
    } catch (error) {
      console.error('Error adding RC observation:', error);
      handleFirestoreError(error, OperationType.WRITE, `consumptionRCRequests/${request.id}`);
    }
  };

  const handleDeleteRCRequest = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'consumptionRCRequests', id));
      if (viewingRCRequest?.id === id) setViewingRCRequest(null);
      setRequestToDelete(null);
      showNotification('Solicitação excluída.');
    } catch (error) {
      console.error('Error deleting RC request:', error);
      handleFirestoreError(error, OperationType.DELETE, `consumptionRCRequests/${id}`);
    }
  };

  const drawPDFLogo = (doc: jsPDF, x: number, y: number, isDark: boolean = false) => {
    // Logo "Axia Energia" apenas em texto para o PDF conforme solicitado
    const primaryColor = isDark ? [255, 255, 255] : [0, 51, 255];
    const secondaryColor = isDark ? [200, 210, 255] : [100, 116, 139];

    // Nome da Marca com tipografia limpa e profissional
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('AXIA', x, y);
    
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text('E N E R G I A', x, y + 5);
  };

  const addWatermark = (doc: jsPDF) => {
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Bottom left corner
    const margin = 10;
    const logoWidth = 40; // Largura aproximada do logo enviado
    const logoHeight = 15; // Mantendo a proporção aproximada
    
    // Posição no canto inferior esquerdo
    const x = margin;
    const y = pageHeight - margin - logoHeight;
    
    try {
      if (typeof AXIA_LOGO_BASE64 !== 'undefined' && AXIA_LOGO_BASE64 && AXIA_LOGO_BASE64.length > 0) {
        doc.addImage(AXIA_LOGO_BASE64, 'PNG', x, y, logoWidth, logoHeight);
      } else {
        // Fallback para texto caso o base64 ainda não tenha sido inserido
        doc.setFontSize(8);
        doc.setTextColor(200, 200, 200);
        doc.text('AXIA ENERGIA', x, pageHeight - margin);
      }
    } catch (e) {
      console.warn('Erro ao adicionar marca d\'água de imagem:', e);
    }
  };

  const generateBulletinPDF = (bulletin: MeasurementBulletin) => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Header
    doc.setFillColor(248, 250, 252); // soft slate background
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setDrawColor(226, 232, 240); // bottom border
    doc.line(0, 40, pageWidth, 40);
    
    // Logo
    drawPDFLogo(doc, 20, 18);
    
    doc.setTextColor(15, 23, 42); // slate-900
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('BOLETIM DE MEDIÇÃO', pageWidth - 20, 20, { align: 'right' });
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Registro Oficial de Execução e Medição - Emissão: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth - 20, 28, { align: 'right' });

    // Content
    doc.setTextColor(51, 65, 85); // slate-700
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Informações Detalhadas do Boletim', 20, 50);

    const bulletinData = [
      ['Obra', bulletin.projectName, 'N° de Contrato', bulletin.contractNumber],
      ['N° RC de Consumo', bulletin.rcNumber, 'Item SAP', bulletin.sapItem],
      ['Instalação', bulletin.installation, 'Fornecedor', bulletin.supplier],
      ['Valor Medido', new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(bulletin.value || 0), 'Data da Medição', new Date(bulletin.date || Date.now()).toLocaleDateString('pt-BR')]
    ];

    autoTable(doc, {
      startY: 55,
      body: bulletinData,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 6 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 40, fillColor: [248, 250, 252] },
        1: { cellWidth: 90 },
        2: { fontStyle: 'bold', cellWidth: 40, fillColor: [248, 250, 252] },
        3: { cellWidth: 90 }
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY || 60;

    // Signatures - Positioned for landscape
    const signatureY = pageHeight - 45;
    doc.setDrawColor(203, 213, 225); // slate-300
    
    // Signature 1
    doc.line(40, signatureY, 120, signatureY);
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('Responsável Técnico / Fiscalização', 80, signatureY + 5, { align: 'center' });
    const projectOfBulletin = projects.find(p => p.id === bulletin.projectId);
    const responsibleName = projectOfBulletin?.responsible || '';
    if (responsibleName) {
      doc.setFont('helvetica', 'bold');
      doc.text((responsibleName || '').toUpperCase(), 80, signatureY + 10, { align: 'center' });
      doc.setFont('helvetica', 'normal');
    }
    
    // Signature 2
    doc.line(pageWidth - 120, signatureY, pageWidth - 40, signatureY);
    doc.text('Representante do Fornecedor', pageWidth - 80, signatureY + 5, { align: 'center' });

    // Photographic Report for the Bulletin
    const projectPhotos = photoReports.filter(p => p.projectId === bulletin.projectId).slice(0, 3);
    if (projectPhotos.length > 0) {
      doc.addPage('a4', 'landscape');
      addWatermark(doc);
      doc.setFillColor(0, 51, 255);
      doc.rect(0, 0, pageWidth, 20, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('ANEXO FOTOGRÁFICO DA MEDIÇÃO', pageWidth / 2, 13, { align: 'center' });

      let photoX = 20;
      let photoY = 30;
      const photoWidth = (pageWidth - 60) / 3;
      const photoHeight = 50;

      projectPhotos.forEach((photo, idx) => {
        try {
          const imgProps = doc.getImageProperties(photo.url);
          const aspectRatio = imgProps.width / imgProps.height;
          const photoWidth = (pageWidth - 60) / 3;
          const photoHeight = photoWidth / aspectRatio;

          // Adjust Y if photo height pushes caption off page
          if (photoY + photoHeight + 15 > pageHeight) {
            doc.addPage('a4', 'landscape');
            addWatermark(doc);
            doc.setFillColor(0, 51, 255);
            doc.rect(0, 0, pageWidth, 20, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('ANEXO FOTOGRÁFICO DA MEDIÇÃO (CONT.)', pageWidth / 2, 13, { align: 'center' });
            photoY = 30;
            photoX = 20;
          }

          doc.addImage(photo.url, 'JPEG', photoX, photoY, photoWidth, photoHeight);
          doc.setFontSize(8);
          doc.setTextColor(100, 116, 139);
          const splitCap = doc.splitTextToSize(photo.caption || 'Registro de Obra', photoWidth);
          doc.text(splitCap, photoX, photoY + photoHeight + 5);
          
          photoX += photoWidth + 10;
          if (photoX + photoWidth > pageWidth - 10) {
            photoX = 20;
            photoY += 70; // Fixed spacing for rows
          }
        } catch (e) {}
      });
    }

    // Footer & Watermark
    const allPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= allPages; i++) {
      doc.setPage(i);
      addWatermark(doc);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text('Este documento é um registro oficial de medição gerado pelo sistema AXIA ENERGIA.', pageWidth / 2, pageHeight - 15, { align: 'center' });
      doc.text('© 2026 AXIA ENERGIA - Todos os direitos reservados', pageWidth / 2, pageHeight - 10, { align: 'center' });
    }

    doc.save(`Boletim_${bulletin.projectName.replace(/\s+/g, '_')}_${bulletin.rcNumber}.pdf`);
    showNotification('Boletim PDF (Horizontal) gerado com sucesso!');
  };

  const generateProjectReport = (project: Project) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.line(0, 40, pageWidth, 40);
    
    // Logo
    drawPDFLogo(doc, 20, 18);
    
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('RELATÓRIO DE PROJETO', pageWidth - 20, 20, { align: 'right' });
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Documento Técnico de Acompanhamento - ${new Date().toLocaleDateString('pt-BR')}`, pageWidth - 20, 28, { align: 'right' });
    
    // Project Info
    doc.setTextColor(30, 41, 59); // slate-800
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text((project.name || '').toUpperCase(), 20, 55);
    
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.line(20, 60, pageWidth - 20, 60);
    
    // Details Table
    const projectAddendumsSum = addendums
      .filter(a => a.projectId === project.id)
      .reduce((sum, a) => sum + (Number(a.value) || 0), 0);
    const totalBudget = (Number(project.budget) || 0) + projectAddendumsSum;
    const balance = totalBudget - (project.spent || 0);
    const usagePercent = totalBudget > 0 ? (project.spent || 0) / totalBudget : 0;

    const detailsData = [
      ['Cliente', project.client],
      ['Responsável', project.responsible || project.creatorName || 'Sistema'],
      ['Contrato', project.contractNumber],
      ['Empresa Executora', project.executingCompany],
      ['Data de Início', project.startDate],
      ['Previsão de Término', project.endDate],
      ['Status', 
        project.status === 'preliminary-study' ? 'Estudo Preliminar' :
        project.status === 'in-progress' ? 'Em Andamento' : 
        project.status === 'finished' ? 'Concluído' : 
        project.status === 'paused' ? 'Paralisado' : 'Não Iniciado'
      ],
      ['Orçamento Base', new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(project.budget) || 0)],
      ['Total de Aditivos', new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(projectAddendumsSum)],
      ['Orçamento Total Geral', new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalBudget)],
      ['Total Medido', new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(project.spent || 0)],
      ['Saldo Disponível', new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(balance)],
      ['Percentual Executado', `${Math.round(usagePercent * 100)}%`]
    ];
    
    autoTable(doc, {
      startY: 70,
      head: [['Campo', 'Informação']],
      body: detailsData,
      theme: 'striped',
      headStyles: { fillColor: [0, 51, 255], textColor: [255, 255, 255] },
      styles: { fontSize: 10, cellPadding: 5 }
    });
    
    // Description
    const finalY = (doc as any).lastAutoTable.finalY || 70;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Descrição do Projeto', 20, finalY + 15);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const splitDescription = doc.splitTextToSize(project.description, pageWidth - 40);
    doc.text(splitDescription, 20, finalY + 25);

    let currentY = finalY + 25 + (splitDescription.length * 5) + 10;

    // Measurements Table
    const projectMeasurements = measurements.filter(m => m.projectId === project.id);
    if (projectMeasurements.length > 0) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Histórico de Medições', 20, currentY);
      
      const measurementData = projectMeasurements.map(m => [
        new Date(m.date).toLocaleDateString('pt-BR'),
        m.description,
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(m.value),
        m.status === 'paid' ? 'Pago' : m.status === 'approved' ? 'Aprovado' : 'Pendente'
      ]);

      autoTable(doc, {
        startY: currentY + 5,
        head: [['Data', 'Descrição', 'Valor', 'Status']],
        body: measurementData,
        theme: 'grid',
        headStyles: { fillColor: [0, 51, 255], textColor: [255, 255, 255] },
        styles: { fontSize: 9 }
      });
      
      currentY = (doc as any).lastAutoTable.finalY + 15;
    }

    // Status Updates Table
    const projectUpdates = statusUpdates.filter(s => s.projectId === project.id);
    if (projectUpdates.length > 0) {
      if (currentY > doc.internal.pageSize.getHeight() - 40) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Histórico de Atualizações', 20, currentY);

      const updateData = projectUpdates.map(s => [
        new Date(s.date).toLocaleDateString('pt-BR'),
        s.message,
        s.author
      ]);

      autoTable(doc, {
        startY: currentY + 5,
        head: [['Data', 'Atualização', 'Autor']],
        body: updateData,
        theme: 'grid',
        headStyles: { fillColor: [0, 51, 255], textColor: [255, 255, 255] },
        styles: { fontSize: 9 },
        columnStyles: {
          1: { cellWidth: 100 }
        }
      });
      currentY = (doc as any).lastAutoTable.finalY + 15;
    }

    // Photographic Report Section
    const projectPhotos = photoReports.filter(p => p.projectId === project.id);
    if (projectPhotos.length > 0) {
      if (currentY > doc.internal.pageSize.getHeight() - 40) {
        doc.addPage();
        currentY = 20;
      } else {
        currentY += 10;
      }

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Relatório Fotográfico', 20, currentY);
      currentY += 10;

      projectPhotos.forEach((photo, index) => {
        try {
          const imgProps = doc.getImageProperties(photo.url);
          const aspectRatio = imgProps.width / imgProps.height;
          const imgWidth = pageWidth - 40;
          const imgHeight = imgWidth / aspectRatio;
          
          const estimatedHeight = imgHeight + 25; // Image + Caption space

          // Check if we need a new page for the photo
          if (currentY + estimatedHeight > doc.internal.pageSize.getHeight()) {
            doc.addPage();
            currentY = 20;
          }

          // Add the photo maintaining aspect ratio
          doc.addImage(photo.url, 'JPEG', 20, currentY, imgWidth, imgHeight);
          currentY += imgHeight + 5;

          // Add the caption
          doc.setFontSize(9);
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(100, 116, 139);
          const captionText = photo.caption || 'Sem descrição';
          const splitCaption = doc.splitTextToSize(captionText, pageWidth - 40);
          doc.text(splitCaption, 20, currentY);
          
          currentY += (splitCaption.length * 5) + 15;
        } catch (err) {
          console.error('Error adding image to PDF:', err);
          doc.setFontSize(9);
          doc.setTextColor(255, 0, 0);
          doc.text('[Erro ao carregar imagem]', 20, currentY);
          currentY += 10;
        }
      });
    }
    
    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      addWatermark(doc);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(`Página ${i} de ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
      doc.text('© 2026 AXIA ENERGIA - Todos os direitos reservados', pageWidth / 2, doc.internal.pageSize.getHeight() - 5, { align: 'center' });
    }
    
    doc.save(`Relatorio_${project.name.replace(/\s+/g, '_')}.pdf`);
    showNotification('Relatório PDF gerado com sucesso!');
  };

  const handleGenerateGeneralReport = () => {
    setIsGeneratingReport(true);
    setTimeout(() => {
      try {
        generateGeneralReport();
      } finally {
        setIsGeneratingReport(false);
      }
    }, 100);
  };

  const generateGeneralReport = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    if (projects.length === 0) {
      showNotification('Nenhum projeto encontrado para gerar relatório.');
      return;
    }

    projectsWithTotals.forEach((project, index) => {
      if (index > 0) {
        doc.addPage();
      }
      addWatermark(doc);

      // Header representing company brand
      doc.setFillColor(248, 250, 252);
      doc.rect(0, 0, pageWidth, 35, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.line(0, 35, pageWidth, 35);
      
      // Logo
      drawPDFLogo(doc, 20, 15);
      
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('RELATÓRIO GERAL DE OBRAS', pageWidth - 15, 15, { align: 'right' });
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`OBRA: ${(project.name || '').toUpperCase()}`, pageWidth - 15, 22, { align: 'right' });
      doc.text(`Emissão: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth - 15, 27, { align: 'right' });
      
      // Project Info Section
      doc.setTextColor(51, 65, 85); // slate-700
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Informações Gerais', 15, 45);
      
      const generalInfo = [
        ['Cliente', project.client],
        ['Responsável', project.responsible || project.creatorName || 'Sistema'],
        ['Contrato', project.contractNumber],
        ['Localidade', project.location],
        ['Empresa Executora', project.executingCompany],
        ['Status', getStatusLabel(project.status)],
        ['Progresso', `${(project.progress || 0)}%`],
        ['Data de Início', project.startDate],
        ['Previsão de Término', project.endDate]
      ];

      autoTable(doc, {
        startY: 50,
        body: generalInfo,
        theme: 'grid',
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } }
      });

      // Description
      const finalYInfo = (doc as any).lastAutoTable.finalY || 50;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Descrição do Projeto', 15, finalYInfo + 10);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const splitDescription = doc.splitTextToSize(project.description, pageWidth - 30);
      doc.text(splitDescription, 15, finalYInfo + 17);
      
      const descriptionHeight = splitDescription.length * 5;
      const financialStartY = finalYInfo + 20 + descriptionHeight;

      // Financial Section
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Resumo Financeiro', 15, financialStartY);
      
      const financialInfo = [
        ['Orçamento Base', new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(project.budget) || 0)],
        ['Total de Aditivos', new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(project.addendumsSum || 0)],
        ['Orçamento Total Geral', new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(project.totalBudget || 0)],
        ['Total Medido', new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(project.spent || 0)],
        ['Saldo Disponível', new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(project.balance || 0)],
        ['Utilização', `${Math.round(project.usage)}%`]
      ];

      autoTable(doc, {
        startY: financialStartY + 5,
        body: financialInfo,
        theme: 'striped',
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } }
      });

      // Recent Measurements
      const finalYFinancial = (doc as any).lastAutoTable.finalY || financialStartY + 5;
      const projectMeasurements = measurements.filter(m => m.projectId === project.id).slice(0, 5);
      
      if (projectMeasurements.length > 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Últimas Medições', 15, finalYFinancial + 10);
        
        const measurementData = projectMeasurements.map(m => [
          m.date || '',
          m.description || '',
          new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(m.value || 0),
          m.status === 'paid' ? 'Pago' : m.status === 'approved' ? 'Aprovado' : 'Pendente'
        ]);

        autoTable(doc, {
          startY: finalYFinancial + 15,
          head: [['Data', 'Descrição', 'Valor', 'Status']],
          body: measurementData,
          theme: 'grid',
          headStyles: { fillColor: [0, 51, 255] },
          styles: { fontSize: 9, cellPadding: 2 }
        });
      }

      // Recent Updates
      const finalYMeasurements = (doc as any).lastAutoTable.finalY || finalYFinancial + 10;
      const projectUpdates = statusUpdates.filter(u => u.projectId === project.id).slice(0, 5);
      
      if (projectUpdates.length > 0) {
        // Check if we need a new page for updates if they are too many
        if (finalYMeasurements + 30 > pageHeight - 20) {
          doc.addPage();
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text('Histórico de Atualizações (Cont.)', 15, 20);
          
          const updateData = projectUpdates.map(u => [u.date, u.author, u.message]);
          autoTable(doc, {
            startY: 25,
            head: [['Data', 'Autor', 'Mensagem']],
            body: updateData,
            theme: 'grid',
            headStyles: { fillColor: [0, 51, 255] },
            styles: { fontSize: 9, cellPadding: 2 }
          });
        } else {
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text('Histórico de Atualizações', 15, finalYMeasurements + 10);
          
          const updateData = projectUpdates.map(u => [u.date, u.author, u.message]);
          autoTable(doc, {
            startY: finalYMeasurements + 15,
            head: [['Data', 'Autor', 'Mensagem']],
            body: updateData,
            theme: 'grid',
            headStyles: { fillColor: [0, 51, 255] },
            styles: { fontSize: 9, cellPadding: 2 }
          });
        }
      }
      
      const projectPhotos = photoReports.filter(p => p.projectId === project.id).slice(0, 4);
      if (projectPhotos.length > 0) {
        const lastTable = (doc as any).lastAutoTable;
        let finalYPhotos = lastTable ? lastTable.finalY : finalYMeasurements + 15;
        let cPY = 0;
        
        if (finalYPhotos + 40 > pageHeight - 30) {
          doc.addPage();
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text('Relatório Fotográfico', 15, 20);
          cPY = 30;
        } else {
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text('Relatório Fotográfico', 15, finalYPhotos + 15);
          cPY = finalYPhotos + 22;
        }

        projectPhotos.forEach((photo) => {
          try {
            const imgProps = doc.getImageProperties(photo.url);
            const aspectRatio = imgProps.width / imgProps.height;
            const imgWidth = pageWidth - 30;
            const imgHeight = imgWidth / aspectRatio;

            if (cPY + imgHeight + 15 > pageHeight - 20) {
              doc.addPage();
              cPY = 20;
            }

            doc.addImage(photo.url, 'JPEG', 15, cPY, imgWidth, imgHeight);
            cPY += imgHeight + 5;

            doc.setFontSize(8);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(148, 163, 184);
            const cap = photo.caption || 'Sem descrição';
            const sCap = doc.splitTextToSize(cap, pageWidth - 30);
            doc.text(sCap, 15, cPY);
            cPY += (sCap.length * 4) + 8;
          } catch (e) {}
        });
      }
    });
    
    // Footer for all pages
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      addWatermark(doc);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(`Página ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      doc.text('© 2026 AXIA ENERGIA - Relatório Gerencial Detalhado', pageWidth / 2, pageHeight - 5, { align: 'center' });
    }
    
    doc.save(`Relatorio_Detalhado_Obras_${new Date().toISOString().split('T')[0]}.pdf`);
    showNotification('Relatório Detalhado PDF gerado com sucesso!');
  };

  const handleUpdateAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showNotification('A imagem é muito grande. Limite de 5MB para processamento.');
      return;
    }

    try {
      showNotification('Processando foto de perfil...');
      const compressedBase64 = await compressImage(file, 400, 400, 0.7);
      
      const updatedUser = { ...currentUser, avatar: compressedBase64 };
      await setDoc(doc(db, 'users', currentUser.id), updatedUser);
      setCurrentUser(updatedUser);
      showNotification('Foto de perfil atualizada!');
    } catch (error) {
      console.error('Error updating avatar:', error);
      handleFirestoreError(error, OperationType.WRITE, `users/${currentUser.id}`);
    }
  };

  const handleUpdateUserAccess = async (userId: string, newAccessLevel: string) => {
    setIsUpdatingUser(userId);
    try {
      await updateDoc(doc(db, 'users', userId), { accessLevel: newAccessLevel });
      showNotification('Nível de acesso atualizado com sucesso!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${userId}`);
    } finally {
      setIsUpdatingUser(null);
    }
  };

  const handleAddStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStatusUpdate.projectId || !newStatusUpdate.message) {
      showNotification('Por favor, preencha todos os campos.');
      return;
    }

    try {
      const updateId = `su-${Date.now()}`;
      const update: StatusUpdate = {
        id: updateId,
        projectId: newStatusUpdate.projectId,
        date: new Date().toLocaleString('pt-BR'),
        message: newStatusUpdate.message,
        author: currentUser.name
      };

      await setDoc(doc(db, 'statusUpdates', updateId), update);
      setNewStatusUpdate({ projectId: '', message: '' });
      showNotification('Atualização de status registrada!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'statusUpdates');
    }
  };

  const handleDeleteStatusUpdate = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'statusUpdates', id));
      showNotification('Atualização excluída com sucesso.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `statusUpdates/${id}`);
    }
  };

  const handleUpload = async () => {
    if (!selectedProject || !selectedDate) {
      showNotification('Por favor, selecione um projeto e uma data.');
      return;
    }

    setIsUploadingReport(true);
    try {
      const reportId = `rep-${Date.now()}`;
      const project = projects.find(p => p.name === selectedProject);
      
      const newReport: WeeklyReport = {
        id: reportId,
        projectId: project?.id || '1',
        projectName: selectedProject,
        weekEnding: selectedDate,
        status: 'submitted',
        fileName: `Relatorio_${selectedProject.replace(/\s+/g, '_')}_${selectedDate}.pdf`,
        fileSize: '1.2 MB',
        uploadedAt: new Date().toLocaleString(),
        uploadedBy: currentUser.name,
      };

      await setDoc(doc(db, 'reports', reportId), newReport);
      showNotification('Relatório enviado com sucesso!');
      setSelectedProject('');
      setSelectedDate('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'reports');
    } finally {
      setIsUploadingReport(false);
    }
  };

  const handleImageClick = (projectId: string) => {
    setImageEditingProjectId(projectId);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && imageEditingProjectId) {
      if (file.size > 5 * 1024 * 1024) {
        showNotification('A imagem é muito grande. Limite de 5MB para processamento.');
        return;
      }

      try {
        showNotification('Processando imagem da obra...');
        const compressedBase64 = await compressImage(file, 1200, 600, 0.6);
        
        // Update Firestore
        const projectRef = doc(db, 'projects', imageEditingProjectId);
        await updateDoc(projectRef, { image: compressedBase64 });

        showNotification('Imagem da obra atualizada com sucesso!');
        setImageEditingProjectId(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (error) {
        console.error('Error updating project image:', error);
        showNotification('Erro ao processar a imagem.');
        setImageEditingProjectId(null);
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'reports', id));
      showNotification('Relatório excluído com sucesso.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `reports/${id}`);
    }
  };

  const handleDownload = (fileName: string) => {
    showNotification(`Iniciando download de: ${fileName}`);
    console.log(`Iniciando download de: ${fileName}`);
  };

  const getStatusColor = (status: Project['status']) => {
    switch (status) {
      case 'not-started': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'preliminary-study': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'in-progress': return 'bg-green-100 text-green-700 border-green-200';
      case 'finished': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'paused': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getStatusLabel = (status: Project['status']) => {
    switch (status) {
      case 'not-started': return 'Não Iniciada';
      case 'preliminary-study': return 'Estudo Preliminar';
      case 'in-progress': return 'Em Andamento';
      case 'paused': return 'Paralisada';
      case 'finished': return 'Finalizada';
      default: return status;
    }
  };

  const getReportStatusColor = (status: WeeklyReport['status']) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-700 border-green-200';
      case 'submitted': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'draft': return 'bg-slate-100 text-slate-700 border-slate-200';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  if (!isLoggedIn) {
    return <LoginPage 
      onLogin={(user) => {
        setCurrentUser(user);
        setIsLoggedIn(true);
      }} 
      onRegister={() => {
        showNotification('Conta criada com sucesso! Agora você pode fazer login.');
      }}
    />;
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden transition-colors duration-300">
      {quotaExceeded && (
        <div className="fixed top-0 left-0 right-0 z-[200] bg-amber-500 text-slate-900 px-4 py-3 flex items-center justify-between shadow-2xl border-b border-amber-600/20 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <AlertCircle size={20} className="text-amber-900" />
            </div>
            <div>
              <p className="text-[13px] font-black uppercase tracking-tight leading-none mb-1">Limite de Uso Atingido (Quota do Google)</p>
              <p className="text-[11px] font-medium opacity-80 leading-tight">O projeto atingiu o limite gratuito de leituras diárias do Firestore. Os dados em tempo real podem não atualizar até o reset automático do Google (amanhã).</p>
            </div>
          </div>
          <button 
            onClick={() => {
              localStorage.removeItem('firestore_quota_extrapolated');
              setQuotaExceeded(false);
              window.location.reload();
            }}
            className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex-shrink-0 ml-4"
          >
            Tentar Reconectar
          </button>
        </div>
      )}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleFileChange} 
      />
      {/* Notification Toast */}
      {/* Lightbox Modal */}
      <AnimatePresence>
        {selectedPhotoUrl && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 md:p-12"
            onClick={() => setSelectedPhotoUrl(null)}
          >
            <button 
              className="absolute top-6 right-6 text-white/70 hover:text-white transition-colors p-2"
              onClick={() => setSelectedPhotoUrl(null)}
            >
              <X size={32} />
            </button>
            <motion.img 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={selectedPhotoUrl} 
              alt="Full view" 
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              referrerPolicy="no-referrer"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
            className="fixed bottom-8 left-1/2 z-50 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-white/10 backdrop-blur-md"
          >
            <div className="w-2 h-2 rounded-full bg-axia-primary animate-pulse" />
            <span className="text-sm font-bold">{notification}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal for Deletion */}
      <AnimatePresence>
        {projectToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800"
            >
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-2xl font-display font-bold text-slate-900 dark:text-white text-center mb-2">Excluir Obra?</h3>
              <p className="text-slate-500 dark:text-slate-400 text-center mb-8">
                Tem certeza que deseja excluir a obra <span className="font-bold text-slate-900 dark:text-white">"{projectToDelete.name}"</span>? Esta ação é irreversível e apagará todos os dados relacionados (medições, anexos e relatórios).
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setProjectToDelete(null)}
                  className="flex-1 px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => handleDeleteProject(projectToDelete.id)}
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Overlay for mobile sidebar */}
      <AnimatePresence>
        {isMobile && isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[25] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ 
          width: isSidebarOpen ? 260 : (isMobile ? 0 : 80),
          x: isMobile && !isSidebarOpen ? -260 : 0
        }}
        className={`bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-30 transition-colors duration-300 fixed lg:relative h-full`}
      >
        <div className="p-6 flex items-center justify-between">
          {isSidebarOpen || isMobile ? (
            <div className="overflow-hidden whitespace-nowrap">
              <h1 className="text-2xl font-display font-black tracking-tighter text-axia-primary">AXIA</h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-axia-secondary font-bold -mt-1">ENERGIA</p>
            </div>
          ) : (
            <div className="w-10 h-10 bg-axia-primary rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg shadow-axia-primary/20 mx-auto">
              <span className="text-white font-black text-xl">AX</span>
            </div>
          )}
          {isMobile && isSidebarOpen && (
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400">
              <X size={20} />
            </button>
          )}
        </div>

        <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
          <NavItem 
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => { setActiveTab('dashboard'); if(isMobile) setIsSidebarOpen(false); }}
            collapsed={!isSidebarOpen && !isMobile}
          />
          <NavItem 
            icon={<HardHat size={20} />} 
            label="Projetos" 
            active={activeTab === 'projects'} 
            onClick={() => { setActiveTab('projects'); if(isMobile) setIsSidebarOpen(false); }}
            collapsed={!isSidebarOpen && !isMobile}
          />

          <NavItem 
            icon={<TrendingUp size={20} />} 
            label="Planejamento" 
            active={activeTab === 'planning'} 
            onClick={() => { setActiveTab('planning'); if(isMobile) setIsSidebarOpen(false); }}
            collapsed={!isSidebarOpen && !isMobile}
          />
          <NavItem 
            icon={<Receipt size={20} />} 
            label="Medições" 
            active={activeTab === 'measurements'} 
            onClick={() => { setActiveTab('measurements'); if(isMobile) setIsSidebarOpen(false); }}
            collapsed={!isSidebarOpen && !isMobile}
          />
          <NavItem 
            icon={<ClipboardList size={20} />} 
            label="Boletim de Medição" 
            active={activeTab === 'bulletin'} 
            onClick={() => { setActiveTab('bulletin'); if(isMobile) setIsSidebarOpen(false); }}
            collapsed={!isSidebarOpen && !isMobile}
          />
          <NavItem 
            icon={<ShieldCheck size={20} />} 
            label="Controle de RC" 
            active={activeTab === 'rc-control'} 
            onClick={() => { setActiveTab('rc-control'); if(isMobile) setIsSidebarOpen(false); }}
            collapsed={!isSidebarOpen && !isMobile}
          />
          <NavItem 
            icon={<MapPin size={20} />} 
            label="Controle de viagens" 
            active={activeTab === 'travel-control'} 
            onClick={() => { setActiveTab('travel-control'); if(isMobile) setIsSidebarOpen(false); }}
            collapsed={!isSidebarOpen && !isMobile}
          />
          <NavItem 
            icon={<BarChart3 size={20} />} 
            label="Relatórios" 
            active={activeTab === 'reports'} 
            onClick={() => { setActiveTab('reports'); if(isMobile) setIsSidebarOpen(false); }}
            collapsed={!isSidebarOpen && !isMobile}
          />
          <NavItem 
            icon={<History size={20} />} 
            label="Atualizações" 
            active={activeTab === 'updates'} 
            onClick={() => { setActiveTab('updates'); if(isMobile) setIsSidebarOpen(false); }}
            collapsed={!isSidebarOpen && !isMobile}
          />
        </nav>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
          <NavItem 
            icon={<Settings size={20} />} 
            label="Configurações" 
            active={activeTab === 'settings'} 
            onClick={() => { setActiveTab('settings'); if(isMobile) setIsSidebarOpen(false); }}
            collapsed={!isSidebarOpen && !isMobile}
          />
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
        {/* Header */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 lg:px-8 z-20 transition-colors duration-300 sticky top-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400"
            >
              <Menu size={20} />
            </button>
            <div className="lg:hidden flex items-center gap-1.5">
               <h1 className="text-xl font-display font-black tracking-tighter text-axia-primary">AXIA</h1>
               <div className="w-1.5 h-1.5 bg-axia-secondary rounded-full animate-pulse" />
            </div>
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Buscar projetos, tarefas..." 
                className="pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-axia-primary/20 w-64 transition-all dark:text-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 lg:gap-4">
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 dark:text-slate-400 transition-colors"
              title={isDarkMode ? "Ativar Modo Claro" : "Ativar Modo Escuro"}
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button className="relative p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 dark:text-slate-400">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-axia-secondary rounded-full border-2 border-white dark:border-slate-900"></span>
            </button>
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 mx-2"></div>
            <button 
              onClick={() => setShowProfile(true)}
              className="flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 p-1.5 rounded-xl transition-colors text-left"
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold dark:text-white">{currentUser?.name || ''}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{currentUser?.role || ''}</p>
              </div>
              <img 
                src={currentUser?.avatar || 'https://picsum.photos/seed/user/200/200'} 
                alt="Profile" 
                className="w-10 h-10 rounded-full border-2 border-axia-primary/10"
                referrerPolicy="no-referrer"
              />
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-4 py-6 lg:p-8 pb-24 lg:pb-8">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-display font-bold text-slate-900 dark:text-white">Dashboard de Obras</h2>
                    <p className="text-slate-500 dark:text-slate-400">Bem-vindo de volta. Aqui está o resumo das suas operações.</p>
                  </div>
                  <button 
                    onClick={() => {
                      setActiveTab('projects');
                      setShowAddProject(true);
                    }}
                    className="bg-axia-primary text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 hover:bg-axia-primary/90 transition-colors shadow-lg shadow-axia-primary/20"
                  >
                    <Plus size={20} />
                    Nova Obra
                  </button>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-6">
                  <StatCard 
                    title="Não Iniciadas" 
                    value={statusCounts['not-started'].toString()} 
                    change="Aguardando início" 
                    icon={<Clock className="text-slate-400" />} 
                    color="slate"
                    onClickDetails={() => setActiveTab('projects')}
                    onClickReport={handleGenerateGeneralReport}
                    isGeneratingReport={isGeneratingReport}
                  />
                  <StatCard 
                    title="Estudo Preliminar" 
                    value={statusCounts['preliminary-study'].toString()} 
                    change="Fase inicial" 
                    icon={<Search className="text-amber-500" />} 
                    color="orange"
                    onClickDetails={() => setActiveTab('projects')}
                    onClickReport={handleGenerateGeneralReport}
                    isGeneratingReport={isGeneratingReport}
                  />
                  <StatCard 
                    title="Em Andamento" 
                    value={statusCounts['in-progress'].toString()} 
                    change="Execução ativa" 
                    icon={<HardHat className="text-axia-primary" />} 
                    color="blue"
                    onClickDetails={() => setActiveTab('projects')}
                    onClickReport={handleGenerateGeneralReport}
                    isGeneratingReport={isGeneratingReport}
                  />
                   <StatCard 
                    title="RC Pendentes" 
                    value={consumptionRCRequests.filter(r => r.status !== 'received' && r.status !== 'canceled').length.toString()} 
                    secondaryValue={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPendingRCValue)}
                    change="Controle de RC" 
                    icon={<ShieldCheck className="text-axia-secondary" />} 
                    color="orange"
                    onClickDetails={() => setActiveTab('rc-control')}
                    onClickReport={handleGenerateGeneralReport}
                    isGeneratingReport={isGeneratingReport}
                  >
                    <div className="space-y-1.5">
                      {consumptionRCRequests
                        .filter(r => r.status !== 'received' && r.status !== 'canceled')
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .slice(0, 3)
                        .map(rc => (
                          <div key={rc.id} className="flex items-center justify-between gap-2 overflow-hidden">
                            <span className="text-[9px] font-bold text-slate-600 dark:text-slate-400 truncate">{rc.projectName}</span>
                            <span className="text-[9px] font-black text-axia-primary shrink-0">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(rc.value || 0)}
                            </span>
                          </div>
                      ))}
                      {consumptionRCRequests.filter(r => r.status !== 'received' && r.status !== 'canceled').length > 3 && (
                        <p className="text-[8px] font-bold text-slate-400 uppercase text-center mt-1">
                          + {consumptionRCRequests.filter(r => r.status !== 'received' && r.status !== 'canceled').length - 3} outras pendentes
                        </p>
                      )}
                    </div>
                  </StatCard>
                  <StatCard 
                    title="Finalizadas" 
                    value={statusCounts['finished'].toString()} 
                    change="Concluídas com sucesso" 
                    icon={<CheckCircle2 className="text-axia-accent" />} 
                    color="green"
                    onClickDetails={() => setActiveTab('projects')}
                    onClickReport={handleGenerateGeneralReport}
                    isGeneratingReport={isGeneratingReport}
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Projects per Client Chart */}
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2 dark:text-white">
                      <User size={20} className="text-axia-primary" />
                      Obras por Cliente
                    </h3>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={projectsByClientData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {projectsByClientData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          />
                          <Legend verticalAlign="bottom" height={36}/>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Budget Spent per Client Chart */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                      <DollarSign size={20} className="text-axia-accent" />
                      Orçamento Total por Cliente (R$)
                    </h3>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={budgetByClientData} layout="vertical" margin={{ left: 40, right: 40 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                          <XAxis type="number" hide />
                          <YAxis 
                            dataKey="name" 
                            type="category" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 12, fontWeight: 600, fill: '#64748b' }}
                            width={100}
                          />
                          <Tooltip 
                            cursor={{ fill: '#f8fafc' }}
                            formatter={(value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          />
                          <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={30}>
                            {budgetByClientData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Planejamento Anual do Fiscal (Cronograma Anual) */}
                <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border-2 border-axia-primary/30 dark:border-axia-primary/45 shadow-xl shadow-axia-primary/5 overflow-hidden space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-axia-primary/10 flex items-center justify-center text-axia-primary shadow-inner">
                        <TrendingUp size={24} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Planejamento Anual do Fiscal</h3>
                          <span className="px-2.5 py-1 bg-axia-primary/10 text-axia-primary text-[10px] font-black uppercase tracking-widest rounded-full animate-pulse border border-axia-primary/20">Cronograma Destaque</span>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold mt-0.5">Cronograma de obras e atividades anuais do fiscal</p>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 shadow-inner">
                        <button
                          onClick={() => setFiscalPlanningViewScale('month')}
                          className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                            fiscalPlanningViewScale === 'month' 
                              ? 'bg-white dark:bg-slate-700 text-axia-primary shadow-sm' 
                              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                          }`}
                        >
                          Meses
                        </button>
                        <button
                          onClick={() => setFiscalPlanningViewScale('week')}
                          className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                            fiscalPlanningViewScale === 'week' 
                              ? 'bg-white dark:bg-slate-700 text-axia-primary shadow-sm' 
                              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                          }`}
                        >
                          Semanas
                        </button>
                      </div>

                      <select 
                        value={fiscalPlanningViewMonths}
                        onChange={(e) => setFiscalPlanningViewMonths(e.target.value === 'auto' ? 'auto' : Number(e.target.value))}
                        className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-4 focus:ring-axia-primary/10 transition-all cursor-pointer shadow-sm"
                      >
                        <option value="auto">Automático (Todas)</option>
                        <option value="6">06 Meses</option>
                        <option value="12">12 Meses</option>
                        <option value="18">18 Meses</option>
                        <option value="24">24 Meses</option>
                        <option value="36">36 Meses</option>
                      </select>

                      <button 
                        onClick={() => {
                          setIsAddingFiscalPlanningActivity(true);
                          setEditingFiscalPlanningActivity(null);
                          setUseSpecificFiscalDates(false);
                          setNewFiscalPlanningActivity({
                            projectId: '',
                            name: '',
                            startMonth: new Date().getMonth(),
                            startYear: new Date().getFullYear(),
                            endMonth: (new Date().getMonth() + 1) % 12,
                            endYear: new Date().getMonth() === 11 ? new Date().getFullYear() + 1 : new Date().getFullYear(),
                            startDate: '',
                            endDate: '',
                            color: '#0033FF',
                            order: fiscalPlanningActivities.length,
                            category: '',
                            description: '',
                            isHidden: false
                          });
                        }}
                        className="bg-axia-primary text-white px-5 py-2.5 rounded-xl font-bold text-xs hover:shadow-lg hover:shadow-axia-primary/25 transition-all flex items-center gap-2 shadow-md shadow-axia-primary/10"
                      >
                        <Plus size={16} />
                        Nova Atividade do Fiscal
                      </button>
                    </div>
                  </div>

                  <div className="relative border border-slate-100 dark:border-slate-800 rounded-[2rem] overflow-hidden bg-slate-50/10 dark:bg-slate-800/15 shadow-inner">
                    <div className="flex">
                      {/* Left Header - Activities column */}
                      <div className="w-[280px] flex-shrink-0 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 z-20">
                        <div className="h-16 border-b border-slate-200 dark:border-slate-700 flex flex-col justify-center px-6 bg-slate-50/50 dark:bg-slate-800/20">
                          <span className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest italic">Obras & Atividades</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Planejamento do Fiscal</span>
                        </div>
                        {fiscalPlanningActivities.length === 0 ? (
                          <div className="py-12 px-6 text-center text-slate-400 text-xs italic">
                            Nenhuma atividade cadastrada. Toque em "Nova Atividade" para iniciar o cronograma.
                          </div>
                        ) : (
                          fiscalPlanningActivities.map((activity) => (
                            <div 
                              key={activity.id} 
                              className="h-14 border-b border-slate-100 dark:border-slate-800 flex items-center px-4 group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                              onClick={() => {
                                setEditingFiscalPlanningActivity(activity);
                                setIsAddingFiscalPlanningActivity(true);
                              }}
                            >
                              <div className="flex flex-col truncate w-full pr-1">
                                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 leading-tight group-hover:text-axia-primary transition-colors truncate">
                                  {activity.name}
                                </span>
                                {activity.category && (
                                  <span className="text-[8px] font-bold text-axia-primary/70 uppercase tracking-widest leading-none mt-1">
                                    {activity.category}
                                  </span>
                                )}
                              </div>
                              <div className="ml-auto opacity-0 group-hover:opacity-100 flex items-center gap-1">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleFiscalPlanningActivityVisibility(activity);
                                  }}
                                  className={`p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${activity.isHidden ? 'text-amber-500' : 'text-slate-400'}`}
                                  title={activity.isHidden ? "Mostrar atividade" : "Ocultar atividade"}
                                >
                                  {activity.isHidden ? <Eye size={12} /> : <EyeOff size={12} />}
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                        {fiscalPlanningActivities.length > 0 && (
                          <div className="h-14 bg-slate-50/30 dark:bg-slate-800/10" />
                        )}
                      </div>

                      {/* Right Header/Bars - Scrollable Gantt */}
                      <div className="flex-grow overflow-x-auto overflow-y-hidden border-l border-slate-200 dark:border-slate-700 custom-scrollbar">
                        <div className="relative" style={{ width: fiscalPlanningTimelineData ? fiscalPlanningTimelineData.numMonths * (fiscalPlanningViewScale === 'month' ? 100 : 160) : '100%' }}>
                          {/* Year / Calendar Row Headers */}
                          <div className="bg-slate-50/80 dark:bg-slate-800/80 sticky top-0 z-30">
                            <div className="h-6 flex border-b border-slate-200 dark:border-slate-700">
                              {fiscalPlanningTimelineData?.years.map((y, i) => (
                                <div 
                                  key={`year-${y.year}-${i}`} 
                                  className="flex items-center justify-center border-r border-slate-200 dark:border-slate-700 text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-100/50 dark:bg-slate-900/50"
                                  style={{ width: y.monthsCount * (fiscalPlanningViewScale === 'month' ? 100 : 160) }}
                                >
                                  {y.year}
                                </div>
                              ))}
                            </div>
                            <div className={`${fiscalPlanningViewScale === 'month' ? 'h-10' : 'h-14'} flex border-b border-slate-200 dark:border-slate-700`}>
                              {fiscalPlanningTimelineData && fiscalPlanningTimelineData.visibleMonths.map((m) => {
                                const monthNamesShort = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
                                return (
                                  <div 
                                    key={`month-header-fiscal-${m.absMonth}`} 
                                    className="flex flex-col items-center justify-center border-r border-slate-100 dark:border-slate-800 text-[9px] font-bold text-slate-400 group relative"
                                    style={{ width: fiscalPlanningViewScale === 'month' ? 100 : 160, minWidth: fiscalPlanningViewScale === 'month' ? 100 : 160 }}
                                  >
                                    <div className="flex-grow flex items-center justify-center w-full">
                                      {monthNamesShort[m.month]}
                                    </div>
                                    {fiscalPlanningViewScale === 'week' && (
                                      <div className="flex w-full border-t border-slate-100 dark:border-slate-800 h-6">
                                        {[1, 2, 3, 4].map(w => (
                                          <div key={`w-${w}`} className="flex-1 border-r last:border-r-0 border-slate-50 dark:border-slate-800/50 flex items-center justify-center text-[7px] font-black text-slate-300">
                                            S{w}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Bars & Grid Lines */}
                          <div className="relative min-h-[160px]">
                            {/* Grid vertical markers */}
                            <div className="absolute inset-0 flex pointer-events-none">
                              {fiscalPlanningTimelineData && fiscalPlanningTimelineData.visibleMonths.map((m) => (
                                <div 
                                  key={`grid-fiscal-${m.absMonth}`} 
                                  className="border-r border-slate-200 dark:border-slate-700 h-full flex" 
                                  style={{ width: fiscalPlanningViewScale === 'month' ? 100 : 160, minWidth: fiscalPlanningViewScale === 'month' ? 100 : 160 }}
                                >
                                  {fiscalPlanningViewScale === 'week' && (
                                    <>
                                      <div className="flex-1 border-r border-slate-100 dark:border-slate-800/30 h-full" />
                                      <div className="flex-1 border-r border-slate-100 dark:border-slate-800/30 h-full" />
                                      <div className="flex-1 border-r border-slate-100 dark:border-slate-800/30 h-full" />
                                      <div className="flex-1 h-full" />
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>

                            {/* Today marker */}
                            {showTodayLine && fiscalPlanningTimelineData && fiscalPlanningTimelineData.exactTodayAbs >= fiscalPlanningTimelineData.startAbs && fiscalPlanningTimelineData.exactTodayAbs <= (fiscalPlanningTimelineData.endAbs + 1) && !hiddenMonths.includes(`${Math.floor(fiscalPlanningTimelineData.exactTodayAbs / 12)}-${Math.floor(fiscalPlanningTimelineData.exactTodayAbs % 12)}`) && (
                              <div 
                                className="absolute top-0 bottom-0 w-px border-l-2 border-dashed border-red-500/40 z-20 pointer-events-none"
                                style={{ 
                                  left: getMonthPosition(Math.floor(fiscalPlanningTimelineData.exactTodayAbs), fiscalPlanningTimelineData.visibleMonths, fiscalPlanningViewScale === 'month' ? 100 : 160) + (fiscalPlanningTimelineData.exactTodayAbs % 1) * (fiscalPlanningViewScale === 'month' ? 100 : 160),
                                }}
                              >
                                <div className="absolute top-2 -left-[18px] px-1.5 py-0.5 bg-red-500 text-white text-[7px] font-black rounded-sm uppercase tracking-tighter shadow-md z-30 flex items-center gap-1">
                                  <Calendar className="w-2 h-2" />
                                  HOJE
                                </div>
                              </div>
                            )}

                            {/* Render Fiscal Bars */}
                            {fiscalPlanningActivities.map((activity) => {
                              if (!fiscalPlanningTimelineData) return null;
                              
                              let absStart = activity.startYear * 12 + activity.startMonth;
                              let absEnd = activity.endYear * 12 + activity.endMonth;
                              
                              let startOffset = 0;
                              let endOffset = 0;

                              if (activity.startDate) {
                                const d = new Date(activity.startDate);
                                const day = d.getDate();
                                const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
                                startOffset = (day - 1) / daysInMonth;
                              }

                              if (activity.endDate) {
                                const d = new Date(activity.endDate);
                                const day = d.getDate();
                                const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
                                endOffset = day / daysInMonth;
                              } else {
                                endOffset = 1;
                              }
                              
                              const GRID_WIDTH = fiscalPlanningViewScale === 'month' ? 100 : 160;
                              const left = getMonthPosition(Math.floor(absStart), fiscalPlanningTimelineData.visibleMonths, GRID_WIDTH) + startOffset * GRID_WIDTH;
                              const width = (getMonthPosition(Math.floor(absEnd), fiscalPlanningTimelineData.visibleMonths, GRID_WIDTH) + endOffset * GRID_WIDTH) - left;

                              if (width <= 0) return null;

                              return (
                                <div key={activity.id} className="h-14 border-b border-slate-50 dark:border-slate-800/50 relative group px-1">
                                  <motion.div 
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="absolute h-8 top-3 rounded-lg shadow-sm cursor-pointer hover:brightness-110 active:scale-[0.98] transition-all z-10 flex items-center gap-2 px-3 group/bar overflow-hidden"
                                    style={{ 
                                      left,
                                      width,
                                      backgroundColor: activity.color,
                                      boxShadow: `0 4px 14px ${activity.color}44`
                                    }}
                                    onClick={() => {
                                      setEditingFiscalPlanningActivity(activity);
                                      setIsAddingFiscalPlanningActivity(true);
                                    }}
                                  >
                                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover/bar:opacity-100 transition-opacity pointer-events-none" />
                                    <span className="text-[10px] font-black text-white truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
                                      {activity.name}
                                    </span>
                                  </motion.div>
                                </div>
                              );
                            })}
                            {fiscalPlanningActivities.length > 0 && (
                              <div className="h-14 border-b border-slate-50 dark:border-slate-800/50" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Drag and manage list underneath grid inside dashboard for incredible completeness */}
                  {fiscalPlanningActivities.length > 0 && (
                    <div className="border border-slate-100 dark:border-slate-850 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm mt-4">
                      <div className="p-4 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-150 dark:border-slate-800 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Gerenciar Ordens & Atividades do Cronograma</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/20 dark:bg-slate-900/10">
                              <th className="px-6 py-3">Obra / Atividade</th>
                              <th className="px-6 py-3">Período</th>
                              <th className="px-5 py-3">Cor</th>
                              <th className="px-6 py-3 text-right">Ações</th>
                            </tr>
                          </thead>
                          <Reorder.Group 
                            as="tbody" 
                            axis="y" 
                            values={fiscalPlanningActivities} 
                            onReorder={handleReorderFiscalPlanningActivities}
                            className="divide-y divide-slate-100 dark:divide-slate-800"
                          >
                            {fiscalPlanningActivities.map((activity) => (
                              <Reorder.Item 
                                key={activity.id} 
                                value={activity} 
                                as="tr"
                                className="hover:bg-slate-50/30 dark:hover:bg-slate-800/30 transition-colors group"
                              >
                                <td className="px-6 py-3">
                                  <div className="flex items-center gap-3">
                                    <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 transition-colors">
                                      <GripVertical size={14} />
                                    </div>
                                    <div className="flex flex-col">
                                      <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: activity.color }} />
                                        <span className="font-bold text-slate-800 dark:text-slate-200">{activity.name}</span>
                                      </div>
                                      {activity.category && (
                                        <span className="text-[9px] font-bold text-axia-primary uppercase tracking-widest mt-1 ml-4">{activity.category}</span>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-3 font-semibold text-slate-600 dark:text-slate-400">
                                  {MONTHS[activity.startMonth]} / {activity.startYear} - {MONTHS[activity.endMonth]} / {activity.endYear}
                                </td>
                                <td className="px-5 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded border border-slate-200 dark:border-slate-705 shadow-sm" style={{ backgroundColor: activity.color }} />
                                    <span className="text-[10px] font-mono text-slate-400">{activity.color}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-3 text-right">
                                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                      type="button"
                                      onClick={() => handleMoveFiscalPlanningActivity(activity, 'up')}
                                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400"
                                      title="Mover para cima"
                                    >
                                      <ChevronUp size={14} />
                                    </button>
                                    <button 
                                      type="button"
                                      onClick={() => handleMoveFiscalPlanningActivity(activity, 'down')}
                                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400"
                                      title="Mover para baixo"
                                    >
                                      <ChevronDown size={14} />
                                    </button>
                                    <button 
                                      type="button"
                                      onClick={() => {
                                        setEditingFiscalPlanningActivity(activity);
                                        setIsAddingFiscalPlanningActivity(true);
                                      }}
                                      className="p-1 text-slate-400 hover:text-axia-primary transition-colors"
                                      title="Editar"
                                    >
                                      <Pencil size={12} />
                                    </button>
                                    <button 
                                      type="button"
                                      onClick={() => handleDeleteFiscalPlanningActivity(activity.id)}
                                      className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                                      title="Excluir"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </td>
                              </Reorder.Item>
                            ))}
                          </Reorder.Group>
                        </table>
                      </div>
                    </div>
                  )}
                </div>


            </motion.div>
          )}

            {activeTab === 'projects' && (
              <motion.div 
                key="projects"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                {viewingProject ? (
                  <div className="space-y-8">
                    <button 
                      onClick={() => setViewingProject(null)}
                      className="flex items-center gap-2 text-slate-500 hover:text-axia-primary transition-colors font-semibold"
                    >
                      <ChevronRight size={20} className="rotate-180" />
                      Voltar para Lista
                    </button>

                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                      <div 
                        className="h-64 bg-slate-100 dark:bg-slate-800 relative cursor-pointer group/banner overflow-hidden"
                        onClick={() => handleImageClick(viewingProject.id)}
                      >
                        <img 
                          src={viewingProject.image || `https://picsum.photos/seed/${viewingProject.id}/1200/400`} 
                          alt={viewingProject.name}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover/banner:scale-105"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/banner:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-2 z-10">
                          <Camera size={48} />
                          <span className="text-xs font-bold uppercase tracking-widest">Alterar Banner da Obra</span>
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-8 z-0">
                          <div className="flex-1">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border bg-white/10 backdrop-blur-md text-white mb-4 inline-block ${getStatusColor(viewingProject.status)}`}>
                              {getStatusLabel(viewingProject.status)}
                            </span>
                            <h2 className="text-4xl font-display font-bold text-white">{viewingProject.name}</h2>
                            <p className="text-white/80 text-sm mt-2 flex items-center gap-2">
                              <User size={14} className="text-axia-accent" />
                              <span className="font-bold">Incluído por:</span>
                              <span>{viewingProject.creatorName || 'Sistema'}</span>
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-12">
                        <div className="lg:col-span-2 space-y-8">
                          <div className="flex border-b border-slate-100 dark:border-slate-800 mb-6 overflow-x-auto no-scrollbar scroll-smooth">
                            <button 
                              onClick={() => setProjectDetailTab('details')}
                              className={`px-4 lg:px-6 py-3 font-bold text-xs lg:text-sm transition-all relative whitespace-nowrap ${projectDetailTab === 'details' ? 'text-axia-primary' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                              Detalhes
                              {projectDetailTab === 'details' && <motion.div layoutId="projectTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-axia-primary" />}
                            </button>
                            <button 
                              onClick={() => setProjectDetailTab('attachments')}
                              className={`px-4 lg:px-6 py-3 font-bold text-xs lg:text-sm transition-all relative whitespace-nowrap ${projectDetailTab === 'attachments' ? 'text-axia-primary' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                              Documentos
                              {projectDetailTab === 'attachments' && <motion.div layoutId="projectTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-axia-primary" />}
                            </button>
                            <button 
                              onClick={() => setProjectDetailTab('history')}
                              className={`px-4 lg:px-6 py-3 font-bold text-xs lg:text-sm transition-all relative whitespace-nowrap ${projectDetailTab === 'history' ? 'text-axia-primary' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                              Histórico
                              {projectDetailTab === 'history' && <motion.div layoutId="projectTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-axia-primary" />}
                            </button>
                            <button 
                              onClick={() => setProjectDetailTab('photos')}
                              className={`px-4 lg:px-6 py-3 font-bold text-xs lg:text-sm transition-all relative whitespace-nowrap ${projectDetailTab === 'photos' ? 'text-axia-primary' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                              Relatório Fotográfico
                              {projectDetailTab === 'photos' && <motion.div layoutId="projectTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-axia-primary" />}
                            </button>
                            <button 
                              onClick={() => setProjectDetailTab('addendums')}
                              className={`px-4 lg:px-6 py-3 font-bold text-xs lg:text-sm transition-all relative whitespace-nowrap ${projectDetailTab === 'addendums' ? 'text-axia-primary' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                              Aditivos
                              {projectDetailTab === 'addendums' && <motion.div layoutId="projectTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-axia-primary" />}
                            </button>
                          </div>

                          {projectDetailTab === 'details' ? (
                            <>
                              <section>
                                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                  <FileText className="text-axia-primary" /> Descrição
                                </h3>
                                <p className="text-slate-600 leading-relaxed">{viewingProject.description}</p>
                              </section>

                              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 lg:gap-6">
                                <div className="p-4 lg:p-5 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm transition-all hover:bg-slate-100/50">
                                  <p className="text-[10px] lg:text-[11px] font-bold text-slate-400 uppercase mb-1 tracking-wider text-center lg:text-left">Cliente</p>
                                  <p className="font-bold text-slate-900 text-sm lg:text-base break-words text-center lg:text-left">{viewingProject.client}</p>
                                </div>
                                <div className="p-4 lg:p-5 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm transition-all hover:bg-slate-100/50">
                                  <p className="text-[10px] lg:text-[11px] font-bold text-slate-400 uppercase mb-1 tracking-wider text-center lg:text-left">Contrato</p>
                                  <p className="font-bold text-slate-900 text-sm lg:text-base break-all text-center lg:text-left">{viewingProject.contractNumber}</p>
                                </div>
                                <div className="p-4 lg:p-5 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm transition-all hover:bg-slate-100/50">
                                  <p className="text-[10px] lg:text-[11px] font-bold text-slate-400 uppercase mb-1 tracking-wider text-center lg:text-left">Responsável</p>
                                  <p className="font-bold text-slate-900 text-sm lg:text-base truncate text-center lg:text-left">{viewingProject.responsible || viewingProject.creatorName || 'Sistema'}</p>
                                </div>
                                <div className="p-4 lg:p-5 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm transition-all hover:bg-slate-100/50">
                                  <p className="text-[10px] lg:text-[11px] font-bold text-slate-400 uppercase mb-1 tracking-wider text-center lg:text-left">Duração</p>
                                  <p className="font-bold text-slate-900 text-sm lg:text-base text-center lg:text-left">{viewingProject.startDate} ➔ {viewingProject.endDate}</p>
                                </div>
                                <div className="p-4 lg:p-5 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm col-span-1 sm:col-span-2 transition-all hover:bg-slate-100/50">
                                  <p className="text-[10px] lg:text-[11px] font-bold text-slate-400 uppercase mb-1 tracking-wider">Empresa Executora</p>
                                  <p className="font-bold text-slate-900 text-sm lg:text-base break-words">{viewingProject.executingCompany}</p>
                                </div>
                                <div className="p-4 lg:p-5 bg-axia-primary/5 rounded-2xl border border-axia-primary/10 shadow-sm col-span-1 sm:col-span-2 transition-all hover:bg-axia-primary/10">
                                  <p className="text-[10px] lg:text-[11px] font-bold text-axia-primary uppercase mb-1 tracking-wider">Localidade</p>
                                  <p className="font-bold text-slate-900 text-sm lg:text-base flex items-center gap-2">
                                    <MapPin size={16} className="text-axia-primary" />
                                    {viewingProject.location}
                                  </p>
                                </div>
                              </div>

                              <section>
                                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                  <TrendingUp className="text-axia-primary" /> Progresso Financeiro
                                </h3>
                                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                                      <p className="text-[11px] font-bold text-slate-400 uppercase mb-1.5 tracking-wider">Orçamento Total Geral</p>
                                      <p className="text-2xl font-bold text-axia-accent">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(viewingProjectStats.totalBudget)}
                                      </p>
                                      <p className="text-[10px] text-slate-400 mt-1 font-medium italic">
                                        Contrato: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(viewingProject.budget) || 0)}
                                        {viewingProjectStats.addendumsSum > 0 && (
                                          <> + Aditivos: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(viewingProjectStats.addendumsSum)}</>
                                        )}
                                      </p>
                                    </div>
                                    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                                      <p className="text-[11px] font-bold text-slate-400 uppercase mb-1.5 tracking-wider">Total Medido</p>
                                      <p className="text-2xl font-bold text-axia-primary">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(viewingProject.spent || 0)}
                                      </p>
                                      <p className="text-[10px] text-slate-400 mt-1 font-medium italic invisible">placeholder</p>
                                    </div>
                                  </div>
                                  
                                  <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Utilização do Orçamento</span>
                                      <span className="text-sm font-bold text-axia-primary bg-axia-primary/10 px-2 py-0.5 rounded-lg">
                                        {Math.round(viewingProjectStats.usage)}%
                                      </span>
                                    </div>
                                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                                      <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${viewingProjectStats.usage}%` }}
                                        className="h-full bg-axia-accent rounded-full shadow-inner"
                                      />
                                    </div>
                                    <div className="flex justify-between text-[11px] font-bold text-slate-400">
                                      <span>Saldo: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(viewingProjectStats.balance)}</span>
                                      <span>Total: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(viewingProjectStats.totalBudget)}</span>
                                    </div>
                                  </div>
                                </div>
                              </section>
                            </>
                          ) : projectDetailTab === 'attachments' ? (
                            <div className="space-y-8">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className={`p-6 bg-slate-50 rounded-3xl border border-slate-200 border-dashed flex flex-col items-center justify-center text-center group hover:bg-white hover:border-axia-primary transition-all cursor-pointer relative ${isUploadingAttachment ? 'opacity-50 pointer-events-none' : ''}`}>
                                  <input 
                                    type="file" 
                                    accept=".pdf" 
                                    className="absolute inset-0 opacity-0 cursor-pointer" 
                                    onChange={(e) => handleAttachmentUpload(e, 'pdf')}
                                  />
                                  {isUploadingAttachment ? (
                                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-axia-primary shadow-sm mb-3">
                                      <div className="w-6 h-6 border-2 border-axia-primary/30 border-t-axia-primary rounded-full animate-spin" />
                                    </div>
                                  ) : (
                                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-red-500 shadow-sm mb-3 group-hover:scale-110 transition-transform">
                                      <FileText size={24} />
                                    </div>
                                  )}
                                  <h4 className="font-bold text-slate-900">{isUploadingAttachment ? 'Enviando...' : 'Anexar Contrato / PDF'}</h4>
                                  <p className="text-xs text-slate-500">{isUploadingAttachment ? 'Aguarde um momento' : 'Clique para selecionar arquivo'}</p>
                                </div>
                                <div className={`p-6 bg-slate-50 rounded-3xl border border-slate-200 border-dashed flex flex-col items-center justify-center text-center group hover:bg-white hover:border-axia-primary transition-all cursor-pointer relative ${isUploadingAttachment ? 'opacity-50 pointer-events-none' : ''}`}>
                                  <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="absolute inset-0 opacity-0 cursor-pointer" 
                                    onChange={(e) => handleAttachmentUpload(e, 'image')}
                                  />
                                  {isUploadingAttachment ? (
                                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-axia-primary shadow-sm mb-3">
                                      <div className="w-6 h-6 border-2 border-axia-primary/30 border-t-axia-primary rounded-full animate-spin" />
                                    </div>
                                  ) : (
                                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-axia-primary shadow-sm mb-3 group-hover:scale-110 transition-transform">
                                      <Camera size={24} />
                                    </div>
                                  )}
                                  <h4 className="font-bold text-slate-900">{isUploadingAttachment ? 'Enviando...' : 'Anexar Foto da Obra'}</h4>
                                  <p className="text-xs text-slate-500">{isUploadingAttachment ? 'Aguarde um momento' : 'Clique para selecionar imagem'}</p>
                                </div>
                              </div>

                              <div className="space-y-4">
                                <h4 className="font-bold text-slate-900 flex items-center gap-2">
                                  <ClipboardList size={18} className="text-axia-primary" /> Arquivos Anexados
                                </h4>
                                <div className="grid grid-cols-1 gap-4">
                                  {attachments.filter(a => a.projectId === viewingProject.id).length === 0 ? (
                                    <div className="p-12 text-center text-slate-400 bg-slate-50 rounded-3xl border border-slate-100">
                                      <Upload size={48} className="mx-auto mb-4 opacity-10" />
                                      <p>Nenhum anexo encontrado para esta obra.</p>
                                    </div>
                                  ) : (
                                    attachments.filter(a => a.projectId === viewingProject.id).map(attachment => (
                                      <div key={attachment.id} className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 hover:shadow-md transition-all group">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${attachment.type === 'pdf' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                                          {attachment.type === 'pdf' ? <FileText size={24} /> : <Camera size={24} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <h5 className="font-bold text-slate-900 truncate">{attachment.name}</h5>
                                          <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase">
                                            <span>{attachment.uploadedAt}</span>
                                            {attachment.size && <span>• {attachment.size}</span>}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                          {attachment.type === 'image' && (
                                            <button 
                                              onClick={() => setSelectedPhotoUrl(attachment.url)}
                                              className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-axia-primary hover:bg-axia-primary/10 transition-colors"
                                              title="Visualizar"
                                            >
                                              <Eye size={18} />
                                            </button>
                                          )}
                                          <a 
                                            href={attachment.url} 
                                            download={attachment.name}
                                            target="_blank" 
                                            rel="noreferrer"
                                            className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-400 hover:text-axia-primary transition-colors flex items-center justify-center"
                                            title="Download"
                                          >
                                            <Download size={18} />
                                          </a>
                                          <button 
                                            onClick={() => handleDeleteAttachment(attachment.id)}
                                            className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                                            title="Excluir"
                                          >
                                            <Trash2 size={18} />
                                          </button>
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : projectDetailTab === 'photos' ? (
                            <div className="space-y-6">
                              <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                  <Camera className="text-axia-primary" /> Relatório Fotográfico
                                </h3>
                                <button 
                                  onClick={() => setIsAddingPhoto(true)}
                                  className="bg-axia-primary text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-axia-primary/90 transition-all shadow-md shadow-axia-primary/20"
                                >
                                  <Plus size={18} /> Adicionar Foto
                                </button>
                              </div>

                              {isAddingPhoto && (
                                <motion.div 
                                  initial={{ opacity: 0, y: -20 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="p-6 bg-slate-50 rounded-3xl border border-slate-200 shadow-inner space-y-4 mb-8"
                                >
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Foto do Relatório</label>
                                      <div className="space-y-3">
                                        {!newPhoto.url ? (
                                          <button 
                                            onClick={() => photoFileInputRef.current?.click()}
                                            disabled={isUploadingPhoto}
                                            className="w-full aspect-video border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-axia-primary hover:bg-axia-primary/5 transition-all group disabled:opacity-50"
                                          >
                                            {isUploadingPhoto ? (
                                              <div className="flex flex-col items-center gap-2">
                                                <div className="w-8 h-8 border-3 border-axia-primary border-t-transparent rounded-full animate-spin" />
                                                <span className="text-xs font-bold text-axia-primary">Enviando...</span>
                                              </div>
                                            ) : (
                                              <>
                                                <div className="p-3 bg-slate-100 rounded-full text-slate-400 group-hover:bg-axia-primary/10 group-hover:text-axia-primary transition-all">
                                                  <Upload size={24} />
                                                </div>
                                                <div className="text-center">
                                                  <p className="text-sm font-bold text-slate-600">Clique para anexar foto</p>
                                                  <p className="text-[10px] text-slate-400">JPG, PNG ou GIF (Máx. 5MB)</p>
                                                </div>
                                              </>
                                            )}
                                          </button>
                                        ) : (
                                          <div className="relative aspect-video rounded-2xl overflow-hidden border border-slate-200 group">
                                            <img 
                                              src={newPhoto.url} 
                                              alt="Preview" 
                                              className="w-full h-full object-cover"
                                              referrerPolicy="no-referrer"
                                            />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2">
                                              <button 
                                                onClick={() => photoFileInputRef.current?.click()}
                                                className="p-2 bg-white text-slate-900 rounded-full hover:bg-axia-primary hover:text-white transition-all"
                                                title="Trocar foto"
                                              >
                                                <Upload size={18} />
                                              </button>
                                              <button 
                                                onClick={() => setNewPhoto({ ...newPhoto, url: '' })}
                                                className="p-2 bg-white text-red-600 rounded-full hover:bg-red-600 hover:text-white transition-all"
                                                title="Remover"
                                              >
                                                <X size={18} />
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                        
                                        <div className="flex gap-2">
                                          <div className="relative flex-1">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                              <Link size={14} className="text-slate-400" />
                                            </div>
                                            <input 
                                              type="text" 
                                              placeholder="Ou cole uma URL direta da imagem..."
                                              value={newPhoto.url}
                                              onChange={(e) => setNewPhoto({ ...newPhoto, url: e.target.value })}
                                              className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-axia-primary/20"
                                            />
                                          </div>
                                          <input 
                                            type="file" 
                                            ref={photoFileInputRef}
                                            onChange={handlePhotoFileChange}
                                            className="hidden"
                                            accept="image/*"
                                          />
                                        </div>
                                      </div>
                                      {newPhoto.url && !newPhoto.url.startsWith('http') && (
                                        <p className="text-[10px] text-amber-600 font-bold">URL inválida ou arquivo não carregado corretamente.</p>
                                      )}
                                    </div>
                                    <div className="space-y-2">
                                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Legenda / Observação</label>
                                      <input 
                                        type="text" 
                                        placeholder="Ex: Fundação do bloco A concluída"
                                        value={newPhoto.caption}
                                        onChange={(e) => setNewPhoto({ ...newPhoto, caption: e.target.value })}
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-axia-primary/20"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex justify-end gap-3 pt-2">
                                    <button 
                                      onClick={() => setIsAddingPhoto(false)}
                                      className="px-4 py-2 text-slate-500 font-bold text-sm hover:bg-slate-100 rounded-xl transition-all"
                                    >
                                      Cancelar
                                    </button>
                                    <button 
                                      onClick={handleAddPhoto}
                                      disabled={!newPhoto.url || isSubmittingPhoto}
                                      className="px-6 py-2 bg-axia-primary text-white font-bold text-sm rounded-xl hover:bg-axia-primary/90 transition-all shadow-md shadow-axia-primary/20 disabled:opacity-50 flex items-center gap-2"
                                    >
                                      {isSubmittingPhoto && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                      {isSubmittingPhoto ? 'Salvando...' : 'Salvar Foto'}
                                    </button>
                                  </div>
                                </motion.div>
                              )}

                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {photoReports.filter(p => p.projectId === viewingProject.id).length === 0 ? (
                                  <div className="col-span-full p-12 text-center text-slate-400 bg-slate-50 rounded-3xl border border-slate-100">
                                    <Camera size={48} className="mx-auto mb-4 opacity-10" />
                                    <p>Nenhuma foto registrada neste relatório.</p>
                                  </div>
                                ) : (
                                  photoReports.filter(p => p.projectId === viewingProject.id).map(photo => (
                                    <div key={photo.id} className="group bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300">
                                      <div className="aspect-video relative overflow-hidden">
                                        <img 
                                          src={photo.url} 
                                          alt={photo.caption}
                                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                          referrerPolicy="no-referrer"
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                          <button 
                                            onClick={() => setSelectedPhotoUrl(photo.url)}
                                            className="p-3 bg-white text-axia-primary rounded-2xl hover:bg-slate-100 transition-all shadow-lg"
                                            title="Visualizar Foto"
                                          >
                                            <Eye size={20} />
                                          </button>
                                          <button 
                                            onClick={() => handleDeletePhoto(photo.id)}
                                            className="p-3 bg-red-500 text-white rounded-2xl hover:bg-red-600 transition-all shadow-lg"
                                            title="Excluir Foto"
                                          >
                                            <Trash2 size={20} />
                                          </button>
                                        </div>
                                      </div>
                                      <div className="p-4">
                                        <p className="text-sm font-bold text-slate-900 mb-1 line-clamp-2">{photo.caption || 'Sem legenda'}</p>
                                        <div className="flex items-center justify-between">
                                          <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                                            <Calendar size={10} /> {new Date(photo.date).toLocaleDateString('pt-BR')}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          ) : projectDetailTab === 'addendums' ? (
                            <div className="space-y-6">
                              <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                  <Link className="text-axia-primary" /> Gestão de Aditivos
                                </h3>
                                <button 
                                  onClick={() => setIsAddingAddendum(true)}
                                  className="bg-axia-primary text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-axia-primary/90 transition-all shadow-md shadow-axia-primary/20"
                                >
                                  <Plus size={18} /> Novo Aditivo
                                </button>
                              </div>

                              {isAddingAddendum && (
                                <motion.div 
                                  initial={{ opacity: 0, y: -20 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="p-6 bg-slate-50 rounded-3xl border border-slate-200 shadow-inner space-y-4 mb-8"
                                >
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    <div className="space-y-2">
                                      <label className="text-xs font-bold text-slate-500 uppercase">N° do Aditivo</label>
                                      <input 
                                        type="text" 
                                        value={newAddendum.number}
                                        onChange={(e) => setNewAddendum({...newAddendum, number: e.target.value})}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-axia-primary focus:ring-1 focus:ring-axia-primary outline-none transition-all bg-white"
                                        placeholder="Ex: 001/2024"
                                      />
                                    </div>
                                    <div className="space-y-2 lg:col-span-2">
                                      <label className="text-xs font-bold text-slate-500 uppercase">Descrição</label>
                                      <input 
                                        type="text" 
                                        value={newAddendum.description}
                                        onChange={(e) => setNewAddendum({...newAddendum, description: e.target.value})}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-axia-primary focus:ring-1 focus:ring-axia-primary outline-none transition-all bg-white"
                                        placeholder="Motivo do aditivo..."
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <label className="text-xs font-bold text-slate-500 uppercase">RC do Aditivo (Opcional)</label>
                                      <input 
                                        type="text" 
                                        value={newAddendum.rcNumber}
                                        onChange={(e) => setNewAddendum({...newAddendum, rcNumber: e.target.value})}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-axia-primary focus:ring-1 focus:ring-axia-primary outline-none transition-all bg-white"
                                        placeholder="N° da RC"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <label className="text-xs font-bold text-slate-500 uppercase">Valor do Aditivo</label>
                                      <input 
                                        type="number" 
                                        value={newAddendum.value}
                                        onChange={(e) => setNewAddendum({...newAddendum, value: e.target.value})}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-axia-primary focus:ring-1 focus:ring-axia-primary outline-none transition-all bg-white"
                                        placeholder="R$ 0,00"
                                      />
                                    </div>
                                    <div className="flex items-end pb-2">
                                      <label className="flex items-center gap-3 cursor-pointer group">
                                        <div className="relative">
                                          <input 
                                            type="checkbox" 
                                            className="sr-only peer"
                                            checked={newAddendum.isApproved}
                                            onChange={(e) => setNewAddendum({...newAddendum, isApproved: e.target.checked})}
                                          />
                                          <div className="w-10 h-6 bg-slate-200 rounded-full peer peer-checked:bg-axia-primary transition-all after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full shadow-sm" />
                                        </div>
                                        <span className="text-sm font-bold text-slate-600 group-hover:text-axia-primary transition-colors">Realizado</span>
                                      </label>
                                    </div>
                                  </div>
                                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                                    <button 
                                      onClick={() => setIsAddingAddendum(false)}
                                      className="px-6 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
                                    >
                                      Cancelar
                                    </button>
                                    <button 
                                      onClick={handleAddAddendum}
                                      className="bg-axia-primary text-white px-8 py-2 rounded-xl font-bold text-sm hover:shadow-lg hover:shadow-axia-primary/25 transition-all"
                                    >
                                      Salvar Aditivo
                                    </button>
                                  </div>
                                </motion.div>
                              )}

                              <div className="grid grid-cols-1 gap-4">
                                {addendums.filter(a => a.projectId === viewingProject.id).length === 0 ? (
                                  <div className="p-12 text-center text-slate-400 bg-slate-50 rounded-3xl border border-slate-100">
                                    <FilePlus size={48} className="mx-auto mb-4 opacity-10" />
                                    <p>Nenhum aditivo registrado para esta obra.</p>
                                  </div>
                                ) : (
                                  addendums.filter(a => a.projectId === viewingProject.id).sort((a,b) => b.createdAt.localeCompare(a.createdAt)).map(addendum => (
                                    <div key={addendum.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                                      {addendum.isApproved && (
                                        <div className="absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 bg-green-500/10 rounded-full flex items-end justify-center pb-4 transition-transform group-hover:scale-110">
                                          <ShieldCheck size={24} className="text-green-500" />
                                        </div>
                                      )}
                                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                        <div className="space-y-3 flex-1">
                                          <div className="flex items-center gap-3">
                                            <button 
                                              onClick={() => handleToggleAddendumApproval(addendum)}
                                              className="px-2.5 py-1 bg-axia-primary/10 text-axia-primary text-[10px] font-black uppercase rounded-lg border border-axia-primary/20 cursor-pointer hover:bg-axia-primary/20 transition-all"
                                            >
                                              Aditivo {addendum.number}
                                            </button>
                                            <button 
                                              onClick={() => handleToggleAddendumApproval(addendum)}
                                              className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-lg border transition-all cursor-pointer hover:scale-105 active:scale-95 ${addendum.isApproved ? 'bg-green-50 text-green-600 border-green-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}
                                            >
                                              {addendum.isApproved ? 'Realizado' : 'Pendente'}
                                            </button>
                                          </div>
                                          <h4 className="text-lg font-bold text-slate-800 leading-tight">{addendum.description}</h4>
                                          <div className="flex flex-wrap items-center gap-5 text-xs font-bold text-slate-500">
                                            {addendum.rcNumber && (
                                              <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-md">
                                                <Receipt size={14} className="text-axia-primary" /> RC: {addendum.rcNumber}
                                              </span>
 
                                            )}
                                            <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-md">
                                                <Calendar size={14} className="text-axia-primary" /> {new Date(addendum.createdAt).toLocaleDateString('pt-BR')}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-8 pl-4 md:border-l border-slate-100">
                                          <div className="text-right">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Valor do Aditivo</p>
                                            <p className="text-2xl font-black text-axia-primary">
                                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(addendum.value || 0)}
                                            </p>
                                          </div>
                                          <div className="flex flex-col gap-2">
                                            <button 
                                              onClick={() => handleToggleAddendumApproval(addendum)}
                                              title={addendum.isApproved ? "Marcar como pendente" : "Marcar como realizado"}
                                              className={`p-2 rounded-xl transition-all shadow-sm ${addendum.isApproved ? 'bg-amber-50 text-amber-500 hover:bg-amber-100' : 'bg-green-50 text-green-500 hover:bg-green-100'}`}
                                            >
                                              {addendum.isApproved ? <Clock size={20} /> : <CheckCircle2 size={20} />}
                                            </button>
                                            <button 
                                              onClick={() => handleDeleteAddendum(addendum)}
                                              title="Excluir aditivo"
                                              className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-all shadow-sm"
                                            >
                                              <Trash2 size={20} />
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          ) : projectDetailTab === 'history' ? (
                            <div className="space-y-6">
                              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                <History className="text-axia-primary" /> Histórico de Atualizações
                              </h3>
                              <div className="space-y-4">
                                {statusUpdates.filter(su => su.projectId === viewingProject.id).length === 0 ? (
                                  <div className="p-12 text-center text-slate-400 bg-slate-50 rounded-3xl border border-slate-100">
                                    <MessageSquare size={48} className="mx-auto mb-4 opacity-10" />
                                    <p>Nenhuma atualização registrada para esta obra.</p>
                                  </div>
                                ) : (
                                  statusUpdates.filter(su => su.projectId === viewingProject.id).map(update => (
                                    <div key={update.id} className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                          <div className="w-8 h-8 bg-axia-primary/10 rounded-full flex items-center justify-center text-axia-primary">
                                            <User size={16} />
                                          </div>
                                          <span className="font-bold text-slate-900 text-sm">{update.author}</span>
                                        </div>
                                        <span className="text-[10px] font-mono font-bold text-slate-400 uppercase bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">{update.date}</span>
                                      </div>
                                      <p className="text-sm text-slate-600 leading-relaxed">{update.message}</p>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="p-12 text-center text-slate-400 bg-slate-50 rounded-3xl border border-slate-100">
                              <History size={48} className="mx-auto mb-4 opacity-10" />
                              <p>Selecione uma aba para visualizar o conteúdo.</p>
                            </div>
                          )}
                        </div>

                        <div className="space-y-8">
                          <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm">
                            <h4 className="font-bold text-axia-primary mb-6 flex items-center gap-2">
                              <Clock size={18} /> Cronograma de Execução
                            </h4>
                            <div className="space-y-6">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Progresso Atual</span>
                                <div className="flex items-center gap-2">
                                  {isUpdatingProgress ? (
                                    <div className="flex items-center gap-2">
                                      <input 
                                        type="number" 
                                        min="0" 
                                        max="100"
                                        value={tempProgress}
                                        onChange={(e) => setTempProgress(Number(e.target.value))}
                                        className="w-16 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-axia-primary/20"
                                      />
                                      <button 
                                        onClick={handleQuickProgressUpdate}
                                        className="p-1.5 bg-axia-primary text-white rounded-lg hover:bg-axia-primary/90 shadow-sm"
                                      >
                                        <CheckCircle2 size={16} />
                                      </button>
                                      <button 
                                        onClick={() => setIsUpdatingProgress(false)}
                                        className="p-1.5 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200"
                                      >
                                        <X size={16} />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <span className="text-lg font-bold text-slate-900">{viewingProject.progress}%</span>
                                      <button 
                                        onClick={() => {
                                          setTempProgress(viewingProject.progress);
                                          setIsUpdatingProgress(true);
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-axia-primary hover:bg-axia-primary/5 rounded-lg transition-all"
                                        title="Atualizar progresso"
                                      >
                                        <Pencil size={14} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                                <div 
                                  className="h-full bg-axia-primary rounded-full shadow-inner transition-all duration-500" 
                                  style={{ width: `${viewingProject.progress}%` }} 
                                />
                              </div>
                              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <AlertCircle size={14} className="text-slate-400" />
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Última atualização: Hoje</p>
                              </div>
                            </div>
                          </div>


                          <button 
                            onClick={async () => {
                              setIsGeneratingReport(true);
                              // Small delay to allow UI to show loading state
                              setTimeout(() => {
                                try {
                                  generateProjectReport(viewingProject);
                                } finally {
                                  setIsGeneratingReport(false);
                                }
                              }, 100);
                            }}
                            disabled={isGeneratingReport}
                            className="w-full bg-axia-secondary text-white py-4 rounded-2xl font-bold hover:bg-axia-secondary/90 transition-all shadow-lg shadow-axia-secondary/20 flex items-center justify-center gap-2 mb-4 disabled:opacity-70"
                          >
                            {isGeneratingReport ? (
                              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <FileText size={20} />
                            )}
                            {isGeneratingReport ? 'Gerando...' : 'Relatório Semanal'}
                          </button>

                          <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm">
                            <h4 className="font-bold text-axia-primary mb-4 flex items-center gap-2">
                              <TrendingUp size={18} /> Histórico de Medições
                            </h4>
                            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                              {measurements.filter(m => m.projectId === viewingProject.id).length === 0 ? (
                                <p className="text-xs text-slate-400 text-center py-4 italic">Nenhuma medição registrada.</p>
                              ) : (
                                measurements
                                  .filter(m => m.projectId === viewingProject.id)
                                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                  .map(measurement => (
                                    <div key={measurement.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-axia-primary/30 transition-colors">
                                      <div className="min-w-0 flex-1">
                                        <p className="text-xs font-bold text-slate-900 truncate">{measurement.description}</p>
                                        <p className="text-[10px] text-slate-500">{new Date(measurement.date).toLocaleDateString('pt-BR')}</p>
                                      </div>
                                      <div className="text-right ml-3">
                                        <p className="text-xs font-bold text-axia-primary">
                                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(measurement.value || 0)}
                                        </p>
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase ${
                                          measurement.status === 'paid' ? 'bg-green-100 text-green-600' : 
                                          measurement.status === 'approved' ? 'bg-blue-100 text-blue-600' : 
                                          'bg-amber-100 text-amber-600'
                                        }`}>
                                          {measurement.status === 'paid' ? 'Pago' : measurement.status === 'approved' ? 'Aprovado' : 'Pendente'}
                                        </span>
                                      </div>
                                    </div>
                                  ))
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div>
                        <h2 className="text-2xl lg:text-3xl font-display font-bold text-slate-900 dark:text-white">Gestão de Obras</h2>
                        <p className="text-sm lg:text-base text-slate-500 dark:text-slate-400">Visualize e gerencie todos os contratos e execuções da Axia Energia.</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 lg:gap-3">
                        <button 
                          onClick={generateGeneralReport}
                          className="flex-1 lg:flex-none bg-axia-secondary text-white px-4 py-2 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-axia-secondary/90 transition-colors shadow-lg shadow-axia-secondary/20 text-sm"
                        >
                          <FileDown size={18} />
                          Emitir Relatório
                        </button>
                        <button 
                          onClick={() => {
                            if (showAddProject) {
                              setEditingProject(null);
                              setNewProject({
                                name: '',
                                client: '',
                                contractNumber: '',
                                description: '',
                                budget: '',
                                location: '',
                                startDate: '',
                                endDate: '',
                                executingCompany: '',
                                status: 'not-started'
                              });
                            }
                            setShowAddProject(!showAddProject);
                          }}
                          className="flex-1 lg:flex-none bg-axia-primary text-white px-4 py-2 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-axia-primary/90 transition-colors shadow-lg shadow-axia-primary/20 text-sm"
                        >
                          {showAddProject ? <X size={18} /> : <Plus size={18} />}
                          {showAddProject ? 'Cancelar' : 'Nova Obra'}
                        </button>
                      </div>
                    </div>

                    {/* Collapsible Global Timeline Section */}
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all">
                      <button 
                        onClick={() => setIsGlobalTimelineExpanded(!isGlobalTimelineExpanded)}
                        className="w-full text-left p-6 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors focus:outline-none"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-axia-primary/10 flex items-center justify-center text-axia-primary">
                            <Calendar size={20} />
                          </div>
                          <div>
                            <h3 className="font-bold text-base text-slate-800 dark:text-white flex items-center gap-2">
                              Cronograma Global de Obras
                              {timelineData.length > 0 && (
                                <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-full border border-slate-200 dark:border-slate-700">
                                  {timelineData.length} {timelineData.length === 1 ? 'Obra' : 'Obras'}
                                </span>
                              )}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">Toque para {isGlobalTimelineExpanded ? 'recolher' : 'visualizar o cronograma em linha do tempo'}</p>
                          </div>
                        </div>
                        <div className={`p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 transition-transform duration-300 ${isGlobalTimelineExpanded ? 'rotate-180' : ''}`}>
                          <ChevronDown size={18} />
                        </div>
                      </button>

                      <AnimatePresence initial={false}>
                        {isGlobalTimelineExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                            className="border-t border-slate-100 dark:border-slate-800/50"
                          >
                            <div className="p-8 space-y-6">
                              {timelineData.length > 0 && timelineWindow ? (
                                <div className="relative pt-6">
                                  {/* Timeline Labels */}
                                  <div className="absolute top-0 left-0 right-0 flex justify-between px-1 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-1">
                                    <span>{new Date(timelineWindow.minStart).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}</span>
                                    <span>{new Date(timelineWindow.minStart + (timelineWindow.totalDuration / 2)).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}</span>
                                    <span>{new Date(timelineWindow.maxEnd).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}</span>
                                  </div>
                                  
                                  <div className="space-y-4 pt-4">
                                    {timelineData.map((item, index) => (
                                      <div key={index} className="space-y-1.5 group">
                                        <div className="flex justify-between text-[11px] font-bold text-slate-550 dark:text-slate-400 px-1">
                                          <span className="group-hover:text-axia-primary transition-colors">{item.name}</span>
                                          <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                                            {item.start} - {item.end}
                                          </span>
                                        </div>
                                        <div className="h-3 w-full bg-slate-50 dark:bg-slate-800/50 rounded-full relative overflow-hidden">
                                          <motion.div 
                                            initial={{ width: 0, opacity: 0 }}
                                            animate={{ width: `${item.width}%`, left: `${item.left}%`, opacity: 1 }}
                                            transition={{ duration: 1, delay: index * 0.1 }}
                                            className={`absolute h-full rounded-full shadow-sm shadow-black/5 ${
                                              item.status === 'finished' ? 'bg-axia-accent' : 
                                              item.status === 'paused' ? 'bg-axia-secondary' : 
                                              item.status === 'delayed' ? 'bg-red-500' :
                                              'bg-axia-primary'
                                            }`}
                                          />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  
                                  {/* Today Marker if within window */}
                                  {(() => {
                                    const today = new Date().getTime();
                                    if (today >= timelineWindow.minStart && today <= timelineWindow.maxEnd) {
                                      const left = ((today - timelineWindow.minStart) / timelineWindow.totalDuration) * 100;
                                      return (
                                        <div 
                                          className="absolute top-0 bottom-0 border-l border-dashed border-red-500/50 z-10 pointer-events-none"
                                          style={{ left: `${left}%` }}
                                        />
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>
                              ) : (
                                <div className="py-12 text-center text-slate-400">
                                  <Calendar size={48} className="mx-auto mb-4 opacity-20" />
                                  <p>Nenhuma data de início/fim definida para as obras.</p>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {showAddProject && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                      >
                        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                          {editingProject ? <Pencil className="text-axia-primary" /> : <FilePlus className="text-axia-primary" />} 
                          {editingProject ? 'Editar Obra' : 'Cadastrar Nova Obra'}
                        </h3>
                        <form onSubmit={handleAddProject} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Título da Obra</label>
                            <input 
                              required
                              type="text" 
                              value={newProject.name}
                              onChange={e => setNewProject({...newProject, name: e.target.value})}
                              placeholder="Ex: Complexo Eólico Serra do Mar"
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-axia-primary/20"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Número do Contrato</label>
                            <input 
                              required
                              type="text" 
                              value={newProject.contractNumber}
                              onChange={e => setNewProject({...newProject, contractNumber: e.target.value})}
                              placeholder="Ex: AX-2024-005"
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-axia-primary/20"
                            />
                          </div>
                          <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descrição Detalhada</label>
                            <textarea 
                              required
                              rows={3}
                              value={newProject.description}
                              onChange={e => setNewProject({...newProject, description: e.target.value})}
                              placeholder="Descreva o escopo principal da obra..."
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-axia-primary/20"
                            ></textarea>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cliente</label>
                            <input 
                              required
                              type="text" 
                              value={newProject.client}
                              onChange={e => setNewProject({...newProject, client: e.target.value})}
                              placeholder="Nome do cliente"
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-axia-primary/20"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Valor da Obra (R$)</label>
                            <input 
                              required
                              type="number" 
                              value={newProject.budget}
                              onChange={e => setNewProject({...newProject, budget: e.target.value})}
                              placeholder="0,00"
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-axia-primary/20"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Localidade</label>
                            <input 
                              required
                              type="text" 
                              value={newProject.location}
                              onChange={e => setNewProject({...newProject, location: e.target.value})}
                              placeholder="Cidade, UF"
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-axia-primary/20"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data de Início</label>
                            <input 
                              required
                              type="date" 
                              value={newProject.startDate}
                              onChange={e => setNewProject({...newProject, startDate: e.target.value})}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-axia-primary/20"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Previsão de Término</label>
                            <input 
                              required
                              type="date" 
                              value={newProject.endDate}
                              onChange={e => setNewProject({...newProject, endDate: e.target.value})}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-axia-primary/20"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status da Obra</label>
                            <select 
                              required
                              value={newProject.status}
                              onChange={e => setNewProject({...newProject, status: e.target.value as Project['status']})}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-axia-primary/20"
                            >
                              <option value="not-started">Não Iniciada</option>
                              <option value="preliminary-study">Em Estudo Preliminar</option>
                              <option value="in-progress">Em Andamento</option>
                              <option value="paused">Paralisada</option>
                              <option value="finished">Finalizada</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Execução Atual (%)</label>
                            <input 
                              required
                              type="number" 
                              min="0"
                              max="100"
                              value={newProject.progress}
                              onChange={e => setNewProject({...newProject, progress: Number(e.target.value)})}
                              placeholder="Ex: 45"
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-axia-primary/20"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Empresa Executora</label>
                            <input 
                              required
                              type="text" 
                              value={newProject.executingCompany}
                              onChange={e => setNewProject({...newProject, executingCompany: e.target.value})}
                              placeholder="Nome da empresa"
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-axia-primary/20"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Responsável pela Obra</label>
                            <select 
                              required
                              value={newProject.responsibleId || ''}
                              onChange={e => {
                                const userId = e.target.value;
                                const user = registeredUsers.find(u => u.id === userId);
                                setNewProject({
                                  ...newProject, 
                                  responsibleId: userId,
                                  responsible: user ? user.name : ''
                                });
                              }}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-axia-primary/20"
                            >
                              <option value="">Selecione um responsável</option>
                              {registeredUsers.map(user => (
                                <option key={user.id} value={user.id}>{user.name} ({user.role})</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Incluído por (Automático)</label>
                            <div className="w-full bg-slate-100 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-500 flex items-center gap-2">
                              <User size={16} className="text-slate-400" />
                              <span className="font-medium text-sm">
                                {editingProject ? (editingProject.creatorName || 'Sistema') : (currentUser?.name || '')}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-end">
                            <button 
                              type="submit"
                              className="w-full bg-axia-primary text-white py-2.5 rounded-xl font-bold hover:bg-axia-primary/90 transition-all shadow-lg shadow-axia-primary/20"
                            >
                              {editingProject ? 'Atualizar Obra' : 'Salvar Obra'}
                            </button>
                          </div>
                        </form>
                      </motion.div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-8">
                      {projectsWithTotals.map((project) => (
                        <motion.div 
                          layout
                          key={project.id}
                          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col sm:flex-row h-full"
                        >
                          <div 
                            className="w-full sm:w-1/3 bg-slate-100 dark:bg-slate-800 relative h-48 sm:h-auto min-h-[160px] cursor-pointer group/img overflow-hidden shrink-0"
                            onClick={() => handleImageClick(project.id)}
                          >
                            <img 
                              src={project.image || `https://picsum.photos/seed/${project.id}/600/400`} 
                              alt={project.name}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-2">
                              <Camera size={32} />
                              <span className="text-[10px] font-bold uppercase tracking-widest">Alterar Foto</span>
                            </div>
                            <div className="absolute top-3 left-3">
                              <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider border shadow-sm ${getStatusColor(project.status)}`}>
                                {getStatusLabel(project.status)}
                              </span>
                            </div>
                          </div>
                          <div className="w-full sm:w-2/3 p-4 lg:p-6 flex flex-col min-w-0">
                            <div className="flex flex-col xl:flex-row justify-between items-start gap-2 mb-3">
                              <div className="min-w-0 flex-1">
                                <p className="text-[9px] font-bold text-axia-secondary uppercase tracking-widest mb-0.5 break-all">Contrato: {project.contractNumber}</p>
                                <h3 className="text-lg lg:text-xl font-bold text-slate-900 dark:text-white leading-tight truncate">{project.name}</h3>
                              </div>
                              <div className="xl:text-right shrink-0">
                                <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Orçado Total</p>
                                <p className="text-base lg:text-lg font-bold text-axia-accent">
                                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(project.totalBudget || 0)}
                                </p>
                              </div>
                            </div>

                            <p className="text-xs lg:text-sm text-slate-600 dark:text-slate-400 mb-4 line-clamp-2 min-h-[2.5rem]">{project.description}</p>

                            <div className="grid grid-cols-2 gap-2 lg:gap-4 mb-4">
                              <div className="flex items-center gap-1.5 text-[10px] lg:text-xs text-slate-500 dark:text-slate-400">
                                <MapPin size={12} className="text-axia-primary shrink-0" />
                                <span className="truncate">{project.location}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] lg:text-xs text-slate-500 dark:text-slate-400">
                                <Calendar size={12} className="text-axia-primary shrink-0" />
                                <span className="truncate">{project.startDate} a {project.endDate}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] lg:text-xs text-slate-500 dark:text-slate-400 col-span-2">
                                <User size={12} className="text-axia-primary shrink-0" />
                                <span className="font-bold shrink-0">Resp.:</span>
                                <span className="truncate">{project.creatorName || 'Sistema'}</span>
                              </div>
                            </div>

                            <div className="mb-4 p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Financ.</span>
                                <span className="text-[9px] font-bold text-axia-accent">
                                  {Math.round(project.usage)}%
                                </span>
                              </div>
                              <div className="h-1 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-1.5">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${project.usage}%` }}
                                  className="h-full bg-axia-accent rounded-full"
                                />
                              </div>
                              <div className="flex justify-between text-[9px] font-bold gap-2">
                                <div className="text-slate-400 dark:text-slate-500 truncate italic">Saldo: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(project.balance)}</div>
                                <div className="text-axia-primary shrink-0">Medido: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(project.spent || 0)}</div>
                              </div>
                            </div>

                            <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Progresso Fis.</span>
                                  <span className="text-[10px] font-bold text-axia-primary">{(project.progress || 0)}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(project.progress || 0)}%` }}
                                    className="h-full bg-axia-primary rounded-full"
                                  />
                                </div>
                              </div>
                              <div className="flex items-center gap-1 xl:gap-2">
                                <button 
                                  onClick={() => startEditing(project)}
                                  className="p-1.5 lg:p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-axia-primary transition-colors"
                                  title="Editar Obra"
                                >
                                  <Pencil size={16} />
                                </button>
                                <button 
                                  onClick={() => setProjectToDelete(project)}
                                  className="p-1.5 lg:p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                                  title="Excluir Obra"
                                >
                                  <Trash2 size={16} />
                                </button>
                                <button 
                                  onClick={() => setViewingProject(project)}
                                  className="p-1.5 lg:p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-axia-primary transition-colors"
                                  title="Ver Detalhes"
                                >
                                  <ChevronRight size={18} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {activeTab === 'planning' && (
              <motion.div 
                key="planning"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Planejamento de Obras</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Cronograma Mensal de Atividades</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setShowTodayLine(!showTodayLine)}
                      className={`p-2 rounded-xl border transition-all flex items-center gap-2 text-xs font-bold ${
                        showTodayLine 
                          ? 'bg-red-50 border-red-200 text-red-600 dark:bg-red-900/20 dark:border-red-800' 
                          : 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-slate-800 dark:border-slate-700'
                      }`}
                      title={showTodayLine ? "Ocultar Hoje" : "Mostrar Hoje"}
                    >
                      <Calendar size={14} />
                      {isMobile ? "" : "Hoje"}
                    </button>
                    {hiddenMonths.length > 0 && (
                      <button 
                        onClick={() => setHiddenMonths([])}
                        className="p-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 transition-all flex items-center gap-2 text-xs font-bold dark:bg-slate-800 dark:border-slate-700"
                        title="Restaurar meses ocultos"
                      >
                         <Eye size={14} />
                         {isMobile ? "" : "Meses"} ({hiddenMonths.length})
                      </button>
                    )}
                    <select 
                      value={selectedPlanningProjectId}
                      onChange={(e) => setSelectedPlanningProjectId(e.target.value)}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-axia-primary/20 transition-all shadow-sm"
                    >
                      <option value="">Projeto...</option>
                      {projectsWithTotals.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>

                    <button 
                      onClick={() => {
                        setIsAddingPlanningActivity(true);
                        setEditingPlanningActivity(null);
                        setUseSpecificPlanningDates(false);
                        setNewPlanningActivity({
                          id: '',
                          projectId: selectedPlanningProjectId,
                          name: '',
                          startMonth: new Date().getMonth(),
                          startYear: new Date().getFullYear(),
                          endMonth: (new Date().getMonth() + 1) % 12,
                          endYear: new Date().getMonth() === 11 ? new Date().getFullYear() + 1 : new Date().getFullYear(),
                          startDate: '',
                          endDate: '',
                          color: '#0033FF',
                          order: planningActivities.filter(a => a.projectId === selectedPlanningProjectId).length,
                          category: '',
                          description: '',
                          isHidden: false
                        } as any);
                      }}
                      className="bg-axia-primary text-white px-6 py-2 rounded-xl font-bold text-sm hover:shadow-lg hover:shadow-axia-primary/25 transition-all flex items-center gap-2"
                    >
                      <Plus size={18} />
                      Nova Atividade
                    </button>
                    <button 
                      onClick={() => selectedPlanningProjectId && exportPlanningToPDF(selectedPlanningProjectId)}
                      disabled={!selectedPlanningProjectId}
                      className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 px-6 py-2 rounded-xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      <Download size={18} className="text-red-500" />
                      PDF
                    </button>
                    <button 
                      onClick={() => selectedPlanningProjectId && exportPlanningToPNG(selectedPlanningProjectId)}
                      disabled={!selectedPlanningProjectId}
                      className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 px-6 py-2 rounded-xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      <Download size={18} className="text-blue-500" />
                      PNG
                    </button>
                    {hiddenMonths.length > 0 && (
                      <button 
                        onClick={showAllMonths}
                        className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 px-6 py-2 rounded-xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-2"
                        title="Restaurar visualização de todos os meses ocultos"
                      >
                        <Eye size={18} className="text-emerald-500" />
                        Meses Ocultos ({hiddenMonths.length})
                      </button>
                    )}
                    <button 
                      onClick={() => setShowHiddenActivities(!showHiddenActivities)}
                      className={`px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border ${
                        showHiddenActivities 
                          ? 'bg-amber-50 text-amber-600 border-amber-200' 
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800'
                      }`}
                      title={showHiddenActivities ? "Ocultar atividades planejadas invisíveis" : "Mostrar atividades planejadas invisíveis"}
                    >
                      {showHiddenActivities ? <Eye size={18} /> : <EyeOff size={18} />}
                    </button>
                  </div>
                </div>

                {!selectedPlanningProjectId ? (
                  <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-12 text-center">
                    <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                      <TrendingUp size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Selecione um projeto</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm mx-auto">Selecione um projeto acima para visualizar ou criar seu planejamento mensal.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Month Gantt Chart */}
                    <div ref={planningRef} id="planning-chart" className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-sm overflow-hidden">
                      <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-axia-primary/10 flex items-center justify-center text-axia-primary">
                            <TrendingUp size={20} />
                          </div>
                          <div>
                            <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">Cronograma de Planejamento</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              {projects.find(p => p.id === selectedPlanningProjectId)?.name}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 export-hide">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Formato:</span>
                            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                              <button
                                onClick={() => setUseRelativePlanningMonths(false)}
                                className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${
                                  !useRelativePlanningMonths 
                                    ? 'bg-white dark:bg-slate-700 text-axia-primary shadow-sm' 
                                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                                }`}
                              >
                                Calendário
                              </button>
                              <button
                                onClick={() => setUseRelativePlanningMonths(true)}
                                className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${
                                  useRelativePlanningMonths 
                                    ? 'bg-white dark:bg-slate-700 text-axia-primary shadow-sm' 
                                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                                }`}
                              >
                                Relativo
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Escala:</span>
                            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                              <button
                                onClick={() => setPlanningViewScale('month')}
                                className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${
                                  planningViewScale === 'month' 
                                    ? 'bg-white dark:bg-slate-700 text-axia-primary shadow-sm' 
                                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                                }`}
                              >
                                Meses
                              </button>
                              <button
                                onClick={() => setPlanningViewScale('week')}
                                className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${
                                  planningViewScale === 'week' 
                                    ? 'bg-white dark:bg-slate-700 text-axia-primary shadow-sm' 
                                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                                  }`}
                              >
                                Semanas
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Exibir:</span>
                            <select 
                              value={planningViewMonths}
                              onChange={(e) => setPlanningViewMonths(e.target.value === 'auto' ? 'auto' : Number(e.target.value))}
                              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-axia-primary/20 transition-all cursor-pointer"
                            >
                              <option value="auto">Automático (Todas)</option>
                              <option value="6">06 Meses</option>
                              <option value="12">12 Meses</option>
                              <option value="18">18 Meses</option>
                              <option value="24">24 Meses</option>
                              <option value="36">36 Meses</option>
                              <option value="48">48 Meses</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="relative border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/30 dark:bg-slate-800/20 shadow-inner">
                        <div className="flex">
                          {/* Sidebar Labels */}
                          <div className="w-[280px] flex-shrink-0 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 z-20">
                            <div className="h-16 border-b border-slate-200 dark:border-slate-700 flex flex-col justify-center px-6 bg-slate-50/50 dark:bg-slate-800/20">
                              <span className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest italic">Atividades do Projeto</span>
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Detalhamento Mensal</span>
                            </div>
                            {currentProjectPlanningActivities.map((activity) => (
                              <div 
                                key={activity.id} 
                                className="h-14 border-b border-slate-100 dark:border-slate-800 flex items-center px-4 group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                                onClick={() => {
                                  setEditingPlanningActivity(activity);
                                  setNewPlanningActivity({
                                    id: activity.id,
                                    projectId: activity.projectId,
                                    name: activity.name,
                                    startMonth: activity.startMonth,
                                    startYear: activity.startYear,
                                    endMonth: activity.endMonth,
                                    endYear: activity.endYear,
                                    color: activity.color,
                                    order: activity.order,
                                    category: activity.category || '',
                                    description: activity.description || '',
                                    isHidden: activity.isHidden
                                  });
                                  setIsAddingPlanningActivity(true);
                                }}
                              >
                                <div className="flex flex-col">
                                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 leading-tight group-hover:text-axia-primary transition-colors">
                                    {activity.name}
                                  </span>
                                  {activity.category && (
                                    <span className="text-[8px] font-bold text-axia-primary/60 uppercase tracking-widest leading-none mt-1">
                                      {activity.category}
                                    </span>
                                  )}
                                </div>
                                <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleTogglePlanningActivityVisibility(activity);
                                    }}
                                    className={`p-1.5 transition-colors ${activity.isHidden ? 'text-amber-500 hover:text-amber-600' : 'text-slate-400 hover:text-axia-primary'}`}
                                    title={activity.isHidden ? "Mostrar atividade" : "Ocultar atividade"}
                                  >
                                    {activity.isHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                                  </button>
                                </div>
                              </div>
                            ))}
                            <div className="h-14 bg-slate-50 dark:bg-slate-800/50" />
                          </div>

                          {/* Chart Grid */}
                          <div className="flex-grow overflow-x-auto overflow-y-hidden border-l border-slate-200 dark:border-slate-700 custom-scrollbar">
                            <div className="relative" style={{ width: planningTimelineData ? planningTimelineData.numMonths * PLANNING_MONTH_WIDTH : '100%' }}>
                              {/* Header Year/Months */}
                              <div className="bg-slate-50/80 dark:bg-slate-800/80 sticky top-0 z-30">
                                {/* Year Row */}
                                <div className="h-6 flex border-b border-slate-200 dark:border-slate-700">
                                  {useRelativePlanningMonths ? (
                                    <div 
                                      className="flex items-center justify-center border-b border-slate-200 dark:border-slate-700 text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-100/50 dark:bg-slate-900/50 w-full"
                                    >
                                      PRAZO RELATIVO DE EXECUÇÃO
                                    </div>
                                  ) : (
                                    planningTimelineData?.years.map((y, i) => (
                                      <div 
                                        key={`year-${y.year}-${i}`} 
                                        className="flex items-center justify-center border-r border-slate-200 dark:border-slate-700 text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-100/50 dark:bg-slate-900/50"
                                        style={{ width: y.monthsCount * PLANNING_MONTH_WIDTH }}
                                      >
                                        {y.year}
                                      </div>
                                    ))
                                  )}
                                </div>
                                {/* Month Row */}
                                <div className={`${planningViewScale === 'month' ? 'h-10' : 'h-14'} flex border-b border-slate-200 dark:border-slate-700`}>
                                  {planningTimelineData && planningTimelineData.visibleMonths.map((m, index) => {
                                    const monthNamesShort = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
                                    return (
                                      <div 
                                        key={`month-header-${m.absMonth}`} 
                                        className="flex flex-col items-center justify-center border-r border-slate-100 dark:border-slate-800 text-[9px] font-bold text-slate-400 group relative"
                                        style={{ width: PLANNING_MONTH_WIDTH, minWidth: PLANNING_MONTH_WIDTH }}
                                      >
                                        <div className="flex-grow flex items-center justify-center w-full relative">
                                          {useRelativePlanningMonths ? `Mês ${index + 1}` : monthNamesShort[m.month]}
                                          <div 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleMonthVisibility(`${m.year}-${m.month}`);
                                            }}
                                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500 cursor-pointer pointer-events-auto z-40"
                                            title="Ocultar mês"
                                          >
                                            <X size={10} />
                                          </div>
                                        </div>
                                        
                                        {planningViewScale === 'week' && (
                                          <div className="flex w-full border-t border-slate-100 dark:border-slate-800 h-6">
                                            {[1, 2, 3, 4].map(w => (
                                              <div key={`w-${w}`} className="flex-1 border-r last:border-r-0 border-slate-50 dark:border-slate-800/50 flex items-center justify-center text-[7px] font-black text-slate-300">
                                                S{w}
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
 
                              {/* Bars Area */}
                              <div className="relative min-h-[400px]">
                                 {/* Vertical Grid Lines */}
                                 <div className="absolute inset-0 flex pointer-events-none">
                                  {planningTimelineData && planningTimelineData.visibleMonths.map((m) => (
                                    <div 
                                      key={`grid-${m.absMonth}`} 
                                      className="border-r border-slate-200 dark:border-slate-700 h-full flex" 
                                      style={{ width: PLANNING_MONTH_WIDTH, minWidth: PLANNING_MONTH_WIDTH }}
                                    >
                                      {planningViewScale === 'week' && (
                                        <>
                                          <div className="flex-1 border-r border-slate-100 dark:border-slate-800/30 h-full" />
                                          <div className="flex-1 border-r border-slate-100 dark:border-slate-800/30 h-full" />
                                          <div className="flex-1 border-r border-slate-100 dark:border-slate-800/30 h-full" />
                                          <div className="flex-1 h-full" />
                                        </>
                                      )}
                                    </div>
                                  ))}
                                </div>
 
                                {/* Today Marker Line */}
                                {showTodayLine && !useRelativePlanningMonths && planningTimelineData && planningTimelineData.exactTodayAbs >= planningTimelineData.startAbs && planningTimelineData.exactTodayAbs <= (planningTimelineData.endAbs + 1) && !hiddenMonths.includes(`${Math.floor(planningTimelineData.exactTodayAbs / 12)}-${Math.floor(planningTimelineData.exactTodayAbs % 12)}`) && (
                                  <div 
                                    className="absolute top-0 bottom-0 w-px border-l-2 border-dashed border-red-500/40 z-20 pointer-events-none"
                                    style={{ 
                                      left: getMonthPosition(Math.floor(planningTimelineData.exactTodayAbs), planningTimelineData.visibleMonths, PLANNING_MONTH_WIDTH) + (planningTimelineData.exactTodayAbs % 1) * PLANNING_MONTH_WIDTH,
                                    }}
                                  >
                                    <div 
                                      onClick={() => setShowTodayLine(false)}
                                      className="absolute top-2 -left-[18px] px-1.5 py-0.5 bg-red-500 text-white text-[7px] font-black rounded-sm uppercase tracking-tighter shadow-md z-30 flex items-center gap-1 cursor-pointer pointer-events-auto hover:scale-110 active:scale-95 transition-transform"
                                      title="Clique para ocultar"
                                    >
                                      <Calendar className="w-2 h-2" />
                                      HOJE
                                    </div>
                                  </div>
                                )}

                                {currentProjectPlanningActivities.map((activity) => {
                                  if (!planningTimelineData) return null;
                                  
                                  let absStart = activity.startYear * 12 + activity.startMonth;
                                  let absEnd = activity.endYear * 12 + activity.endMonth;
                                  
                                  let startOffset = 0;
                                  let endOffset = 0;

                                  if (activity.startDate) {
                                    const d = new Date(activity.startDate);
                                    const day = d.getDate();
                                    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
                                    startOffset = (day - 1) / daysInMonth;
                                  }

                                  if (activity.endDate) {
                                    const d = new Date(activity.endDate);
                                    const day = d.getDate();
                                    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
                                    endOffset = day / daysInMonth;
                                  } else {
                                    endOffset = 1; // Default to end of month if no specific date
                                  }
                                  
                                  const left = getMonthPosition(Math.floor(absStart), planningTimelineData.visibleMonths, PLANNING_MONTH_WIDTH) + startOffset * PLANNING_MONTH_WIDTH;
                                  const width = (getMonthPosition(Math.floor(absEnd), planningTimelineData.visibleMonths, PLANNING_MONTH_WIDTH) + endOffset * PLANNING_MONTH_WIDTH) - left;

                                  if (width <= 0) return null;

                                  return (
                                    <div key={activity.id} className="h-14 border-b border-slate-50 dark:border-slate-800/50 relative group">
                                      <motion.div 
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="absolute h-8 top-3 rounded-lg shadow-sm cursor-pointer hover:brightness-110 active:scale-[0.98] transition-all z-10 flex items-center gap-2 px-3 group/bar overflow-hidden"
                                        style={{ 
                                          left,
                                          width,
                                          backgroundColor: activity.color,
                                          boxShadow: `0 4px 14px ${activity.color}44`
                                        }}
                                        onClick={() => {
                                          setEditingPlanningActivity(activity);
                                          setNewPlanningActivity({
                                            id: activity.id,
                                            projectId: activity.projectId,
                                            name: activity.name,
                                            startMonth: activity.startMonth,
                                            startYear: activity.startYear,
                                            endMonth: activity.endMonth,
                                            endYear: activity.endYear,
                                            color: activity.color,
                                            order: activity.order,
                                            category: activity.category || '',
                                            description: activity.description || '',
                                            isHidden: !!activity.isHidden
                                          });
                                          setIsAddingPlanningActivity(true);
                                        }}
                                      >
                                        <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover/bar:opacity-100 transition-opacity pointer-events-none" />
                                        <span className="text-[10px] font-black text-white truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
                                          {activity.name}
                                        </span>
                                      </motion.div>
                                    </div>
                                  );
                                })}
                                {/* Buffer Row */}
                                <div className="h-14 border-b border-slate-50 dark:border-slate-800/50" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Table View */}
                    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                      <div className="p-6 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
                        <h3 className="font-bold text-slate-800 dark:text-white">Gerenciar Atividades do Planejamento</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-50 dark:border-slate-800">
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Atividade</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Período</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Cor</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Ordem</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Ações</th>
                            </tr>
                          </thead>
                          <Reorder.Group 
                            as="tbody" 
                            axis="y" 
                            values={currentProjectPlanningActivities} 
                            onReorder={handleReorderPlanningActivities}
                            className="divide-y divide-slate-100 dark:divide-slate-800"
                          >
                            {currentProjectPlanningActivities.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic font-medium">Nenhuma atividade planejada.</td>
                              </tr>
                            ) : (
                              currentProjectPlanningActivities.map((activity) => (
                                <Reorder.Item 
                                  key={activity.id} 
                                  value={activity} 
                                  as="tr"
                                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group cursor-default"
                                >
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                      <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 transition-colors p-1">
                                        <GripVertical size={16} />
                                      </div>
                                      <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: activity.color }} />
                                          <span className="font-bold text-slate-800 dark:text-slate-200">{activity.name}</span>
                                        </div>
                                        {activity.category && (
                                          <span className="text-[9px] font-bold text-axia-primary uppercase tracking-widest mt-1 ml-4">{activity.category}</span>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                                      {MONTHS[activity.startMonth]} / {activity.startYear} - {MONTHS[activity.endMonth]} / {activity.endYear}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                      <div className="w-6 h-6 rounded border border-slate-200 dark:border-slate-700 shadow-sm" style={{ backgroundColor: activity.color }} />
                                      <span className="text-[10px] font-mono text-slate-400">{activity.color}</span>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                                      <button 
                                        onClick={() => handleMovePlanningActivity(activity, 'up')}
                                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400"
                                      >
                                        <ChevronUp size={14} />
                                      </button>
                                      <button 
                                        onClick={() => handleMovePlanningActivity(activity, 'down')}
                                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400"
                                      >
                                        <ChevronDown size={14} />
                                      </button>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button 
                                        onClick={() => {
                                          setEditingPlanningActivity(activity);
                                          setNewPlanningActivity({
                                            id: activity.id,
                                            projectId: activity.projectId,
                                            name: activity.name,
                                            startMonth: activity.startMonth,
                                            startYear: activity.startYear,
                                            endMonth: activity.endMonth,
                                            endYear: activity.endYear,
                                            color: activity.color,
                                            order: activity.order,
                                            category: activity.category || '',
                                            description: activity.description || '',
                                            isHidden: !!activity.isHidden
                                          });
                                          setIsAddingPlanningActivity(true);
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-axia-primary transition-colors"
                                      >
                                        <Pencil size={14} />
                                      </button>
                                      <button 
                                        onClick={() => handleDeletePlanningActivity(activity.id)}
                                        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </td>
                                </Reorder.Item>
                              ))
                            )}
                          </Reorder.Group>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'measurements' && (
              <motion.div 
                key="measurements"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-display font-bold text-slate-900 dark:text-white">Medições de Obras</h2>
                    <p className="text-slate-500 dark:text-slate-400">Registre e acompanhe as medições mensais de cada projeto.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* New Measurement Form */}
                  <div className="lg:col-span-1">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm sticky top-8">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold flex items-center gap-2 dark:text-white">
                          <Receipt className="text-axia-primary" /> {editingMeasurement ? 'Editar Medição' : 'Nova Medição'}
                        </h3>
                        {editingMeasurement && (
                          <button 
                            onClick={() => {
                              setEditingMeasurement(null);
                              setNewMeasurement({ projectId: '', date: '', value: '', description: '' });
                            }}
                            className="text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <X size={18} />
                          </button>
                        )}
                      </div>
                      <form onSubmit={handleAddMeasurement} className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Projeto</label>
                          <select 
                            required
                            value={newMeasurement.projectId}
                            onChange={(e) => setNewMeasurement({...newMeasurement, projectId: e.target.value})}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-axia-primary/20 dark:text-white"
                          >
                            <option value="">Selecione a obra...</option>
                            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Data da Medição</label>
                          <input 
                            required
                            type="date" 
                            value={newMeasurement.date}
                            onChange={(e) => setNewMeasurement({...newMeasurement, date: e.target.value})}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-axia-primary/20 dark:text-white" 
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Valor Medido (R$)</label>
                          <input 
                            required
                            type="number" 
                            value={newMeasurement.value}
                            onChange={(e) => setNewMeasurement({...newMeasurement, value: e.target.value})}
                            placeholder="0,00"
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-axia-primary/20 dark:text-white" 
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Descrição dos Serviços</label>
                          <textarea 
                            required
                            rows={3}
                            value={newMeasurement.description}
                            onChange={(e) => setNewMeasurement({...newMeasurement, description: e.target.value})}
                            placeholder="Ex: Execução de 500m de cabeamento..."
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-axia-primary/20 dark:text-white"
                          ></textarea>
                        </div>
                        <button 
                          type="submit"
                          className="w-full bg-axia-primary text-white py-3 rounded-xl font-bold hover:bg-axia-primary/90 transition-all shadow-lg shadow-axia-primary/20 flex items-center justify-center gap-2"
                        >
                          {editingMeasurement ? <Pencil size={18} /> : <Plus size={18} />}
                          {editingMeasurement ? 'Atualizar Medição' : 'Registrar Medição'}
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* Measurements History */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                      <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <h3 className="text-lg font-bold dark:text-white">Histórico de Medições</h3>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 dark:text-slate-500">
                          <TrendingUp size={14} />
                          <span>Total Medido: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(measurements.reduce((acc, m) => acc + (m.value || 0), 0))}</span>
                        </div>
                      </div>
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {measurements.length === 0 ? (
                          <div className="p-20 text-center text-slate-400 dark:text-slate-600">
                            <Receipt size={48} className="mx-auto mb-4 opacity-20" />
                            <p>Nenhuma medição registrada ainda.</p>
                          </div>
                        ) : (
                          measurements.map((measurement) => (
                            <div key={measurement.id} className="p-6 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-bold text-slate-900 dark:text-white">{measurement.projectName}</h4>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900/30">
                                      {measurement.status === 'paid' ? 'Pago' : measurement.status === 'approved' ? 'Aprovado' : 'Pendente'}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                    <Calendar size={12} /> {measurement.date}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-lg font-bold text-axia-accent">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(measurement.value || 0)}
                                  </p>
                                  <div className="flex items-center justify-end gap-2 mt-1">
                                    <button 
                                      onClick={() => startEditingMeasurement(measurement)}
                                      className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-axia-primary transition-colors"
                                      title="Editar Medição"
                                    >
                                      <Pencil size={14} />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteMeasurement(measurement)}
                                      className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                                      title="Excluir Medição"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                              <p className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 italic">
                                "{measurement.description}"
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'rc-control' && (
              <motion.div 
                key="rc-control"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="space-y-6"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-3xl font-display font-bold text-slate-900 dark:text-white">Controle de RC de Consumo</h2>
                    <p className="text-slate-500 dark:text-slate-400">Gerencie as solicitações de RC necessárias para medição.</p>
                  </div>
                  <button 
                    onClick={() => setIsAddingRCRequest(true)}
                    className="bg-axia-primary text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-axia-primary/90 shadow-lg shadow-axia-primary/20 transition-all"
                  >
                    <Plus size={20} />
                    Nova Solicitação
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* RC Request List */}
                  <div className="lg:col-span-2 space-y-4">
                    {consumptionRCRequests.length === 0 ? (
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-20 text-center text-slate-400 dark:text-slate-600 shadow-sm">
                        <Receipt size={64} className="mx-auto mb-4 opacity-10" />
                        <p className="text-lg font-medium">Nenhuma solicitação de RC registrada.</p>
                        <p className="text-sm">Clique em "Nova Solicitação" para começar.</p>
                      </div>
                    ) : (
                      consumptionRCRequests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((request) => (
                        <div 
                          key={request.id} 
                          onClick={() => setViewingRCRequest(request)}
                          className={`bg-white dark:bg-slate-900 border ${viewingRCRequest?.id === request.id ? 'border-axia-primary ring-2 ring-axia-primary/10' : 'border-slate-200 dark:border-slate-800'} rounded-2xl p-6 shadow-sm hover:shadow-md transition-all cursor-pointer group`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                request.status === 'received' ? 'bg-green-100 dark:bg-green-900/30 text-green-600' :
                                request.status === 'pending' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' :
                                request.status === 'canceled' ? 'bg-slate-100 dark:bg-slate-800/50 text-slate-500' :
                                'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                              }`}>
                                <FileText size={24} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-axia-primary transition-colors">{request.projectName}</h4>
                                  <span className="text-[10px] font-black text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                    {projects.find(p => p.id === request.projectId)?.contractNumber || '---'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 mt-1">
                                  <span className="text-xs font-bold text-axia-primary">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(request.value || 0)}
                                  </span>
                                  <span className="text-xs text-slate-400 dark:text-slate-500">•</span>
                                  <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                    <Calendar size={12} /> Solicitação: {formatInputDate(request.requestDate)}
                                  </span>
                                  {request.rcNumber && (
                                    <span className="text-xs font-bold text-axia-primary bg-axia-primary/10 px-2 py-0.5 rounded-full">
                                      RC: {request.rcNumber}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center justify-end gap-2">
                              {requestToDelete === request.id ? (
                                <div className="flex items-center gap-2 animate-pulse bg-red-50 dark:bg-red-900/10 p-1.5 rounded-xl border border-red-100 dark:border-red-900/20">
                                  <span className="text-[10px] font-bold text-red-600 px-1">Excluir?</span>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleDeleteRCRequest(request.id); }}
                                    className="p-1 px-2 bg-red-600 text-white rounded-lg text-[10px] font-bold"
                                  >
                                    Sim
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); setRequestToDelete(null); }}
                                    className="p-1 px-2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-bold"
                                  >
                                    Não
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                    request.status === 'received' ? 'bg-green-100 text-green-700 border border-green-200' :
                                    request.status === 'returned' ? 'bg-red-100 text-red-700 border border-red-200' :
                                    request.status === 'pending' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                                    request.status === 'canceled' ? 'bg-slate-100 text-slate-600 border border-slate-350 dark:border-slate-700' :
                                    'bg-blue-100 text-blue-700 border border-blue-200'
                                  }`}>
                                    {request.status === 'received' ? 'Recebido' : 
                                     request.status === 'returned' ? 'Devolvido' : 
                                     request.status === 'pending' ? 'Pendente' : 
                                     request.status === 'canceled' ? 'Cancelado' : 'Solicitado'}
                                  </span>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); setRequestToDelete(request.id); }}
                                    className="p-2 hover:bg-red-50 hover:text-red-600 rounded-lg text-slate-400 transition-colors"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* RC Request Details / Timeline */}
                  <div className="space-y-6">
                    {viewingRCRequest ? (
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm sticky top-6">
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="font-bold text-slate-900 dark:text-white">Detalhes da Solicitação</h3>
                          <button onClick={() => setViewingRCRequest(null)} className="text-slate-400 hover:text-slate-600">
                            <X size={20} />
                          </button>
                        </div>

                        <div className="space-y-4 mb-8">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider mb-1">Obra</p>
                              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{viewingRCRequest.projectName}</p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider mb-1">Contrato</p>
                              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                {projects.find(p => p.id === viewingRCRequest.projectId)?.contractNumber || 'N/A'}
                              </p>
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider mb-1">Valor</p>
                            <p className="text-sm font-bold text-axia-primary">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(viewingRCRequest.value || 0)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider mb-1">Status Atual</p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {['requested', 'pending', 'returned', 'received', 'canceled'].map((s) => (
                                <button
                                  key={s}
                                  onClick={() => {
                                    if (s === 'received' && !viewingRCRequest.rcNumber) {
                                      setIsUpdatingRCStatus(s);
                                      setTempRCNumber(viewingRCRequest.rcNumber || '');
                                    } else if (s === viewingRCRequest.status) {
                                      // Do nothing if clicking same status
                                    } else {
                                      handleUpdateRCStatus(viewingRCRequest, s as any);
                                      setIsUpdatingRCStatus(null);
                                    }
                                  }}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                    viewingRCRequest.status === s 
                                      ? s === 'returned' ? 'bg-red-600 text-white border-red-600 shadow-sm' 
                                        : s === 'canceled' ? 'bg-slate-500 text-white border-slate-500 shadow-sm'
                                        : 'bg-axia-primary text-white border-axia-primary shadow-sm' 
                                      : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-axia-primary/30'
                                  }`}
                                >
                                  {s === 'requested' ? 'Solicitado' : 
                                   s === 'pending' ? 'Pendente' : 
                                   s === 'returned' ? 'Devolvido' : 
                                   s === 'canceled' ? 'Cancelado' : 'Recebido'}
                                </button>
                              ))}
                            </div>
                          </div>

                          {viewingRCRequest.signedBulletin && (
                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
                               <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider mb-3 px-1">Boletim de Medição Anexado</p>
                               <a 
                                 href={viewingRCRequest.signedBulletin.url}
                                 download={viewingRCRequest.signedBulletin.name}
                                 className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-axia-primary hover:shadow-md transition-all group"
                               >
                                 <div className="w-10 h-10 rounded-lg bg-axia-primary/10 flex items-center justify-center text-axia-primary group-hover:bg-axia-primary group-hover:text-white transition-colors">
                                   <Download size={20} />
                                 </div>
                                 <div className="flex-1 overflow-hidden">
                                   <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{viewingRCRequest.signedBulletin.name}</p>
                                   <p className="text-[10px] text-slate-400 font-medium">{viewingRCRequest.signedBulletin.size || 'Arquivo'}</p>
                                 </div>
                               </a>
                            </div>
                          )}

                          {isUpdatingRCStatus === 'received' && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="bg-axia-primary/5 p-4 rounded-2xl border border-axia-primary/10 space-y-3"
                            >
                              <label className="text-[10px] font-bold text-axia-primary uppercase tracking-widest">Informar Número da RC</label>
                              <div className="flex gap-2">
                                <input 
                                  type="text"
                                  value={tempRCNumber}
                                  onChange={(e) => setTempRCNumber(e.target.value)}
                                  placeholder="Digite o número da RC..."
                                  className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-axia-primary/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-axia-primary/20 dark:text-white"
                                />
                                <button 
                                  onClick={() => {
                                    if (tempRCNumber.trim()) {
                                      handleUpdateRCStatus(viewingRCRequest, 'received', tempRCNumber);
                                      setIsUpdatingRCStatus(null);
                                    }
                                  }}
                                  className="bg-axia-primary text-white px-4 py-2 rounded-lg text-xs font-bold"
                                >
                                  Salvar
                                </button>
                              </div>
                            </motion.div>
                          )}

                          {viewingRCRequest.rcNumber && (
                            <div>
                              <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider mb-1">Número da RC</p>
                              <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center justify-between">
                                <p className="text-lg font-mono font-bold text-axia-primary">{viewingRCRequest.rcNumber}</p>
                                <button 
                                  onClick={() => {
                                    setIsUpdatingRCStatus('received');
                                    setTempRCNumber(viewingRCRequest.rcNumber || '');
                                  }}
                                  className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-400 transition-colors"
                                >
                                  <Pencil size={14} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                          <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-4 flex items-center gap-2">
                            <History size={14} />
                            Linha do Tempo
                          </h4>
                          
                          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                            {viewingRCRequest.observations.map((obs, idx) => (
                              <div key={obs.id} className="relative pl-4 pb-4 border-l border-slate-100 dark:border-slate-800 last:pb-0">
                                <div className="absolute left-[-4.5px] top-1.5 w-2 h-2 rounded-full bg-axia-primary ring-4 ring-white dark:ring-slate-900" />
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span className="font-bold text-slate-900 dark:text-white">{obs.userName}</span>
                                    <span className="text-slate-400">{obs.date}</span>
                                  </div>
                                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed italic border-l-2 border-slate-100 dark:border-slate-800 pl-2">
                                    "{obs.text}"
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="mt-6 flex gap-2">
                            <input
                              type="text"
                              value={newRCObservation}
                              onChange={(e) => setNewRCObservation(e.target.value)}
                              placeholder="Adicionar observação..."
                              className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-axia-primary/20 dark:text-white"
                              onKeyDown={(e) => e.key === 'Enter' && handleAddRCObservation(viewingRCRequest)}
                            />
                            <button 
                              onClick={() => handleAddRCObservation(viewingRCRequest)}
                              disabled={!newRCObservation.trim()}
                              className="w-10 h-10 bg-axia-primary text-white rounded-xl flex items-center justify-center hover:bg-axia-primary/90 shadow-sm disabled:opacity-50 disabled:grayscale transition-all"
                            >
                              <Plus size={20} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-400 dark:text-slate-600 h-full flex flex-col items-center justify-center">
                        <div className="w-16 h-16 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center mb-4 shadow-sm">
                          <MessageSquare size={32} className="opacity-20" />
                        </div>
                        <p className="text-sm font-medium">Selecione uma solicitação para ver os detalhes e a linha do tempo.</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'travel-control' && (
              <motion.div 
                key="travel-control"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="space-y-6"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-3xl font-display font-bold text-slate-900 dark:text-white tracking-tight">Controle de Viagens</h2>
                    <p className="text-slate-500 dark:text-slate-400">Gerenciamento e controle de custos de viagens realizadas, agrupadas por mês.</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button 
                      onClick={exportTravelsToPDF}
                      className="border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all font-sans shadow-sm"
                      title="Salvar controle de viagens atual como PDF"
                    >
                      <FileText size={20} />
                      Exportar PDF
                    </button>
                    <button 
                      onClick={() => {
                        setEditingTravel(null);
                        setNewTravel({
                          name: '',
                          cost: 0,
                          inspector: '',
                          origin: '',
                          destination: '',
                          startDate: new Date().toISOString().split('T')[0],
                          endDate: new Date().toISOString().split('T')[0],
                        });
                        setIsAddingTravel(true);
                      }}
                      className="bg-axia-primary text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-axia-primary/90 shadow-lg shadow-axia-primary/20 transition-all font-sans"
                    >
                      <Plus size={20} />
                      Cadastrar Viagem
                    </button>
                  </div>
                </div>

                {/* KPI/Summary cards */}
                {(() => {
                  const totalCost = travels.reduce((acc, curr) => acc + (Number(curr.cost) || 0), 0);
                  const travelCount = travels.length;
                  const averageCost = travelCount > 0 ? totalCost / travelCount : 0;
                  const maxTravel = travels.reduce((max, curr) => (Number(curr.cost) || 0) > (max ? (Number(max.cost) || 0) : 0) ? curr : max, null as Travel | null);

                  const formatBRL = (val: number) => {
                    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
                  };

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
                      <StatCard 
                        title="Total de Viagens" 
                        value={String(travelCount)} 
                        change="Total acumulado das viagens realizadas"
                        icon={<MapPin size={24} className="text-blue-600 dark:text-blue-400" />}
                        color="blue"
                      />
                      <StatCard 
                        title="Custo Acumulado" 
                        value={formatBRL(totalCost)} 
                        change="Soma total de despesas com viagens"
                        icon={<DollarSign size={24} className="text-green-600 dark:text-green-400" />}
                        color="green"
                      />
                      <StatCard 
                        title="Média por Viagem" 
                        value={formatBRL(averageCost)} 
                        change="Média geral de custos por roteiro"
                        icon={<TrendingUp size={24} className="text-orange-600 dark:text-orange-400" />}
                        color="orange"
                      />
                      <StatCard 
                        title="Maior Custo" 
                        value={maxTravel ? formatBRL(maxTravel.cost) : 'R$ 0,00'} 
                        change={maxTravel ? maxTravel.name : "Nenhuma viagem registrada"}
                        icon={<AlertCircle size={24} className="text-slate-600 dark:text-slate-400" />}
                        color="slate"
                      />
                    </div>
                  );
                })()}

                {/* Filters Row */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text"
                      value={searchTravelQuery}
                      onChange={(e) => setSearchTravelQuery(e.target.value)}
                      placeholder="Buscar por nome da viagem, origem ou destino..."
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-axia-primary/20 text-slate-700 dark:text-slate-200 transition-colors"
                    />
                  </div>
                  <div className="w-full md:w-64 relative">
                    <select
                      value={filterInspector}
                      onChange={(e) => setFilterInspector(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl py-2 pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-axia-primary/20 text-slate-700 dark:text-slate-200 transition-colors appearance-none"
                    >
                      <option value="">Todos os Fiscais</option>
                      {Array.from(new Set(travels.map(t => t.inspector).filter(Boolean))).map(inspector => (
                        <option key={inspector} value={inspector}>{inspector}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                  </div>
                </div>

                {/* Grouped Monthly Display */}
                {(() => {
                  const formatDateBR = (dateStr: string) => {
                    if (!dateStr) return '';
                    const parts = dateStr.split('-');
                    if (parts.length === 3) {
                      return `${parts[2]}/${parts[1]}/${parts[0]}`;
                    }
                    return dateStr;
                  };

                  const formatMonthYear = (myStr: string) => {
                    if (myStr === 'Sem data') return 'Sem data';
                    const [year, month] = myStr.split('-');
                    const monthNames = [
                      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
                    ];
                    const monthIndex = parseInt(month, 10) - 1;
                    if (monthIndex >= 0 && monthIndex < 12) {
                      return `${monthNames[monthIndex]} de ${year}`;
                    }
                    return myStr;
                  };

                  const filteredTravels = travels.filter(t => {
                    const matchesSearch = 
                      (t.name?.toLowerCase().includes(searchTravelQuery.toLowerCase()) || false) ||
                      (t.origin?.toLowerCase().includes(searchTravelQuery.toLowerCase()) || false) ||
                      (t.destination?.toLowerCase().includes(searchTravelQuery.toLowerCase()) || false);
                    
                    const matchesInspector = !filterInspector || t.inspector === filterInspector;
                    
                    return matchesSearch && matchesInspector;
                  });

                  if (filteredTravels.length === 0) {
                    return (
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-20 text-center text-slate-400 dark:text-slate-600 shadow-sm">
                        <MapPin size={64} className="mx-auto mb-4 opacity-10 text-slate-300" />
                        <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">Nenhuma viagem encontrada.</p>
                        <p className="text-sm text-slate-400">Tente ajustar a busca ou clique em "Cadastrar Viagem".</p>
                      </div>
                    );
                  }

                  // Group by Month Year
                  const grouped: { [key: string]: Travel[] } = {};
                  filteredTravels.forEach(t => {
                    const key = t.monthYear || 'Sem data';
                    if (!grouped[key]) grouped[key] = [];
                    grouped[key].push(t);
                  });

                  const sortedMonthKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

                  return (
                    <div className="space-y-8">
                      {sortedMonthKeys.map(monthYearKey => {
                        const monthTravels = grouped[monthYearKey].sort((a,b) => a.startDate.localeCompare(b.startDate));
                        const monthTotalCost = monthTravels.reduce((acc, curr) => acc + (Number(curr.cost) || 0), 0);
                        const formatBRL = (val: number) => {
                          return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
                        };

                        return (
                          <div key={monthYearKey} className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-6 animate-fade-in">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4 mb-6">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-axia-primary/10 rounded-lg text-axia-primary">
                                  <Calendar size={18} />
                                </div>
                                <div>
                                  <h3 className="text-xl font-display font-bold text-slate-900 dark:text-white">
                                    {formatMonthYear(monthYearKey)}
                                  </h3>
                                  <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">{monthTravels.length} {monthTravels.length === 1 ? 'viagem registrada' : 'viagens registradas'}</p>
                                </div>
                              </div>
                              <div className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-4 py-2 rounded-xl text-sm font-display font-extrabold shadow-sm border border-emerald-100/10">
                                Total do Mês: {formatBRL(monthTotalCost)}
                              </div>
                            </div>

                            <div className="overflow-x-auto rounded-xl">
                              <table className="w-full text-left border-collapse min-w-[700px]">
                                <thead>
                                  <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-slate-50/50 dark:bg-slate-800/20">
                                    <th className="py-3 px-4">Nome da Viagem</th>
                                    <th className="py-3 px-4">Roteiro (Origem ➔ Destino)</th>
                                    <th className="py-3 px-4">Fiscal Responsável</th>
                                    <th className="py-3 px-4">Período</th>
                                    <th className="py-3 px-4 text-right">Custo</th>
                                    <th className="py-3 px-4 text-center">Ações</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-sm">
                                  {monthTravels.map(travel => (
                                    <tr key={travel.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/10 transition-colors group">
                                      <td className="py-4 px-4">
                                        <p className="font-bold text-slate-900 dark:text-white">{travel.name}</p>
                                      </td>
                                      <td className="py-4 px-4">
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium text-slate-600 dark:text-slate-300">{travel.origin}</span>
                                          <ChevronRight size={14} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                                          <span className="font-bold text-slate-800 dark:text-slate-200">{travel.destination}</span>
                                        </div>
                                      </td>
                                      <td className="py-4 px-4 text-slate-600 dark:text-slate-400">
                                        <div className="flex items-center gap-2">
                                          <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                            {travel.inspector ? travel.inspector.substring(0, 2).toUpperCase() : 'FI'}
                                          </div>
                                          <span className="font-medium">{travel.inspector}</span>
                                        </div>
                                      </td>
                                      <td className="py-4 px-4 text-xs text-slate-500 dark:text-slate-400 font-mono">
                                        {formatDateBR(travel.startDate)} - {formatDateBR(travel.endDate)}
                                      </td>
                                      <td className="py-4 px-4 text-right font-display font-bold text-slate-900 dark:text-white">
                                        {formatBRL(travel.cost)}
                                      </td>
                                      <td className="py-4 px-4">
                                        <div className="flex items-center justify-center gap-1">
                                          <button 
                                            onClick={() => {
                                              setEditingTravel(travel);
                                              setNewTravel({
                                                name: travel.name,
                                                cost: travel.cost,
                                                inspector: travel.inspector,
                                                origin: travel.origin,
                                                destination: travel.destination,
                                                startDate: travel.startDate,
                                                endDate: travel.endDate
                                              });
                                              setIsAddingTravel(true);
                                            }}
                                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-axia-primary transition-colors"
                                            title="Editar"
                                          >
                                            <Pencil size={14} />
                                          </button>
                                          <button 
                                            onClick={() => setTravelToDelete(travel)}
                                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                                            title="Excluir"
                                          >
                                            <Trash2 size={14} />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </motion.div>
            )}

            {activeTab === 'reports' && (
              <motion.div 
                key="reports"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-display font-bold text-slate-900 dark:text-white">Relatórios Semanais</h2>
                    <p className="text-slate-500 dark:text-slate-400">Gerencie e anexe os relatórios de acompanhamento das obras.</p>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => showNotification('Exportando todos os relatórios para PDF...')}
                      className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-lg font-semibold flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Download size={18} />
                      Exportar Tudo
                    </button>
                    <button 
                      onClick={() => {
                        const element = document.getElementById('upload-area');
                        element?.scrollIntoView({ behavior: 'smooth' });
                        showNotification('Preencha os dados abaixo para o novo relatório.');
                      }}
                      className="bg-axia-primary text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 hover:bg-axia-primary/90 transition-colors shadow-lg shadow-axia-primary/20"
                    >
                      <FilePlus size={18} />
                      Novo Relatório
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Upload Area */}
                  <div className="lg:col-span-1 space-y-6" id="upload-area">
                    <div 
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={(e) => { e.preventDefault(); setIsDragging(false); }}
                      className={`
                        border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer
                        ${isDragging 
                          ? 'border-axia-primary bg-axia-primary/5 scale-[1.02]' 
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-axia-primary/50 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }
                      `}
                    >
                      <div className="w-16 h-16 bg-axia-primary/10 rounded-full flex items-center justify-center mb-4 text-axia-primary">
                        <Upload size={32} />
                      </div>
                      <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Anexar Relatório Semanal</h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Arraste seu arquivo PDF aqui ou clique para selecionar do computador.</p>
                      <div className="w-full space-y-4 text-left">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Projeto</label>
                          <select 
                            value={selectedProject}
                            onChange={(e) => setSelectedProject(e.target.value)}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-axia-primary/20 dark:text-white"
                          >
                            <option value="">Selecione a obra...</option>
                            {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Semana de Referência</label>
                          <input 
                            type="date" 
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-axia-primary/20 dark:text-white" 
                          />
                        </div>
                        <button 
                          onClick={handleUpload}
                          disabled={isUploadingReport}
                          className="w-full bg-axia-primary text-white py-2.5 rounded-xl font-bold hover:bg-axia-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                        >
                          {isUploadingReport ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <Upload size={18} />
                          )}
                          {isUploadingReport ? 'Enviando...' : 'Fazer Upload'}
                        </button>
                      </div>
                    </div>

                    <div className="bg-axia-secondary/10 border border-axia-secondary/20 rounded-2xl p-6">
                      <div className="flex items-center gap-3 mb-3 text-axia-secondary">
                        <AlertCircle size={20} />
                        <h4 className="font-bold">Lembrete</h4>
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                        Os relatórios semanais devem ser enviados até toda sexta-feira às 18h para aprovação da diretoria técnica.
                      </p>
                    </div>
                  </div>

                  {/* Reports List */}
                  <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                      <h3 className="text-lg font-bold dark:text-white">Histórico de Envios</h3>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {reports.map((report) => (
                        <div key={report.id} className="p-6 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-center gap-4">
                          <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 rounded-xl flex items-center justify-center flex-shrink-0">
                            <FileText size={24} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-bold text-slate-900 dark:text-white truncate">{report.fileName}</h4>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getReportStatusColor(report.status)}`}>
                                {report.status === 'approved' ? 'Aprovado' : report.status === 'submitted' ? 'Em Análise' : 'Rascunho'}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                              <span className="flex items-center gap-1 font-medium text-axia-primary">
                                <HardHat size={12} /> {report.projectName}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar size={12} /> Final da Semana: {report.weekEnding}
                              </span>
                              <span className="flex items-center gap-1">
                                <TrendingUp size={12} /> {report.fileSize}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => handleDownload(report.fileName)}
                              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-axia-primary transition-colors" 
                              title="Download"
                            >
                              <Download size={18} />
                            </button>
                            <button 
                              onClick={() => handleDelete(report.id)}
                              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-red-500 transition-colors" 
                              title="Excluir"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'updates' && (
              <motion.div 
                key="updates"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-display font-bold text-slate-900 dark:text-white">Atualizações de Status</h2>
                    <p className="text-slate-500 dark:text-slate-400">Registre o progresso diário e comunicados importantes das obras.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* New Update Form */}
                  <div className="lg:col-span-1">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm sticky top-8">
                      <h3 className="text-lg font-bold flex items-center gap-2 mb-6 dark:text-white">
                        <MessageSquare className="text-axia-primary" /> Nova Atualização
                      </h3>
                      <form onSubmit={handleAddStatusUpdate} className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Projeto</label>
                          <select 
                            required
                            value={newStatusUpdate.projectId}
                            onChange={(e) => setNewStatusUpdate({...newStatusUpdate, projectId: e.target.value})}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-axia-primary/20 dark:text-white"
                          >
                            <option value="">Selecione a obra...</option>
                            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Mensagem / Status</label>
                          <textarea 
                            required
                            rows={5}
                            value={newStatusUpdate.message}
                            onChange={(e) => setNewStatusUpdate({...newStatusUpdate, message: e.target.value})}
                            placeholder="Descreva o que aconteceu hoje ou o status atual..."
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-axia-primary/20 dark:text-white"
                          ></textarea>
                        </div>
                        <button 
                          type="submit"
                          className="w-full bg-axia-primary text-white py-3 rounded-xl font-bold hover:bg-axia-primary/90 transition-all shadow-lg shadow-axia-primary/20 flex items-center justify-center gap-2"
                        >
                          <Plus size={18} />
                          Registrar Atualização
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* Updates History */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                      <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <h3 className="text-lg font-bold dark:text-white">Histórico Geral de Atualizações</h3>
                      </div>
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {statusUpdates.length === 0 ? (
                          <div className="p-12 text-center text-slate-400 dark:text-slate-600">
                            <History size={48} className="mx-auto mb-4 opacity-10" />
                            <p>Nenhuma atualização registrada ainda.</p>
                          </div>
                        ) : (
                          statusUpdates.map((update) => {
                            const project = projects.find(p => p.id === update.projectId);
                            return (
                              <div key={update.id} className="p-6 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <div className="flex items-start gap-4">
                                  <div className="w-10 h-10 bg-axia-primary/10 text-axia-primary rounded-full flex items-center justify-center flex-shrink-0">
                                    <User size={20} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                      <h4 className="font-bold text-slate-900 dark:text-white">{update.author}</h4>
                                      <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">{update.date}</span>
                                        <button 
                                          onClick={() => handleDeleteStatusUpdate(update.id)}
                                          className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                                          title="Excluir atualização"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    </div>
                                    <p className="text-[10px] font-bold text-axia-secondary uppercase tracking-wider mb-2">
                                      {project?.name || 'Projeto Excluído'}
                                    </p>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{update.message}</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'bulletin' && (
              <motion.div 
                key="bulletin"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-display font-bold text-slate-900 dark:text-white">Boletim de Medição</h2>
                    <p className="text-slate-500 dark:text-slate-400">Gere e acompanhe os boletins de medição detalhados.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* New Bulletin Form */}
                  <div className="lg:col-span-1">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm sticky top-8">
                      <h3 className="text-lg font-bold flex items-center gap-2 mb-6 dark:text-white">
                        <ClipboardList className="text-axia-primary" /> Novo Boletim
                      </h3>
                      <form onSubmit={handleAddBulletin} className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Obra</label>
                          <select 
                            required
                            value={newBulletin.projectId}
                            onChange={(e) => setNewBulletin({...newBulletin, projectId: e.target.value})}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-axia-primary/20 dark:text-white"
                          >
                            <option value="">Selecione a obra...</option>
                            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">N° de Contrato</label>
                          <input 
                            disabled
                            type="text" 
                            value={projects.find(p => p.id === newBulletin.projectId)?.contractNumber || ''}
                            placeholder="Selecione uma obra..."
                            className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-500 cursor-not-allowed" 
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">N° RC de Consumo</label>
                          <input 
                            required
                            type="text" 
                            value={newBulletin.rcNumber}
                            onChange={(e) => setNewBulletin({...newBulletin, rcNumber: e.target.value})}
                            placeholder="Ex: RC-2024-001"
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-axia-primary/20 dark:text-white" 
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Item SAP</label>
                          <input 
                            required
                            type="text" 
                            value={newBulletin.sapItem}
                            onChange={(e) => setNewBulletin({...newBulletin, sapItem: e.target.value})}
                            placeholder="Ex: 10.20.30"
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-axia-primary/20 dark:text-white" 
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Instalação</label>
                          <input 
                            required
                            type="text" 
                            value={newBulletin.installation}
                            onChange={(e) => setNewBulletin({...newBulletin, installation: e.target.value})}
                            placeholder="Ex: Subestação 01"
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-axia-primary/20 dark:text-white" 
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Fornecedor</label>
                          <input 
                            required
                            type="text" 
                            value={newBulletin.supplier}
                            onChange={(e) => setNewBulletin({...newBulletin, supplier: e.target.value})}
                            placeholder="Ex: Empresa X Ltda"
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-axia-primary/20 dark:text-white" 
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Valor (R$)</label>
                          <input 
                            required
                            type="number" 
                            value={newBulletin.value}
                            onChange={(e) => setNewBulletin({...newBulletin, value: e.target.value})}
                            placeholder="0,00"
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-axia-primary/20 dark:text-white" 
                          />
                        </div>
                        <button 
                          type="submit"
                          disabled={isAddingBulletin}
                          className="w-full bg-axia-primary text-white py-3 rounded-xl font-bold hover:bg-axia-primary/90 transition-all shadow-lg shadow-axia-primary/20 flex items-center justify-center gap-2 disabled:opacity-70"
                        >
                          {isAddingBulletin ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <Plus size={18} />
                          )}
                          {isAddingBulletin ? 'Processando...' : 'Gerar Boletim'}
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* Bulletins History */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                      <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <h3 className="text-lg font-bold dark:text-white">Histórico de Boletins</h3>
                          <button 
                            onClick={() => setShowArchivedBulletins(!showArchivedBulletins)}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-all ${showArchivedBulletins ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-axia-primary/10 border-axia-primary/20 text-axia-primary'}`}
                          >
                            {showArchivedBulletins ? <Eye size={12} /> : <EyeOff size={12} />}
                            {showArchivedBulletins ? 'Ver Ativos' : 'Ver Arquivados'}
                          </button>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 dark:text-slate-500">
                          <TrendingUp size={14} />
                          <span>Total: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(measurementBulletins.filter(b => !!b.archived === showArchivedBulletins).reduce((acc, b) => acc + (b.value || 0), 0))}</span>
                        </div>
                      </div>
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {measurementBulletins.filter(b => !!b.archived === showArchivedBulletins).length === 0 ? (
                          <div className="p-20 text-center text-slate-400 dark:text-slate-600">
                            <ClipboardList size={48} className="mx-auto mb-4 opacity-20" />
                            <p>{showArchivedBulletins ? 'Nenhum boletim arquivado.' : 'Nenhum boletim ativo encontrado.'}</p>
                          </div>
                        ) : (
                          measurementBulletins.filter(b => !!b.archived === showArchivedBulletins).map((bulletin) => (
                            <div key={bulletin.id} className={`p-6 transition-colors ${bulletin.archived ? 'bg-slate-50/50 dark:bg-slate-800/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                              <div className="flex items-start justify-between mb-4">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className={`font-bold ${bulletin.archived ? 'text-slate-500' : 'text-slate-900 dark:text-white'}`}>{bulletin.projectName}</h4>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30">
                                      Contrato: {bulletin.contractNumber}
                                    </span>
                                    {bulletin.archived && (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">Arquivado</span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                    <Calendar size={12} /> {bulletin.date}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className={`text-lg font-bold ${bulletin.archived ? 'text-slate-400' : 'text-axia-accent'}`}>
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(bulletin.value || 0)}
                                  </p>
                                  <div className="flex items-center justify-end gap-2 mt-1">
                                    <button 
                                      onClick={() => generateBulletinPDF(bulletin)}
                                      className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-axia-primary transition-colors"
                                      title="Baixar PDF"
                                    >
                                      <FileDown size={14} />
                                    </button>
                                    <button 
                                      onClick={() => handleToggleArchiveBulletin(bulletin)}
                                      className={`p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors ${bulletin.archived ? 'text-axia-primary hover:text-axia-primary/80' : 'text-slate-400 hover:text-slate-600'}`}
                                      title={bulletin.archived ? 'Desarquivar' : 'Arquivar'}
                                    >
                                      {bulletin.archived ? <Eye size={14} /> : <EyeOff size={14} />}
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteBulletin(bulletin)}
                                      className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                                      title="Excluir Boletim"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                                <div>
                                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">RC de Consumo</p>
                                  <p className="text-sm font-semibold dark:text-slate-200">{bulletin.rcNumber}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Item SAP</p>
                                  <p className="text-sm font-semibold dark:text-slate-200">{bulletin.sapItem}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Instalação</p>
                                  <p className="text-sm font-semibold dark:text-slate-200">{bulletin.installation}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Fornecedor</p>
                                  <p className="text-sm font-semibold dark:text-slate-200">{bulletin.supplier}</p>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-4xl mx-auto space-y-8"
              >
                <div>
                  <h2 className="text-3xl font-display font-bold text-slate-900">Configurações</h2>
                  <p className="text-slate-500">Personalize sua experiência no sistema Axia Energia.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="md:col-span-1">
                    <nav className="space-y-1">
                      <button 
                        onClick={() => setSettingsTab('general')}
                        className={`w-full text-left px-4 py-2 rounded-lg font-bold transition-all ${settingsTab === 'general' ? 'bg-axia-primary/10 text-axia-primary' : 'text-slate-500 hover:bg-slate-100'}`}
                      >
                        Geral
                      </button>
                      <button 
                        onClick={() => setSettingsTab('appearance')}
                        className={`w-full text-left px-4 py-2 rounded-lg font-bold transition-all ${settingsTab === 'appearance' ? 'bg-axia-primary/10 text-axia-primary' : 'text-slate-500 hover:bg-slate-100'}`}
                      >
                        Aparência
                      </button>
                      <button 
                        onClick={() => setSettingsTab('security')}
                        className={`w-full text-left px-4 py-2 rounded-lg font-bold transition-all ${settingsTab === 'security' ? 'bg-axia-primary/10 text-axia-primary' : 'text-slate-500 hover:bg-slate-100'}`}
                      >
                        Segurança
                      </button>
                      {(currentUser.accessLevel === 'Gestor' || currentUser.accessLevel === 'Administrador de Sistema') && (
                        <button 
                          onClick={() => setSettingsTab('users')}
                          className={`w-full text-left px-4 py-2 rounded-lg font-bold transition-all ${settingsTab === 'users' ? 'bg-axia-primary/10 text-axia-primary' : 'text-slate-500 hover:bg-slate-100'}`}
                        >
                          Usuários
                        </button>
                      )}
                    </nav>
                  </div>

                    <div className="md:col-span-2 space-y-6">
                      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-8">
                        {settingsTab === 'general' && (
                          <>
                            <section className="space-y-4">
                              <h3 className="text-lg font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">Preferências Gerais</h3>
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-bold text-slate-700 dark:text-slate-200">Compactar Sidebar</p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">Reduzir o tamanho da barra lateral automaticamente.</p>
                                </div>
                                <button 
                                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                                  className={`w-12 h-6 rounded-full relative transition-colors ${isSidebarOpen ? 'bg-axia-primary' : 'bg-slate-200'}`}
                                >
                                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${isSidebarOpen ? 'right-1' : 'left-1'}`} />
                                </button>
                              </div>
                            </section>

                            <section className="space-y-4">
                              <h3 className="text-lg font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">Notificações</h3>
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-bold text-slate-700 dark:text-slate-200">Alertas de Prazo</p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">Receber avisos sobre tarefas próximas do vencimento.</p>
                                </div>
                                <button className="w-12 h-6 bg-axia-primary rounded-full relative">
                                  <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                                </button>
                              </div>
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-bold text-slate-700 dark:text-slate-200">Relatórios Semanais</p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">Notificar quando novos relatórios forem aprovados.</p>
                                </div>
                                <button className="w-12 h-6 bg-axia-primary rounded-full relative">
                                  <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                                </button>
                              </div>
                            </section>
                          </>
                        )}

                        {settingsTab === 'appearance' && (
                          <section className="space-y-6">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">Personalização Visual</h3>
                            
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-bold text-slate-700 dark:text-slate-200">Modo Escuro</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Alternar entre tema claro e escuro.</p>
                              </div>
                              <button 
                                onClick={() => setIsDarkMode(!isDarkMode)}
                                className={`w-12 h-6 rounded-full relative transition-colors ${isDarkMode ? 'bg-axia-primary' : 'bg-slate-200'}`}
                              >
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${isDarkMode ? 'right-1' : 'left-1'}`} />
                              </button>
                            </div>

                            <div className="space-y-4">
                              <p className="font-bold text-slate-700 dark:text-slate-200">Paleta de Cores do Sistema</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Escolha uma combinação de cores que melhor se adapta ao seu estilo de trabalho.</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {palettes.map((palette) => (
                                  <button
                                    key={palette.id}
                                    onClick={() => setCurrentPalette(palette.id)}
                                    className={`p-4 rounded-2xl border-2 transition-all flex items-center gap-4 text-left ${
                                      currentPalette === palette.id 
                                        ? 'border-axia-primary bg-axia-primary/5 shadow-md' 
                                        : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 bg-slate-50 dark:bg-slate-800/50'
                                    }`}
                                  >
                                    <div className="flex -space-x-3">
                                      <div className="w-10 h-10 rounded-xl border-2 border-white dark:border-slate-700 shadow-sm" style={{ backgroundColor: palette.primary }} />
                                      <div className="w-10 h-10 rounded-xl border-2 border-white dark:border-slate-700 shadow-sm" style={{ backgroundColor: palette.secondary }} />
                                    </div>
                                    <div>
                                      <p className={`font-bold text-sm ${currentPalette === palette.id ? 'text-axia-primary' : 'text-slate-700 dark:text-slate-300'}`}>
                                        {palette.name}
                                      </p>
                                      <div className="flex gap-1 mt-1">
                                        <div className="w-3 h-1 rounded-full" style={{ backgroundColor: palette.primary }} />
                                        <div className="w-3 h-1 rounded-full" style={{ backgroundColor: palette.accent }} />
                                      </div>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          </section>
                        )}

                        {settingsTab === 'security' && (
                          <section className="space-y-4">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">Segurança da Conta</h3>
                            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                              <p className="text-sm text-slate-600 dark:text-slate-400">As opções de segurança e alteração de senha estão disponíveis através do provedor de autenticação.</p>
                            </div>
                          </section>
                        )}

                        {settingsTab === 'users' && (currentUser.accessLevel === 'Gestor' || currentUser.accessLevel === 'Administrador de Sistema') && (
                          <section className="space-y-6">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">Controle de Usuários</h3>
                            <div className="space-y-4">
                              {registeredUsers.length === 0 ? (
                                <p className="text-center text-slate-500 py-8">Carregando usuários...</p>
                              ) : (
                                registeredUsers.map((user) => (
                                  <div key={user.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 gap-4">
                                    <div className="flex items-center gap-3">
                                      <img src={user.avatar || 'https://picsum.photos/seed/user/200/200'} alt={user.name} className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700" referrerPolicy="no-referrer" />
                                      <div>
                                        <p className="font-bold text-slate-700 dark:text-slate-200 text-sm">{user.name}</p>
                                        <p className="text-xs text-slate-500">{user.email}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <select
                                        value={user.accessLevel}
                                        onChange={(e) => handleUpdateUserAccess(user.id, e.target.value)}
                                        disabled={isUpdatingUser === user.id || user.id === currentUser.id}
                                        className="w-full sm:w-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-axia-primary/20 transition-all cursor-pointer disabled:opacity-50"
                                      >
                                        <option value="Usuário Padrão">Usuário Padrão</option>
                                        <option value="Colaborador">Colaborador</option>
                                        <option value="Gestor">Gestor</option>
                                        <option value="Administrador de Sistema">Administrador de Sistema</option>
                                      </select>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </section>
                        )}
                      </div>

                      <div className="pt-4">
                        <button 
                          onClick={handleSaveSettings}
                          className="w-full bg-axia-primary text-white py-3 rounded-xl font-bold hover:bg-axia-primary/90 transition-all shadow-lg shadow-axia-primary/20"
                        >
                          Salvar Configurações
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-around z-50 px-2 lg:hidden shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center gap-1 flex-1 transition-all ${activeTab === 'dashboard' ? 'text-axia-primary scale-110' : 'text-slate-400'}`}
          >
            <LayoutDashboard size={20} />
            <span className="text-[10px] font-bold">Início</span>
          </button>
          <button 
            onClick={() => setActiveTab('projects')}
            className={`flex flex-col items-center gap-1 flex-1 transition-all ${activeTab === 'projects' ? 'text-axia-primary scale-110' : 'text-slate-400'}`}
          >
            <HardHat size={20} />
            <span className="text-[10px] font-bold">Obras</span>
          </button>

          <button 
            onClick={() => setActiveTab('measurements')}
            className={`flex flex-col items-center gap-1 flex-1 transition-all ${activeTab === 'measurements' ? 'text-axia-primary scale-110' : 'text-slate-400'}`}
          >
            <Receipt size={20} />
            <span className="text-[10px] font-bold">Medir</span>
          </button>
          <button 
            onClick={() => setActiveTab('rc-control')}
            className={`flex flex-col items-center gap-1 flex-1 transition-all ${activeTab === 'rc-control' ? 'text-axia-primary scale-110' : 'text-slate-400'}`}
          >
            <ShieldCheck size={20} />
            <span className="text-[10px] font-bold">RC</span>
          </button>
          <button 
            onClick={() => setShowProfile(true)}
            className="flex flex-col items-center gap-1 flex-1 text-slate-400"
          >
            <User size={20} />
            <span className="text-[10px] font-bold">Perfil</span>
          </button>
        </div>
      )}

      {/* User Profile Modal */}
      <AnimatePresence>
        {showProfile && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowProfile(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden relative z-10"
            >
              <div className="h-32 bg-axia-primary relative">
                <button 
                  onClick={() => setShowProfile(false)}
                  className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="px-8 pb-8 -mt-16 relative">
                <div className="mb-6">
                  <div className="relative inline-block">
                    <img 
                      src={currentUser.avatar} 
                      alt="Profile" 
                      className="w-32 h-32 rounded-3xl border-4 border-white shadow-xl object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <label className="absolute -bottom-2 -right-2 bg-axia-primary w-10 h-10 rounded-full border-4 border-white shadow-lg flex items-center justify-center cursor-pointer hover:scale-110 transition-transform text-white">
                      <Camera size={18} />
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        onChange={handleUpdateAvatar}
                      />
                    </label>
                    <div className="absolute -top-2 -left-2 bg-green-500 w-6 h-6 rounded-full border-4 border-white shadow-sm" />
                  </div>
                </div>

                <div className="mb-8">
                  <h3 className="text-2xl font-bold text-slate-900">{currentUser?.name || ''}</h3>
                  <p className="text-axia-secondary font-semibold">{currentUser?.role || ''}</p>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-axia-primary shadow-sm">
                      <Mail size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">E-mail Corporativo</p>
                      <p className="text-sm font-bold text-slate-700">{currentUser?.email || ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-axia-primary shadow-sm">
                      <Phone size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Telefone / WhatsApp</p>
                      <p className="text-sm font-bold text-slate-700">{currentUser?.phone || ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-axia-primary shadow-sm">
                      <ShieldCheck size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Nível de Acesso</p>
                      <p className="text-sm font-bold text-slate-700">{currentUser?.accessLevel || ''}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <button 
                    onClick={async () => {
                      try {
                        await signOut(auth);
                        setIsLoggedIn(false);
                        setShowProfile(false);
                      } catch (error) {
                        console.error('Error signing out:', error);
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 py-4 px-4 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-2xl transition-all shadow-sm"
                  >
                    <LogOut size={20} /> Sair da Conta
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Fiscal Planning Activity Modal */}
        {isAddingFiscalPlanningActivity && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                      {editingFiscalPlanningActivity ? 'Editar Planejamento Fiscal' : 'Novo Planejamento Fiscal'}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                      {editingFiscalPlanningActivity ? 'Atualizar atividade fiscal' : 'Adicionar ao cronograma fiscal'}
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      setIsAddingFiscalPlanningActivity(false);
                      setEditingFiscalPlanningActivity(null);
                    }}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleSaveFiscalPlanningActivity} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Vincular a Obra (Opcional)</label>
                    <select 
                      value={newFiscalPlanningActivity.projectId || ''}
                      onChange={(e) => {
                        const pId = e.target.value;
                        const matchedProj = projects.find(p => p.id === pId);
                        setNewFiscalPlanningActivity({ 
                          ...newFiscalPlanningActivity, 
                          projectId: pId,
                          name: matchedProj ? matchedProj.name : newFiscalPlanningActivity.name
                        });
                      }}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3.5 text-sm focus:outline-none focus:ring-4 focus:ring-axia-primary/10 transition-all font-medium text-slate-700 dark:text-slate-200"
                    >
                      <option value="">Nenhuma (Atividade Geral do Fiscal)</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Nome da Atividade / Obra</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Execução de Pavimento..."
                      value={newFiscalPlanningActivity.name}
                      onChange={(e) => setNewFiscalPlanningActivity({ ...newFiscalPlanningActivity, name: e.target.value })}
                      required
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3.5 text-sm focus:outline-none focus:ring-4 focus:ring-axia-primary/10 transition-all font-medium text-slate-700 dark:text-slate-200"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Categoria (Opcional)</label>
                      <input 
                        type="text" 
                        placeholder="Ex: Pavimentação"
                        value={newFiscalPlanningActivity.category || ''}
                        onChange={(e) => setNewFiscalPlanningActivity({ ...newFiscalPlanningActivity, category: e.target.value })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3.5 text-sm focus:outline-none font-bold text-slate-700 dark:text-slate-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Descrição</label>
                      <input 
                        type="text" 
                        placeholder="Breve descrição"
                        value={newFiscalPlanningActivity.description || ''}
                        onChange={(e) => setNewFiscalPlanningActivity({ ...newFiscalPlanningActivity, description: e.target.value })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3.5 text-sm focus:outline-none font-bold text-slate-700 dark:text-slate-200"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mb-4 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div 
                      className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${useSpecificFiscalDates ? 'bg-axia-primary' : 'bg-slate-300 dark:bg-slate-700'}`}
                      onClick={() => setUseSpecificFiscalDates(!useSpecificFiscalDates)}
                    >
                      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${useSpecificFiscalDates ? 'left-6' : 'left-1'}`} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest col">Usar datas específicas (Dia/Mês/Ano)</span>
                  </div>

                  {useSpecificFiscalDates ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Data Início</label>
                        <div className="relative">
                          <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                          <input 
                            type="date" 
                            value={newFiscalPlanningActivity.startDate || ''}
                            onChange={(e) => {
                              const dt = e.target.value;
                              if (dt) {
                                const d = new Date(dt);
                                setNewFiscalPlanningActivity({ 
                                  ...newFiscalPlanningActivity, 
                                  startDate: dt,
                                  startMonth: d.getMonth(),
                                  startYear: d.getFullYear()
                                });
                              }
                            }}
                            required
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl pl-12 pr-5 py-3.5 text-sm focus:outline-none font-bold text-slate-700 dark:text-slate-200"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Data Fim</label>
                        <div className="relative">
                          <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                          <input 
                            type="date" 
                            value={newFiscalPlanningActivity.endDate || ''}
                            onChange={(e) => {
                              const dt = e.target.value;
                              if (dt) {
                                const d = new Date(dt);
                                setNewFiscalPlanningActivity({ 
                                  ...newFiscalPlanningActivity, 
                                  endDate: dt,
                                  endMonth: d.getMonth(),
                                  endYear: d.getFullYear()
                                });
                              }
                            }}
                            required
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl pl-12 pr-5 py-3.5 text-sm focus:outline-none font-bold text-slate-700 dark:text-slate-200"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Mês Início</label>
                          <select 
                            value={newFiscalPlanningActivity.startMonth}
                            onChange={(e) => setNewFiscalPlanningActivity({ ...newFiscalPlanningActivity, startMonth: parseInt(e.target.value), startDate: '' })}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3.5 text-sm focus:outline-none font-bold text-slate-700 dark:text-slate-200"
                          >
                            {MONTHS.map((m, i) => (
                              <option key={i} value={i}>{m}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Ano Início</label>
                          <input 
                            type="number"
                            value={newFiscalPlanningActivity.startYear}
                            onChange={(e) => setNewFiscalPlanningActivity({ ...newFiscalPlanningActivity, startYear: parseInt(e.target.value), startDate: '' })}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3.5 text-sm focus:outline-none font-bold text-slate-700 dark:text-slate-200"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Mês Fim</label>
                          <select 
                            value={newFiscalPlanningActivity.endMonth}
                            onChange={(e) => setNewFiscalPlanningActivity({ ...newFiscalPlanningActivity, endMonth: parseInt(e.target.value), endDate: '' })}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3.5 text-sm focus:outline-none font-bold text-slate-700 dark:text-slate-200"
                          >
                            {MONTHS.map((m, i) => (
                              <option key={i} value={i}>{m}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Ano Fim</label>
                          <input 
                            type="number"
                            value={newFiscalPlanningActivity.endYear}
                            onChange={(e) => setNewFiscalPlanningActivity({ ...newFiscalPlanningActivity, endYear: parseInt(e.target.value), endDate: '' })}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3.5 text-sm focus:outline-none font-bold text-slate-700 dark:text-slate-200"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Cor da Barra</label>
                      <div className="flex items-center gap-3">
                        <input 
                          type="color" 
                          value={newFiscalPlanningActivity.color}
                          onChange={(e) => setNewFiscalPlanningActivity({ ...newFiscalPlanningActivity, color: e.target.value })}
                          className="w-12 h-12 rounded-xl border-0 cursor-pointer overflow-hidden p-0"
                        />
                        <input 
                          type="text" 
                          value={newFiscalPlanningActivity.color}
                          onChange={(e) => setNewFiscalPlanningActivity({ ...newFiscalPlanningActivity, color: e.target.value })}
                          className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3.5 text-sm font-mono"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Selecione uma Paleta</label>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {['#0033FF', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#64748B'].map(c => (
                          <button 
                            key={c}
                            type="button"
                            onClick={() => setNewFiscalPlanningActivity({ ...newFiscalPlanningActivity, color: c })}
                            className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${newFiscalPlanningActivity.color === c ? 'border-axia-primary' : 'border-transparent'}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 mt-10">
                    <button 
                      type="button"
                      onClick={() => {
                        setIsAddingFiscalPlanningActivity(false);
                        setEditingFiscalPlanningActivity(null);
                      }}
                      className="flex-1 py-4 px-6 text-slate-500 font-bold rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      className="flex-[2] py-4 px-6 bg-axia-primary text-white font-bold rounded-2xl hover:shadow-xl hover:shadow-axia-primary/25 transition-all shadow-lg shadow-axia-primary/20"
                    >
                      {editingFiscalPlanningActivity ? 'Salvar Alterações' : 'Adicionar Atividade'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}

        {/* Planning Activity Modal */}
        {isAddingPlanningActivity && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                      {editingPlanningActivity ? 'Editar Planejamento' : 'Novo Planejamento'}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                      {editingPlanningActivity ? 'Atualizar atividade mensal' : 'Adicionar ao cronograma mensal'}
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      setIsAddingPlanningActivity(false);
                      setEditingPlanningActivity(null);
                    }}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleSavePlanningActivity} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Nome da Atividade</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Execução de Pavimento..."
                      value={newPlanningActivity.name}
                      onChange={(e) => setNewPlanningActivity({ ...newPlanningActivity, name: e.target.value })}
                      required
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3.5 text-sm focus:outline-none focus:ring-4 focus:ring-axia-primary/10 transition-all font-medium text-slate-700 dark:text-slate-200"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Categoria (Opcional)</label>
                      <input 
                        type="text" 
                        placeholder="Ex: Engenharia Civil"
                        value={newPlanningActivity.category || ''}
                        onChange={(e) => setNewPlanningActivity({ ...newPlanningActivity, category: e.target.value })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3.5 text-sm focus:outline-none font-bold text-slate-700 dark:text-slate-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Descrição</label>
                      <input 
                        type="text" 
                        placeholder="Breve descrição"
                        value={newPlanningActivity.description || ''}
                        onChange={(e) => setNewPlanningActivity({ ...newPlanningActivity, description: e.target.value })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3.5 text-sm focus:outline-none font-bold text-slate-700 dark:text-slate-200"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mb-4 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div 
                      className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${useSpecificPlanningDates ? 'bg-axia-primary' : 'bg-slate-300 dark:bg-slate-700'}`}
                      onClick={() => setUseSpecificPlanningDates(!useSpecificPlanningDates)}
                    >
                      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${useSpecificPlanningDates ? 'left-6' : 'left-1'}`} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Usar datas específicas (Dia/Mês/Ano)</span>
                  </div>

                  {useSpecificPlanningDates ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Data Início</label>
                        <div className="relative">
                          <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                          <input 
                            type="date" 
                            value={newPlanningActivity.startDate || ''}
                            onChange={(e) => {
                              const date = e.target.value;
                              if (date) {
                                const d = new Date(date);
                                setNewPlanningActivity({ 
                                  ...newPlanningActivity, 
                                  startDate: date,
                                  startMonth: d.getMonth(),
                                  startYear: d.getFullYear()
                                });
                              }
                            }}
                            required
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl pl-12 pr-5 py-3.5 text-sm focus:outline-none font-bold text-slate-700 dark:text-slate-200"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Data Fim</label>
                        <div className="relative">
                          <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                          <input 
                            type="date" 
                            value={newPlanningActivity.endDate || ''}
                            onChange={(e) => {
                              const date = e.target.value;
                              if (date) {
                                const d = new Date(date);
                                setNewPlanningActivity({ 
                                  ...newPlanningActivity, 
                                  endDate: date,
                                  endMonth: d.getMonth(),
                                  endYear: d.getFullYear()
                                });
                              }
                            }}
                            required
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl pl-12 pr-5 py-3.5 text-sm focus:outline-none font-bold text-slate-700 dark:text-slate-200"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Mês Início</label>
                          <select 
                            value={newPlanningActivity.startMonth}
                            onChange={(e) => setNewPlanningActivity({ ...newPlanningActivity, startMonth: parseInt(e.target.value), startDate: '' })}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3.5 text-sm focus:outline-none font-bold text-slate-700 dark:text-slate-200"
                          >
                            {MONTHS.map((m, i) => (
                              <option key={i} value={i}>{m}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Ano Início</label>
                          <input 
                            type="number"
                            value={newPlanningActivity.startYear}
                            onChange={(e) => setNewPlanningActivity({ ...newPlanningActivity, startYear: parseInt(e.target.value), startDate: '' })}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3.5 text-sm focus:outline-none font-bold text-slate-700 dark:text-slate-200"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Mês Fim</label>
                          <select 
                            value={newPlanningActivity.endMonth}
                            onChange={(e) => setNewPlanningActivity({ ...newPlanningActivity, endMonth: parseInt(e.target.value), endDate: '' })}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3.5 text-sm focus:outline-none font-bold text-slate-700 dark:text-slate-200"
                          >
                            {MONTHS.map((m, i) => (
                              <option key={i} value={i}>{m}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Ano Fim</label>
                          <input 
                            type="number"
                            value={newPlanningActivity.endYear}
                            onChange={(e) => setNewPlanningActivity({ ...newPlanningActivity, endYear: parseInt(e.target.value), endDate: '' })}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3.5 text-sm focus:outline-none font-bold text-slate-700 dark:text-slate-200"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Cor da Barra</label>
                      <div className="flex items-center gap-3">
                        <input 
                          type="color" 
                          value={newPlanningActivity.color}
                          onChange={(e) => setNewPlanningActivity({ ...newPlanningActivity, color: e.target.value })}
                          className="w-12 h-12 rounded-xl border-0 cursor-pointer overflow-hidden p-0"
                        />
                        <input 
                          type="text" 
                          value={newPlanningActivity.color}
                          onChange={(e) => setNewPlanningActivity({ ...newPlanningActivity, color: e.target.value })}
                          className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3.5 text-sm font-mono"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Selecione uma Paleta</label>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {['#0033FF', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#64748B'].map(c => (
                          <button 
                            key={c}
                            type="button"
                            onClick={() => setNewPlanningActivity({ ...newPlanningActivity, color: c })}
                            className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${newPlanningActivity.color === c ? 'border-axia-primary' : 'border-transparent'}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 mt-10">
                    <button 
                      type="button"
                      onClick={() => {
                        setIsAddingPlanningActivity(false);
                        setEditingPlanningActivity(null);
                      }}
                      className="flex-1 py-4 px-6 text-slate-500 font-bold rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      className="flex-[2] py-4 px-6 bg-axia-primary text-white font-bold rounded-2xl hover:shadow-xl hover:shadow-axia-primary/25 transition-all shadow-lg shadow-axia-primary/20"
                    >
                      {editingPlanningActivity ? 'Salvar Alterações' : 'Adicionar Atividade'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}

        {(isAddingActivity || editingActivity) && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsAddingActivity(false);
                setEditingActivity(null);
              }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden border border-slate-100 dark:border-slate-800"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                      {editingActivity ? 'Editar Atividade' : 'Nova Atividade'}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                      {editingActivity ? 'Atualizar cronograma' : 'Adicionar ao cronograma'}
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      setIsAddingActivity(false);
                      setEditingActivity(null);
                    }}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Nome da Atividade</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Terraplanagem, Fundação..."
                      value={editingActivity ? editingActivity.name : newActivity.name}
                      onChange={(e) => {
                        if (editingActivity) setEditingActivity({...editingActivity, name: e.target.value});
                        else setNewActivity({...newActivity, name: e.target.value});
                      }}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3.5 text-sm focus:outline-none focus:ring-4 focus:ring-axia-primary/10 transition-all font-medium text-slate-700 dark:text-slate-200"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Responsável</label>
                      <input 
                        type="text" 
                        placeholder="Nome do responsável"
                        value={editingActivity ? editingActivity.responsible : newActivity.responsible}
                        onChange={(e) => {
                          if (editingActivity) setEditingActivity({...editingActivity, responsible: e.target.value});
                          else setNewActivity({...newActivity, responsible: e.target.value});
                        }}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3.5 text-sm focus:outline-none focus:ring-4 focus:ring-axia-primary/10 transition-all font-medium text-slate-700 dark:text-slate-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Categoria</label>
                      <input 
                        type="text" 
                        placeholder="Ex: Engenharia, Civil..."
                        value={editingActivity ? (editingActivity.category || '') : newActivity.category}
                        onChange={(e) => {
                          if (editingActivity) setEditingActivity({...editingActivity, category: e.target.value});
                          else setNewActivity({...newActivity, category: e.target.value});
                        }}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3.5 text-sm focus:outline-none focus:ring-4 focus:ring-axia-primary/10 transition-all font-medium text-slate-700 dark:text-slate-200"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Data Início</label>
                      <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="date" 
                          value={editingActivity ? editingActivity.startDate : newActivity.startDate}
                          onChange={(e) => {
                            if (editingActivity) setEditingActivity({...editingActivity, startDate: e.target.value});
                            else setNewActivity({...newActivity, startDate: e.target.value});
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl pl-12 pr-5 py-3.5 text-sm focus:outline-none focus:ring-4 focus:ring-axia-primary/10 transition-all font-bold text-slate-700 dark:text-slate-200"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Data Fim</label>
                      <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="date" 
                          value={editingActivity ? editingActivity.endDate : newActivity.endDate}
                          onChange={(e) => {
                            if (editingActivity) setEditingActivity({...editingActivity, endDate: e.target.value});
                            else setNewActivity({...newActivity, endDate: e.target.value});
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl pl-12 pr-5 py-3.5 text-sm focus:outline-none focus:ring-4 focus:ring-axia-primary/10 transition-all font-bold text-slate-700 dark:text-slate-200"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Status</label>
                      <select 
                        value={editingActivity ? editingActivity.status : newActivity.status}
                        onChange={(e) => {
                          const val = e.target.value as any;
                          if (editingActivity) {
                            const updates: any = { status: val };
                            if (val === 'delayed' && !editingActivity.predictedEndDate) {
                              updates.predictedEndDate = editingActivity.endDate;
                            }
                            setEditingActivity({...editingActivity, ...updates});
                          } else {
                            const updates: any = { status: val };
                            if (val === 'delayed' && !newActivity.predictedEndDate) {
                              updates.predictedEndDate = newActivity.endDate;
                            }
                            setNewActivity({...newActivity, ...updates});
                          }
                        }}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3.5 text-sm focus:outline-none focus:ring-4 focus:ring-axia-primary/10 transition-all font-bold text-slate-700 dark:text-slate-200"
                      >
                        <option value="pending">Pendente</option>
                        <option value="scheduled">Programado</option>
                        <option value="in-progress">Em Andamento</option>
                        <option value="completed">Concluído</option>
                        <option value="delayed">Atrasada</option>
                      </select>
                    </div>

                    {((editingActivity && editingActivity.status === 'delayed') || (!editingActivity && newActivity.status === 'delayed')) && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-2 pb-2"
                    >
                      <label className="text-[10px] font-bold text-red-500 uppercase tracking-widest ml-1">Previsão de Término (Atraso)</label>
                      <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-red-400" size={16} />
                        <input 
                          type="date" 
                          value={editingActivity ? (editingActivity.predictedEndDate || '') : newActivity.predictedEndDate}
                          onChange={(e) => {
                            if (editingActivity) setEditingActivity({...editingActivity, predictedEndDate: e.target.value});
                            else setNewActivity({...newActivity, predictedEndDate: e.target.value});
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/30 rounded-2xl pl-12 pr-5 py-3.5 text-sm focus:outline-none focus:ring-4 focus:ring-red-500/10 transition-all font-bold text-slate-700 dark:text-slate-200"
                        />
                      </div>
                    </motion.div>
                  )}
                </div>

                <div className="flex gap-4 mt-10">
                  <button 
                    onClick={() => {
                      setIsAddingActivity(false);
                      setEditingActivity(null);
                    }}
                    className="flex-1 py-4 px-6 text-slate-500 font-bold rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={() => {
                      if (editingActivity) {
                        handleUpdateActivity(editingActivity.id, editingActivity);
                        setEditingActivity(null);
                      } else {
                        handleAddActivity(newActivity);
                        setIsAddingActivity(false);
                        setNewActivity({
                          name: '',
                          responsible: '',
                          startDate: new Date().toISOString().split('T')[0],
                          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                          predictedEndDate: '',
                          progress: 0,
                          status: 'pending',
                          category: '',
                          order: activities.length + 1
                        });
                      }
                    }}
                    disabled={editingActivity ? (!editingActivity.name || !editingActivity.responsible) : (!newActivity.name || !newActivity.responsible)}
                    className="flex-[2] py-4 px-6 bg-axia-primary text-white font-bold rounded-2xl hover:shadow-xl hover:shadow-axia-primary/25 transition-all disabled:opacity-50 shadow-lg shadow-axia-primary/20"
                  >
                    {editingActivity ? 'Salvar Alterações' : 'Salvar Atividade'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {isAddingRCRequest && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[32px] overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-2xl font-display font-bold text-slate-900 dark:text-white tracking-tight">Nova Solicitação de RC</h3>
                    <p className="text-sm text-slate-500">Inicie o processo de solicitação de RC de consumo.</p>
                  </div>
                  <button 
                    onClick={() => setIsAddingRCRequest(false)}
                    className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <X size={24} className="text-slate-400" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Obra / Projeto</label>
                    <div className="relative">
                      <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <select 
                        value={newRCRequest.projectId}
                        onChange={(e) => setNewRCRequest({ ...newRCRequest, projectId: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl pl-12 pr-5 py-4 text-sm focus:outline-none focus:ring-4 focus:ring-axia-primary/10 transition-all font-bold text-slate-700 dark:text-slate-200"
                      >
                        <option value="">Selecione a Obra</option>
                        {projectsWithTotals.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Data da Solicitação</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="date" 
                        value={newRCRequest.requestDate}
                        onChange={(e) => setNewRCRequest({ ...newRCRequest, requestDate: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl pl-12 pr-5 py-4 text-sm focus:outline-none focus:ring-4 focus:ring-axia-primary/10 transition-all font-bold text-slate-700 dark:text-slate-200"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Valor da Solicitação</label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">R$</div>
                      <input 
                        type="number" 
                        value={newRCRequest.value}
                        onChange={(e) => setNewRCRequest({ ...newRCRequest, value: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl pl-12 pr-5 py-4 text-sm focus:outline-none focus:ring-4 focus:ring-axia-primary/10 transition-all font-bold text-slate-700 dark:text-slate-200"
                        placeholder="0,00"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Boletim de Medição Assinado</label>
                    <div className="relative group">
                      <div className={`w-full border-2 border-dashed rounded-2xl p-6 transition-all flex flex-col items-center justify-center gap-3 ${
                        newRCRequest.signedBulletin ? 'border-green-500/50 bg-green-50/30' : 'border-slate-200 dark:border-slate-800 hover:border-axia-primary/50'
                      }`}>
                        {newRCRequest.signedBulletin ? (
                          <div className="flex items-center gap-3 text-green-600 dark:text-green-400">
                            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                              <FileText size={24} />
                            </div>
                            <div className="flex-1 overflow-hidden">
                              <p className="text-sm font-bold truncate">{newRCRequest.signedBulletin.name}</p>
                              <p className="text-[10px] opacity-70 uppercase font-black tracking-widest">Documento Anexado</p>
                            </div>
                            <button 
                              onClick={() => setNewRCRequest({ ...newRCRequest, signedBulletin: null })}
                              className="p-2 hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors"
                            >
                              <X size={18} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="w-12 h-12 rounded-2xl bg-axia-primary/5 flex items-center justify-center text-axia-primary group-hover:scale-110 transition-transform">
                              <UploadCloud size={28} />
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Clique ou arraste o arquivo</p>
                              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mt-1">PDF, JPG ou PNG</p>
                            </div>
                            <input 
                              type="file"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = (event) => {
                                    setNewRCRequest({
                                      ...newRCRequest,
                                      signedBulletin: {
                                        name: file.name,
                                        url: event.target?.result as string,
                                        size: `${(file.size / 1024 / 1024).toFixed(2)} MB`
                                      }
                                    });
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                              className="absolute inset-0 opacity-0 cursor-pointer"
                              accept=".pdf,.jpg,.jpeg,.png"
                            />
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 pt-6">
                    <button 
                      onClick={() => setIsAddingRCRequest(false)}
                      className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={handleAddRCRequest}
                      disabled={!newRCRequest.projectId}
                      className="flex-[2] py-4 bg-axia-primary text-white font-bold rounded-2xl hover:shadow-xl hover:shadow-axia-primary/20 transition-all disabled:opacity-50 shadow-lg shadow-axia-primary/20"
                    >
                      Criar Solicitação
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {isAddingTravel && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[32px] overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-2xl font-display font-bold text-slate-900 dark:text-white tracking-tight">
                      {editingTravel ? 'Editar Cadastro de Viagem' : 'Cadastrar Viagem Realizada'}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {editingTravel ? 'Atualize as informações desta viagem.' : 'Insira as informações da viagem realizada durante o mês.'}
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      setIsAddingTravel(false);
                      setEditingTravel(null);
                    }}
                    type="button"
                    className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <X size={24} className="text-slate-400" />
                  </button>
                </div>

                <form onSubmit={editingTravel ? handleEditTravel : handleAddTravel} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Nome da Viagem</label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="text" 
                        required
                        value={newTravel.name}
                        onChange={(e) => setNewTravel({ ...newTravel, name: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-850 rounded-2xl pl-12 pr-5 py-3.5 text-sm focus:outline-none focus:ring-4 focus:ring-axia-primary/10 transition-all font-bold text-slate-700 dark:text-slate-200"
                        placeholder="Ex: Vistoria Tática Linha 1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Custo da Viagem</label>
                      <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">R$</div>
                        <input 
                          type="number" 
                          step="0.01"
                          required
                          value={newTravel.cost || ''}
                          onChange={(e) => setNewTravel({ ...newTravel, cost: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-850 rounded-2xl pl-12 pr-5 py-3.5 text-sm focus:outline-none focus:ring-4 focus:ring-axia-primary/10 transition-all font-bold text-slate-700 dark:text-slate-200"
                          placeholder="0,00"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Nome do Fiscal</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                          type="text" 
                          required
                          value={newTravel.inspector}
                          onChange={(e) => setNewTravel({ ...newTravel, inspector: e.target.value })}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-850 rounded-2xl pl-12 pr-5 py-3.5 text-sm focus:outline-none focus:ring-4 focus:ring-axia-primary/10 transition-all font-bold text-slate-700 dark:text-slate-200"
                          placeholder="Ex: Eng. Ricardo Silva"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Origem</label>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                          type="text" 
                          required
                          value={newTravel.origin}
                          onChange={(e) => setNewTravel({ ...newTravel, origin: e.target.value })}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-850 rounded-2xl pl-12 pr-5 py-3.5 text-sm focus:outline-none focus:ring-4 focus:ring-axia-primary/10 transition-all font-bold text-slate-700 dark:text-slate-200"
                          placeholder="Cidade / Estado de saída"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Destino</label>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                          type="text" 
                          required
                          value={newTravel.destination}
                          onChange={(e) => setNewTravel({ ...newTravel, destination: e.target.value })}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-850 rounded-2xl pl-12 pr-5 py-3.5 text-sm focus:outline-none focus:ring-4 focus:ring-axia-primary/10 transition-all font-bold text-slate-700 dark:text-slate-200"
                          placeholder="Cidade / Estado de destino"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Data de Ida</label>
                      <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                          type="date" 
                          required
                          value={newTravel.startDate}
                          onChange={(e) => setNewTravel({ ...newTravel, startDate: e.target.value })}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-850 rounded-2xl pl-12 pr-5 py-3.5 text-sm focus:outline-none focus:ring-4 focus:ring-axia-primary/10 transition-all font-bold text-slate-700 dark:text-slate-200"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Data de Volta</label>
                      <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                          type="date" 
                          required
                          value={newTravel.endDate}
                          onChange={(e) => setNewTravel({ ...newTravel, endDate: e.target.value })}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-850 rounded-2xl pl-12 pr-5 py-3.5 text-sm focus:outline-none focus:ring-4 focus:ring-axia-primary/10 transition-all font-bold text-slate-700 dark:text-slate-200"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button 
                      type="button"
                      onClick={() => {
                        setIsAddingTravel(false);
                        setEditingTravel(null);
                      }}
                      className="flex-1 py-3.5 text-slate-500 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      className="flex-[2] py-3.5 bg-axia-primary text-white font-bold rounded-2xl hover:shadow-xl hover:shadow-axia-primary/20 transition-all shadow-lg shadow-axia-primary/20"
                    >
                      {editingTravel ? 'Salvar Alterações' : 'Salvar Viagem'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}

        {travelToDelete && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800"
            >
              <div className="p-8">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center flex-shrink-0 text-red-500">
                    <AlertCircle size={24} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-display font-bold text-slate-900 dark:text-white leading-snug">
                      Excluir Registro de Viagem
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Tem certeza que deseja excluir esta viagem? Esta ação não pode ser desfeita e removerá os custos associados do relatório do mês.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 mb-6 border border-slate-100 dark:border-slate-800/80 text-sm space-y-2.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400 dark:text-slate-500 font-semibold">Viagem:</span>
                    <span className="font-bold text-slate-700 dark:text-slate-200">{travelToDelete.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 dark:text-slate-500 font-semibold">Fiscal:</span>
                    <span className="font-bold text-slate-700 dark:text-slate-200">{travelToDelete.inspector}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 dark:text-slate-500 font-semibold">Valor gasto:</span>
                    <span className="font-extrabold text-slate-900 dark:text-white">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(travelToDelete.cost)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 dark:text-slate-500 font-semibold">Período:</span>
                    <span className="font-bold text-slate-600 dark:text-slate-300">
                      {formatInputDate(travelToDelete.startDate)} - {formatInputDate(travelToDelete.endDate)}
                    </span>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setTravelToDelete(null)}
                    className="flex-1 py-3.5 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold rounded-2xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="button"
                    onClick={confirmDeleteTravel}
                    className="flex-1 py-3.5 bg-red-500 hover:bg-red-650 text-white font-bold rounded-2xl transition-all shadow-lg shadow-red-500/10 hover:shadow-red-500/20"
                  >
                    Confirmar Exclusão
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavItem({ icon, label, active, onClick, collapsed }: { 
  icon: React.ReactNode, 
  label: string, 
  active?: boolean, 
  onClick: () => void,
  collapsed?: boolean
}) {
  return (
    <button 
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
        ${active 
          ? 'bg-axia-primary text-white shadow-lg shadow-axia-primary/20' 
          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
        }
      `}
    >
      <div className="flex-shrink-0">{icon}</div>
      {!collapsed && <span className="font-semibold text-sm whitespace-nowrap">{label}</span>}
      {active && !collapsed && (
        <motion.div 
          layoutId="active-pill"
          className="ml-auto w-1.5 h-1.5 bg-white rounded-full"
        />
      )}
    </button>
  );
}

function LoginPage({ onLogin, onRegister }: { 
  onLogin: (user: UserProfile) => void;
  onRegister: (user: UserProfile) => void;
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [phone, setPhone] = useState('');
  const [accessLevel, setAccessLevel] = useState('Usuário Padrão');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const trimmedEmail = email.trim();
      if (mode === 'login') {
        const userCredential = await signInWithEmailAndPassword(auth, trimmedEmail, password);
        const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
        if (userDoc.exists()) {
          onLogin(userDoc.data() as UserProfile);
        } else {
          setError('Perfil do usuário não encontrado.');
          await signOut(auth);
        }
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        const newUser: UserProfile = {
          id: userCredential.user.uid,
          name: name,
          email: trimmedEmail,
          role: role || 'Colaborador',
          avatar: `https://picsum.photos/seed/${name}/200/200`,
          phone: phone,
          accessLevel: accessLevel
        };
        await setDoc(doc(db, 'users', userCredential.user.uid), newUser);
        onRegister(newUser);
        setMode('login');
      }
    } catch (err: any) {
      console.error('Full Auth Error Object:', JSON.stringify(err, null, 2));
      console.error('Auth error code:', err.code);
      console.error('Auth error message:', err.message);
      
      const errorCode = err.code || '';
      const errorMessage = err.message || '';

      if (errorMessage.includes('Quota exceeded') || errorCode.includes('quota-exceeded')) {
        setError('O limite de acesso aos dados do Google foi atingido para hoje. O sistema voltará ao normal em breve.');
        localStorage.setItem('firestore_quota_extrapolated', 'true');
      } else if (
        errorCode === 'auth/user-not-found' || 
        errorCode === 'auth/wrong-password' || 
        errorCode === 'auth/invalid-credential' ||
        errorMessage.includes('auth/invalid-credential') ||
        errorMessage.includes('invalid-credential')
      ) {
        setError('E-mail ou senha incorretos. Verifique suas credenciais e tente novamente.');
      } else if (errorCode === 'auth/email-already-in-use') {
        setError('Este e-mail já está em uso.');
      } else if (errorCode === 'auth/weak-password') {
        setError('A senha deve ter pelo menos 6 caracteres.');
      } else if (errorCode === 'auth/invalid-email') {
        setError('E-mail inválido.');
      } else if (errorCode === 'auth/network-request-failed') {
        setError('Erro de conexão: Não foi possível conectar ao servidor da AXIA. Verifique sua internet e tente novamente.');
      } else if (errorCode === 'auth/too-many-requests') {
        setError('Muitas tentativas malsucedidas. Sua conta foi temporariamente bloqueada. Tente novamente mais tarde.');
      } else {
        setError('Ocorreu um erro ao processar sua solicitação: ' + (errorMessage || 'Erro desconhecido'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 font-sans transition-colors duration-300">
      {/* Quota Banner duplicated here for visibility before login */}
      {localStorage.getItem('firestore_quota_extrapolated') === 'true' && (
        <div className="fixed top-0 left-0 right-0 z-[200] bg-red-600 text-white px-4 py-2 text-center text-xs font-bold animate-pulse">
          Limite de dados gratuito do Google atingido hoje. O sistema voltará ao normal em breve ou após o reset diário.
        </div>
      )}
      <div className="w-full max-w-md">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl shadow-slate-200/60 dark:shadow-black/40 border border-slate-100 dark:border-slate-800 overflow-hidden"
        >
          <div className="p-10">
            <div className="flex flex-col items-center mb-8">
              <h1 className="text-4xl font-display font-black tracking-tighter text-axia-primary">AXIA</h1>
              <p className="text-xs uppercase tracking-[0.4em] text-axia-secondary font-bold -mt-1 ml-1">ENERGIA</p>
            </div>

            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl mb-8">
              <button 
                onClick={() => setMode('login')}
                className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${mode === 'login' ? 'bg-white dark:bg-slate-700 text-axia-primary shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
              >
                Login
              </button>
              <button 
                onClick={() => setMode('register')}
                className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${mode === 'register' ? 'bg-white dark:bg-slate-700 text-axia-primary shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
              >
                Cadastro
              </button>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                {mode === 'login' ? 'Bem-vindo de volta' : 'Criar nova conta'}
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                {mode === 'login' 
                  ? 'Acesse sua conta para gerenciar suas obras.' 
                  : 'Preencha os dados abaixo para solicitar seu acesso.'}
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl flex items-center gap-3 text-red-600 dark:text-red-400 text-sm font-medium">
                <AlertCircle size={18} />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {mode === 'register' && (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-1">Nome Completo</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="text" 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-axia-primary/20 transition-all font-medium dark:text-white"
                        placeholder="Ex: Ricardo Silva"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-1">Cargo / Função</label>
                    <div className="relative">
                      <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="text" 
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-axia-primary/20 transition-all font-medium dark:text-white"
                        placeholder="Ex: Engenheiro Civil"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-1">Telefone / WhatsApp</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="tel" 
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-axia-primary/20 transition-all font-medium dark:text-white"
                        placeholder="Ex: +55 (11) 99999-9999"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-1">Nível de Acesso</label>
                    <div className="relative">
                      <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <select 
                        value={accessLevel}
                        onChange={(e) => setAccessLevel(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-axia-primary/20 transition-all font-medium appearance-none dark:text-white"
                        required
                      >
                        <option value="Usuário Padrão">Usuário Padrão</option>
                        <option value="Gestor">Gestor</option>
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <ChevronRight size={18} className="rotate-90" />
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-1">E-mail Corporativo</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-axia-primary/20 transition-all font-medium dark:text-white"
                    placeholder="seu@email.com"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Senha</label>
                  {mode === 'login' && (
                    <button type="button" className="text-xs font-bold text-axia-primary hover:underline">Esqueceu a senha?</button>
                  )}
                </div>
                <div className="relative">
                  <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-axia-primary/20 transition-all font-medium dark:text-white"
                    placeholder="Sua senha"
                    required
                  />
                </div>
              </div>

              {mode === 'login' && (
                <div className="flex items-center gap-2 px-1">
                  <input type="checkbox" id="remember" className="rounded border-slate-300 dark:border-slate-700 text-axia-primary focus:ring-axia-primary bg-transparent" defaultChecked />
                  <label htmlFor="remember" className="text-sm text-slate-600 dark:text-slate-400 font-medium cursor-pointer">Lembrar de mim</label>
                </div>
              )}

              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-axia-primary text-white py-4 rounded-2xl font-bold text-lg hover:bg-axia-primary/90 transition-all shadow-xl shadow-axia-primary/20 flex items-center justify-center gap-3 disabled:opacity-70"
              >
                {isLoading ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    {mode === 'login' ? 'Entrar no Sistema' : 'Solicitar Cadastro'}
                    <ArrowUpRight size={20} />
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 p-6 border-t border-slate-100 dark:border-slate-800 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {mode === 'login' ? (
                <>Não tem acesso? <button onClick={() => setMode('register')} className="text-axia-primary font-bold hover:underline">Solicite aqui</button></>
              ) : (
                <>Já possui conta? <button onClick={() => setMode('login')} className="text-axia-primary font-bold hover:underline">Faça login</button></>
              )}
            </p>
          </div>
        </motion.div>
        
        <div className="mt-8 text-center">
          <p className="text-xs text-slate-400 font-medium">© 2026 Axia Energia. Todos os direitos reservados.</p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, secondaryValue, change, icon, color, onClickDetails, onClickReport, isGeneratingReport, children }: { 
  title: string, 
  value: string, 
  secondaryValue?: string,
  change: string, 
  icon: React.ReactNode,
  color: 'blue' | 'orange' | 'green' | 'slate',
  onClickDetails?: () => void,
  onClickReport?: () => void,
  isGeneratingReport?: boolean,
  children?: React.ReactNode
}) {
  const [showMenu, setShowMenu] = useState(false);
  const colors = {
    blue: 'bg-blue-50 dark:bg-blue-900/20',
    orange: 'bg-orange-50 dark:bg-orange-900/20',
    green: 'bg-green-50 dark:bg-green-900/20',
    slate: 'bg-slate-50 dark:bg-slate-800/50'
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all relative">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl ${colors[color]}`}>
          {icon}
        </div>
        <div className="relative">
          <button 
            onClick={() => setShowMenu(!showMenu)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            < MoreVertical size={18} />
          </button>
          
          <AnimatePresence>
            {showMenu && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 py-2 z-30"
              >
                <button 
                  onClick={() => {
                    onClickDetails?.();
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-axia-primary dark:hover:text-axia-primary transition-colors flex items-center gap-2"
                >
                  <TrendingUp size={14} /> Ver Detalhes
                </button>
                <button 
                  onClick={() => {
                    if (isGeneratingReport) return;
                    onClickReport?.();
                    setShowMenu(false);
                  }}
                  disabled={isGeneratingReport}
                  className="w-full text-left px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-axia-primary dark:hover:text-axia-primary transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isGeneratingReport ? (
                    <div className="w-3.5 h-3.5 border-2 border-axia-primary/30 border-t-axia-primary rounded-full animate-spin" />
                  ) : (
                    <BarChart3 size={14} />
                  )}
                  {isGeneratingReport ? 'Gerando...' : 'Gerar Relatório'}
                </button>
                <div className="h-px bg-slate-100 dark:bg-slate-800 my-1 mx-2"></div>
                <button 
                  onClick={() => setShowMenu(false)}
                  className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2"
                >
                  <AlertCircle size={14} /> Ocultar Card
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <div>
        <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">{title}</p>
        <h4 className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{value}</h4>
        {secondaryValue && <p className="text-sm font-bold text-axia-primary mb-1">{secondaryValue}</p>}
        {children && <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-3 space-y-2">{children}</div>}
        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-2">{change}</p>
      </div>
    </div>
  );
}

