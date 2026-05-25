interface Props {
  proposal: {
    itinerary?: string;
    accommodation_tables?: Array<{ destination: string; options: Array<{ name: string; price_per_night: number }> }>;
    budget_breakdown?: Array<{ category: string; allocated: number }>;
  } | null;
}

export function ProposalInline({ proposal }: Props) {
  if (!proposal) return null;

  return (
    <div data-testid="proposal-inline" style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "16px", margin: "16px 0" }}>
      <h2>Your Trip Proposal</h2>

      {proposal.itinerary && (
        <details open>
          <summary data-testid="proposal-itinerary-toggle">Itinerary</summary>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: "14px" }}>{proposal.itinerary}</pre>
        </details>
      )}

      {proposal.budget_breakdown && proposal.budget_breakdown.length > 0 && (
        <details>
          <summary data-testid="proposal-budget-toggle">Budget Breakdown</summary>
          <table style={{ width: "100%", marginTop: "8px" }}>
            <thead>
              <tr><th>Category</th><th>Amount</th></tr>
            </thead>
            <tbody>
              {proposal.budget_breakdown.map((item, i) => (
                <tr key={i}><td>{item.category}</td><td>${item.allocated.toFixed(2)}</td></tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}
