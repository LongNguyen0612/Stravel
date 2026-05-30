export type CardState = 'nascent' | 'forming' | 'settled' | 'error';
export type { CardType } from '../../types/domain';

export interface FlightCardData {
  origin?: string;
  destination?: string;
  departDate?: string;
  returnDate?: string;
  airline?: string;
  price?: number;
  flightTimes?: string;
}

export interface HotelCardData {
  neighborhood?: string;
  starRange?: string;
  name?: string;
  nightlyRate?: number;
  highlights?: string[];
  complianceSeverity?: 'block' | 'warning' | 'clear';
}

export interface ActivityCardData {
  category?: string;
  cityZone?: string;
  venue?: string;
  hours?: string;
  cost?: number;
  dayNumber?: number;
  description?: string;
  complianceSeverity?: 'block' | 'warning' | 'clear';
}

export interface BudgetCardData {
  total?: number;
  currency?: string;
  flights?: number;
  accommodation?: number;
  activities?: number;
  misc?: number;
}

export interface ComplianceCardData {
  visaRequirement?: string;
  passportCheck?: string;
  healthAdvisories?: string[];
  isBlock?: boolean;
  visaLink?: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface BookingCardData {} // presence triggers booking CTA; no data fields needed

export interface VisaCardData {
  destinationCountry?: string;
  nationality?: string;
  processingTime?: string;
  fee?: number;
}

export type CardData = FlightCardData | HotelCardData | ActivityCardData | VisaCardData | BudgetCardData | ComplianceCardData | BookingCardData;

export function cardDisplayState(
  score: number,
  isFinal: boolean
): Exclude<CardState, 'error'> {
  if (score >= 0.75 && isFinal) return 'settled';
  if (score >= 0.25) return 'forming';
  return 'nascent';
}
