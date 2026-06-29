export interface Athlete {
  plate: string;
  firstName: string;
  lastName: string;
  fullName: string;
  club: string;
  state: string;
  country: string;
  uciId: string;
  sponsor?: string;
  transponder?: string;
  place?: string; // Final/current standing place
  points?: number; // Total points
  m1Place?: string;
  m1Time?: string;
  m1Reaction?: string;
  m2Place?: string;
  m2Time?: string;
  m2Reaction?: string;
  m3Place?: string;
  m3Time?: string;
  m3Reaction?: string;
  m1Draw?: string; // e.g. "10: 3" -> Race 10, Lane 3
  m2Draw?: string;
  m3Draw?: string;
  group?: string; // e.g. "57"
  transfer?: string; // e.g. "S13"
  totalPoints?: number;
  mpts?: number;
  fullFinal?: string;
  fullSemi?: string;
  fullQuartas?: string;
  sourceFile?: string;
}

export interface CategoryData {
  categoryName: string;
  entriesCount: number;
  transferText?: string;
  sponsor?: string;
  athletes: Athlete[];
}

export interface EventData {
  eventName: string;
  eventSponsor: string;
  eventLocation: string;
  reportCreated: string;
  reportType: string;
  categories: CategoryData[];
}

export interface ScheduleEvent {
  id: string;
  time: string;
  title: string;
  category: string;
  status: 'pending' | 'ongoing' | 'completed' | 'delayed';
  details?: string;
}

export interface ScheduleNotification {
  id: string;
  timestamp: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'alert';
  read?: boolean;
}

export interface SyncStatus {
  lastSync: string | null;
  status: 'connected' | 'offline';
  filesSyncedCount: number;
}

export interface RaceState {
  event: EventData;
  schedule: ScheduleEvent[];
  notifications: ScheduleNotification[];
  syncStatus: SyncStatus;
}

export interface UserProfile {
  id: string;
  username: string;
  role: 'admin' | 'pilot' | 'viewer';
  pilotPlate?: string; // If role is pilot, links to their plate
  pilotName?: string;
}
