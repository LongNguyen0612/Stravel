import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const CONFIDENCE_THRESHOLD = 0.85;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const OCR_TIMEOUT_MS = 30_000;

// P3: guard against null/empty/malformed input
function formatDateForDisplay(iso) {
    if (!iso || !DATE_REGEX.test(iso)) return iso;
    const [year, month, day] = iso.split('-');
    return `${day}/${month}/${year}`;
}

export function PassportUploadCard({ slotKey, onSelect, onSkip, className }) {
    const [uploadState, setUploadState] = useState('idle');
    const [extractedDate, setExtractedDate] = useState(null);
    const [manualInput, setManualInput] = useState('');
    const [uploadError, setUploadError] = useState(null);
    const [manualInputError, setManualInputError] = useState(null);
    // P5: aria-live announcement for screen readers
    const [statusAnnouncement, setStatusAnnouncement] = useState('');
    // P7: prevent double-fire of Yes
    const yesSubmittedRef = useRef(false);

    const takePhotoRef = useRef(null);
    const uploadPhotoRef = useRef(null);
    const manualInputRef = useRef(null);

    useEffect(() => {
        if (uploadState === 'manual') {
            if (manualInputRef.current) manualInputRef.current.focus();
        }
    }, [uploadState]);

    // P1 + P6: check res.ok and add AbortController timeout
    async function handleFileUpload(file) {
        setUploadState('uploading');
        setUploadError(null);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await fetch('/api/v1/passport/extract-expiry', {
                method: 'POST',
                body: fd,
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!res.ok) throw new Error(`OCR request failed: ${res.status}`);
            const data = await res.json();
            const success =
                !data.fallback_required &&
                data.confidence >= CONFIDENCE_THRESHOLD &&
                data.expiry_date !== null;
            if (success) {
                setExtractedDate(data.expiry_date);
                setUploadState('confirm');
                // P5: announce result
                setStatusAnnouncement(`Passport date detected: ${formatDateForDisplay(data.expiry_date)}. Is this correct?`);
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
    function handleInputChange(e) {
        if (uploadState === 'uploading') return;
        const file = e.target.files && e.target.files[0];
        if (file) handleFileUpload(file);
        e.target.value = '';
    }

    // P2: guard against concurrent uploads via drag-drop
    function handleDrop(e) {
        e.preventDefault();
        if (uploadState === 'uploading') return;
        const file = e.dataTransfer.files[0];
        if (file) handleFileUpload(file);
    }

    function handleDragOver(e) {
        e.preventDefault();
    }

    function handleZoneKeyDown(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (uploadPhotoRef.current) uploadPhotoRef.current.click();
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

    return _jsxs("div", {
        className: cn('flex flex-col gap-3', className),
        children: [
            // P5: sr-only live region
            _jsx("div", {
                role: "status",
                "aria-live": "polite",
                "aria-atomic": "true",
                style: { position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' },
                children: statusAnnouncement
            }),

            // Hidden file inputs
            _jsx("input", {
                ref: takePhotoRef,
                type: "file",
                accept: "image/*",
                capture: "environment",
                hidden: true,
                onChange: handleInputChange,
                "data-testid": "take-photo-input"
            }),
            _jsx("input", {
                ref: uploadPhotoRef,
                type: "file",
                accept: "image/jpeg,image/png,image/webp",
                hidden: true,
                onChange: handleInputChange,
                "data-testid": "upload-photo-input"
            }),

            // Idle state
            uploadState === 'idle' && _jsxs("div", {
                children: [
                    _jsxs("div", {
                        role: "button",
                        tabIndex: 0,
                        "aria-label": "Upload passport photo",
                        className: zoneClass,
                        onDrop: handleDrop,
                        onDragOver: handleDragOver,
                        onKeyDown: handleZoneKeyDown,
                        onClick: () => { if (uploadPhotoRef.current) uploadPhotoRef.current.click(); },
                        children: [
                            _jsx("span", { className: "text-3xl", "aria-hidden": "true", children: "📷" }),
                            _jsx("p", {
                                className: "text-sm text-text-muted text-center",
                                children: "Drop your passport photo here, or use the buttons below"
                            })
                        ]
                    }),
                    _jsxs("div", {
                        className: "flex gap-2 justify-center flex-wrap mt-2",
                        children: [
                            _jsx("button", {
                                type: "button",
                                onClick: () => { if (takePhotoRef.current) takePhotoRef.current.click(); },
                                className: btnClass,
                                children: "Take photo"
                            }),
                            _jsx("button", {
                                type: "button",
                                onClick: () => { if (uploadPhotoRef.current) uploadPhotoRef.current.click(); },
                                className: outlineBtnClass,
                                children: "Upload photo"
                            })
                        ]
                    })
                ]
            }),

            // Uploading state
            uploadState === 'uploading' && _jsxs("div", {
                className: "flex flex-col items-center justify-center gap-2 p-6 rounded-lg bg-teal-50",
                "aria-busy": "true",
                "aria-label": "Reading passport…",
                children: [
                    _jsx("div", { className: "h-4 w-32 rounded bg-teal-200 animate-pulse", "aria-hidden": "true" }),
                    _jsx("div", { className: "h-3 w-24 rounded bg-teal-100 animate-pulse", "aria-hidden": "true" }),
                    _jsx("p", { className: "text-sm text-text-muted sr-only", children: "Reading passport…" })
                ]
            }),

            // Confirm state
            uploadState === 'confirm' && extractedDate && _jsxs("div", {
                className: "flex flex-col gap-3 items-center",
                children: [
                    _jsx("p", { className: "text-sm text-text-muted", children: "Is this correct?" }),
                    _jsx("p", {
                        className: "text-lg font-semibold text-teal-700",
                        children: formatDateForDisplay(extractedDate)
                    }),
                    _jsxs("div", {
                        className: "flex gap-2",
                        children: [
                            _jsx("button", { type: "button", onClick: handleYes, className: btnClass, children: "Yes" }),
                            _jsx("button", { type: "button", onClick: handleNo, className: outlineBtnClass, children: "No" })
                        ]
                    })
                ]
            }),

            // Manual state
            uploadState === 'manual' && _jsxs("div", {
                className: "flex flex-col gap-3",
                children: [
                    uploadError
                        ? _jsx("p", { className: "text-sm text-amber-700", children: uploadError })
                        : _jsx("p", {
                            className: "text-sm text-text-muted",
                            children: "I couldn't read the date clearly — please enter it manually"
                        }),
                    _jsx("input", {
                        ref: manualInputRef,
                        type: "text",
                        placeholder: "YYYY-MM-DD",
                        value: manualInput,
                        onChange: (e) => { setManualInput(e.target.value); setManualInputError(null); },
                        "aria-label": "Passport expiry date",
                        "aria-describedby": manualInputError ? "passport-date-error" : undefined,
                        className: cn(
                            'w-full px-3 py-2 border rounded-lg text-sm',
                            manualInputError ? 'border-red-400' : 'border-slate-300',
                            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'
                        )
                    }),
                    // P4: inline format validation error
                    manualInputError && _jsx("p", {
                        id: "passport-date-error",
                        className: "text-sm text-red-600",
                        role: "alert",
                        children: manualInputError
                    }),
                    _jsx("button", {
                        type: "button",
                        onClick: handleManualSubmit,
                        disabled: !manualInput,
                        className: cn(btnClass, 'self-center', !manualInput && 'opacity-50 cursor-not-allowed'),
                        children: "Confirm date"
                    })
                ]
            }),

            // Skip link
            uploadState !== 'uploading' && _jsx("button", {
                type: "button",
                onClick: () => onSkip({ slotKey }),
                className: "text-sm text-text-muted underline self-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded",
                children: "Skip"
            })
        ]
    });
}
