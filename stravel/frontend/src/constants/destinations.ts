export const VIETNAM_CITIES_FRONTEND = [
  "Hanoi", "Ho Chi Minh City", "Da Nang", "Hoi An", "Hue",
  "Nha Trang", "Phu Quoc", "Ha Long Bay", "Sapa", "Da Lat",
  "Can Tho", "Vung Tau", "Mui Ne", "Ninh Binh", "Quy Nhon",
  "Phan Thiet", "Con Dao", "Lang Co", "Bac Ha", "Mai Chau",
] as const;

const SURPRISE_PATTERN = /\bsurprise\s+me\b/i;
const DESTINATION_VERB_PATTERN = /\b(?:visit|go to|travel to|trip to|fly to)\s+[A-Z]/i;

/** Returns true if the message is a candidate for the propose-first fast-path. */
export function classifyFirstMessage(text: string): boolean {
  if (SURPRISE_PATTERN.test(text)) return true;
  if (DESTINATION_VERB_PATTERN.test(text)) return true;
  for (const city of VIETNAM_CITIES_FRONTEND) {
    if (new RegExp(`\\b${city}\\b`, "i").test(text)) return true;
  }
  return false;
}
