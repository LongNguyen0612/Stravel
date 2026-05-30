import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PassportUploadCard } from '../PassportUploadCard';

const SLOT_KEY = 'passport_expiry' as const;

function makeFile(name = 'passport.jpg', type = 'image/jpeg') {
  return new File(['data'], name, { type });
}

function mockFetchSuccess(expiryDate = '2027-06-30', confidence = 0.9) {
  vi.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ expiry_date: expiryDate, confidence, fallback_required: false }),
  } as Response);
}

function mockFetchFallback() {
  vi.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ expiry_date: null, confidence: 0.5, fallback_required: true }),
  } as Response);
}

function mockFetchNetworkError() {
  vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));
}

async function uploadFile(file: File) {
  const inputs = document.querySelectorAll('input[type="file"]');
  const uploadInput = inputs[1] as HTMLInputElement; // second input = upload (no capture)
  await act(async () => {
    fireEvent.change(uploadInput, { target: { files: [file] } });
  });
  await act(async () => {}); // flush fetch microtask
}

describe('PassportUploadCard — AC1: renders upload affordances', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('renders upload zone with role="button" and aria-label', () => {
    render(<PassportUploadCard slotKey={SLOT_KEY} onSelect={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Upload passport photo/i })).toBeInTheDocument();
  });

  it('renders "Take photo" button', () => {
    render(<PassportUploadCard slotKey={SLOT_KEY} onSelect={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Take photo/i })).toBeInTheDocument();
  });

  it('renders "Upload photo" button', () => {
    render(<PassportUploadCard slotKey={SLOT_KEY} onSelect={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Upload photo/i })).toBeInTheDocument();
  });

  it('renders Skip link in idle state', () => {
    render(<PassportUploadCard slotKey={SLOT_KEY} onSelect={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Skip/i })).toBeInTheDocument();
  });
});

describe('PassportUploadCard — AC2: file selection triggers OCR', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('AC2b: OCR success → confirm state with date in DD/MM/YYYY format', async () => {
    mockFetchSuccess('2027-06-30', 0.9);
    render(<PassportUploadCard slotKey={SLOT_KEY} onSelect={vi.fn()} onSkip={vi.fn()} />);
    await uploadFile(makeFile());
    expect(screen.getByText('30/06/2027')).toBeInTheDocument();
    // aria-live region also carries this text, so use getAllByText
    expect(screen.getAllByText(/Is this correct\?/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /^Yes$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^No$/i })).toBeInTheDocument();
  });

  it('AC2c: fallback_required → manual state with text input', async () => {
    mockFetchFallback();
    render(<PassportUploadCard slotKey={SLOT_KEY} onSelect={vi.fn()} onSkip={vi.fn()} />);
    await uploadFile(makeFile());
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    // aria-live region also carries this text, so use getAllByText
    expect(screen.getAllByText(/couldn't read/i).length).toBeGreaterThan(0);
  });

  it('AC2c: low confidence also triggers fallback', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ expiry_date: '2027-06-30', confidence: 0.5, fallback_required: false }),
    } as Response);
    render(<PassportUploadCard slotKey={SLOT_KEY} onSelect={vi.fn()} onSkip={vi.fn()} />);
    await uploadFile(makeFile());
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });
});

describe('PassportUploadCard — AC3: Yes chip', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('Yes calls onSelect with YYYY-MM-DD value', async () => {
    mockFetchSuccess('2027-06-30', 0.9);
    const onSelect = vi.fn();
    render(<PassportUploadCard slotKey={SLOT_KEY} onSelect={onSelect} onSkip={vi.fn()} />);
    await uploadFile(makeFile());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Yes$/i })); });
    expect(onSelect).toHaveBeenCalledWith({ slotKey: SLOT_KEY, value: '2027-06-30' });
  });
});

describe('PassportUploadCard — AC4: No chip', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('No transitions to manual state with input pre-filled', async () => {
    mockFetchSuccess('2027-06-30', 0.9);
    render(<PassportUploadCard slotKey={SLOT_KEY} onSelect={vi.fn()} onSkip={vi.fn()} />);
    await uploadFile(makeFile());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^No$/i })); });
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe('2027-06-30');
  });
});

describe('PassportUploadCard — AC5: Skip', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('Skip calls onSkip with slotKey', () => {
    const onSkip = vi.fn();
    render(<PassportUploadCard slotKey={SLOT_KEY} onSelect={vi.fn()} onSkip={onSkip} />);
    fireEvent.click(screen.getByRole('button', { name: /Skip/i }));
    expect(onSkip).toHaveBeenCalledWith({ slotKey: SLOT_KEY });
  });
});

describe('PassportUploadCard — AC6: keyboard accessibility', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('upload zone has role="button" and aria-label="Upload passport photo"', () => {
    render(<PassportUploadCard slotKey={SLOT_KEY} onSelect={vi.fn()} onSkip={vi.fn()} />);
    const zone = screen.getByRole('button', { name: 'Upload passport photo' });
    expect(zone).toBeInTheDocument();
    expect(zone).toHaveAttribute('tabindex', '0');
  });
});

describe('PassportUploadCard — error handling', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('network error → manual state with error message', async () => {
    mockFetchNetworkError();
    render(<PassportUploadCard slotKey={SLOT_KEY} onSelect={vi.fn()} onSkip={vi.fn()} />);
    await uploadFile(makeFile());
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByText(/went wrong/i)).toBeInTheDocument();
  });
});

describe('PassportUploadCard — manual state submit', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('manual input submit calls onSelect with typed value', async () => {
    mockFetchFallback();
    const onSelect = vi.fn();
    render(<PassportUploadCard slotKey={SLOT_KEY} onSelect={onSelect} onSkip={vi.fn()} />);
    await uploadFile(makeFile());
    const input = screen.getByRole('textbox');
    await act(async () => {
      fireEvent.change(input, { target: { value: '2028-03-15' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm date/i }));
    });
    expect(onSelect).toHaveBeenCalledWith({ slotKey: SLOT_KEY, value: '2028-03-15' });
  });
});
