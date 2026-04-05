/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
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
  User,
  Briefcase,
  Mail,
  Phone,
  ShieldCheck,
  LogOut,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MOCK_PROJECTS, MOCK_RESOURCES, MOCK_REPORTS, MOCK_MEASUREMENTS, MOCK_ATTACHMENTS } from './constants';
import { Project, WeeklyReport, Measurement, UserProfile, Attachment } from './types';

const DEFAULT_USER: UserProfile = {
  id: '1',
  name: 'Eng. Ricardo Silva',
  email: 'ricardo.silva@axiaenergia.com.br',
  role: 'Gestor de Projetos Sênior',
  avatar: 'https://picsum.photos/seed/ricardo/200/200',
  phone: '+55 (31) 98765-4321',
  accessLevel: 'Administrador de Sistema'
};

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile>(DEFAULT_USER);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [reports, setReports] = useState<WeeklyReport[]>(MOCK_REPORTS);
  const [projects, setProjects] = useState<Project[]>(MOCK_PROJECTS);
  const [measurements, setMeasurements] = useState<Measurement[]>(MOCK_MEASUREMENTS);
  const [attachments, setAttachments] = useState<Attachment[]>(MOCK_ATTACHMENTS);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [showAddProject, setShowAddProject] = useState(false);
  const [viewingProject, setViewingProject] = useState<Project | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editingMeasurement, setEditingMeasurement] = useState<Measurement | null>(null);
  const [projectDetailTab, setProjectDetailTab] = useState<'details' | 'attachments'>('details');
  const [notification, setNotification] = useState<string | null>(null);
  const [imageEditingProjectId, setImageEditingProjectId] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showNotification = (msg: string) => setNotification(msg);

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
    status: 'not-started' as Project['status']
  });

  const [newMeasurement, setNewMeasurement] = useState({
    projectId: '',
    date: '',
    value: '',
    description: ''
  });

  const handleAddProject = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingProject) {
      setProjects(prev => prev.map(p => 
        p.id === editingProject.id ? { 
          ...p, 
          ...newProject, 
          budget: Number(newProject.budget) 
        } : p
      ));
      showNotification('Projeto atualizado com sucesso!');

      // Update viewingProject if it's the same project
      setViewingProject(prev => {
        if (prev && prev.id === editingProject.id) {
          return { ...prev, ...newProject, budget: Number(newProject.budget) };
        }
        return prev;
      });

      setEditingProject(null);
    } else {
      const project: Project = {
        id: `proj-${Date.now()}`,
        name: newProject.name,
        client: newProject.client,
        contractNumber: newProject.contractNumber,
        description: newProject.description,
        status: newProject.status,
        progress: 0,
        startDate: newProject.startDate,
        endDate: newProject.endDate,
        budget: Number(newProject.budget),
        spent: 0,
        location: newProject.location,
        executingCompany: newProject.executingCompany,
      };
      setProjects(prev => [project, ...prev]);
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
      status: 'not-started'
    });
  };

  const handleDeleteProject = (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    setMeasurements(prev => prev.filter(m => m.projectId !== id));
    setAttachments(prev => prev.filter(a => a.projectId !== id));
    setReports(prev => prev.filter(r => r.projectId !== id));
    
    if (viewingProject?.id === id) {
      setViewingProject(null);
    }
    
    setProjectToDelete(null);
    showNotification('Obra excluída com sucesso!');
  };

  const handleAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'pdf' | 'image') => {
    const file = e.target.files?.[0];
    if (!file || !viewingProject) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const newAttachment: Attachment = {
        id: Math.random().toString(36).substr(2, 9),
        projectId: viewingProject.id,
        name: file.name,
        type: type,
        url: event.target?.result as string,
        uploadedAt: new Date().toLocaleString('pt-BR'),
        size: (file.size / (1024 * 1024)).toFixed(2) + ' MB'
      };
      setAttachments([newAttachment, ...attachments]);
      showNotification(`${type === 'pdf' ? 'PDF' : 'Foto'} anexado com sucesso!`);
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteAttachment = (id: string) => {
    setAttachments(attachments.filter(a => a.id !== id));
    showNotification('Anexo removido com sucesso.');
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
      status: project.status
    });
    setShowAddProject(true);
    setViewingProject(null);
  };

  const handleAddMeasurement = (e: React.FormEvent) => {
    e.preventDefault();
    const project = projects.find(p => p.id === newMeasurement.projectId);
    if (!project) return;

    if (editingMeasurement) {
      const oldValue = editingMeasurement.value;
      const newValue = Number(newMeasurement.value);
      const diff = newValue - oldValue;

      const updatedMeasurements = measurements.map(m => 
        m.id === editingMeasurement.id ? {
          ...m,
          projectId: newMeasurement.projectId,
          projectName: project.name,
          date: newMeasurement.date,
          value: newValue,
          description: newMeasurement.description
        } : m
      );
      setMeasurements(updatedMeasurements);

      // Update project spent value
      const updatedProjects = projects.map(p => {
        if (p.id === newMeasurement.projectId) {
          return { ...p, spent: p.spent + diff };
        }
        return p;
      });
      setProjects(updatedProjects);

      // Update viewingProject if it's the same project
      if (viewingProject && viewingProject.id === newMeasurement.projectId) {
        setViewingProject({ ...viewingProject, spent: viewingProject.spent + diff });
      }

      setEditingMeasurement(null);
      showNotification('Medição atualizada com sucesso!');
    } else {
      const measurement: Measurement = {
        id: `meas-${Date.now()}`,
        projectId: newMeasurement.projectId,
        projectName: project.name,
        date: newMeasurement.date,
        value: Number(newMeasurement.value),
        description: newMeasurement.description,
        status: 'pending'
      };

      setMeasurements([measurement, ...measurements]);
      
      // Update project spent value
      const updatedProjects = projects.map(p => {
        if (p.id === newMeasurement.projectId) {
          return { ...p, spent: p.spent + Number(newMeasurement.value) };
        }
        return p;
      });
      setProjects(updatedProjects);

      // Update viewingProject if it's the same project
      if (viewingProject && viewingProject.id === newMeasurement.projectId) {
        setViewingProject({ ...viewingProject, spent: viewingProject.spent + Number(newMeasurement.value) });
      }
      showNotification('Medição registrada com sucesso!');
    }

    setNewMeasurement({
      projectId: '',
      date: '',
      value: '',
      description: ''
    });
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

  const handleDeleteMeasurement = (measurement: Measurement) => {
    const updatedMeasurements = measurements.filter(m => m.id !== measurement.id);
    setMeasurements(updatedMeasurements);

    // Update project spent value
    setProjects(prev => prev.map(p => {
      if (p.id === measurement.projectId) {
        return { ...p, spent: p.spent - measurement.value };
      }
      return p;
    }));

    // Update viewingProject if it's the same project
    setViewingProject(prev => {
      if (prev && prev.id === measurement.projectId) {
        return { ...prev, spent: prev.spent - measurement.value };
      }
      return prev;
    });

    showNotification('Medição excluída com sucesso!');
  };

  const handleUpload = () => {
    if (!selectedProject || !selectedDate) {
      showNotification('Por favor, selecione um projeto e uma data.');
      return;
    }

    const newReport: WeeklyReport = {
      id: `rep-${Date.now()}`,
      projectId: '1', // Simplificado para o exemplo
      projectName: selectedProject,
      weekEnding: selectedDate,
      status: 'submitted',
      fileName: `Relatorio_${selectedProject.replace(/\s+/g, '_')}_${selectedDate}.pdf`,
      fileSize: '1.2 MB',
      uploadedAt: new Date().toLocaleString(),
      uploadedBy: 'Eng. Ricardo Silva',
    };

    setReports([newReport, ...reports]);
    setSelectedProject('');
    setSelectedDate('');
  };

  const handleImageClick = (projectId: string) => {
    setImageEditingProjectId(projectId);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && imageEditingProjectId) {
      // Check file size (limit to 2MB for base64 storage)
      if (file.size > 2 * 1024 * 1024) {
        showNotification('A imagem é muito grande. Limite de 2MB.');
        return;
      }

      const reader = new FileReader();
      reader.onloadstart = () => {
        showNotification('Processando imagem...');
      };
      reader.onloadend = () => {
        const base64String = reader.result as string;
        
        setProjects(prevProjects => prevProjects.map(p => 
          p.id === imageEditingProjectId ? { ...p, image: base64String } : p
        ));
        
        // Update viewingProject if it's the same project
        setViewingProject(prev => {
          if (prev && prev.id === imageEditingProjectId) {
            return { ...prev, image: base64String };
          }
          return prev;
        });

        showNotification('Imagem da obra atualizada com sucesso!');
        setImageEditingProjectId(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.onerror = () => {
        showNotification('Erro ao carregar a imagem.');
        setImageEditingProjectId(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDelete = (id: string) => {
    setReports(reports.filter(r => r.id !== id));
    showNotification('Relatório excluído com sucesso.');
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
    return <LoginPage onLogin={(user) => {
      setCurrentUser(user);
      setIsLoggedIn(true);
    }} />;
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
          <div className="w-10 h-10 bg-axia-primary rounded-lg flex items-center justify-center flex-shrink-0">
            <HardHat className="text-white w-6 h-6" />
          </div>
          {isSidebarOpen && (
            <div className="overflow-hidden whitespace-nowrap">
              <h1 className="text-xl font-display font-bold text-axia-primary">AXIA</h1>
              <p className="text-[10px] uppercase tracking-widest text-axia-secondary font-bold">Energia & Obras</p>
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
                    title="Obras Ativas" 
                    value="12" 
                    change="+2 este mês" 
                    icon={<HardHat className="text-axia-primary" />} 
                    color="blue"
                  />
                  <StatCard 
                    title="Tarefas Pendentes" 
                    value="48" 
                    change="-5 desde ontem" 
                    icon={<ClipboardList className="text-axia-secondary" />} 
                    color="orange"
                  />
                  <StatCard 
                    title="Orçamento Total" 
                    value="R$ 8.4M" 
                    change="65% utilizado" 
                    icon={<TrendingUp className="text-axia-accent" />} 
                    color="green"
                  />
                  <StatCard 
                    title="Prazo Médio" 
                    value="14 dias" 
                    change="Dentro do esperado" 
                    icon={<Clock className="text-slate-500" />} 
                    color="slate"
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Projects Table */}
                  <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
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
                          <div className="flex gap-3">
                            <button 
                              onClick={() => startEditing(viewingProject)}
                              className="bg-white/20 hover:bg-white/30 backdrop-blur-md text-white p-3 rounded-2xl transition-all border border-white/20 flex items-center gap-2 font-bold"
                            >
                              <Pencil size={20} />
                              Editar
                            </button>
                            <button 
                              onClick={() => setProjectToDelete(viewingProject)}
                              className="bg-red-500/20 hover:bg-red-500/40 backdrop-blur-md text-white p-3 rounded-2xl transition-all border border-white/20 flex items-center gap-2 font-bold"
                            >
                              <Trash2 size={20} />
                              Excluir
                            </button>
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
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Cliente</p>
                                  <p className="font-bold text-slate-900">{viewingProject.client}</p>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Contrato</p>
                                  <p className="font-bold text-slate-900">{viewingProject.contractNumber}</p>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Início</p>
                                  <p className="font-bold text-slate-900">{viewingProject.startDate}</p>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Término</p>
                                  <p className="font-bold text-slate-900">{viewingProject.endDate}</p>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 col-span-2">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Empresa Executora</p>
                                  <p className="font-bold text-slate-900">{viewingProject.executingCompany}</p>
                                </div>
                              </div>

                              <section>
                                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                  <TrendingUp className="text-axia-primary" /> Progresso Financeiro
                                </h3>
                                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-6">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-xs font-bold text-slate-500 uppercase mb-1">Orçamento Total</p>
                                      <p className="text-2xl font-bold text-axia-accent">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(viewingProject.budget)}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-xs font-bold text-slate-500 uppercase mb-1">Total Medido</p>
                                      <p className="text-2xl font-bold text-axia-primary">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(viewingProject.spent)}
                                      </p>
                                    </div>
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs font-bold text-slate-500 uppercase">Utilização do Orçamento</span>
                                      <span className="text-sm font-bold text-axia-primary">
                                        {Math.round((viewingProject.spent / viewingProject.budget) * 100)}%
                                      </span>
                                    </div>
                                    <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
                                      <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${(viewingProject.spent / viewingProject.budget) * 100}%` }}
                                        className="h-full bg-axia-accent rounded-full shadow-inner"
                                      />
                                    </div>
                                    <div className="flex justify-between text-[10px] font-bold text-slate-400">
                                      <span>Saldo Disponível: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(viewingProject.budget - viewingProject.spent)}</span>
                                      <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(viewingProject.budget)}</span>
                                    </div>
                                  </div>
                                </div>
                              </section>
                            </>
                          ) : (
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
                          )}
                        </div>

                        <div className="space-y-8">
                          <div className="p-6 bg-axia-primary/5 rounded-3xl border border-axia-primary/10">
                            <h4 className="font-bold text-axia-primary mb-4 flex items-center gap-2">
                              <Clock size={18} /> Cronograma
                            </h4>
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-600">Execução</span>
                                <span className="text-sm font-bold text-slate-900">{viewingProject.progress}%</span>
                              </div>
                              <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                                <div className="h-full bg-axia-primary rounded-full" style={{ width: `${viewingProject.progress}%` }} />
                              </div>
                              <p className="text-xs text-slate-500 italic">Última atualização: 24h atrás</p>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <h4 className="font-bold text-slate-900">Equipe Responsável</h4>
                            <div className="flex -space-x-2">
                              {[1,2,3,4].map(i => (
                                <img 
                                  key={i}
                                  src={`https://picsum.photos/seed/user${i}/100/100`} 
                                  alt="Team" 
                                  className="w-10 h-10 rounded-full border-2 border-white shadow-sm"
                                  referrerPolicy="no-referrer"
                                />
                              ))}
                              <div className="w-10 h-10 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-xs font-bold text-slate-400">
                                +2
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
                                <p className="text-[10px] font-bold text-axia-secondary uppercase tracking-widest mb-1">Contrato: {project.contractNumber}</p>
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
                                <Briefcase size={14} className="text-axia-primary" />
                                <span className="font-bold">Executora:</span>
                                <span>{project.executingCompany}</span>
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
                  <p className="text-slate-500">Personalize sua experiência no sistema AXIA.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="md:col-span-1">
                    <nav className="space-y-1">
                      <button className="w-full text-left px-4 py-2 rounded-lg bg-axia-primary/10 text-axia-primary font-bold">Geral</button>
                      <button className="w-full text-left px-4 py-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">Segurança</button>
                      <button className="w-full text-left px-4 py-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">Notificações</button>
                      <button className="w-full text-left px-4 py-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">Integrações</button>
                    </nav>
                  </div>

                  <div className="md:col-span-2 space-y-6">
                    <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8">
                      <section className="space-y-4">
                        <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">Preferências de Exibição</h3>
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
                    <div className="absolute -bottom-2 -right-2 bg-green-500 w-6 h-6 rounded-full border-4 border-white shadow-sm" />
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
                    onClick={() => {
                      setIsLoggedIn(false);
                      setShowProfile(false);
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

function LoginPage({ onLogin }: { onLogin: (user: UserProfile) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('ricardo.silva@axiaenergia.com.br');
  const [password, setPassword] = useState('********');
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      const newUser: UserProfile = {
        id: Math.random().toString(36).substr(2, 9),
        name: mode === 'login' ? 'Eng. Ricardo Silva' : name,
        email: email,
        role: mode === 'login' ? 'Gestor de Projetos Sênior' : role,
        avatar: `https://picsum.photos/seed/${mode === 'login' ? 'ricardo' : name}/200/200`,
        phone: mode === 'login' ? '+55 (31) 98765-4321' : phone,
        accessLevel: mode === 'login' ? 'Administrador de Sistema' : 'Usuário Padrão'
      };
      onLogin(newUser);
      setIsLoading(false);
    }, 1500);
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
              <div className="w-16 h-16 bg-axia-primary rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-axia-primary/30">
                <HardHat className="text-white w-10 h-10" />
              </div>
              <h1 className="text-3xl font-display font-bold text-axia-primary tracking-tight">AXIA</h1>
              <p className="text-xs uppercase tracking-[0.2em] text-axia-secondary font-bold">Energia & Obras</p>
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
          <p className="text-xs text-slate-400 font-medium">© 2024 Axia Energia & Obras. Todos os direitos reservados.</p>
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
        <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
        <h4 className="text-2xl font-bold text-slate-900 mb-1">{value}</h4>
        <p className="text-xs font-semibold text-slate-400">{change}</p>
      </div>
    </div>
  );
}
