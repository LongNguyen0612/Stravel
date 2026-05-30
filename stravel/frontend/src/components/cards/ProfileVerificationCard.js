import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from '@/lib/utils';

export function ProfileVerificationCard({ items, onConfirm, onEdit, className }) {
  return _jsx("div", {
    "data-testid": "profile-verification-card",
    className: cn('rounded-2xl border border-border bg-surface p-4 shadow-sm', className),
    children: _jsxs("div", {
      children: [
        _jsx("ul", {
          role: "list",
          className: "mb-4 space-y-2",
          children: items.map((item) =>
            _jsxs("li", {
              role: "listitem",
              className: "flex items-center gap-2 text-sm",
              children: [
                _jsx("span", { "aria-hidden": "true", children: item.icon }),
                _jsxs("span", { className: "font-medium text-text-base", children: [item.label, ":"] }),
                _jsx("span", { className: "text-text-muted", children: item.value }),
              ],
            }, item.label)
          ),
        }),
        _jsxs("div", {
          className: "flex flex-col gap-2 sm:flex-row",
          children: [
            _jsx("button", {
              type: "button",
              onClick: onConfirm,
              className: "min-h-[44px] flex-1 rounded-full bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2",
              children: "Looks good — build my trip!",
            }),
            _jsx("button", {
              type: "button",
              onClick: onEdit,
              className: "min-h-[44px] flex-1 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-text-base hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              children: "Edit something",
            }),
          ],
        }),
      ],
    }),
  });
}
