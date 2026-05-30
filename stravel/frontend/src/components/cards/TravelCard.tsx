import { useEffect, useRef, useState } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { CompletenessIndicator } from './CompletenessIndicator';
import { cardDisplayState } from './cardUtils';
import type {
  CardType,
  CardData,
  FlightCardData,
  HotelCardData,
  ActivityCardData,
  VisaCardData,
  BudgetCardData,
  ComplianceCardData,
} from './cardUtils';
import type { SlotKey } from '@/types/domain';

export interface TravelCardProps {
  cardId: string;
  cardType: CardType;
  completenessScore: number;
  isFinal: boolean;
  delta: Partial<CardData>;
  deckState: 'browsing' | 'committing';
  shimmerEnabled?: boolean;
  onEdit?: () => void;
  onBook?: () => void;
  onRetry?: () => void;
  className?: string;
  assumedSlots?: SlotKey[];
  onAssumedBadgeTap?: (slotKey: SlotKey) => void;
  onComplianceBadgeTap?: (cardId: string) => void;
  pulse?: boolean;
}

const STALL_TIMEOUT_MS = 90_000;

function AssumedBadge({ slotKey, onTap }: { slotKey: SlotKey; onTap?: (slotKey: SlotKey) => void }) {
  return (
    <button
      className="ml-1 text-xs text-amber-600 underline cursor-pointer"
      onClick={() => onTap?.(slotKey)}
      aria-label={`${slotKey} was assumed — tap to change`}
    >
      (assumed)
    </button>
  );
}

const CARD_ICONS: Record<CardType, string> = {
  flight: '✈️',
  hotel: '🏨',
  activities: '🎯',
  visa: '🛂',
  budget: '💰',
  compliance: '🛡️',
  booking: '📋',
};

const SHIMMER_COUNT: Record<CardType, number> = {
  flight: 4, hotel: 3, activities: 3, visa: 3,
  budget: 4, compliance: 3, booking: 1,
};

const COMPLIANCE_DOT: Record<string, string> = { block: '🔴', warning: '🟡', clear: '🟢' };

const cardVariants = cva('relative rounded-xl border p-4 touch-pan-y', {
  variants: {
    state: {
      nascent: 'border-border bg-surface-2 pointer-events-none scale-[0.98]',
      forming: 'border-amber-200 bg-surface scale-[0.98] transition-card-settle',
      settled: 'border-slate-200 bg-surface scale-100 shadow-md transition-card-settle',
      error: 'border-status-pending bg-amber-50',
    },
  },
});

function ShimmerField({ shimmerEnabled }: { shimmerEnabled: boolean }) {
  return (
    <div
      className={cn(
        'h-4 rounded bg-gradient-to-r from-surface via-surface-2 to-surface bg-[length:200%_100%]',
        shimmerEnabled ? 'animate-shimmer' : '',
        shimmerEnabled ? 'will-change-transform' : ''
      )}
    />
  );
}

function FlightFields({
  data,
  isSettled,
  assumedSlots,
  onAssumedBadgeTap,
}: {
  data: Partial<FlightCardData>;
  isSettled: boolean;
  assumedSlots?: SlotKey[];
  onAssumedBadgeTap?: (slotKey: SlotKey) => void;
}) {
  const assumed = (key: SlotKey) => assumedSlots?.includes(key);
  return (
    <div className="grid grid-cols-2 gap-2 text-sm">
      <div>
        <span className="text-text-muted text-xs">From</span>
        <p className="font-medium">{data.origin ?? '—'}</p>
      </div>
      <div>
        <span className="text-text-muted text-xs">To</span>
        <p className="font-medium">{data.destination ?? '—'}</p>
      </div>
      <div>
        <span className="text-text-muted text-xs">Depart</span>
        <p>
          {data.departDate ?? '—'}
          {assumed('travel_dates') && <AssumedBadge slotKey="travel_dates" onTap={onAssumedBadgeTap} />}
        </p>
      </div>
      <div>
        <span className="text-text-muted text-xs">Return</span>
        <p>
          {data.returnDate ?? '—'}
          {assumed('travel_dates') && <AssumedBadge slotKey="travel_dates" onTap={onAssumedBadgeTap} />}
        </p>
      </div>
      {isSettled && (
        <>
          <div>
            <span className="text-text-muted text-xs">Airline</span>
            <p>{data.airline ?? '—'}</p>
          </div>
          <div>
            <span className="text-text-muted text-xs">Price</span>
            <p>{data.price != null ? `$${data.price}` : '—'}</p>
          </div>
          <div className="col-span-2">
            <span className="text-text-muted text-xs">Times</span>
            <p>{data.flightTimes ?? '—'}</p>
          </div>
        </>
      )}
    </div>
  );
}

