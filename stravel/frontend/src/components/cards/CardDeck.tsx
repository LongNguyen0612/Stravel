import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { TravelCard } from './TravelCard';
import type { CardData } from './cardUtils';
import type { CardUpdateEvent, SlotKey } from '@/types/domain';
import { api } from '@/services/apiClient';

export interface CardDeckProps {
  cards: CardUpdateEvent[];
  sessionId?: string;
  onBook?: () => void;
  onCardEdit?: (cardId: string) => void;
  onComplianceBadgeTap?: (cardId: string) => void;
  onAssumedBadgeTap?: (slotKey: SlotKey) => void;
  onRetry?: () => void;
  assumedSlots?: string[];
  hasComplianceBlock?: boolean;
  highlightComplianceCard?: boolean;
  className?: string;
}

export function CardDeck({
  cards,
  sessionId,
  onBook,
  onCardEdit,
  onComplianceBadgeTap,
  onAssumedBadgeTap,
  onRetry,
  assumedSlots,
  hasComplianceBlock = false,
  highlightComplianceCard = false,
  className,
}: CardDeckProps) {
  const [deckState, setDeckState] = useState<'browsing' | 'committing'>('browsing');
  const [authorshipPending, setAuthorshipPending] = useState(false);
  const [tripName, setTripName] = useState('');
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const allSettled = cards.length > 0 && cards.every(c => c.completeness_score >= 0.75 && c.is_final);

  useEffect(() => {
    if (allSettled && deckState === 'browsing') {
      settleTimerRef.current = setTimeout(() => {
        setDeckState('committing');
        setAuthorshipPending(true);
      }, 500);
    } else if (!allSettled && deckState === 'committing') {
      setDeckState('browsing');
      setAuthorshipPending(false);  // reset so authorship re-queues next time
    }
    return () => {
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    };
  }, [allSettled, deckState]);

  // Focus input when authorship panel appears
  useEffect(() => {
    if (authorshipPending && inputRef.current) {
      inputRef.current.focus();
    }
  }, [authorshipPending]);

  // After authorship resolves in committing state, focus the booking CTA
  useEffect(() => {
    if (!authorshipPending && deckState === 'committing') {
      const ctaEl = containerRef.current?.querySelector<HTMLElement>('[data-testid="booking-cta"]');
      ctaEl?.focus();
    }
  }, [authorshipPending, deckState]);

  const bookingCTAActive = deckState === 'committing' && !authorshipPending && !hasComplianceBlock;

  // Compute shimmer gating (UX-DR23: max 3 simultaneous will-change: transform)
  const shimmerMap: Record<string, boolean> = {};
  let shimmerCount = 0;
  for (const card of cards) {
    const isNascent = card.completeness_score < 0.25 && !card.is_final;
    if (isNascent && shimmerCount < 3) {
      shimmerMap[card.card_id] = true;
      shimmerCount++;
    } else {
      shimmerMap[card.card_id] = false;
    }
  }

  const handleAuthorshipSave = () => {
    if (tripName.trim() && sessionId) {
      api.userPreferences.saveTripName(sessionId, tripName.trim());
    }
    setAuthorshipPending(false);
  };

  const handleAuthorshipDismiss = () => {
    setAuthorshipPending(false);
  };

  return (
    <div ref={containerRef} className={cn('flex flex-col gap-3', className)} data-testid="card-deck">
      {cards.map(card => (
        <TravelCard
          key={card.card_id}
          cardId={card.card_id}
          cardType={card.type}
          completenessScore={card.completeness_score}
          isFinal={card.is_final}
          delta={card.delta as Partial<CardData>}
          deckState={deckState}
          shimmerEnabled={shimmerMap[card.card_id] ?? false}
          onBook={card.type === 'booking' ? (bookingCTAActive ? onBook : undefined) : undefined}
          onEdit={onCardEdit ? () => onCardEdit(card.card_id) : undefined}
          onRetry={onRetry}
          onComplianceBadgeTap={onComplianceBadgeTap}
          onAssumedBadgeTap={onAssumedBadgeTap}
          assumedSlots={assumedSlots as SlotKey[] | undefined}
          pulse={card.type === 'compliance' && highlightComplianceCard}
        />
      ))}

      {authorshipPending && (
        <div
          role="region"
          aria-label="Name your trip"
          data-testid="authorship-panel"
          onKeyDown={e => { if (e.key === 'Escape') handleAuthorshipDismiss(); }}
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3"
        >
          <p className="text-sm font-medium text-text-base">
            What would you like to name this trip?
          </p>
          <input
            ref={inputRef}
            type="text"
            value={tripName}
            onChange={e => setTripName(e.target.value)}
            aria-label="Trip name"
            data-testid="trip-name-input"
            placeholder="e.g. Vietnam Summer 2026"
            maxLength={100}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            onKeyDown={e => {
              if (e.key === 'Escape') handleAuthorshipDismiss();
              if (e.key === 'Enter') handleAuthorshipSave();
            }}
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleAuthorshipSave}
              data-testid="authorship-save"
              className="px-4 py-2 text-sm rounded-lg bg-primary text-white font-medium"
            >
              Save
            </button>
            <button
              type="button"
              onClick={handleAuthorshipDismiss}
              data-testid="authorship-skip"
              className="text-sm text-text-muted underline"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {hasComplianceBlock && deckState === 'committing' && (
        <p
          role="alert"
          className="text-xs text-red-600 text-center mt-1"
        >
          Resolve compliance issues before booking
        </p>
      )}
    </div>
  );
}
