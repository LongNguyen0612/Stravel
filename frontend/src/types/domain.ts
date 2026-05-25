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

export type SessionStatus = "in_progress" | "completed" | "archived";

export interface AdvisorySession {
  id: string;
  tenant_id: string;
  status: SessionStatus;
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
