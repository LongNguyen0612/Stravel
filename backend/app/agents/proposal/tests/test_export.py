from app.agents.proposal.export import format_proposal_html, generate_pdf_bytes, generate_share_token


def test_generate_share_token():
    token = generate_share_token()
    assert len(token) > 20
    # Tokens should be unique
    token2 = generate_share_token()
    assert token != token2


def test_format_proposal_html_basic():
    content = {
        "itinerary": "Day 1: Visit War Museum",
        "accommodation_tables": [
            {
                "destination": "HCMC",
                "options": [
                    {"name": "Rex Hotel", "price_per_night": 120, "rating": 4.5, "why_it_fits": "Great location"}
                ],
            }
        ],
        "budget_breakdown": [{"category": "accommodation", "allocated": 1200}],
        "booking_actions": [{"item": "Book flights", "priority": 1, "reason": "Prices volatile"}],
    }
    html = format_proposal_html(content)
    assert "<html>" in html
    assert "Rex Hotel" in html
    assert "War Museum" in html
    assert "Book flights" in html
    assert "accommodation" in html


def test_format_proposal_html_empty():
    html = format_proposal_html({})
    assert "<html>" in html
    assert "STravel" in html


def test_generate_pdf_fallback():
    """Without WeasyPrint installed, falls back to HTML bytes."""
    html = "<html><body>Test</body></html>"
    result = generate_pdf_bytes(html)
    assert len(result) > 0
    # Either PDF bytes or HTML bytes
    assert b"Test" in result or result[:4] == b"%PDF"
