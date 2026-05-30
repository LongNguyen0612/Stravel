import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { SlotKey } from '../../types/domain';

export interface PassportUploadCardProps {
  slotKey: SlotKey;
  onSelect: (update: { slotKey: SlotKey; value: string }) => void;
  onSkip: (event: { slotKey: SlotKey }) => void;
  className?: string;
}

type UploadState = 'idle' | 'uploading' | 'confirm' | 'manual';

interface PassportOCRResult {
  expiry_date: string | null;
  confidence: number;
  fallback_required: boolean;
}

const CONFIDENCE_THRESHOLD = 0.85;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const OCR_TIMEOUT_MS = 30_000;

// P3: guard against null/empty/malformed input
function formatDateForDisplay(iso: string): string {
  if (!iso || !DATE_REGEX.test(iso)) return iso;
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

export function PassportUploadCard({ slotKey, onSelect, onSkip, className }: PassportUploadCardProps) {
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [extractedDate, setExtractedDate] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [manualInputError, setManualInputError] = useState<string | null>(null);
  // P5: aria-live announcement for screen readers
  const [statusAnnouncement, setStatusAnnouncement] = useState('');
  // P7: prevent double-fire of Yes
  const yesSubmittedRef = useRef(false);

  const takePhotoRef = useRef<HTMLInputElement>(null);
  const uploadPhotoRef = useRef<HTMLInputElement>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (uploadState === 'manual') {
      manualInputRef.current?.focus();
    }
  }, [uploadState]);

  // P1 + P6: check res.ok and add AbortController timeout
  async function handleFileUpload(file: File) {
    setUploadState('uploading');
    setUploadError(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);
    try {
      const fd = new FormData();
      fd.append('file', file);
      // eslint-disable-next-line no-restricted-globals -- multipart upload; apiClient.ts uses JSON headers
      const res = await fetch('/api/v1/passport/extract-expiry', {
        method: 'POST',
        body: fd,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`OCR request failed: ${res.status}`);
      const data: PassportOCRResult = await res.json();
      const success =
        !data.fallback_required &&
        data.confidence >= CONFIDENCE_THRESHOLD &&
        data.expiry_date !== null;
      if (success) {
        setExtractedDate(data.expiry_date);
        setUploadState('confirm');
        // P5: announce result
        setStatusAnnouncement(`Passport date detected: ${formatDateForDisplay(data.expiry_date!)}. Is this correct?`);
      } else {
        setManualInput(data.expiry_date ?? '');
        setUploadState('manual');
        setStatusAnnouncement("Couldn't read the date clearly — please enter it manually.");
      }
    } catch {
      clearTimeout(timeoutId);
      setUploadError('Something went wrong — please enter the date manually');
      setManualInput('');
      setUploadState('manual');
      setStatusAnnouncement('Upload failed — please enter the date manually.');
    }
  }

  // P2: guard against concurrent uploads
  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (uploadState === 'uploading') return;
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
    // reset so same file can be re-uploaded
    e.target.value = '';
  }

  // P2: guard against concurrent uploads via drag-drop
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    if (uploadState === 'uploading') return;
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleZoneKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      uploadPhotoRef.current?.click();
    }
  }

  // P7: prevent double-fire
  function handleYes() {
    if (!extractedDate || yesSubmittedRef.current) return;
    yesSubmittedRef.current = true;
    onSelect({ slotKey, value: extractedDate });
  }

  function handleNo() {
    setManualInput(extractedDate ?? '');
    setUploadState('manual');
  }

  // P4: validate YYYY-MM-DD format before submitting
  function handleManualSubmit() {
    if (!DATE_REGEX.test(manualInput)) {
      setManualInputError('Please enter a valid date in YYYY-MM-DD format (e.g. 2027-06-30)');
      return;
    }
    setManualInputError(null);
    onSelect({ slotKey, value: manualInput });
  }

  const zoneClass = cn(
    'flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-lg cursor-pointer',
    'border-teal-300 bg-teal-50 hover:bg-teal-100 transition-colors motion-reduce:transition-none',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'
  );

  const btnClass = cn(
    'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full text-sm font-medium cursor-pointer',
    'bg-teal-600 text-white min-h-[44px] min-w-[44px]',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
    'transition-colors motion-reduce:transition-none'
  );

  const outlineBtnClass = cn(
    'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full text-sm font-medium cursor-pointer',
    'border border-teal-600 text-teal-700 min-h-[44px] min-w-[44px]',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
    'transition-colors motion-reduce:transition-none hover:bg-teal-50'
  );

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* P5: sr-only live region for state transition announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}
      >
        {statusAnnouncement}
      </div>

      {/* Hidden file inputs */}
      <input
        ref={takePhotoRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={handleInputChange}
        data-testid="take-photo-input"
      />
      <input
        ref={uploadPhotoRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={handleInputChange}
        data-testid="upload-photo-input"
      />

      {uploadState === 'idle' && (
        <>
          {/* Upload zone */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload passport photo"
            className={zoneClass}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onKeyDown={handleZoneKeyDown}
            onClick={() => uploadPhotoRef.current?.click()}
          >
            <span className="text-3xl" aria-hidden="true">📷</span>
            <p className="text-sm text-text-muted text-center">
              Drop your passport photo here, or use the buttons below
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 justify-center flex-wrap">
            <button
              type="button"
              onClick={() => takePhotoRef.current?.click()}
              className={btnClass}
            >
              Take photo
            </button>
            <button
              type="button"
              onClick={() => uploadPhotoRef.current?.click()}
              className={outlineBtnClass}
            >
              Upload photo
            </button>
          </div>
        </>
      )}

      {uploadState === 'uploading' && (
        <div
          className="flex flex-col items-center justify-center gap-2 p-6 rounded-lg bg-teal-50"
          aria-busy="true"
          aria-label="Reading passport…"
        >
          <div className="h-4 w-32 rounded bg-teal-200 animate-pulse" aria-hidden="true" />
          <div className="h-3 w-24 rounded bg-teal-100 animate-pulse" aria-hidden="true" />
          <p className="text-sm text-text-muted sr-only">Reading passport…</p>
        </div>
      )}

      {uploadState === 'confirm' && extractedDate && (
        <div className="flex flex-col gap-3 items-center">
          <p className="text-sm text-text-muted">Is this correct?</p>
          <p className="text-lg font-semibold text-teal-700">{formatDateForDisplay(extractedDate)}</p>
          <div className="flex gap-2">
            <button type="button" onClick={handleYes} className={btnClass}>Yes</button>
            <button type="button" onClick={handleNo} className={outlineBtnClass}>No</button>
          </div>
        </div>
      )}

      {uploadState === 'manual' && (
        <div className="flex flex-col gap-3">
          {uploadError ? (
            <p className="text-sm text-amber-700">{uploadError}</p>
          ) : (
            <p className="text-sm text-text-muted">
              I couldn't read the date clearly — please enter it manually
            </p>
          )}
          <input
            ref={manualInputRef}
            type="text"
            placeholder="YYYY-MM-DD"
            value={manualInput}
            onChange={(e) => { setManualInput(e.target.value); setManualInputError(null); }}
            aria-label="Passport expiry date"
            aria-describedby={manualInputError ? 'passport-date-error' : undefined}
            className={cn(
              'w-full px-3 py-2 border rounded-lg text-sm',
              manualInputError ? 'border-red-400' : 'border-slate-300',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'
            )}
          />
          {/* P4: inline format validation error */}
          {manualInputError && (
            <p id="passport-date-error" className="text-sm text-red-600" role="alert">
              {manualInputError}
            </p>
          )}
          <button
            type="button"
            onClick={handleManualSubmit}
            disabled={!manualInput}
            className={cn(btnClass, 'self-center', !manualInput && 'opacity-50 cursor-not-allowed')}
          >
            Confirm date
          </button>
        </div>
      )}

      {/* Skip link — hidden during uploading */}
      {uploadState !== 'uploading' && (
        <button
          type="button"
          onClick={() => onSkip({ slotKey })}
          className="text-sm text-text-muted underline self-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
        >
          Skip
        </button>
      )}
    </div>
  );
}
