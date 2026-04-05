import { Project, Resource, WeeklyReport, Measurement, Attachment } from './types';

export const MOCK_PROJECTS: Project[] = [
  {
    id: '1',
    name: 'Parque Solar Alvorada',
    client: 'EcoEnergy S.A.',
    contractNumber: 'AX-2024-001',
    description: 'Implantação de complexo fotovoltaico com capacidade de 50MWp, incluindo subestação elevadora e linha de transmissão.',
    status: 'in-progress',
    progress: 65,
    startDate: '2024-01-15',
    endDate: '2024-08-30',
    budget: 1250000,
    spent: 820000,
    location: 'Belo Horizonte, MG',
    executingCompany: 'Axia Energia Ltda',
  },
  {
    id: '2',
    name: 'Subestação Norte 230kV',
    client: 'Transmissora Brasil',
    contractNumber: 'AX-2023-089',
    description: 'Ampliação da subestação existente com instalação de novo banco de transformadores e adequação de barramentos.',
    status: 'not-started',
    progress: 15,
    startDate: '2024-03-01',
    endDate: '2024-12-15',
    budget: 4800000,
    spent: 450000,
    location: 'Curitiba, PR',
    executingCompany: 'ConstruTech Brasil',
  },
  {
    id: '3',
    name: 'Manutenção Rede Distribuição Setor A',
    client: 'Cemig',
    contractNumber: 'AX-2024-012',
    description: 'Serviços de manutenção preventiva e corretiva em redes de média e baixa tensão no setor industrial.',
    status: 'paused',
    progress: 40,
    startDate: '2024-02-10',
    endDate: '2024-05-20',
    budget: 350000,
    spent: 280000,
    location: 'Uberlândia, MG',
    executingCompany: 'Manutenção Express',
  },
];

export const MOCK_RESOURCES: Resource[] = [
  {
    id: 'r1',
    name: 'Cabo de Cobre 50mm²',
    type: 'material',
    quantity: 500,
    unit: 'm',
    status: 'low-stock',
  },
  {
    id: 'r2',
    name: 'Escavadeira Hidráulica',
    type: 'equipment',
    quantity: 2,
    unit: 'un',
    status: 'in-use',
  },
  {
    id: 'r3',
    name: 'Equipe de Montagem Eletromecânica',
    type: 'labor',
    quantity: 12,
    unit: 'pessoas',
    status: 'available',
  },
];

export const MOCK_REPORTS: WeeklyReport[] = [
  {
    id: 'rep1',
    projectId: '1',
    projectName: 'Parque Solar Alvorada',
    weekEnding: '2024-03-29',
    status: 'approved',
    fileName: 'Relatorio_Semanal_Alvorada_W13.pdf',
    fileSize: '2.4 MB',
    uploadedAt: '2024-03-29 16:45',
    uploadedBy: 'Eng. Ricardo Silva',
  },
  {
    id: 'rep2',
    projectId: '1',
    projectName: 'Parque Solar Alvorada',
    weekEnding: '2024-04-05',
    status: 'submitted',
    fileName: 'Relatorio_Semanal_Alvorada_W14.pdf',
    fileSize: '3.1 MB',
    uploadedAt: '2024-04-05 17:10',
    uploadedBy: 'Eng. Ricardo Silva',
  },
];

export const MOCK_MEASUREMENTS: Measurement[] = [
  {
    id: 'm1',
    projectId: '1',
    projectName: 'Parque Solar Alvorada',
    date: '2024-02-28',
    value: 150000,
    description: 'Medição referente aos serviços de terraplanagem e fundações.',
    status: 'paid',
  },
  {
    id: 'm2',
    projectId: '1',
    projectName: 'Parque Solar Alvorada',
    date: '2024-03-31',
    value: 220000,
    description: 'Medição de montagem das estruturas metálicas.',
    status: 'approved',
  },
];

export const MOCK_ATTACHMENTS: Attachment[] = [
  {
    id: 'a1',
    projectId: '1',
    name: 'Contrato_Obra_Alvorada.pdf',
    type: 'pdf',
    url: '#',
    uploadedAt: '2024-01-10 10:30',
    size: '1.8 MB'
  },
  {
    id: 'a2',
    projectId: '1',
    name: 'Foto_Canteiro_Obras_01.jpg',
    type: 'image',
    url: 'https://picsum.photos/seed/obra1/800/600',
    uploadedAt: '2024-02-15 14:20',
  },
  {
    id: 'a3',
    projectId: '1',
    name: 'Foto_Fundacoes_Setor_A.jpg',
    type: 'image',
    url: 'https://picsum.photos/seed/obra2/800/600',
    uploadedAt: '2024-03-05 09:15',
  },
  {
    id: 'a4',
    projectId: '2',
    name: 'Contrato_Subestacao_Norte.pdf',
    type: 'pdf',
    url: '#',
    uploadedAt: '2024-02-28 11:45',
    size: '2.2 MB'
  }
];
