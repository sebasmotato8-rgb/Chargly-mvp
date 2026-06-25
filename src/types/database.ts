export type UserRole = 'owner' | 'admin' | 'barber';
export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';
export type AppointmentSource = 'web' | 'whatsapp' | 'chat' | 'manual' | 'n8n';
export type ConversationChannel = 'web_chat' | 'whatsapp' | 'api';
export type MessageRole = 'user' | 'assistant' | 'tool_result';

export interface BarberShop {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  country: string;
  timezone: string;
  logo_url: string | null;
  website_url: string | null;
  is_active: boolean;
  trial_ends_at: string | null;
  plan: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  shop_id: string;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  bio: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  shop_id: string;
  full_name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  preferred_barber_id: string | null;
  visit_count: number;
  last_visit_at: string | null;
  is_blocked: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  shop_id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  is_active: boolean;
  sort_order: number;
  color: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface BarberSchedule {
  id: string;
  shop_id: string;
  barber_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BarberTimeOff {
  id: string;
  shop_id: string;
  barber_id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
  created_at: string;
}

export interface ShopClosure {
  id: string;
  shop_id: string;
  closure_date: string;
  reason: string | null;
  created_at: string;
}

export interface Appointment {
  id: string;
  shop_id: string;
  barber_id: string;
  client_id: string;
  service_id: string;
  scheduled_at: string;
  ends_at: string;
  status: AppointmentStatus;
  source: AppointmentSource;
  notes: string | null;
  barber_notes: string | null;
  cancellation_reason: string | null;
  price_snapshot: number | null;
  duration_snapshot: number | null;
  conversation_id: string | null;
  reminder_24h_sent_at: string | null;
  reminder_1h_sent_at: string | null;
  review_sent_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AppointmentHistory {
  id: string;
  appointment_id: string;
  previous_status: AppointmentStatus | null;
  new_status: AppointmentStatus;
  changed_by: string;
  notes: string | null;
  changed_at: string;
}

export interface Conversation {
  id: string;
  shop_id: string;
  client_id: string | null;
  channel: ConversationChannel;
  external_id: string | null;
  is_resolved: boolean;
  resolved_at: string | null;
  escalated_to: string | null;
  total_input_tokens: number;
  total_output_tokens: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  tool_name: string | null;
  tool_input: Record<string, unknown> | null;
  tool_result: Record<string, unknown> | null;
  input_tokens: number | null;
  output_tokens: number | null;
  model: string | null;
  latency_ms: number | null;
  user_feedback: -1 | 1 | null;
  created_at: string;
}

export interface BusinessConfig {
  id: string;
  shop_id: string;
  category: string;
  key: string;
  value: string;
  is_secret: boolean;
  created_at: string;
  updated_at: string;
}

export interface TodayAppointment {
  id: string;
  shop_id: string;
  scheduled_at: string;
  ends_at: string;
  status: AppointmentStatus;
  source: AppointmentSource;
  notes: string | null;
  price_snapshot: number | null;
  client_name: string;
  client_phone: string;
  barber_name: string;
  service_name: string;
  duration_minutes: number;
  service_color: string | null;
}

export interface MonthlyKpi {
  shop_id: string;
  month: string;
  total_appointments: number;
  completed: number;
  cancelled: number;
  no_shows: number;
  revenue: number;
  no_show_rate_pct: number | null;
}

export interface AvailableSlot {
  slot_start: string;
  slot_end: string;
}

// ── Tipo Database con estructura exacta que espera @supabase/supabase-js v2 ──
// GenericTable requiere: Row, Insert, Update, Relationships
// GenericView  requiere: Row, Relationships (non-updatable)
// GenericFunction requiere: Args, Returns
export type Database = {
  public: {
    Tables: {
      barber_shops: {
        Row: BarberShop;
        Insert: Omit<BarberShop, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string };
        Update: Partial<Omit<BarberShop, 'id'>>;
        Relationships: [];
      };
      users: {
        Row: User;
        Insert: Omit<User, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string };
        Update: Partial<Omit<User, 'id'>>;
        Relationships: [];
      };
      clients: {
        Row: Client;
        Insert: Omit<Client, 'id' | 'visit_count' | 'created_at' | 'updated_at'> & { id?: string; visit_count?: number; created_at?: string; updated_at?: string };
        Update: Partial<Omit<Client, 'id'>>;
        Relationships: [];
      };
      services: {
        Row: Service;
        Insert: Omit<Service, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string };
        Update: Partial<Omit<Service, 'id'>>;
        Relationships: [];
      };
      barber_schedules: {
        Row: BarberSchedule;
        Insert: Omit<BarberSchedule, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string };
        Update: Partial<Omit<BarberSchedule, 'id'>>;
        Relationships: [];
      };
      barber_time_off: {
        Row: BarberTimeOff;
        Insert: Omit<BarberTimeOff, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<BarberTimeOff, 'id'>>;
        Relationships: [];
      };
      shop_closures: {
        Row: ShopClosure;
        Insert: Omit<ShopClosure, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<ShopClosure, 'id'>>;
        Relationships: [];
      };
      appointments: {
        Row: Appointment;
        Insert: Omit<Appointment, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string };
        Update: Partial<Omit<Appointment, 'id'>>;
        Relationships: [];
      };
      appointment_history: {
        Row: AppointmentHistory;
        Insert: Omit<AppointmentHistory, 'id' | 'changed_at'> & { id?: string; changed_at?: string };
        Update: Partial<Omit<AppointmentHistory, 'id'>>;
        Relationships: [];
      };
      conversations: {
        Row: Conversation;
        Insert: Omit<Conversation, 'id' | 'total_input_tokens' | 'total_output_tokens' | 'created_at' | 'updated_at'> & { id?: string; total_input_tokens?: number; total_output_tokens?: number; created_at?: string; updated_at?: string };
        Update: Partial<Omit<Conversation, 'id'>>;
        Relationships: [];
      };
      conversation_messages: {
        Row: ConversationMessage;
        Insert: Omit<ConversationMessage, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<ConversationMessage, 'id'>>;
        Relationships: [];
      };
      business_config: {
        Row: BusinessConfig;
        Insert: Omit<BusinessConfig, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string };
        Update: Partial<Omit<BusinessConfig, 'id'>>;
        Relationships: [];
      };
    };
    Views: {
      v_today_appointments: {
        Row: TodayAppointment;
        Relationships: [];
      };
      v_monthly_kpis: {
        Row: MonthlyKpi;
        Relationships: [];
      };
    };
    Functions: {
      get_available_slots: {
        Args: { p_barber_id: string; p_service_id: string; p_date: string };
        Returns: AvailableSlot[];
      };
      check_appointment_overlap: {
        Args: { p_barber_id: string; p_scheduled_at: string; p_ends_at: string; p_exclude_id?: string };
        Returns: boolean;
      };
    };
    Enums: {
      user_role: UserRole;
      appointment_status: AppointmentStatus;
      appointment_source: AppointmentSource;
    };
    CompositeTypes: Record<string, never>;
  };
};
