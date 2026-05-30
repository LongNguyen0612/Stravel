import { useEffect, useRef, useState } from 'react';
import type { AdvisorySession } from '../../types/domain';
import { api } from '../../services/apiClient';

interface StagingGateProps {
  session: AdvisorySession;
  onStatusChange: (session: AdvisorySession) => void;
}

export function StagingGate({ session, onStatusChange }: StagingGateProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [justConfirmed, setJustConfirmed] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [error, setError] = useState<string | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const prevStatusRef = useRef<string>(session.status);

  useEffect(() => {
    if (modalOpen) {
      cancelRef.current?.focus();
    }
  }, [modalOpen]);

  useEffect(() => {
    if (!justConfirmed) return;
    const timer = setTimeout(() => setJustConfirmed(false), 3000);
    return () => clearTimeout(timer);
  }, [justConfirmed]);

  useEffect(() => {
    if (prevStatusRef.current === 'confirmed' && session.status === 'modified') {
      setAnnouncement('Session returned to draft');
    }
    prevStatusRef.current = session.status;
  }, [session.status]);

  function openModal() {
    setError(null);
    setModalOpen(true);
  }

  // P2: guard cancel during in-flight confirm — API may still succeed
  function handleCancel() {
    if (confirming) return;
    setModalOpen(false);
    triggerRef.current?.focus();
  }

  async function handleConfirm() {
    if (confirming) return; // P1: guard for aria-disabled pattern
    setConfirming(true);
    setError(null);
    try {
      const updated = await api.sessions.updateStatus(session.id, 'confirmed', undefined);
      setModalOpen(false);
      setJustConfirmed(true);
      setAnnouncement('Session confirmed and shared with client');
      onStatusChange(updated);
    } catch {
      setError('Failed to share proposal. Please try again.'); // P3
    } finally {
      setConfirming(false);
    }
  }

  function handleModalKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      handleCancel();
      return;
    }
    if (e.key === 'Tab') {
      const focusable = [cancelRef.current, confirmRef.current].filter(
        (el): el is HTMLButtonElement => el !== null,
      );
      if (focusable.length < 2) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  }

  const { status, flag_reason } = session;

  return (
    <>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>

      {/* P4: no aria-live here — sr-only sentinel above handles announcements */}
      {(status === 'pending' || status === 'modified') && (
        <div
          data-testid="staging-banner-draft"
          role="banner"
          className="flex items-center justify-between gap-3 px-4 py-2 text-sm font-medium text-white shrink-0"
          style={{ background: 'var(--status-modified)' }}
        >
          <span>Working draft — not yet shared with client</span>
          <button
            ref={triggerRef}
            data-testid="mark-client-ready-btn"
            onClick={openModal}
            className="text-xs px-3 py-1 rounded border border-white/60 hover:bg-white/10 whitespace-nowrap"
          >
            Mark as client-ready →
          </button>
        </div>
      )}

      {justConfirmed && (
        <div
          data-testid="staging-banner-confirmed"
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white shrink-0"
          style={{ background: 'var(--status-confirmed)' }}
        >
          Shared with client ✓
        </div>
      )}

      {status === 'flagged' && (
        <div
          data-testid="staging-banner-flagged"
          role="alert"
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white shrink-0"
          style={{ background: 'var(--status-flagged)' }}
        >
          <span>Flagged: {flag_reason ?? 'No reason provided'}</span>
        </div>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          data-testid="staging-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCancel();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Confirm sharing proposal"
            aria-describedby="staging-modal-desc"
            data-testid="staging-modal"
            tabIndex={-1}
            onKeyDown={handleModalKeyDown}
            className="bg-surface rounded-lg shadow-xl p-6 w-full max-w-sm mx-4 flex flex-col gap-4"
          >
            <p id="staging-modal-desc" className="text-sm text-text-base">
              Share this proposal with the client? This cannot be undone without editing.
            </p>
            {error && (
              <p role="alert" data-testid="modal-error" className="text-sm" style={{ color: 'var(--status-flagged)' }}>
                {error}
              </p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                ref={cancelRef}
                data-testid="modal-cancel-btn"
                onClick={handleCancel}
                className="text-sm px-4 py-2 rounded border border-border text-text-base hover:bg-surface-2"
              >
                Cancel
              </button>
              <button
                ref={confirmRef}
                data-testid="modal-confirm-btn"
                onClick={handleConfirm}
                aria-disabled={confirming}
                className="text-sm px-4 py-2 rounded text-white"
                style={{ background: 'var(--color-primary)', opacity: confirming ? 0.6 : 1 }}
              >
                {confirming ? 'Confirming…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
