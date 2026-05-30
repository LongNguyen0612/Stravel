# ARIA Patterns Reference

Canonical patterns for accessibility in STravel components. Established through Phase 2 (Epics 7–10).
Point story Dev Notes here instead of re-explaining these patterns per-story.

---

## 1. Live Region Announcements — Dual Sentinel

**Rule:** Use two always-in-DOM sentinels rather than a single sentinel with a dynamic `aria-live` attribute.

**Why:** Dynamically changing `aria-live` from `polite` to `assertive` (or vice versa) on the same element is not reliably re-announced by screen readers. AT reads the `aria-live` value at mount time.

```tsx
{/* Always in DOM — never conditionally rendered */}
<div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
  {politeAnnouncement}
</div>
<div role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">
  {assertiveAnnouncement}
</div>
```

**Pattern for state-driven announcements:**
```tsx
const [politeMsg, setPoliteMsg] = useState('');
const [assertiveMsg, setAssertiveMsg] = useState('');

// On success → polite
setPoliteMsg('Session confirmed and shared with client');

// On error → assertive
setAssertiveMsg('Failed to load. Please try again.');

// Clear after AT reads (optional — AT reads once on content change)
```

**Established:** Story 7.7 (`aria-live` state machine)
**Used in:** Stories 9.10 (compliance badges), 10.5 (StagingGate announcements)

---

## 2. Focus Trap in Modals

**Rule:** Trap Tab/Shift+Tab between the first and last focusable elements using `onKeyDown` on the modal container.

```tsx
const cancelRef = useRef<HTMLButtonElement>(null);
const confirmRef = useRef<HTMLButtonElement>(null);

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

// Apply to the modal overlay div:
<div role="dialog" aria-modal="true" onKeyDown={handleModalKeyDown} tabIndex={-1}>
```

**Established:** Story 10.5 (StagingGate confirmation modal)

---

## 3. `aria-disabled` vs `disabled` for In-Flight Buttons

**Rule:** Use `aria-disabled={true}` + onClick guard instead of `disabled={true}` when a button must remain in the tab order (e.g., inside a focus trap during an async operation).

**Why:** `disabled` removes the element from the tab order entirely. Inside a focus trap, this breaks cycling — Tab escapes the modal or Shift+Tab dead-ends.

```tsx
// ❌ WRONG — breaks focus trap when confirming
<button disabled={confirming} onClick={handleConfirm}>
  Confirm
</button>

// ✅ CORRECT — stays in tab order, onClick guard prevents double-submit
<button
  aria-disabled={confirming}
  onClick={handleConfirm}
  style={{ opacity: confirming ? 0.6 : 1 }}
>
  {confirming ? 'Confirming…' : 'Confirm'}
</button>

// In the handler:
async function handleConfirm() {
  if (confirming) return; // guard for aria-disabled pattern
  setConfirming(true);
  // ...
}
```

**Note:** `aria-disabled` doesn't prevent click by itself — the onClick guard is required.

**Established:** Story 10.5 code review patch P1

---

## 4. Focus Restoration — triggerRef Pattern

**Rule:** Store a ref to the button that opened a modal/dialog. Restore focus to it on cancel/close.

**Why:** After a modal closes, focus must return to a logical point in the page — typically the element that triggered the modal (WCAG 2.1 SC 2.4.3).

```tsx
const triggerRef = useRef<HTMLButtonElement>(null);
const cancelRef = useRef<HTMLButtonElement>(null);

// Move focus to Cancel when modal opens (safe default — UX-DR18)
useEffect(() => {
  if (modalOpen) {
    cancelRef.current?.focus();
  }
}, [modalOpen]);

// Restore focus to trigger on cancel
function handleCancel() {
  if (confirming) return; // guard if async in-flight
  setModalOpen(false);
  triggerRef.current?.focus(); // synchronous focus restoration
}

// Wire refs:
<button ref={triggerRef} onClick={() => setModalOpen(true)}>
  Open dialog
</button>

// Inside modal:
<button ref={cancelRef} onClick={handleCancel}>Cancel</button>
```

**UX-DR18 rule:** Focus defaults to "Cancel" (safe action) on modal open, not "Confirm" (destructive action).

**Established:** Story 10.5 (StagingGate modal)

---

## 5. `aria-describedby` on Dialogs

**Rule:** Always link a dialog's description paragraph to the `role="dialog"` element via `aria-describedby`.

**Why:** Without `aria-describedby`, screen readers may not read the description automatically when focus enters the dialog.

```tsx
<div
  role="dialog"
  aria-modal="true"
  aria-label="Confirm sharing proposal"
  aria-describedby="my-modal-desc"  // ← link description
>
  <p id="my-modal-desc">           // ← give description an id
    Share this proposal with the client? This cannot be undone without editing.
  </p>
  <button>Cancel</button>
  <button>Confirm</button>
</div>
```

