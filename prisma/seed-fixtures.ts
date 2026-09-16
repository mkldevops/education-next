export const DEMO_CLASSES = [
  { name: 'CP-A', levelIndex: 0 },
  { name: 'CE1-A', levelIndex: 1 },
  { name: 'CE2-A', levelIndex: 2 },
  { name: 'CM1-A', levelIndex: 3 },
  { name: 'CM2-A', levelIndex: 4 },
] as const

export const DEMO_TEACHERS = [
  { firstName: 'Amina', lastName: 'Benali' },
  { firstName: 'Karim', lastName: 'Foudil' },
  { firstName: 'Claire', lastName: 'Moreau' },
  { firstName: 'Nadia', lastName: 'Haddad' },
  { firstName: 'Thomas', lastName: 'Bernard' },
] as const

type DemoChild = {
  firstName: string
  sex: 'MALE' | 'FEMALE'
  birthday: string
  levelIndex: number
  snackAuthorization?: boolean
  allergies?: string
}

type DemoFamily = {
  name: string
  parentFirstName: string
  parentSex: 'MALE' | 'FEMALE'
  phone: string
  languagesAtHome: string[]
  children: DemoChild[]
}

export const DEMO_FAMILIES: DemoFamily[] = [
  {
    name: 'Diallo',
    parentFirstName: 'Fatou',
    parentSex: 'FEMALE',
    phone: '06 20 31 42 53',
    languagesAtHome: ['Français', 'Peul'],
    children: [
      {
        firstName: 'Lina',
        sex: 'FEMALE',
        birthday: '2020-02-14',
        levelIndex: 0,
        snackAuthorization: true,
      },
      {
        firstName: 'Sami',
        sex: 'MALE',
        birthday: '2018-07-03',
        levelIndex: 2,
      },
    ],
  },
  {
    name: 'Morel',
    parentFirstName: 'Julien',
    parentSex: 'MALE',
    phone: '06 31 42 53 64',
    languagesAtHome: ['Français'],
    children: [
      {
        firstName: 'Hugo',
        sex: 'MALE',
        birthday: '2019-11-22',
        levelIndex: 1,
        snackAuthorization: true,
      },
    ],
  },
  {
    name: 'Haddad',
    parentFirstName: 'Rania',
    parentSex: 'FEMALE',
    phone: '06 42 53 64 75',
    languagesAtHome: ['Français', 'Arabe'],
    children: [
      {
        firstName: 'Inès',
        sex: 'FEMALE',
        birthday: '2017-05-18',
        levelIndex: 3,
        allergies: 'Fruits à coque',
      },
      {
        firstName: 'Nour',
        sex: 'FEMALE',
        birthday: '2020-08-09',
        levelIndex: 0,
        snackAuthorization: true,
      },
    ],
  },
  {
    name: 'Bernard',
    parentFirstName: 'Élodie',
    parentSex: 'FEMALE',
    phone: '06 53 64 75 86',
    languagesAtHome: ['Français'],
    children: [
      {
        firstName: 'Emma',
        sex: 'FEMALE',
        birthday: '2016-03-27',
        levelIndex: 4,
        snackAuthorization: true,
      },
    ],
  },
  {
    name: 'Traoré',
    parentFirstName: 'Moussa',
    parentSex: 'MALE',
    phone: '06 64 75 86 97',
    languagesAtHome: ['Français', 'Bambara'],
    children: [
      {
        firstName: 'Ilyas',
        sex: 'MALE',
        birthday: '2019-01-30',
        levelIndex: 1,
      },
      {
        firstName: 'Maya',
        sex: 'FEMALE',
        birthday: '2016-10-11',
        levelIndex: 4,
        snackAuthorization: true,
      },
    ],
  },
]

export const DEMO_SCHEDULE_SLOTS = [
  {
    weekday: 1,
    startTime: '08:30',
    endTime: '10:00',
    description: 'Français, lecture et expression orale.',
  },
  {
    weekday: 2,
    startTime: '10:15',
    endTime: '11:45',
    description: 'Mathématiques et résolution de problèmes.',
  },
  {
    weekday: 4,
    startTime: '13:30',
    endTime: '15:00',
    description: 'Sciences, découverte du monde et travail de groupe.',
  },
  {
    weekday: 5,
    startTime: '09:00',
    endTime: '10:30',
    description: 'Arts, sport et projets de classe.',
  },
] as const

