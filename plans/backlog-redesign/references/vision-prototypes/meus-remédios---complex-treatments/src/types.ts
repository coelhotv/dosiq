export type View = 'hoje' | 'tratamentos' | 'estoque' | 'saude' | 'perfil';

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  type: 'Comprimido' | 'Cápsula' | 'Injetável' | 'Gotas';
  time: string;
  period: 'Madrugada' | 'Manhã' | 'Tarde' | 'Noite';
  status: 'pending' | 'taken' | 'delayed';
  stockDays?: number;
  category: string;
  adherence: number; // percentage
  totalDoses: number;
  remainingDoses: number;
  titration?: {
    currentWeek: number;
    totalWeeks: number;
    steps: { week: number; dose: string; status: 'completed' | 'current' | 'upcoming' }[];
    notes: string;
  };
}

export const MOCK_MEDICATIONS: Medication[] = [
  {
    id: '1',
    name: 'Metformina',
    dosage: '850mg',
    type: 'Comprimido',
    time: '08:00',
    period: 'Manhã',
    status: 'pending',
    stockDays: 12,
    category: 'Diabetes',
    adherence: 85,
    totalDoses: 30,
    remainingDoses: 12,
  },
  {
    id: '2',
    name: 'Enalapril',
    dosage: '10mg',
    type: 'Comprimido',
    time: '08:30',
    period: 'Manhã',
    status: 'pending',
    category: 'Cardiovascular',
    adherence: 100,
    totalDoses: 30,
    remainingDoses: 15,
  },
  {
    id: '3',
    name: 'AAS',
    dosage: '100mg',
    type: 'Comprimido',
    time: '10:00',
    period: 'Manhã',
    status: 'pending',
    category: 'Cardiovascular',
    adherence: 100,
    totalDoses: 30,
    remainingDoses: 20,
  },
  {
    id: '4',
    name: 'Losartana Potássica',
    dosage: '50mg',
    type: 'Comprimido',
    time: '08:00',
    period: 'Manhã',
    status: 'taken',
    category: 'Cardiovascular',
    adherence: 86,
    totalDoses: 30,
    remainingDoses: 12,
  },
  {
    id: '5',
    name: 'Anlodipino',
    dosage: '5mg',
    type: 'Comprimido',
    time: '20:00',
    period: 'Noite',
    status: 'pending',
    category: 'Cardiovascular',
    adherence: 100,
    totalDoses: 30,
    remainingDoses: 4,
  },
  {
    id: '6',
    name: 'Insulina Glargina',
    dosage: '10 UI',
    type: 'Injetável',
    time: '22:00',
    period: 'Noite',
    status: 'pending',
    category: 'Diabetes',
    adherence: 92,
    totalDoses: 1,
    remainingDoses: 0.4, // 1 frasco partial
  },
  {
    id: '7',
    name: 'Prednisona',
    dosage: '20mg → 10mg',
    type: 'Comprimido',
    time: '09:00',
    period: 'Manhã',
    status: 'taken',
    category: 'Anti-inflamatório',
    adherence: 100,
    totalDoses: 21,
    remainingDoses: 5,
    titration: {
      currentWeek: 2,
      totalWeeks: 3,
      steps: [
        { week: 1, dose: '20mg', status: 'completed' },
        { week: 2, dose: '10mg', status: 'current' },
        { week: 3, dose: '5mg', status: 'upcoming' },
      ],
      notes: 'Atenção: Não interromper o uso abruptamente. O processo de desmame é essencial para a recuperação da glândula supra-renal. Em caso de tonturas severas, contatar Dr. Marcelo.',
    },
  },
  {
    id: '8',
    name: 'Espironolactona',
    dosage: '25mg',
    type: 'Comprimido',
    time: '14:00',
    period: 'Tarde',
    status: 'pending',
    category: 'Cardiovascular',
    adherence: 95,
    totalDoses: 30,
    remainingDoses: 10,
  },
  {
    id: '9',
    name: 'Sinvastatina',
    dosage: '20mg',
    type: 'Comprimido',
    time: '20:00',
    period: 'Noite',
    status: 'pending',
    category: 'Cardiovascular',
    adherence: 98,
    totalDoses: 30,
    remainingDoses: 15,
  },
  {
    id: '10',
    name: 'Atorvastatina',
    dosage: '20mg',
    type: 'Comprimido',
    time: '21:00',
    period: 'Noite',
    status: 'pending',
    category: 'Cardiovascular',
    adherence: 90,
    totalDoses: 30,
    remainingDoses: 2,
  },
  {
    id: '11',
    name: 'Vitamina D3',
    dosage: '10.000 UI',
    type: 'Cápsula',
    time: 'Semanal',
    period: 'Manhã',
    status: 'taken',
    category: 'Suplementação & Vitaminas',
    adherence: 100,
    totalDoses: 10,
    remainingDoses: 8,
  },
  {
    id: '12',
    name: 'Ômega 3',
    dosage: 'Cáps.',
    type: 'Cápsula',
    time: '12:00',
    period: 'Tarde',
    status: 'pending',
    category: 'Suplementação & Vitaminas',
    adherence: 80,
    totalDoses: 60,
    remainingDoses: 2,
  },
];
