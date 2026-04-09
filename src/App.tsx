/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, Component } from 'react';
import { 
  LayoutDashboard, 
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
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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
  query,
  where,
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
import { Project, WeeklyReport, Measurement, UserProfile, Attachment, StatusUpdate, PhotoReportItem } from './types';

const Logo = ({ size = 40, className = "" }: { size?: number, className?: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 100 100" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Buildings */}
    <path d="M20 60V40H30V30H40V60H20Z" fill="currentColor" />
    <path d="M32 60V45H38V60H32Z" fill="currentColor" opacity="0.8" />
    
    {/* House */}
    <path d="M40 60L60 40L80 60H40Z" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
    <path d="M55 50H65V60H55V50Z" fill="currentColor" />
    
    {/* Gear (simplified) */}
    <circle cx="75" cy="40" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="4 2" />
    <circle cx="75" cy="40" r="4" fill="currentColor" />
    
    {/* Wave */}
    <path d="M10 70C30 60 70 80 90 70" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
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
      providerInfo: auth.currentUser?.providerData.map(provider => ({
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
  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile>(DEFAULT_USER);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [statusUpdates, setStatusUpdates] = useState<StatusUpdate[]>([]);
  const [photoReports, setPhotoReports] = useState<PhotoReportItem[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<UserProfile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [showAddProject, setShowAddProject] = useState(false);
  const [viewingProject, setViewingProject] = useState<Project | null>(null);
  const [currentPalette, setCurrentPalette] = useState('forest');

  const palettes = [
    { id: 'forest', name: 'Floresta (Verde)', primary: '#10B981', secondary: '#1E293B', accent: '#34D399' },
    { id: 'original', name: 'Original (Ouro)', primary: '#C5A059', secondary: '#1A1A1A', accent: '#E5C76B' },
    { id: 'ocean', name: 'Oceano (Azul)', primary: '#0EA5E9', secondary: '#0F172A', accent: '#38BDF8' },
    { id: 'royal', name: 'Real (Roxo)', primary: '#8B5CF6', secondary: '#111827', accent: '#A78BFA' },
    { id: 'sunset', name: 'Pôr do Sol (Laranja)', primary: '#F59E0B', secondary: '#451A03', accent: '#FBBF24' },
  ];

  useEffect(() => {
    const palette = palettes.find(p => p.id === currentPalette) || palettes[0];
    const root = document.documentElement;
    root.style.setProperty('--axia-primary', palette.primary);
    root.style.setProperty('--axia-secondary', palette.secondary);
    root.style.setProperty('--axia-accent', palette.accent);
  }, [currentPalette]);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editingMeasurement, setEditingMeasurement] = useState<Measurement | null>(null);
  const [projectDetailTab, setProjectDetailTab] = useState<'details' | 'attachments' | 'history' | 'photos'>('details');
  const [settingsTab, setSettingsTab] = useState<'general' | 'appearance' | 'security'>('general');
  const [notification, setNotification] = useState<string | null>(null);
  const [imageEditingProjectId, setImageEditingProjectId] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isUpdatingProgress, setIsUpdatingProgress] = useState(false);
  const [tempProgress, setTempProgress] = useState(0);
  const [isAddingPhoto, setIsAddingPhoto] = useState(false);
  const [newPhoto, setNewPhoto] = useState({ url: '', caption: '' });
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const photoFileInputRef = useRef<HTMLInputElement>(null);

  const handleQuickProgressUpdate = async () => {
    if (!viewingProject) return;
    try {
      const projectRef = doc(db, 'projects', viewingProject.id);
      await updateDoc(projectRef, { progress: tempProgress });
      setViewingProject({ ...viewingProject, progress: tempProgress });
      setIsUpdatingProgress(false);
      showNotification('Progresso atualizado!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `projects/${viewingProject.id}`);
    }
  };

  const handleAddPhoto = async () => {
    if (!viewingProject || !newPhoto.url) return;
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
      setIsAddingPhoto(false);
      showNotification('Foto adicionada ao relatório!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'photoReports');
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

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !viewingProject) return;

    setIsUploadingPhoto(true);
    try {
      const storage = getStorageInstance();
      const fileRef = storageRef(storage, `photoReports/${viewingProject.id}/${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      setNewPhoto(prev => ({ ...prev, url }));
      showNotification('Foto carregada com sucesso!');
    } catch (error) {
      console.error('Error uploading photo:', error);
      showNotification('Erro ao carregar foto. Verifique as permissões do Firebase Storage.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setCurrentUser(userDoc.data() as UserProfile);
            setIsLoggedIn(true);
          } else {
            // This case might happen if auth user exists but firestore doc doesn't
            // We'll handle it by signing out or redirecting to profile completion
            console.warn('User authenticated but profile not found in Firestore');
            setIsLoggedIn(false);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
        }
      } else {
        setIsLoggedIn(false);
      }
      setIsAuthReady(true);
    });

    // Test connection
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    };
    testConnection();

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isLoggedIn || !isAuthReady) return;

    const isManager = currentUser.accessLevel === 'Administrador de Sistema' || currentUser.accessLevel === 'Gestor';
    const projectsQuery = isManager 
      ? collection(db, 'projects') 
      : query(collection(db, 'projects'), where('createdBy', '==', currentUser.id));

    const unsubProjects = onSnapshot(projectsQuery, (snapshot) => {
      setProjects(snapshot.docs.map(doc => doc.data() as Project));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'projects'));

    const unsubReports = onSnapshot(collection(db, 'reports'), (snapshot) => {
      setReports(snapshot.docs.map(doc => doc.data() as WeeklyReport));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'reports'));

    const unsubMeasurements = onSnapshot(collection(db, 'measurements'), (snapshot) => {
      setMeasurements(snapshot.docs.map(doc => doc.data() as Measurement));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'measurements'));

    const unsubAttachments = onSnapshot(collection(db, 'attachments'), (snapshot) => {
      setAttachments(snapshot.docs.map(doc => doc.data() as Attachment));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'attachments'));

    const unsubStatusUpdates = onSnapshot(query(collection(db, 'statusUpdates'), orderBy('date', 'desc')), (snapshot) => {
      setStatusUpdates(snapshot.docs.map(doc => doc.data() as StatusUpdate));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'statusUpdates'));

    const unsubPhotoReports = onSnapshot(collection(db, 'photoReports'), (snapshot) => {
      setPhotoReports(snapshot.docs.map(doc => doc.data() as PhotoReportItem));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'photoReports'));

    return () => {
      unsubProjects();
      unsubReports();
      unsubMeasurements();
      unsubAttachments();
      unsubStatusUpdates();
      unsubPhotoReports();
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
  const projectsByClient = projects.reduce((acc: any, project) => {
    acc[project.client] = (acc[project.client] || 0) + 1;
    return acc;
  }, {});

  const projectsByClientData = Object.keys(projectsByClient).map(client => ({
    name: client,
    value: projectsByClient[client]
  }));

  const budgetByClient = projects.reduce((acc: any, project) => {
    acc[project.client] = (acc[project.client] || 0) + project.budget;
    return acc;
  }, {});

  const budgetByClientData = Object.keys(budgetByClient).map(client => ({
    name: client,
    value: budgetByClient[client]
  }));

  const statusCounts = {
    'not-started': projects.filter(p => p.status === 'not-started').length,
    'in-progress': projects.filter(p => p.status === 'in-progress').length,
    'paused': projects.filter(p => p.status === 'paused').length,
    'finished': projects.filter(p => p.status === 'finished').length,
  };

  const timelineData = projects
    .filter(p => p.startDate && p.endDate)
    .map(p => {
      const start = new Date(p.startDate);
      const end = new Date(p.endDate);
      const duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      return {
        name: p.name,
        start: start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        end: end.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        duration: duration > 0 ? duration : 1,
        fullStart: start.getTime(),
        status: p.status
      };
    })
    .sort((a, b) => a.fullStart - b.fullStart);

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
          image: `https://picsum.photos/seed/${newProject.name}/800/600`,
          createdBy: currentUser.id
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

  const handleAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'pdf' | 'image') => {
    const file = e.target.files?.[0];
    if (!file || !viewingProject) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const attachmentId = Math.random().toString(36).substr(2, 9);
        const newAttachment: Attachment = {
          id: attachmentId,
          projectId: viewingProject.id,
          name: file.name,
          type: type,
          url: event.target?.result as string,
          uploadedAt: new Date().toLocaleString('pt-BR'),
          size: (file.size / (1024 * 1024)).toFixed(2) + ' MB'
        };
        await setDoc(doc(db, 'attachments', attachmentId), newAttachment);
        showNotification(`${type === 'pdf' ? 'PDF' : 'Foto'} anexado com sucesso!`);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'attachments');
      }
    };
    reader.readAsDataURL(file);
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
      name: project.name,
      client: project.client,
      contractNumber: project.contractNumber,
      description: project.description,
      budget: project.budget.toString(),
      location: project.location,
      startDate: project.startDate,
      endDate: project.endDate,
      executingCompany: project.executingCompany,
      status: project.status,
      progress: project.progress
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
      value: measurement.value.toString(),
      description: measurement.description
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

  const generateProjectReport = (project: Project) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFillColor(196, 160, 82); // axia-primary color
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('A.L GESTÃO DE OBRAS', 20, 20);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('RELATÓRIO TÉCNICO DE OBRA', 20, 30);
    doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth - 70, 30);
    
    // Project Info
    doc.setTextColor(30, 41, 59); // slate-800
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(project.name.toUpperCase(), 20, 55);
    
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.line(20, 60, pageWidth - 20, 60);
    
    // Details Table
    const detailsData = [
      ['Cliente', project.client],
      ['Contrato', project.contractNumber],
      ['Empresa Executora', project.executingCompany],
      ['Data de Início', project.startDate],
      ['Previsão de Término', project.endDate],
      ['Status', 
        project.status === 'in-progress' ? 'Em Andamento' : 
        project.status === 'finished' ? 'Concluído' : 
        project.status === 'paused' ? 'Paralisado' : 'Não Iniciado'
      ],
      ['Orçamento Total', new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(project.budget)],
      ['Total Medido', new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(project.spent)],
      ['Saldo Disponível', new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(project.budget - project.spent)],
      ['Percentual Executado', `${Math.round((project.spent / project.budget) * 100)}%`]
    ];
    
    autoTable(doc, {
      startY: 70,
      head: [['Campo', 'Informação']],
      body: detailsData,
      theme: 'striped',
      headStyles: { fillColor: [196, 160, 82], textColor: [255, 255, 255] },
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
        headStyles: { fillColor: [196, 160, 82], textColor: [255, 255, 255] },
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
        headStyles: { fillColor: [196, 160, 82], textColor: [255, 255, 255] },
        styles: { fontSize: 9 },
        columnStyles: {
          1: { cellWidth: 100 }
        }
      });
    }
    
    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(`Página ${i} de ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
      doc.text('© 2026 A.L Gestão de Obras - Todos os direitos reservados', pageWidth / 2, doc.internal.pageSize.getHeight() - 5, { align: 'center' });
    }
    
    doc.save(`Relatorio_${project.name.replace(/\s+/g, '_')}.pdf`);
    showNotification('Relatório PDF gerado com sucesso!');
  };

  const generateGeneralReport = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    if (projects.length === 0) {
      showNotification('Nenhum projeto encontrado para gerar relatório.');
      return;
    }

    projects.forEach((project, index) => {
      if (index > 0) {
        doc.addPage();
      }

      // Header for each project page
      doc.setFillColor(196, 160, 82); // axia-primary color
      doc.rect(0, 0, pageWidth, 30, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('A.L GESTÃO DE OBRAS', 15, 15);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`RELATÓRIO DETALHADO DA OBRA - ${project.name.toUpperCase()}`, 15, 22);
      doc.text(`Emissão: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth - 15, 22, { align: 'right' });
      
      // Project Info Section
      doc.setTextColor(51, 65, 85); // slate-700
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Informações Gerais', 15, 45);
      
      const generalInfo = [
        ['Cliente', project.client],
        ['Contrato', project.contractNumber],
        ['Localidade', project.location],
        ['Empresa Executora', project.executingCompany],
        ['Status', getStatusLabel(project.status)],
        ['Progresso', `${project.progress}%`],
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
        ['Orçamento Total', new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(project.budget)],
        ['Total Medido', new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(project.spent)],
        ['Saldo Disponível', new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(project.budget - project.spent)],
        ['Utilização', `${Math.round((project.spent / project.budget) * 100)}%`]
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
          m.date,
          m.description,
          new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(m.value),
          m.status === 'paid' ? 'Pago' : m.status === 'approved' ? 'Aprovado' : 'Pendente'
        ]);

        autoTable(doc, {
          startY: finalYFinancial + 15,
          head: [['Data', 'Descrição', 'Valor', 'Status']],
          body: measurementData,
          theme: 'grid',
          headStyles: { fillColor: [196, 160, 82] },
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
            headStyles: { fillColor: [196, 160, 82] },
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
            headStyles: { fillColor: [196, 160, 82] },
            styles: { fontSize: 9, cellPadding: 2 }
          });
        }
      }
    });
    
    // Footer for all pages
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(`Página ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      doc.text('© 2026 A.L Gestão de Obras - Relatório Gerencial Detalhado', pageWidth / 2, pageHeight - 5, { align: 'center' });
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

    try {
      const reportId = `rep-${Date.now()}`;
      const newReport: WeeklyReport = {
        id: reportId,
        projectId: '1', // Simplificado para o exemplo
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
      case 'in-progress': return 'bg-green-100 text-green-700 border-green-200';
      case 'finished': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'paused': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getStatusLabel = (status: Project['status']) => {
    switch (status) {
      case 'not-started': return 'Não Iniciada';
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
    <div className="flex h-screen bg-slate-50 overflow-hidden">
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
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-200"
            >
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-2xl font-display font-bold text-slate-900 text-center mb-2">Excluir Obra?</h3>
              <p className="text-slate-500 text-center mb-8">
                Tem certeza que deseja excluir a obra <span className="font-bold text-slate-900">"{projectToDelete.name}"</span>? Esta ação é irreversível e apagará todos os dados relacionados (medições, anexos e relatórios).
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setProjectToDelete(null)}
                  className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
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

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 260 : 80 }}
        className="bg-white border-r border-slate-200 flex flex-col z-30"
      >
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-axia-primary rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg shadow-axia-primary/20">
            <Logo size={28} className="text-white" />
          </div>
          {isSidebarOpen && (
            <div className="overflow-hidden whitespace-nowrap">
              <h1 className="text-xl font-display font-bold text-axia-primary">A.L</h1>
              <p className="text-[10px] uppercase tracking-widest text-axia-secondary font-bold">Gestão de Obras</p>
            </div>
          )}
        </div>

        <nav className="flex-1 px-4 py-4 space-y-2">
          <NavItem 
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')}
            collapsed={!isSidebarOpen}
          />
          <NavItem 
            icon={<HardHat size={20} />} 
            label="Projetos" 
            active={activeTab === 'projects'} 
            onClick={() => setActiveTab('projects')}
            collapsed={!isSidebarOpen}
          />
          <NavItem 
            icon={<Receipt size={20} />} 
            label="Medições" 
            active={activeTab === 'measurements'} 
            onClick={() => setActiveTab('measurements')}
            collapsed={!isSidebarOpen}
          />
          <NavItem 
            icon={<BarChart3 size={20} />} 
            label="Relatórios" 
            active={activeTab === 'reports'} 
            onClick={() => setActiveTab('reports')}
            collapsed={!isSidebarOpen}
          />
          <NavItem 
            icon={<History size={20} />} 
            label="Atualizações" 
            active={activeTab === 'updates'} 
            onClick={() => setActiveTab('updates')}
            collapsed={!isSidebarOpen}
          />
        </nav>

        <div className="p-4 border-t border-slate-100">
          <NavItem 
            icon={<Settings size={20} />} 
            label="Configurações" 
            active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')}
            collapsed={!isSidebarOpen}
          />
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 z-20">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"
            >
              <Menu size={20} />
            </button>
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Buscar projetos, tarefas..." 
                className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-axia-primary/20 w-64 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="relative p-2 hover:bg-slate-100 rounded-full text-slate-500">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-axia-secondary rounded-full border-2 border-white"></span>
            </button>
            <div className="h-8 w-px bg-slate-200 mx-2"></div>
            <button 
              onClick={() => setShowProfile(true)}
              className="flex items-center gap-3 hover:bg-slate-50 p-1.5 rounded-xl transition-colors text-left"
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold">{currentUser.name}</p>
                <p className="text-xs text-slate-500">{currentUser.role}</p>
              </div>
              <img 
                src={currentUser.avatar} 
                alt="Profile" 
                className="w-10 h-10 rounded-full border-2 border-axia-primary/10"
                referrerPolicy="no-referrer"
              />
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8">
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
                    <h2 className="text-3xl font-display font-bold text-slate-900">Dashboard de Obras</h2>
                    <p className="text-slate-500">Bem-vindo de volta. Aqui está o resumo das suas operações.</p>
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatCard 
                    title="Não Iniciadas" 
                    value={statusCounts['not-started'].toString()} 
                    change="Aguardando início" 
                    icon={<Clock className="text-slate-400" />} 
                    color="slate"
                  />
                  <StatCard 
                    title="Em Andamento" 
                    value={statusCounts['in-progress'].toString()} 
                    change="Execução ativa" 
                    icon={<HardHat className="text-axia-primary" />} 
                    color="blue"
                  />
                  <StatCard 
                    title="Paralisadas" 
                    value={statusCounts['paused'].toString()} 
                    change="Necessita atenção" 
                    icon={<AlertCircle className="text-axia-secondary" />} 
                    color="orange"
                  />
                  <StatCard 
                    title="Finalizadas" 
                    value={statusCounts['finished'].toString()} 
                    change="Concluídas com sucesso" 
                    icon={<CheckCircle2 className="text-axia-accent" />} 
                    color="green"
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Projects per Client Chart */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
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

                {/* Timeline / Schedule */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <Calendar size={20} className="text-axia-primary" />
                    Cronograma de Obras
                  </h3>
                  <div className="space-y-4">
                    {timelineData.length > 0 ? (
                      timelineData.map((item, index) => (
                        <div key={index} className="space-y-1">
                          <div className="flex justify-between text-xs font-bold text-slate-500 px-1">
                            <span>{item.name}</span>
                            <div className="flex gap-4">
                              <span>Início: {item.start}</span>
                              <span>Fim: {item.end}</span>
                            </div>
                          </div>
                          <div className="h-4 w-full bg-slate-50 rounded-full overflow-hidden flex">
                            <div 
                              className={`h-full rounded-full transition-all duration-1000 ${
                                item.status === 'finished' ? 'bg-axia-accent' : 
                                item.status === 'paused' ? 'bg-axia-secondary' : 
                                item.status === 'in-progress' ? 'bg-axia-primary' : 'bg-slate-300'
                              }`}
                              style={{ width: `${Math.min(100, (item.duration / 365) * 100 * 5)}%` }} // Scaled for visibility
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-12 text-center text-slate-400">
                        <Calendar size={48} className="mx-auto mb-4 opacity-20" />
                        <p>Nenhuma data de início/fim definida para as obras.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Projects Table */}
                  <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="text-lg font-bold">Projetos Recentes</h3>
                      <button 
                        onClick={() => setActiveTab('projects')}
                        className="text-axia-primary text-sm font-semibold hover:underline"
                      >
                        Ver todos
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                            <th className="px-6 py-4 font-semibold">Projeto</th>
                            <th className="px-6 py-4 font-semibold">Status</th>
                            <th className="px-6 py-4 font-semibold">Progresso</th>
                            <th className="px-6 py-4 font-semibold">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {projects.slice(0, 3).map((project) => (
                            <tr key={project.id} className="hover:bg-slate-50 transition-colors group">
                              <td className="px-6 py-4">
                                <div>
                                  <p className="font-bold text-slate-900">{project.name}</p>
                                  <p className="text-xs text-slate-500 flex items-center gap-1">
                                    <MapPin size={12} /> {project.location}
                                  </p>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(project.status)}`}>
                                  {getStatusLabel(project.status)}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="w-full max-w-[120px]">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-bold text-slate-700">{project.progress}%</span>
                                  </div>
                                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <motion.div 
                                      initial={{ width: 0 }}
                                      animate={{ width: `${project.progress}%` }}
                                      className={`h-full rounded-full ${
                                        project.status === 'delayed' ? 'bg-red-500' : 'bg-axia-primary'
                                      }`}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <button 
                                  onClick={() => {
                                    setViewingProject(project);
                                    setActiveTab('projects');
                                  }}
                                  className="p-2 hover:bg-slate-200 rounded-lg text-slate-400 group-hover:text-slate-600 transition-colors"
                                >
                                  <ChevronRight size={18} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
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

                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                      <div 
                        className="h-64 bg-slate-100 relative cursor-pointer group/banner overflow-hidden"
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
                          </div>
                        </div>
                      </div>

                      <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-12">
                        <div className="lg:col-span-2 space-y-8">
                          <div className="flex border-b border-slate-100 mb-6">
                            <button 
                              onClick={() => setProjectDetailTab('details')}
                              className={`px-6 py-3 font-bold text-sm transition-all relative ${projectDetailTab === 'details' ? 'text-axia-primary' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                              Detalhes do Projeto
                              {projectDetailTab === 'details' && <motion.div layoutId="projectTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-axia-primary" />}
                            </button>
                            <button 
                              onClick={() => setProjectDetailTab('attachments')}
                              className={`px-6 py-3 font-bold text-sm transition-all relative ${projectDetailTab === 'attachments' ? 'text-axia-primary' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                              Anexos
                              {projectDetailTab === 'attachments' && <motion.div layoutId="projectTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-axia-primary" />}
                            </button>
                            <button 
                              onClick={() => setProjectDetailTab('history')}
                              className={`px-6 py-3 font-bold text-sm transition-all relative ${projectDetailTab === 'history' ? 'text-axia-primary' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                              Histórico
                              {projectDetailTab === 'history' && <motion.div layoutId="projectTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-axia-primary" />}
                            </button>
                            <button 
                              onClick={() => setProjectDetailTab('photos')}
                              className={`px-6 py-3 font-bold text-sm transition-all relative ${projectDetailTab === 'photos' ? 'text-axia-primary' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                              Relatório Fotográfico
                              {projectDetailTab === 'photos' && <motion.div layoutId="projectTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-axia-primary" />}
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

                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                                  <p className="text-[11px] font-bold text-slate-400 uppercase mb-1.5 tracking-wider">Cliente</p>
                                  <p className="font-bold text-slate-900 text-base break-words">{viewingProject.client}</p>
                                </div>
                                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                                  <p className="text-[11px] font-bold text-slate-400 uppercase mb-1.5 tracking-wider">Contrato</p>
                                  <p className="font-bold text-slate-900 text-base break-all">{viewingProject.contractNumber}</p>
                                </div>
                                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                                  <p className="text-[11px] font-bold text-slate-400 uppercase mb-1.5 tracking-wider">Início</p>
                                  <p className="font-bold text-slate-900 text-base">{viewingProject.startDate}</p>
                                </div>
                                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                                  <p className="text-[11px] font-bold text-slate-400 uppercase mb-1.5 tracking-wider">Término</p>
                                  <p className="font-bold text-slate-900 text-base">{viewingProject.endDate}</p>
                                </div>
                                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm col-span-2">
                                  <p className="text-[11px] font-bold text-slate-400 uppercase mb-1.5 tracking-wider">Empresa Executora</p>
                                  <p className="font-bold text-slate-900 text-base break-words">{viewingProject.executingCompany}</p>
                                </div>
                                <div className="p-5 bg-axia-primary/10 rounded-2xl border border-axia-primary/20 shadow-sm col-span-2">
                                  <p className="text-[11px] font-bold text-axia-primary uppercase mb-1.5 tracking-wider">Localidade</p>
                                  <p className="font-bold text-slate-900 text-base flex items-center gap-2">
                                    <MapPin size={18} className="text-axia-primary" />
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
                                      <p className="text-[11px] font-bold text-slate-400 uppercase mb-1.5 tracking-wider">Orçamento Total</p>
                                      <p className="text-2xl font-bold text-axia-accent">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(viewingProject.budget)}
                                      </p>
                                    </div>
                                    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                                      <p className="text-[11px] font-bold text-slate-400 uppercase mb-1.5 tracking-wider">Total Medido</p>
                                      <p className="text-2xl font-bold text-axia-primary">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(viewingProject.spent)}
                                      </p>
                                    </div>
                                  </div>
                                  
                                  <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Utilização do Orçamento</span>
                                      <span className="text-sm font-bold text-axia-primary bg-axia-primary/10 px-2 py-0.5 rounded-lg">
                                        {Math.round((viewingProject.spent / viewingProject.budget) * 100)}%
                                      </span>
                                    </div>
                                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                                      <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${(viewingProject.spent / viewingProject.budget) * 100}%` }}
                                        className="h-full bg-axia-accent rounded-full shadow-inner"
                                      />
                                    </div>
                                    <div className="flex justify-between text-[11px] font-bold text-slate-400">
                                      <span>Saldo: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(viewingProject.budget - viewingProject.spent)}</span>
                                      <span>Total: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(viewingProject.budget)}</span>
                                    </div>
                                  </div>
                                </div>
                              </section>
                            </>
                          ) : projectDetailTab === 'attachments' ? (
                            <div className="space-y-8">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200 border-dashed flex flex-col items-center justify-center text-center group hover:bg-white hover:border-axia-primary transition-all cursor-pointer relative">
                                  <input 
                                    type="file" 
                                    accept=".pdf" 
                                    className="absolute inset-0 opacity-0 cursor-pointer" 
                                    onChange={(e) => handleAttachmentUpload(e, 'pdf')}
                                  />
                                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-red-500 shadow-sm mb-3 group-hover:scale-110 transition-transform">
                                    <FileText size={24} />
                                  </div>
                                  <h4 className="font-bold text-slate-900">Anexar Contrato / PDF</h4>
                                  <p className="text-xs text-slate-500">Clique para selecionar arquivo</p>
                                </div>
                                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200 border-dashed flex flex-col items-center justify-center text-center group hover:bg-white hover:border-axia-primary transition-all cursor-pointer relative">
                                  <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="absolute inset-0 opacity-0 cursor-pointer" 
                                    onChange={(e) => handleAttachmentUpload(e, 'image')}
                                  />
                                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-axia-primary shadow-sm mb-3 group-hover:scale-110 transition-transform">
                                    <Camera size={24} />
                                  </div>
                                  <h4 className="font-bold text-slate-900">Anexar Foto da Obra</h4>
                                  <p className="text-xs text-slate-500">Clique para selecionar imagem</p>
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
                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <a 
                                            href={attachment.url} 
                                            target="_blank" 
                                            rel="noreferrer"
                                            className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-axia-primary transition-colors"
                                          >
                                            <Download size={18} />
                                          </a>
                                          <button 
                                            onClick={() => handleDeleteAttachment(attachment.id)}
                                            className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
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
                                      disabled={!newPhoto.url}
                                      className="px-6 py-2 bg-axia-primary text-white font-bold text-sm rounded-xl hover:bg-axia-primary/90 transition-all shadow-md shadow-axia-primary/20 disabled:opacity-50"
                                    >
                                      Salvar Foto
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
                          ) : (
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
                            onClick={() => {
                              setSelectedProject(viewingProject.name);
                              setActiveTab('reports');
                            }}
                            className="w-full bg-axia-secondary text-white py-4 rounded-2xl font-bold hover:bg-axia-secondary/90 transition-all shadow-lg shadow-axia-secondary/20 flex items-center justify-center gap-2"
                          >
                            <FileText size={20} />
                            Relatório Mensal
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-3xl font-display font-bold text-slate-900">Gestão de Obras</h2>
                        <p className="text-slate-500">Visualize e gerencie todos os contratos e execuções da Axia Energia.</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={generateGeneralReport}
                          className="bg-axia-secondary text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 hover:bg-axia-secondary/90 transition-colors shadow-lg shadow-axia-secondary/20"
                        >
                          <FileDown size={20} />
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
                          className="bg-axia-primary text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 hover:bg-axia-primary/90 transition-colors shadow-lg shadow-axia-primary/20"
                        >
                          {showAddProject ? <X size={20} /> : <Plus size={20} />}
                          {showAddProject ? 'Cancelar' : 'Nova Obra'}
                        </button>
                      </div>
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

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                      {projects.map((project) => (
                        <motion.div 
                          layout
                          key={project.id}
                          className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row"
                        >
                          <div 
                            className="md:w-1/3 bg-slate-100 relative min-h-[200px] cursor-pointer group/img overflow-hidden"
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
                            <div className="absolute top-4 left-4">
                              <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm ${getStatusColor(project.status)}`}>
                                {getStatusLabel(project.status)}
                              </span>
                            </div>
                          </div>
                          <div className="md:w-2/3 p-6 flex flex-col">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="text-[10px] font-bold text-axia-secondary uppercase tracking-widest mb-1 break-all">Contrato: {project.contractNumber}</p>
                                <h3 className="text-xl font-bold text-slate-900 leading-tight">{project.name}</h3>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Valor do Contrato</p>
                                <p className="text-lg font-bold text-axia-accent">
                                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(project.budget)}
                                </p>
                              </div>
                            </div>

                            <p className="text-sm text-slate-600 mb-6 line-clamp-2">{project.description}</p>

                            <div className="grid grid-cols-2 gap-4 mb-6">
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                <MapPin size={14} className="text-axia-primary" />
                                <span>{project.location}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                <Calendar size={14} className="text-axia-primary" />
                                <span>{project.startDate} até {project.endDate}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-slate-500 col-span-2">
                                <Briefcase size={14} className="text-axia-primary shrink-0" />
                                <span className="font-bold shrink-0">Executora:</span>
                                <span className="break-words">{project.executingCompany}</span>
                              </div>
                            </div>

                            <div className="mb-6 p-3 bg-slate-50 rounded-xl border border-slate-100">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-bold text-slate-500 uppercase">Progresso Financeiro</span>
                                <span className="text-[10px] font-bold text-axia-accent">
                                  {Math.round((project.spent / project.budget) * 100)}% Medido
                                </span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden mb-2">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${(project.spent / project.budget) * 100}%` }}
                                  className="h-full bg-axia-accent rounded-full"
                                />
                              </div>
                              <div className="flex justify-between text-[10px] font-bold">
                                <div className="text-slate-400">Saldo: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(project.budget - project.spent)}</div>
                                <div className="text-axia-primary">Medido: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(project.spent)}</div>
                              </div>
                            </div>

                            <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                              <div className="flex-1 mr-8">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[10px] font-bold text-slate-500 uppercase">Progresso da Obra</span>
                                  <span className="text-xs font-bold text-axia-primary">{project.progress}%</span>
                                </div>
                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${project.progress}%` }}
                                    className="h-full bg-axia-primary rounded-full"
                                  />
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => startEditing(project)}
                                  className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-axia-primary transition-colors"
                                  title="Editar Obra"
                                >
                                  <Pencil size={18} />
                                </button>
                                <button 
                                  onClick={() => setProjectToDelete(project)}
                                  className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                                  title="Excluir Obra"
                                >
                                  <Trash2 size={18} />
                                </button>
                                <button 
                                  onClick={() => setViewingProject(project)}
                                  className="p-2 hover:bg-slate-100 rounded-lg text-axia-primary transition-colors"
                                  title="Ver Detalhes"
                                >
                                  <ChevronRight size={20} />
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
                    <h2 className="text-3xl font-display font-bold text-slate-900">Medições de Obras</h2>
                    <p className="text-slate-500">Registre e acompanhe as medições mensais de cada projeto.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* New Measurement Form */}
                  <div className="lg:col-span-1">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm sticky top-8">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold flex items-center gap-2">
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
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Projeto</label>
                          <select 
                            required
                            value={newMeasurement.projectId}
                            onChange={(e) => setNewMeasurement({...newMeasurement, projectId: e.target.value})}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-axia-primary/20"
                          >
                            <option value="">Selecione a obra...</option>
                            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data da Medição</label>
                          <input 
                            required
                            type="date" 
                            value={newMeasurement.date}
                            onChange={(e) => setNewMeasurement({...newMeasurement, date: e.target.value})}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-axia-primary/20" 
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Valor Medido (R$)</label>
                          <input 
                            required
                            type="number" 
                            value={newMeasurement.value}
                            onChange={(e) => setNewMeasurement({...newMeasurement, value: e.target.value})}
                            placeholder="0,00"
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-axia-primary/20" 
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descrição dos Serviços</label>
                          <textarea 
                            required
                            rows={3}
                            value={newMeasurement.description}
                            onChange={(e) => setNewMeasurement({...newMeasurement, description: e.target.value})}
                            placeholder="Ex: Execução de 500m de cabeamento..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-axia-primary/20"
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
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="text-lg font-bold">Histórico de Medições</h3>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                          <TrendingUp size={14} />
                          <span>Total Medido: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(measurements.reduce((acc, m) => acc + m.value, 0))}</span>
                        </div>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {measurements.length === 0 ? (
                          <div className="p-20 text-center text-slate-400">
                            <Receipt size={48} className="mx-auto mb-4 opacity-20" />
                            <p>Nenhuma medição registrada ainda.</p>
                          </div>
                        ) : (
                          measurements.map((measurement) => (
                            <div key={measurement.id} className="p-6 hover:bg-slate-50 transition-colors">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-bold text-slate-900">{measurement.projectName}</h4>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 border border-green-200">
                                      {measurement.status === 'paid' ? 'Pago' : measurement.status === 'approved' ? 'Aprovado' : 'Pendente'}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-500 flex items-center gap-2">
                                    <Calendar size={12} /> {measurement.date}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-lg font-bold text-axia-accent">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(measurement.value)}
                                  </p>
                                  <div className="flex items-center justify-end gap-2 mt-1">
                                    <button 
                                      onClick={() => startEditingMeasurement(measurement)}
                                      className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-axia-primary transition-colors"
                                      title="Editar Medição"
                                    >
                                      <Pencil size={14} />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteMeasurement(measurement)}
                                      className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                                      title="Excluir Medição"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                              <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 italic">
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
                    <h2 className="text-3xl font-display font-bold text-slate-900">Relatórios Semanais</h2>
                    <p className="text-slate-500">Gerencie e anexe os relatórios de acompanhamento das obras.</p>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => showNotification('Exportando todos os relatórios para PDF...')}
                      className="bg-white text-slate-700 border border-slate-200 px-4 py-2 rounded-lg font-semibold flex items-center gap-2 hover:bg-slate-50 transition-colors"
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
                          : 'border-slate-200 bg-white hover:border-axia-primary/50 hover:bg-slate-50'
                        }
                      `}
                    >
                      <div className="w-16 h-16 bg-axia-primary/10 rounded-full flex items-center justify-center mb-4 text-axia-primary">
                        <Upload size={32} />
                      </div>
                      <h4 className="text-lg font-bold text-slate-900 mb-2">Anexar Relatório Semanal</h4>
                      <p className="text-sm text-slate-500 mb-6">Arraste seu arquivo PDF aqui ou clique para selecionar do computador.</p>
                      <div className="w-full space-y-4 text-left">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Projeto</label>
                          <select 
                            value={selectedProject}
                            onChange={(e) => setSelectedProject(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-axia-primary/20"
                          >
                            <option value="">Selecione a obra...</option>
                            {MOCK_PROJECTS.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Semana de Referência</label>
                          <input 
                            type="date" 
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-axia-primary/20" 
                          />
                        </div>
                        <button 
                          onClick={handleUpload}
                          className="w-full bg-axia-primary text-white py-2.5 rounded-xl font-bold hover:bg-axia-primary/90 transition-all"
                        >
                          Fazer Upload
                        </button>
                      </div>
                    </div>

                    <div className="bg-axia-secondary/10 border border-axia-secondary/20 rounded-2xl p-6">
                      <div className="flex items-center gap-3 mb-3 text-axia-secondary">
                        <AlertCircle size={20} />
                        <h4 className="font-bold">Lembrete</h4>
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed">
                        Os relatórios semanais devem ser enviados até toda sexta-feira às 18h para aprovação da diretoria técnica.
                      </p>
                    </div>
                  </div>

                  {/* Reports List */}
                  <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100">
                      <h3 className="text-lg font-bold">Histórico de Envios</h3>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {reports.map((report) => (
                        <div key={report.id} className="p-6 hover:bg-slate-50 transition-colors flex items-center gap-4">
                          <div className="w-12 h-12 bg-red-50 text-red-500 rounded-xl flex items-center justify-center flex-shrink-0">
                            <FileText size={24} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-bold text-slate-900 truncate">{report.fileName}</h4>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getReportStatusColor(report.status)}`}>
                                {report.status === 'approved' ? 'Aprovado' : report.status === 'submitted' ? 'Em Análise' : 'Rascunho'}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
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
                              className="p-2 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-axia-primary transition-colors" 
                              title="Download"
                            >
                              <Download size={18} />
                            </button>
                            <button 
                              onClick={() => handleDelete(report.id)}
                              className="p-2 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-red-500 transition-colors" 
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
                    <h2 className="text-3xl font-display font-bold text-slate-900">Atualizações de Status</h2>
                    <p className="text-slate-500">Registre o progresso diário e comunicados importantes das obras.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* New Update Form */}
                  <div className="lg:col-span-1">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm sticky top-8">
                      <h3 className="text-lg font-bold flex items-center gap-2 mb-6">
                        <MessageSquare className="text-axia-primary" /> Nova Atualização
                      </h3>
                      <form onSubmit={handleAddStatusUpdate} className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Projeto</label>
                          <select 
                            required
                            value={newStatusUpdate.projectId}
                            onChange={(e) => setNewStatusUpdate({...newStatusUpdate, projectId: e.target.value})}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-axia-primary/20"
                          >
                            <option value="">Selecione a obra...</option>
                            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mensagem / Status</label>
                          <textarea 
                            required
                            rows={5}
                            value={newStatusUpdate.message}
                            onChange={(e) => setNewStatusUpdate({...newStatusUpdate, message: e.target.value})}
                            placeholder="Descreva o que aconteceu hoje ou o status atual..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-axia-primary/20"
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
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="text-lg font-bold">Histórico Geral de Atualizações</h3>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {statusUpdates.length === 0 ? (
                          <div className="p-12 text-center text-slate-400">
                            <History size={48} className="mx-auto mb-4 opacity-10" />
                            <p>Nenhuma atualização registrada ainda.</p>
                          </div>
                        ) : (
                          statusUpdates.map((update) => {
                            const project = projects.find(p => p.id === update.projectId);
                            return (
                              <div key={update.id} className="p-6 hover:bg-slate-50 transition-colors">
                                <div className="flex items-start gap-4">
                                  <div className="w-10 h-10 bg-axia-primary/10 text-axia-primary rounded-full flex items-center justify-center flex-shrink-0">
                                    <User size={20} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                      <h4 className="font-bold text-slate-900">{update.author}</h4>
                                      <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-mono font-bold text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded-md">{update.date}</span>
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
                                    <p className="text-sm text-slate-600 leading-relaxed">{update.message}</p>
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
                  <p className="text-slate-500">Personalize sua experiência no sistema A.L Gestão de Obras.</p>
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
                    </nav>
                  </div>

                  <div className="md:col-span-2 space-y-6">
                    <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8">
                      {settingsTab === 'general' && (
                        <section className="space-y-4">
                          <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">Preferências Gerais</h3>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-bold text-slate-700">Compactar Sidebar</p>
                              <p className="text-xs text-slate-500">Reduzir o tamanho da barra lateral automaticamente.</p>
                            </div>
                            <button 
                              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                              className={`w-12 h-6 rounded-full relative transition-colors ${isSidebarOpen ? 'bg-axia-primary' : 'bg-slate-200'}`}
                            >
                              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${isSidebarOpen ? 'right-1' : 'left-1'}`} />
                            </button>
                          </div>
                        </section>
                      )}

                      {settingsTab === 'appearance' && (
                        <section className="space-y-6">
                          <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">Personalização Visual</h3>
                          
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-bold text-slate-700">Modo Escuro</p>
                              <p className="text-xs text-slate-500">Alternar entre tema claro e escuro.</p>
                            </div>
                            <button 
                              onClick={() => showNotification('Modo escuro será implementado em breve.')}
                              className="w-12 h-6 bg-slate-200 rounded-full relative transition-colors"
                            >
                              <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                            </button>
                          </div>

                          <div className="space-y-4">
                            <p className="font-bold text-slate-700">Paleta de Cores do Sistema</p>
                            <p className="text-xs text-slate-500 mb-4">Escolha uma combinação de cores que melhor se adapta ao seu estilo de trabalho.</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {palettes.map((palette) => (
                                <button
                                  key={palette.id}
                                  onClick={() => setCurrentPalette(palette.id)}
                                  className={`p-4 rounded-2xl border-2 transition-all flex items-center gap-4 text-left ${
                                    currentPalette === palette.id 
                                      ? 'border-axia-primary bg-axia-primary/5 shadow-md' 
                                      : 'border-slate-100 hover:border-slate-200 bg-slate-50'
                                  }`}
                                >
                                  <div className="flex -space-x-3">
                                    <div className="w-10 h-10 rounded-xl border-2 border-white shadow-sm" style={{ backgroundColor: palette.primary }} />
                                    <div className="w-10 h-10 rounded-xl border-2 border-white shadow-sm" style={{ backgroundColor: palette.secondary }} />
                                  </div>
                                  <div>
                                    <p className={`font-bold text-sm ${currentPalette === palette.id ? 'text-axia-primary' : 'text-slate-700'}`}>
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
                          <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">Segurança da Conta</h3>
                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <p className="text-sm text-slate-600">As opções de segurança e alteração de senha estão disponíveis através do provedor de autenticação.</p>
                          </div>
                        </section>
                      )}

                      {settingsTab === 'general' && (
                        <section className="space-y-4">
                          <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">Preferências Gerais</h3>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-bold text-slate-700">Compactar Sidebar</p>
                              <p className="text-xs text-slate-500">Reduzir o tamanho da barra lateral automaticamente.</p>
                            </div>
                            <button 
                              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                              className={`w-12 h-6 rounded-full relative transition-colors ${isSidebarOpen ? 'bg-axia-primary' : 'bg-slate-200'}`}
                            >
                              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${isSidebarOpen ? 'right-1' : 'left-1'}`} />
                            </button>
                          </div>
                        </section>
                      )}

                      {settingsTab === 'appearance' && (
                        <section className="space-y-6">
                          <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">Personalização Visual</h3>
                          
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-bold text-slate-700">Modo Escuro</p>
                              <p className="text-xs text-slate-500">Alternar entre tema claro e escuro.</p>
                            </div>
                            <button 
                              onClick={() => showNotification('Modo escuro será implementado em breve.')}
                              className="w-12 h-6 bg-slate-200 rounded-full relative transition-colors"
                            >
                              <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                            </button>
                          </div>

                          <div className="space-y-4">
                            <p className="font-bold text-slate-700">Paleta de Cores do Sistema</p>
                            <p className="text-xs text-slate-500 mb-4">Escolha uma combinação de cores que melhor se adapta ao seu estilo de trabalho.</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {palettes.map((palette) => (
                                <button
                                  key={palette.id}
                                  onClick={() => setCurrentPalette(palette.id)}
                                  className={`p-4 rounded-2xl border-2 transition-all flex items-center gap-4 text-left ${
                                    currentPalette === palette.id 
                                      ? 'border-axia-primary bg-axia-primary/5 shadow-md' 
                                      : 'border-slate-100 hover:border-slate-200 bg-slate-50'
                                  }`}
                                >
                                  <div className="flex -space-x-3">
                                    <div className="w-10 h-10 rounded-xl border-2 border-white shadow-sm" style={{ backgroundColor: palette.primary }} />
                                    <div className="w-10 h-10 rounded-xl border-2 border-white shadow-sm" style={{ backgroundColor: palette.secondary }} />
                                  </div>
                                  <div>
                                    <p className={`font-bold text-sm ${currentPalette === palette.id ? 'text-axia-primary' : 'text-slate-700'}`}>
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
                          <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">Segurança da Conta</h3>
                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <p className="text-sm text-slate-600">As opções de segurança e alteração de senha estão disponíveis através do provedor de autenticação.</p>
                          </div>
                        </section>
                      )}

                      <section className="space-y-4">
                        <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">Notificações</h3>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-bold text-slate-700">Alertas de Prazo</p>
                            <p className="text-xs text-slate-500">Receber avisos sobre tarefas próximas do vencimento.</p>
                          </div>
                          <button className="w-12 h-6 bg-axia-primary rounded-full relative">
                            <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-bold text-slate-700">Relatórios Semanais</p>
                            <p className="text-xs text-slate-500">Notificar quando novos relatórios forem aprovados.</p>
                          </div>
                          <button className="w-12 h-6 bg-axia-primary rounded-full relative">
                            <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                          </button>
                        </div>
                      </section>

                      <div className="pt-4">
                        <button 
                          onClick={() => showNotification('Configurações salvas com sucesso.')}
                          className="w-full bg-axia-primary text-white py-3 rounded-xl font-bold hover:bg-axia-primary/90 transition-all shadow-lg shadow-axia-primary/20"
                        >
                          Salvar Alterações
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

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
                  <h3 className="text-2xl font-bold text-slate-900">{currentUser.name}</h3>
                  <p className="text-axia-secondary font-semibold">{currentUser.role}</p>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-axia-primary shadow-sm">
                      <Mail size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">E-mail Corporativo</p>
                      <p className="text-sm font-bold text-slate-700">{currentUser.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-axia-primary shadow-sm">
                      <Phone size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Telefone / WhatsApp</p>
                      <p className="text-sm font-bold text-slate-700">{currentUser.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-axia-primary shadow-sm">
                      <ShieldCheck size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Nível de Acesso</p>
                      <p className="text-sm font-bold text-slate-700">{currentUser.accessLevel}</p>
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
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
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
      console.error('Auth error:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('E-mail ou senha incorretos.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está em uso.');
      } else if (err.code === 'auth/weak-password') {
        setError('A senha deve ter pelo menos 6 caracteres.');
      } else if (err.code === 'auth/invalid-email') {
        setError('E-mail inválido.');
      } else {
        setError('Ocorreu um erro ao processar sua solicitação: ' + (err.message || 'Erro desconhecido'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/60 border border-slate-100 overflow-hidden"
        >
          <div className="p-10">
            <div className="flex flex-col items-center mb-8">
              <div className="w-20 h-20 bg-axia-primary rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-axia-primary/30">
                <Logo size={56} className="text-white" />
              </div>
              <h1 className="text-3xl font-display font-bold text-axia-primary tracking-tight">A.L</h1>
              <p className="text-xs uppercase tracking-[0.2em] text-axia-secondary font-bold">Gestão de Obras</p>
            </div>

            <div className="flex p-1 bg-slate-100 rounded-2xl mb-8">
              <button 
                onClick={() => setMode('login')}
                className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${mode === 'login' ? 'bg-white text-axia-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Login
              </button>
              <button 
                onClick={() => setMode('register')}
                className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${mode === 'register' ? 'bg-white text-axia-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Cadastro
              </button>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                {mode === 'login' ? 'Bem-vindo de volta' : 'Criar nova conta'}
              </h2>
              <p className="text-slate-500 text-sm">
                {mode === 'login' 
                  ? 'Acesse sua conta para gerenciar suas obras.' 
                  : 'Preencha os dados abaixo para solicitar seu acesso.'}
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-medium">
                <AlertCircle size={18} />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {mode === 'register' && (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Nome Completo</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="text" 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-axia-primary/20 transition-all font-medium"
                        placeholder="Ex: Ricardo Silva"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Cargo / Função</label>
                    <div className="relative">
                      <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="text" 
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-axia-primary/20 transition-all font-medium"
                        placeholder="Ex: Engenheiro Civil"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Telefone / WhatsApp</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="tel" 
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-axia-primary/20 transition-all font-medium"
                        placeholder="Ex: +55 (11) 99999-9999"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Nível de Acesso</label>
                    <div className="relative">
                      <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <select 
                        value={accessLevel}
                        onChange={(e) => setAccessLevel(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-axia-primary/20 transition-all font-medium appearance-none"
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
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">E-mail Corporativo</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-axia-primary/20 transition-all font-medium"
                    placeholder="seu@email.com"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Senha</label>
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
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-axia-primary/20 transition-all font-medium"
                    placeholder="Sua senha"
                    required
                  />
                </div>
              </div>

              {mode === 'login' && (
                <div className="flex items-center gap-2 px-1">
                  <input type="checkbox" id="remember" className="rounded border-slate-300 text-axia-primary focus:ring-axia-primary" defaultChecked />
                  <label htmlFor="remember" className="text-sm text-slate-600 font-medium cursor-pointer">Lembrar de mim</label>
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

          <div className="bg-slate-50 p-6 border-t border-slate-100 text-center">
            <p className="text-sm text-slate-500">
              {mode === 'login' ? (
                <>Não tem acesso? <button onClick={() => setMode('register')} className="text-axia-primary font-bold hover:underline">Solicite aqui</button></>
              ) : (
                <>Já possui conta? <button onClick={() => setMode('login')} className="text-axia-primary font-bold hover:underline">Faça login</button></>
              )}
            </p>
          </div>
        </motion.div>
        
        <div className="mt-8 text-center">
          <p className="text-xs text-slate-400 font-medium">© 2026 A.L Gestão de Obras. Todos os direitos reservados.</p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, change, icon, color }: { 
  title: string, 
  value: string, 
  change: string, 
  icon: React.ReactNode,
  color: 'blue' | 'orange' | 'green' | 'slate'
}) {
  const [showMenu, setShowMenu] = useState(false);
  const colors = {
    blue: 'bg-blue-50',
    orange: 'bg-orange-50',
    green: 'bg-green-50',
    slate: 'bg-slate-50'
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl ${colors[color]}`}>
          {icon}
        </div>
        <div className="relative">
          <button 
            onClick={() => setShowMenu(!showMenu)}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <MoreVertical size={18} />
          </button>
          
          <AnimatePresence>
            {showMenu && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-30"
              >
                <button className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-axia-primary transition-colors flex items-center gap-2">
                  <TrendingUp size={14} /> Ver Detalhes
                </button>
                <button className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-axia-primary transition-colors flex items-center gap-2">
                  <BarChart3 size={14} /> Gerar Relatório
                </button>
                <div className="h-px bg-slate-100 my-1 mx-2"></div>
                <button className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors flex items-center gap-2">
                  <AlertCircle size={14} /> Ocultar Card
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <div>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">{title}</p>
        <h4 className="text-3xl font-bold text-slate-900 mb-1">{value}</h4>
        <p className="text-xs font-semibold text-slate-400">{change}</p>
      </div>
    </div>
  );
}

