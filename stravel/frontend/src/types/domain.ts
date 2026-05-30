export interface TravelerProfile {
  id: string;
  advisory_session_id: string;
  traveler_count: number | null;
  traveler_ages: number[] | null;
  nationalities: string[] | null;
  travel_start_date: string | null;
  travel_end_date: string | null;
  date_flexibility: string | null;
  budget_total: number | null;
  budget_currency: string | null;
  destination_preferences: string[] | null;
  accommodation_style: string | null;
  dietary_requirements: string[] | null;
  accessibility_needs: string[] | null;
  activity_preferences: string[] | null;
  special_interests: string[] | null;
  passport_expiry_date: string | null;
  is_confirmed: boolean;
}

// Backend API advisory session status (original enum values from advisory_session.py)
export type LegacyAdvisoryStatus = "in_progress" | "completed" | "archived";

// Chat-First UI B2B session status vocabulary (ARCH-7)
export type SessionStatus = "pending" | "confirmed" | "modified" | "flagged";

// Profile slot keys used by slot-filling cards and MOOD_TRANSITION reducer
export type SlotKey =
  | 'mood'
  | 'destination'
  | 'travel_dates'
  | 'budget'
  | 'dietary'
  | 'activities'
  | 'passport_expiry'
  | 'traveler_count';

export interface AdvisorySession {
  id: string;
  tenant_id: string;
  status: SessionStatus;
  flag_reason?: string | null;
  created_at: string;
  updated_at: string;
  traveler_profile: TravelerProfile | null;
}

export interface SessionListResponse {
  items: AdvisorySession[];
  total: number;
  limit: number;
  offset: number;
}

export type CardType = 'flight' | 'hotel' | 'activities' | 'visa' | 'budget' | 'compliance' | 'booking';

export interface CardUpdateEvent {
  card_id: string;
  type: CardType;
  completeness_score: number;
  delta: Record<string, unknown>;
  is_final: boolean;
}

export interface ProposeFirstResponse {
  bot_message: string;
  extracted_slots: Record<string, unknown>;
  assumed_slots: string[];
  is_surprise_me: boolean;
}