**Note:** `aria-label` names the dialog (short). `aria-describedby` provides the fuller context paragraph. Both serve different AT roles.

**Established:** Story 10.5 code review patch P5

---

## 6. `role` Landmark Usage — What NOT to Use in Sub-Components

**Rule:** ARIA landmark roles (`banner`, `main`, `navigation`, `complementary`, `contentinfo`) are page-level landmarks. Do not use them on sub-components.

| Role | Correct use | Wrong use |
|------|------------|-----------|
| `role="banner"` | Top-level `<header>` of the page | A status banner component inside a panel |
| `role="main"` | The primary `<main>` content area | A content region inside a component |
| `role="navigation"` | Site-wide nav | A component's internal tab list |

**For component-level banners and notices, use:**
```tsx
// Informational notice — no landmark role
<div aria-live="polite">...</div>

// Error/alert — use role="alert" (not a landmark, announces immediately)
<div role="alert">Error: {message}</div>

// Status update — use role="status" (polite, in sr-only sentinel)
<div role="status" aria-live="polite" className="sr-only">{announcement}</div>

// Labeled region — use role="region" with aria-label
<div role="region" aria-label="Draft warning">...</div>
```

**Note (Phase 2 known issue):** `StagingGate.tsx` uses `role="banner"` on the draft banner per AC1's spec. This is a documented ARIA misuse (D5 in deferred-work.md) — it creates a spurious landmark but was spec-prescribed and deferred.

**Established:** Story 10.5 code review defer D5

---

## 7. Guard Async Modal Cancel

**Rule:** Do not allow modal cancel/close while an async operation is in-flight.

**Why:** If the modal closes while `fetch` is still running, the resolved success state (`setJustConfirmed(true)`, `onStatusChange(updated)`) still fires — causing a success banner the user did not intend.

```tsx
function handleCancel() {
  if (confirming) return; // ← guard
  setModalOpen(false);
  triggerRef.current?.focus();
}

// Also guard backdrop click:
onClick={(e) => {
  if (e.target === e.currentTarget) handleCancel(); // handleCancel checks confirming internally
}}

// And Escape key via handleModalKeyDown → handleCancel
```

**Established:** Story 10.5 code review patch P2

---

## 8. Error State in Modal (API Failure)

**Rule:** Never use an empty `catch` block in async confirm handlers. Show a `role="alert"` error message inside the modal.

```tsx
const [error, setError] = useState<string | null>(null);

async function handleConfirm() {
  if (confirming) return;
  setConfirming(true);
  setError(null);
  try {
    const updated = await api.sessions.updateStatus(session.id, 'confirmed');
    setModalOpen(false);
    setJustConfirmed(true);
    onStatusChange(updated);
  } catch {
    setError('Failed to share proposal. Please try again.');
  } finally {
    setConfirming(false);
  }
}

// In modal JSX:
{error && (
  <p role="alert" data-testid="modal-error" style={{ color: 'var(--status-flagged)' }}>
    {error}
  </p>
)}
```

**Pattern:** Modal stays open on error (user can retry). Error cleared on modal reopen (`setError(null)` in `openModal()`).

**Established:** Story 10.5 code review patch P3

---

## 9. Detecting Status Transitions for Announcements

**Rule:** Use `useRef` to track previous prop values and announce only on meaningful transitions.

```tsx
const prevStatusRef = useRef<string>(session.status);

useEffect(() => {
  if (prevStatusRef.current === 'confirmed' && session.status === 'modified') {
    setAnnouncement('Session returned to draft');
  }
  prevStatusRef.current = session.status;
}, [session.status]);
```

**Why useRef not useState:** We don't want a re-render when the previous value changes — just a mutable container to compare against.

**Note:** This fires only on the `confirmed → modified` transition, not on initial render (because `prevStatusRef` is initialized to the current status).

**Established:** Story 10.5 (AC7 announcement pattern)

---

## Quick Reference

| Pattern | Key rule | Established |
|---------|----------|-------------|
| Dual sentinel | Two always-in-DOM elements, one polite + one assertive | 7.7 |
| Focus trap | `onKeyDown` Tab/Shift+Tab on modal div | 10.5 |
| `aria-disabled` vs `disabled` | Use `aria-disabled` inside focus traps; add onClick guard | 10.5 |
| triggerRef | Store trigger button ref, restore focus on cancel | 10.5 |
| `aria-describedby` | Always link dialog description paragraph | 10.5 |
| Landmark roles | Never use `banner`/`main`/`navigation` in sub-components | 10.5 |
| Async cancel guard | Check `confirming` in cancel handler | 10.5 |
| Error state | `role="alert"` error in modal, never empty catch | 10.5 |
| Transition announcements | `useRef` for previous value, announce only on specific transitions | 10.5 |
