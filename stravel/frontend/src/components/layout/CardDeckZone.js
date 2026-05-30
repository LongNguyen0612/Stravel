import { jsx as _jsx } from "react/jsx-runtime";
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
export const CardDeckZone = forwardRef(function CardDeckZone({ chatInputHeight, children, className }, ref) {
    return (_jsx("div", { ref: ref, className: cn('fixed left-0 right-0 w-full', className), style: { bottom: `${chatInputHeight}px` }, children: children }));
});
