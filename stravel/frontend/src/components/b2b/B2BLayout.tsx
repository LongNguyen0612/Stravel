import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { AdvisorySession } from '../../types/domain';
import { SessionList } from './SessionList';
import { StagingGate } from './StagingGate';

interface B2BLayoutProps {
  sessions: AdvisorySession[];
  activeSessionId?: string;
  onSelectSession: (session: AdvisorySession) => void;
  onToggleMode: () => void;
  activeSession?: AdvisorySession;
  onStatusChange?: (session: AdvisorySession) => void;
  children?: ReactNode;
}

export function B2BLayout({ sessions, activeSessionId, onSelectSession, onToggleMode, activeSession, onStatusChange, children }: B2BLayoutProps) {
  const [overlayOpen, setOverlayOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close overlay on Escape key; move focus into dialog on open
  useEffect(() => {
    if (!overlayOpen) return;
    overlayRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOverlayOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [overlayOpen]);

  function handleSessionSelectFromOverlay(session: AdvisorySession) {
    onSelectSession(session);
    setOverlayOpen(false);
  }

  const rightPanelContent = children ?? (
    <div className="flex items-center justify-center h-full text-text-muted text-sm">
      Select a session to begin
    </div>
  );

  const stagingGate =
    activeSession && onStatusChange ? (
      <StagingGate session={activeSession} onStatusChange={onStatusChange} />
    ) : null;

  const rightPanelWithGate = (
    <div className="flex flex-col h-full overflow-hidden">
      {stagingGate}
      <div className="flex-1 overflow-hidden">{rightPanelContent}</div>
    </div>
  );

  // Session list used in desktop left panel and overlay
  const sessionList = (
    <SessionList
      sessions={sessions}
      activeSessionId={activeSessionId}
      onSelect={handleSessionSelectFromOverlay}
    />
  );

  return (
    <div
      className="theme-b2b h-dvh flex flex-col bg-surface text-text-base overflow-hidden"
      data-testid="b2b-layout"
    >
      {/* AppHeader */}
      <header className="h-14 flex items-center justify-between px-4 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xl" aria-hidden="true">✈️</span>
          <span className="font-bold text-sm text-text-base">STravel Advisory</span>
          <span className="text-xs px-2 py-0.5 rounded bg-primary text-white font-semibold">
            Agent Mode
          </span>
        </div>
        <button
          onClick={onToggleMode}
          className="text-sm text-text-muted border border-border rounded px-3 py-1.5 hover:bg-surface-2"
          data-testid="chat-mode-toggle"
        >
          Chat Mode
        </button>
      </header>

      {/* Desktop ≥1280px — 320px left panel + flex right */}
      <div className="hidden desktop:flex flex-1 overflow-hidden">
        <aside
          className="w-80 shrink-0 border-r border-border overflow-y-auto bg-surface"
          aria-label="Client sessions"
        >
          {sessionList}
        </aside>
        <main className="flex-1 overflow-hidden" data-testid="right-panel-desktop">
          {rightPanelWithGate}
        </main>
      </div>

      {/* Tablet 1024–1279px — 64px icon-rail + flex right */}
      <div className="hidden desktop-sm:flex desktop:hidden flex-1 overflow-hidden relative">
        {/* 64px icon rail */}
        <div
          className="w-16 shrink-0 border-r border-border flex flex-col items-center py-3 gap-3 bg-surface overflow-y-auto"
          aria-label="Session icons"
          data-testid="icon-rail"
        >
          {sessions.length === 0 ? (
            <div
              className="w-10 h-10 rounded-full bg-border"
              aria-label="No sessions"
            />
          ) : (
            sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => setOverlayOpen(true)}
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ background: `var(--status-${session.status})` }}
                aria-label={`Session ${session.id.slice(0, 8)}, status ${session.status}`}
                data-testid={`session-avatar-${session.id}`}
              >
                {session.id.slice(0, 2).toUpperCase()}
              </button>
            ))
          )}
        </div>

        {/* Full session list overlay */}
        {overlayOpen && (
          <div
            ref={overlayRef}
            className="fixed inset-0 z-50 bg-surface overflow-y-auto"
            data-testid="session-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Session list"
            tabIndex={-1}
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <span className="font-semibold text-sm text-text-base">Sessions</span>
              <button
                onClick={() => setOverlayOpen(false)}
                className="text-text-muted text-sm px-3 py-1.5 hover:bg-surface-2 rounded border border-border"
                data-testid="close-overlay"
              >
                ✕ Close
              </button>
            </div>
            {sessionList}
          </div>
        )}

        <main className="flex-1 overflow-hidden" data-testid="right-panel-tablet">
          {rightPanelWithGate}
        </main>
      </div>

      {/* Mobile <1024px — single column */}
      <div
        className="flex desktop-sm:hidden flex-1 flex-col overflow-hidden"
        data-testid="mobile-panel"
      >
        {rightPanelWithGate}
      </div>
    </div>
  );
}
