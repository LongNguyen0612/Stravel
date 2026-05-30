import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { SlotKey } from '../../types/domain';

export interface InlineCalendarCardProps {
  slotKey: SlotKey;
  initialMonth?: Date;
  onSelect: (update: { slotKey: SlotKey; value: string; nightCount: number }) => void;
  className?: string;
}

type CalendarPhase = 'start' | 'end' | 'confirmed';

const DOW_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function daysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function formatAriaDate(d: Date): string {
  const dow = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()];
  const month = MONTH_NAMES[d.getMonth()];
  return `${dow}, ${month} ${d.getDate()}, ${d.getFullYear()}`;
}

function buildWeeks(days: Date[], firstDow: number): (Date | null)[][] {
  const cells: (Date | null)[] = [...Array(firstDow).fill(null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function InlineCalendarCard({
  slotKey,
  initialMonth,
  onSelect,
  className,
}: InlineCalendarCardProps) {
  const base = initialMonth ?? new Date();
  const month0 = new Date(base.getFullYear(), base.getMonth(), 1);
  const month1 = new Date(base.getFullYear(), base.getMonth() + 1, 1);

  const [phase, setPhase] = useState<CalendarPhase>('start');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const nightCount =
    startDate && endDate
      ? Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      : null;

  function handleDateClick(date: Date) {
    if (phase === 'start') {
      setStartDate(date);
      setEndDate(null);
      setPhase('end');
    } else {
      if (startDate && date > startDate) {
        setEndDate(date);
        setPhase('confirmed');
      } else {
        setStartDate(null);
        setEndDate(null);
        setPhase('start');
      }
    }
  }

  function handleDateKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, date: Date) {
    const deltas: Record<string, number> = {
      ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7,
    };
    if (e.key in deltas) {
      e.preventDefault();
      const target = addDays(date, deltas[e.key]);
      const btn = containerRef.current?.querySelector<HTMLButtonElement>(
        `[data-date="${isoDate(target)}"]`
      );
      btn?.focus();
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleDateClick(date);
    }
  }

  function isSelected(date: Date): boolean {
    if (!startDate) return false;
    const iso = isoDate(date);
    const s = isoDate(startDate);
    const e = endDate ? isoDate(endDate) : null;
    return iso === s || (e !== null && iso >= s && iso <= e);
  }

  function dateClass(date: Date): string {
    if (!startDate) return 'hover:bg-surface-2 text-text-base';
    const iso = isoDate(date);
    const s = isoDate(startDate);
    const e = endDate ? isoDate(endDate) : null;
    if (iso === s || iso === e) return 'bg-teal-600 text-white';
    if (e !== null && iso > s && iso < e) return 'bg-teal-100 text-teal-900';
    return 'hover:bg-surface-2 text-text-base';
  }

  function isFocusTarget(date: Date, month: Date): boolean {
    if (startDate && isoDate(startDate) === isoDate(date)) return true;
    if (!startDate && isoDate(month) === isoDate(month0)) {
      const days = daysInMonth(month.getFullYear(), month.getMonth());
      return isoDate(days[0]) === isoDate(date);
    }
    return false;
  }

  function renderMonth(month: Date) {
    const year = month.getFullYear();
    const m = month.getMonth();
    const days = daysInMonth(year, m);
    const firstDow = days[0].getDay();
    const monthLabel = `${MONTH_NAMES[m]} ${year}`;
    const weeks = buildWeeks(days, firstDow);

    return (
      <div key={monthLabel}>
        <p className="text-sm font-semibold text-center mb-2">{monthLabel}</p>
        <div role="grid" aria-label={monthLabel}>
          <div role="row" className="grid grid-cols-7 text-xs text-text-muted text-center mb-1">
            {DOW_HEADERS.map(d => (
              <span key={d} role="columnheader" aria-label={d}>{d}</span>
            ))}
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} role="row" className="grid grid-cols-7">
              {week.map((day, di) =>
                day === null ? (
                  <span key={di} role="gridcell" />
                ) : (
                  <button
                    key={isoDate(day)}
                    type="button"
                    role="gridcell"
                    data-date={isoDate(day)}
                    aria-label={formatAriaDate(day)}
                    aria-selected={isSelected(day)}
                    tabIndex={isFocusTarget(day, month) ? 0 : -1}
                    onClick={() => handleDateClick(day)}
                    onKeyDown={(e) => handleDateKeyDown(e, day)}
                    className={cn(
                      'rounded-full text-xs text-center transition-colors',
                      'min-h-[44px] min-w-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
                      'motion-reduce:transition-none',
                      dateClass(day)
                    )}
                  >
                    {day.getDate()}
                  </button>
                )
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn('flex flex-col gap-4', className)}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {renderMonth(month0)}
        {renderMonth(month1)}
      </div>

      {startDate && (
        <p className="text-sm text-center text-text-muted">
          Nights: {nightCount !== null ? nightCount : '—'}
        </p>
      )}

      {phase === 'confirmed' && nightCount !== null && startDate && endDate && (
        <button
          type="button"
          className={cn(
            'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full self-center',
            'bg-teal-600 text-white text-sm font-medium cursor-pointer',
            'min-h-[44px] min-w-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
            'transition-colors motion-reduce:transition-none'
          )}
          onClick={() =>
            onSelect({
              slotKey,
              value: `${isoDate(startDate)},${isoDate(endDate)}`,
              nightCount,
            })
          }
        >
          Confirm {nightCount} nights
        </button>
      )}
    </div>
  );
}
