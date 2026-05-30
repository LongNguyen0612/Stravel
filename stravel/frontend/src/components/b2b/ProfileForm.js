import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
const DESTINATIONS = ["Hanoi", "Ho Chi Minh City", "Da Nang", "Hoi An", "Phu Quoc", "Hue", "Nha Trang", "Ha Long Bay", "Sapa", "Mekong Delta"];
const ACTIVITIES = ["Culture & History", "Adventure", "Food & Dining", "Beach & Relaxation", "Trekking", "Scuba Diving", "City Exploration", "Photography"];
const DIETARY = ["Vegetarian", "Vegan", "Halal", "Kosher", "Gluten-free", "No restrictions"];
const ACCESSIBILITY = ["Wheelchair access", "Elevator required", "Limited walking", "No restrictions"];
const inputStyle = {
    width: "100%",
    padding: "8px 10px",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontSize: "14px",
    boxSizing: "border-box",
};
const labelStyle = {
    display: "block",
    fontSize: "13px",
    fontWeight: 500,
    color: "#374151",
    marginBottom: "4px",
};
const fieldStyle = { marginBottom: "16px" };
const sectionStyle = {
    marginBottom: "24px",
    paddingBottom: "20px",
    borderBottom: "1px solid #f3f4f6",
};
const sectionTitleStyle = {
    fontSize: "13px",
    fontWeight: 600,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: "14px",
};
export function ProfileForm({ profile, onSave }) {
    const [form, setForm] = useState({
        traveler_count: profile.traveler_count ?? 1,
        nationalities: profile.nationalities?.join(", ") ?? "",
        travel_start_date: profile.travel_start_date ?? "",
        travel_end_date: profile.travel_end_date ?? "",
        date_flexibility: profile.date_flexibility ?? "fixed",
        budget_total: profile.budget_total ?? "",
        budget_currency: profile.budget_currency ?? "USD",
        destination_preferences: profile.destination_preferences ?? [],
        accommodation_style: profile.accommodation_style ?? "mid-range",
        dietary_requirements: profile.dietary_requirements ?? [],
        accessibility_needs: profile.accessibility_needs ?? [],
        activity_preferences: profile.activity_preferences ?? [],
        special_interests: profile.special_interests?.join(", ") ?? "",
        passport_expiry_date: profile.passport_expiry_date ?? "",
    });
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    function toggle(key, value) {
        setForm((f) => {
            const current = f[key];
            return {
                ...f,
                [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
            };
        });
    }
    async function handleSubmit(e) {
        e.preventDefault();
        setSaving(true);
        try {
            await onSave({
                traveler_count: Number(form.traveler_count),
                nationalities: form.nationalities ? form.nationalities.split(",").map((s) => s.trim()).filter(Boolean) : [],
                travel_start_date: form.travel_start_date || null,
                travel_end_date: form.travel_end_date || null,
                date_flexibility: form.date_flexibility,
                budget_total: form.budget_total ? Number(form.budget_total) : null,
                budget_currency: form.budget_currency,
                destination_preferences: form.destination_preferences,
                accommodation_style: form.accommodation_style,
                dietary_requirements: form.dietary_requirements,
                accessibility_needs: form.accessibility_needs,
                activity_preferences: form.activity_preferences,
                special_interests: form.special_interests ? form.special_interests.split(",").map((s) => s.trim()).filter(Boolean) : [],
                passport_expiry_date: form.passport_expiry_date || null,
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        }
        finally {
            setSaving(false);
        }
    }
    return (_jsxs("form", { onSubmit: handleSubmit, style: { fontSize: "14px" }, children: [_jsxs("div", { style: sectionStyle, children: [_jsx("div", { style: sectionTitleStyle, children: "Travelers" }), _jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }, children: [_jsxs("div", { style: fieldStyle, children: [_jsx("label", { style: labelStyle, children: "Number of travelers" }), _jsx("input", { type: "number", min: 1, max: 50, value: form.traveler_count, onChange: (e) => setForm((f) => ({ ...f, traveler_count: Number(e.target.value) })), style: inputStyle })] }), _jsxs("div", { style: fieldStyle, children: [_jsx("label", { style: labelStyle, children: "Nationalities" }), _jsx("input", { type: "text", placeholder: "e.g. German, Australian", value: form.nationalities, onChange: (e) => setForm((f) => ({ ...f, nationalities: e.target.value })), style: inputStyle })] })] }), _jsxs("div", { style: fieldStyle, children: [_jsx("label", { style: labelStyle, children: "Passport expiry date" }), _jsx("input", { type: "date", value: form.passport_expiry_date, onChange: (e) => setForm((f) => ({ ...f, passport_expiry_date: e.target.value })), style: { ...inputStyle, width: "50%" } })] })] }), _jsxs("div", { style: sectionStyle, children: [_jsx("div", { style: sectionTitleStyle, children: "Dates & Budget" }), _jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }, children: [_jsxs("div", { style: fieldStyle, children: [_jsx("label", { style: labelStyle, children: "Start date" }), _jsx("input", { type: "date", value: form.travel_start_date, onChange: (e) => setForm((f) => ({ ...f, travel_start_date: e.target.value })), style: inputStyle })] }), _jsxs("div", { style: fieldStyle, children: [_jsx("label", { style: labelStyle, children: "End date" }), _jsx("input", { type: "date", value: form.travel_end_date, onChange: (e) => setForm((f) => ({ ...f, travel_end_date: e.target.value })), style: inputStyle })] })] }), _jsxs("div", { style: fieldStyle, children: [_jsx("label", { style: labelStyle, children: "Date flexibility" }), _jsxs("select", { value: form.date_flexibility, onChange: (e) => setForm((f) => ({ ...f, date_flexibility: e.target.value })), style: inputStyle, children: [_jsx("option", { value: "fixed", children: "Fixed dates" }), _jsx("option", { value: "flexible_1w", children: "Flexible \u00B11 week" }), _jsx("option", { value: "flexible_2w", children: "Flexible \u00B12 weeks" }), _jsx("option", { value: "open", children: "Fully open" })] })] }), _jsxs("div", { style: { display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px" }, children: [_jsxs("div", { style: fieldStyle, children: [_jsx("label", { style: labelStyle, children: "Total budget" }), _jsx("input", { type: "number", min: 0, placeholder: "e.g. 3000", value: form.budget_total, onChange: (e) => setForm((f) => ({ ...f, budget_total: e.target.value })), style: inputStyle })] }), _jsxs("div", { style: fieldStyle, children: [_jsx("label", { style: labelStyle, children: "Currency" }), _jsxs("select", { value: form.budget_currency, onChange: (e) => setForm((f) => ({ ...f, budget_currency: e.target.value })), style: inputStyle, children: [_jsx("option", { value: "USD", children: "USD" }), _jsx("option", { value: "EUR", children: "EUR" }), _jsx("option", { value: "GBP", children: "GBP" }), _jsx("option", { value: "AUD", children: "AUD" }), _jsx("option", { value: "VND", children: "VND" })] })] })] })] }), _jsxs("div", { style: sectionStyle, children: [_jsx("div", { style: sectionTitleStyle, children: "Destinations" }), _jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: "8px" }, children: DESTINATIONS.map((dest) => (_jsx("button", { type: "button", onClick: () => toggle("destination_preferences", dest), style: {
                                padding: "6px 12px",
                                borderRadius: "20px",
                                fontSize: "13px",
                                border: "1px solid",
                                background: form.destination_preferences.includes(dest) ? "#2563eb" : "#fff",
                                color: form.destination_preferences.includes(dest) ? "#fff" : "#374151",
                                borderColor: form.destination_preferences.includes(dest) ? "#2563eb" : "#d1d5db",
                                cursor: "pointer",
                            }, children: dest }, dest))) })] }), _jsxs("div", { style: sectionStyle, children: [_jsx("div", { style: sectionTitleStyle, children: "Preferences" }), _jsxs("div", { style: fieldStyle, children: [_jsx("label", { style: labelStyle, children: "Accommodation style" }), _jsxs("select", { value: form.accommodation_style, onChange: (e) => setForm((f) => ({ ...f, accommodation_style: e.target.value })), style: inputStyle, children: [_jsx("option", { value: "budget", children: "Budget (hostels, guesthouses)" }), _jsx("option", { value: "mid-range", children: "Mid-range (3-star hotels)" }), _jsx("option", { value: "luxury", children: "Luxury (4-5 star, resorts)" })] })] }), _jsxs("div", { style: fieldStyle, children: [_jsx("label", { style: labelStyle, children: "Activity preferences" }), _jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: "8px" }, children: ACTIVITIES.map((act) => (_jsx("button", { type: "button", onClick: () => toggle("activity_preferences", act), style: {
                                        padding: "6px 12px",
                                        borderRadius: "20px",
                                        fontSize: "13px",
                                        border: "1px solid",
                                        background: form.activity_preferences.includes(act) ? "#059669" : "#fff",
                                        color: form.activity_preferences.includes(act) ? "#fff" : "#374151",
                                        borderColor: form.activity_preferences.includes(act) ? "#059669" : "#d1d5db",
                                        cursor: "pointer",
                                    }, children: act }, act))) })] }), _jsxs("div", { style: fieldStyle, children: [_jsx("label", { style: labelStyle, children: "Special interests" }), _jsx("input", { type: "text", placeholder: "e.g. Photography, Cooking classes, Temples", value: form.special_interests, onChange: (e) => setForm((f) => ({ ...f, special_interests: e.target.value })), style: inputStyle })] })] }), _jsxs("div", { style: sectionStyle, children: [_jsx("div", { style: sectionTitleStyle, children: "Special Needs" }), _jsxs("div", { style: fieldStyle, children: [_jsx("label", { style: labelStyle, children: "Dietary requirements" }), _jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: "8px" }, children: DIETARY.map((diet) => (_jsx("button", { type: "button", onClick: () => toggle("dietary_requirements", diet), style: {
                                        padding: "6px 12px",
                                        borderRadius: "20px",
                                        fontSize: "13px",
                                        border: "1px solid",
                                        background: form.dietary_requirements.includes(diet) ? "#7c3aed" : "#fff",
                                        color: form.dietary_requirements.includes(diet) ? "#fff" : "#374151",
                                        borderColor: form.dietary_requirements.includes(diet) ? "#7c3aed" : "#d1d5db",
                                        cursor: "pointer",
                                    }, children: diet }, diet))) })] }), _jsxs("div", { style: fieldStyle, children: [_jsx("label", { style: labelStyle, children: "Accessibility needs" }), _jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: "8px" }, children: ACCESSIBILITY.map((acc) => (_jsx("button", { type: "button", onClick: () => toggle("accessibility_needs", acc), style: {
                                        padding: "6px 12px",
                                        borderRadius: "20px",
                                        fontSize: "13px",
                                        border: "1px solid",
                                        background: form.accessibility_needs.includes(acc) ? "#dc2626" : "#fff",
                                        color: form.accessibility_needs.includes(acc) ? "#fff" : "#374151",
                                        borderColor: form.accessibility_needs.includes(acc) ? "#dc2626" : "#d1d5db",
                                        cursor: "pointer",
                                    }, children: acc }, acc))) })] })] }), _jsx("button", { type: "submit", disabled: saving, style: {
                    width: "100%",
                    padding: "12px",
                    background: saved ? "#059669" : "#2563eb",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "15px",
                    fontWeight: 600,
                    cursor: "pointer",
                }, children: saving ? "Saving..." : saved ? "Saved!" : "Save Profile" })] }));
}