type DemoEvent = {
  title: string
  slug: string
  summary?: string
  category: 'MEETING' | 'TERM_START' | 'OUTING' | 'HOLIDAY' | 'CLOSURE' | 'CELEBRATION'
  visibility: 'PUBLIC' | 'MEMBERS' | 'STAFF'
  status: 'DRAFT' | 'PUBLISHED' | 'CANCELLED'
  startOffsetDays: number
  endOffsetDays?: number
  startHour?: number
  endHour?: number
  location?: string
  announceDaysBefore?: number
}

export const DEMO_EVENTS: DemoEvent[] = [
  {
    title: 'Rentrée des élèves',
    slug: 'rentree-des-eleves',
    summary: 'Accueil des familles et reprise des cours.',
    category: 'TERM_START',
    visibility: 'PUBLIC',
    status: 'PUBLISHED',
    startOffsetDays: -7,
    location: 'Cour principale',
    announceDaysBefore: 14,
  },
  {
    title: 'Réunion de rentrée',
    slug: 'reunion-de-rentree',
    summary: 'Présentation de l’équipe et du programme de l’année.',
    category: 'MEETING',
    visibility: 'MEMBERS',
    status: 'PUBLISHED',
    startOffsetDays: 2,
    startHour: 18,
    endHour: 20,
    location: 'Salle polyvalente',
    announceDaysBefore: 7,
  },
  {
    title: 'Sortie au musée',
    slug: 'sortie-au-musee',
    summary: 'Journée pédagogique pour les classes de CE2, CM1 et CM2.',
    category: 'OUTING',
    visibility: 'MEMBERS',
    status: 'PUBLISHED',
    startOffsetDays: 10,
    startHour: 9,
    endHour: 16,
    location: 'Musée des sciences',
    announceDaysBefore: 10,
  },
  {
    title: 'Conseil pédagogique',
    slug: 'conseil-pedagogique',
    category: 'MEETING',
    visibility: 'STAFF',
    status: 'DRAFT',
    startOffsetDays: 12,
    startHour: 17,
    endHour: 19,
    location: 'Salle des enseignants',
  },
  {
    title: 'Vacances d’automne',
    slug: 'vacances-d-automne',
    category: 'HOLIDAY',
    visibility: 'PUBLIC',
    status: 'PUBLISHED',
    startOffsetDays: 20,
    endOffsetDays: 34,
    announceDaysBefore: 14,
  },
  {
    title: 'Fermeture exceptionnelle',
    slug: 'fermeture-exceptionnelle',
    summary: 'La fermeture prévue est annulée, l’école reste ouverte.',
    category: 'CLOSURE',
    visibility: 'PUBLIC',
    status: 'CANCELLED',
    startOffsetDays: 35,
    announceDaysBefore: 7,
  },
  {
    title: 'Fête de l’école',
    slug: 'fete-de-lecole',
    summary: 'Spectacle des élèves et goûter partagé, ouvert à tous.',
    category: 'CELEBRATION',
    visibility: 'PUBLIC',
    status: 'PUBLISHED',
    startOffsetDays: 45,
    startHour: 14,
    endHour: 18,
    location: 'Cour principale',
    announceDaysBefore: 14,
  },
  {
    title: 'Début du deuxième trimestre',
    slug: 'debut-du-deuxieme-trimestre',
    category: 'TERM_START',
    visibility: 'MEMBERS',
    status: 'PUBLISHED',
    startOffsetDays: 60,
    announceDaysBefore: 5,
  },
]

const additionalStudentCount = DEMO_FAMILIES.reduce(
  (total, family) => total + family.children.length,
  0
)

export const EXPECTED_SEED_COUNTS = {
  classesPerSchool: DEMO_CLASSES.length,
  familiesPerSchool: DEMO_FAMILIES.length + 2,
  studentsPerSchool: additionalStudentCount + 2,
  scheduleSlotsPerSchool: DEMO_CLASSES.length * DEMO_SCHEDULE_SLOTS.length,
  eventsPerSchool: DEMO_EVENTS.length,
} as const
