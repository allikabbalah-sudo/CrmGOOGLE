export type ClientStatus = 'lead' | 'consultation' | 'active' | 'inactive' | 'waiting' | 'paid';
export type MemberRole = 'owner' | 'admin' | 'therapist' | 'member' | 'pending_approval';
export type ProgramStatus = 'active' | 'completed' | 'cancelled' | 'paused';
export type SessionStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show' | 'postponed';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'done';

export interface Organization {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  updated_at?: string;
}

export interface Profile {
  id: string;
  full_name: string;
  avatar_url?: string;
  email: string;
  password?: string;
  created_at?: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: MemberRole;
  invited_by?: string;
  created_at?: string;
  user_email?: string;
  user_name?: string;
}

export interface OrgInvite {
  id: string;
  organization_id: string;
  email: string;
  role: MemberRole;
  token: string;
  invited_by: string;
  accepted_at?: string;
  accepted_by?: string;
  created_at: string;
}

export interface OrgPendingApproval {
  id: string;
  organization_id: string;
  user_id: string;
  user_email: string;
  user_name?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface Client {
  id: string;
  organization_id: string;
  full_name: string;
  phone: string;
  email: string;
  status: ClientStatus;
  date_of_birth?: string;
  mother_name?: string;
  address?: string;
  avatar_url?: string;
  selected_reading?: string; // e.g., 'אילן הספירות', 'עץ החיים', 'פתרון חלומות ותיקון'
  partner_full_name?: string;
  partner_dob?: string;
  partner_mother_name?: string;
  notes?: string;
  assigned_to?: string;
  created_by?: string;
  last_completed_session_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface ClientAssignee {
  client_id: string;
  user_id: string;
  added_by: string;
  created_at: string;
}

export interface Program {
  id: string;
  organization_id: string;
  client_id: string;
  title: string;
  total_sessions: number;
  weekly_days: number[]; // 0=Sun .. 6=Sat
  start_date: string;
  status: ProgramStatus;
  sessions_per_day: number;
  session_times: string[]; // e.g. ["09:00", "19:00"]
  day_times?: Record<number, string[]>; // e.g. { 0: ["10:00"], 3: ["16:30"] }
  day_parts?: string[];
  morning_time?: string;
  noon_time?: string;
  evening_time?: string;
  session_time?: string;
  assigned_to?: string;
  created_by?: string;
  created_at: string;
  updated_at?: string;
}

export interface Session {
  id: string;
  organization_id: string;
  program_id?: string | null;
  client_id: string;
  session_date: string; // ISO string
  status: SessionStatus;
  notes?: string;
  audio_urls: string[];
  image_urls: string[];
  assigned_to?: string;
  reminder_sent_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface Task {
  id: string;
  organization_id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  due_date?: string; // ISO string or YYYY-MM-DD HH:mm
  client_id?: string;
  assigned_to?: string;
  created_by?: string;
  source?: string;
  reminder_1h_sent_at?: string;
  reminder_10m_sent_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  organization_id: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
  read_at?: string | null;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  organization_id: string;
  client_id?: string | null;
  user_id?: string | null;
  action: string;
  payload?: Record<string, any>;
  created_at: string;
}

export interface PushSubscriptionData {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
  user_agent?: string;
  created_at?: string;
}

export interface MediaFile {
  id: string;
  url: string;
  name: string;
  size: number;
  type: 'image' | 'audio';
  category: 'client' | 'program' | 'general';
  parent_id: string; // clientId, programId, or 'general' / ''
  organization_id: string;
  created_at: string;
  blob_data?: Blob;
  drive_file_id?: string;
  drive_view_link?: string;
  drive_thumbnail_link?: string;
  source?: 'local' | 'drive' | 'cloud';
}

export const KABBALAH_READINGS = [
  'אילן הספירות הקבלי',
  'תיקון נשמה לפי השם ואם',
  'ניתוח שמות ותאריך לידה',
  'שמות הקודש וסוד האותיות',
  'פתיחת מזל בזיווג והרמוניה',
  'פתרון חלומות ומסרים',
  'הסרת עין הרע וחסימות אנרגטיות',
  'טיהור בתים ועסקים',
  "איזון מרכזי אנרגיה (צ'אקרות)",
  'ייעוץ זוגי ומשפחתי לפי הספירות',
] as const;

export const CLIENT_STATUS_LABELS: Record<ClientStatus, { label: string; color: string; badge: string }> = {
  lead: { label: 'ליד חדש', color: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30', badge: 'bg-amber-500' },
  consultation: { label: 'פגישת ייעוץ', color: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30', badge: 'bg-blue-500' },
  active: { label: 'פעיל בתהליך', color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30', badge: 'bg-emerald-500' },
  waiting: { label: 'בהמתנה להמשך', color: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30', badge: 'bg-purple-500' },
  inactive: { label: 'לא פעיל', color: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30', badge: 'bg-slate-500' },
  paid: { label: 'שולם / סוגר', color: 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30', badge: 'bg-teal-500' },
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, { label: string; class: string }> = {
  low: { label: 'נמוכה', class: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  medium: { label: 'בינונית', class: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  high: { label: 'גבוהה', class: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  urgent: { label: 'דחופה!', class: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 font-bold animate-pulse' },
};

export const SESSION_STATUS_LABELS: Record<SessionStatus, { label: string; class: string }> = {
  scheduled: { label: 'מתוכנן', class: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800' },
  completed: { label: 'בוצע', class: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' },
  cancelled: { label: 'בוטל', class: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800' },
  no_show: { label: 'לא הגיע', class: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
  postponed: { label: 'נדחה', class: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800' },
};