function HotelFields({
  data,
  isSettled,
}: {
  data: Partial<HotelCardData>;
  isSettled: boolean;
}) {
  return (
    <div className="space-y-2 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className="text-text-muted text-xs">Neighborhood</span>
          <p className="font-medium">{data.neighborhood ?? '—'}</p>
        </div>
        <div>
          <span className="text-text-muted text-xs">Stars</span>
          <p>{data.starRange ?? '—'}</p>
        </div>
        {isSettled && (
          <>
            <div>
              <span className="text-text-muted text-xs">Name</span>
              <p>{data.name ?? '—'}</p>
            </div>
            <div>
              <span className="text-text-muted text-xs">Nightly Rate</span>
              <p>{data.nightlyRate != null ? `$${data.nightlyRate}` : '—'}</p>
            </div>
          </>
        )}
      </div>
      {isSettled && data.highlights && data.highlights.length > 0 && (
        <ul className="list-disc list-inside text-xs text-text-muted space-y-0.5">
          {data.highlights.slice(0, 3).map((h, i) => <li key={i}>{h}</li>)}
        </ul>
      )}
    </div>
  );
}

function ActivityFields({
  data,
  isSettled,
  assumedSlots,
  onAssumedBadgeTap,
}: {
  data: Partial<ActivityCardData>;
  isSettled: boolean;
  assumedSlots?: SlotKey[];
  onAssumedBadgeTap?: (slotKey: SlotKey) => void;
}) {
  const assumed = (key: SlotKey) => assumedSlots?.includes(key);
  return (
    <div className="space-y-2 text-sm">
      {data.dayNumber != null && (
        <div className="text-xs text-text-muted">Day {data.dayNumber}</div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className="text-text-muted text-xs">Category</span>
          <p className="font-medium">
            {data.category ?? '—'}
            {assumed('activities') && <AssumedBadge slotKey="activities" onTap={onAssumedBadgeTap} />}
          </p>
        </div>
        <div>
          <span className="text-text-muted text-xs">Zone</span>
          <p>{data.cityZone ?? '—'}</p>
        </div>
        {isSettled && (
          <>
            <div>
              <span className="text-text-muted text-xs">Venue</span>
              <p>{data.venue ?? '—'}</p>
            </div>
            <div>
              <span className="text-text-muted text-xs">Hours</span>
              <p>{data.hours ?? '—'}</p>
            </div>
            <div>
              <span className="text-text-muted text-xs">Cost</span>
              <p>{data.cost != null ? `$${data.cost}` : '—'}</p>
            </div>
            {data.description && (
              <div className="col-span-2">
                <span className="text-text-muted text-xs">Description</span>
                <p className="line-clamp-2 text-xs">{data.description}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function VisaFields({
  data,
  isSettled,
}: {
  data: Partial<VisaCardData>;
  isSettled: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 text-sm">
      <div>
        <span className="text-text-muted text-xs">Destination</span>
        <p className="font-medium">{data.destinationCountry ?? '—'}</p>
      </div>
      <div>
        <span className="text-text-muted text-xs">Nationality</span>
        <p>{data.nationality ?? '—'}</p>
      </div>
      {isSettled && (
        <>
          <div>
            <span className="text-text-muted text-xs">Processing Time</span>
            <p>{data.processingTime ?? '—'}</p>
          </div>
          <div>
            <span className="text-text-muted text-xs">Fee</span>
            <p>{data.fee != null ? `$${data.fee}` : '—'}</p>
          </div>
        </>
      )}
    </div>
  );
}

function BudgetFields({ data, isSettled }: { data: Partial<BudgetCardData>; isSettled: boolean }) {
  return (
    <div className="space-y-2 text-sm">
      <div className="flex justify-between font-semibold border-b border-border pb-1">
        <span>Total</span>
        <span>{data.total != null ? `${data.currency ?? 'USD'} ${data.total.toLocaleString()}` : '—'}</span>
      </div>
      {isSettled && (
        <div className="grid grid-cols-2 gap-1 text-xs text-text-muted">
          <span>Flights</span><span className="text-right">{data.flights != null ? `$${data.flights}` : '—'}</span>
          <span>Accommodation</span><span className="text-right">{data.accommodation != null ? `$${data.accommodation}` : '—'}</span>
          <span>Activities</span><span className="text-right">{data.activities != null ? `$${data.activities}` : '—'}</span>
          <span>Misc</span><span className="text-right">{data.misc != null ? `$${data.misc}` : '—'}</span>
        </div>
      )}
    </div>
  );
}

function ComplianceFields({ data, isSettled }: { data: Partial<ComplianceCardData>; isSettled: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const advisories = data.healthAdvisories ?? [];
  return (
    <div className="space-y-2 text-sm">
      <div>
        <span className="text-text-muted text-xs">Visa</span>
        <p>{data.visaRequirement ?? '—'}</p>
      </div>
      <div>
        <span className="text-text-muted text-xs">Passport</span>
        <p>{data.passportCheck ?? '—'}</p>
      </div>
      {isSettled && advisories.length > 0 && (
        <div>
          <button
            className="text-xs text-primary underline"
            onClick={() => setExpanded(e => !e)}
            aria-label={expanded ? 'Hide advisories' : `Show ${advisories.length} advisories`}
          >
            {expanded ? 'Hide advisories' : `Show ${advisories.length} advisories`}
          </button>
          {expanded && (
            <ul className="mt-1 space-y-1 text-xs text-text-muted list-disc list-inside">
              {advisories.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          )}
        </div>
      )}
      {isSettled && advisories.length === 0 && (
        <p className="text-xs text-text-muted">No current advisories</p>
      )}
      {isSettled && data.visaLink && (
        <a
          href={data.visaLink}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary underline"
          data-testid="visa-requirements-link"
        >
          Check visa requirements →
        </a>
      )}
    </div>
  );
}

function BookingFields({ deckState, onBook }: { deckState: 'browsing' | 'committing'; onBook?: () => void }) {
  if (deckState !== 'committing') {
    return (
      <div className="space-y-2">
        <ShimmerField shimmerEnabled={false} />
      </div>
    );
  }
  return (
    <button
      className={cn('w-full py-3 rounded-lg bg-primary text-white font-semibold text-sm', !onBook && 'opacity-50 cursor-not-allowed')}
      onClick={onBook}
      aria-disabled={!onBook ? true : undefined}
      title={onBook ? undefined : 'Resolve compliance issues before booking'}
      aria-label="Book this trip"
      data-testid="booking-cta"
    >
      Book this trip
    </button>
  );
}

export function TravelCard({
  cardId,
  cardType,
  completenessScore,
  isFinal,
  delta,
  deckState,
  shimmerEnabled = true,
  onEdit,
  onBook,
  onRetry,
  className,
  assumedSlots,
  onAssumedBadgeTap,
  onComplianceBadgeTap,
  pulse,
}: TravelCardProps) {
  const [isStalled, setIsStalled] = useState(false);
  const lastScoreRef = useRef(completenessScore);

  useEffect(() => {
    if (completenessScore !== lastScoreRef.current) {
      lastScoreRef.current = completenessScore;
      setIsStalled(false);
    }
  }, [completenessScore]);

  useEffect(() => {
    const state = cardDisplayState(completenessScore, isFinal);
    if (state !== 'nascent') return;
    const timer = setTimeout(() => setIsStalled(true), STALL_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [completenessScore, isFinal]);

  const displayState = isStalled
    ? 'error'
    : cardDisplayState(completenessScore, isFinal);

  const pct = Math.round(completenessScore * 100);
  const isSettled = displayState === 'settled';
  const isNascent = displayState === 'nascent';
  const isCommittingSettled = isSettled && deckState === 'committing';

  return (
    <div
      role="article"
      aria-label={`${cardType} card, ${pct}% complete`}
      data-card-type={cardType}
      className={cn(cardVariants({ state: displayState }), pulse && isSettled && 'compliance-highlight', className)}
    >
      <span className="sr-only" aria-live="polite">
        {pct}% complete
      </span>

      {/* CardHeader */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span aria-hidden="true">{CARD_ICONS[cardType]}</span>
          <span className="font-semibold capitalize text-text-base">{cardType}</span>
          {cardType === 'hotel' && (delta as Partial<HotelCardData>).complianceSeverity && (
            <button
              className="ml-1 text-base"
              onClick={() => onComplianceBadgeTap?.(cardId)}
            >
              <span
                role="status"
                aria-label={`Compliance: ${(delta as Partial<HotelCardData>).complianceSeverity}`}
              >
                {COMPLIANCE_DOT[(delta as Partial<HotelCardData>).complianceSeverity!] ?? '⚪'}
              </span>
            </button>
          )}
          {cardType === 'activities' && (delta as Partial<ActivityCardData>).complianceSeverity && (
            <button
              className="ml-1 text-base"
              onClick={() => onComplianceBadgeTap?.(cardId)}
            >
              <span
                role="status"
                aria-label={`Compliance: ${(delta as Partial<ActivityCardData>).complianceSeverity}`}
              >
                {COMPLIANCE_DOT[(delta as Partial<ActivityCardData>).complianceSeverity!] ?? '⚪'}
              </span>
            </button>
          )}
        </div>
        <CompletenessIndicator
          score={completenessScore}
          state={displayState}
          className="w-20"
        />
      </div>

      {/* CardBody */}
      {isNascent ? (
        <div className="space-y-2">
          {Array.from({ length: SHIMMER_COUNT[cardType] }).map((_, i) => (
            <ShimmerField key={i} shimmerEnabled={shimmerEnabled} />
          ))}
        </div>
      ) : displayState === 'error' ? (
        <div className="py-2 text-sm text-text-muted">
          <p>Taking longer than expected</p>
          <button
            className="mt-2 px-3 py-1 rounded border border-status-pending text-status-pending text-xs hover:bg-amber-50"
            onClick={onRetry}
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          {cardType === 'flight' && (
            <FlightFields data={delta as Partial<FlightCardData>} isSettled={isSettled} assumedSlots={assumedSlots} onAssumedBadgeTap={onAssumedBadgeTap} />
          )}
          {cardType === 'hotel' && (
            <HotelFields data={delta as Partial<HotelCardData>} isSettled={isSettled} />
          )}
          {cardType === 'activities' && (
            <ActivityFields data={delta as Partial<ActivityCardData>} isSettled={isSettled} assumedSlots={assumedSlots} onAssumedBadgeTap={onAssumedBadgeTap} />
          )}
          {cardType === 'visa' && (
            <VisaFields data={delta as Partial<VisaCardData>} isSettled={isSettled} />
          )}
          {cardType === 'budget' && (
            <BudgetFields data={delta as Partial<BudgetCardData>} isSettled={isSettled} />
          )}
          {cardType === 'compliance' && (
            <ComplianceFields data={delta as Partial<ComplianceCardData>} isSettled={isSettled} />
          )}
          {cardType === 'booking' && (
            <BookingFields deckState={deckState} onBook={onBook} />
          )}
        </>
      )}

      {/* CardActions */}
      {isSettled && (
        <div className="flex items-center justify-end gap-2 mt-3">
          {onEdit && (
            <button
              className="text-xs text-text-muted hover:text-text-base"
              onClick={onEdit}
              aria-label={`Edit ${cardType} card`}
            >
              ✏️ Edit
            </button>
          )}
          {isCommittingSettled && onBook && cardType !== 'booking' && (
            <button
              className="px-3 py-1 text-xs rounded bg-primary text-white"
              onClick={onBook}
            >
              Book
            </button>
          )}
        </div>
      )}

      {/* CardFooter — timestamp, forming+ */}
      {(displayState === 'forming' || isSettled) && (
        <div className="mt-2 text-xs text-text-muted">{pct}% complete</div>
      )}
    </div>
  );
}
