import structlog

from app.agents.calculation.schemas import OptimizedRoute, Routeleg

logger = structlog.get_logger()

# Vietnam transport network: (from, to) -> [(mode, cost_usd, hours)]
TRANSPORT_NETWORK: dict[tuple[str, str], list[tuple[str, float, float]]] = {
    ("hanoi", "halong"): [("bus", 15, 4), ("car", 50, 3.5)],
    ("hanoi", "sapa"): [("bus", 20, 6), ("train", 35, 8)],
    ("hanoi", "danang"): [("flight", 60, 1.5), ("train", 30, 16)],
    ("hanoi", "hue"): [("flight", 55, 1.3), ("train", 25, 13)],
    ("hanoi", "hcmc"): [("flight", 70, 2), ("train", 40, 30)],
    ("hanoi", "ninhbinh"): [("bus", 10, 2)],
    ("danang", "hoian"): [("bus", 5, 1), ("taxi", 15, 0.7)],
    ("danang", "hue"): [("bus", 8, 3), ("train", 10, 2.5)],
    ("danang", "nhatrang"): [("flight", 50, 1), ("bus", 20, 10)],
    ("danang", "hcmc"): [("flight", 55, 1.3)],
    ("hcmc", "phuquoc"): [("flight", 50, 1)],
    ("hcmc", "dalat"): [("bus", 15, 7), ("flight", 45, 1)],
    ("hcmc", "nhatrang"): [("flight", 45, 1), ("bus", 15, 9)],
    ("hcmc", "mekong"): [("bus", 10, 3)],
    ("hcmc", "phanthiet"): [("bus", 10, 4)],
    ("hue", "hoian"): [("bus", 8, 3)],
    ("nhatrang", "dalat"): [("bus", 10, 4)],
}

# Routes requiring a connection (no direct transport)
REQUIRED_CONNECTIONS: dict[tuple[str, str], str] = {
    ("sapa", "phuquoc"): "hanoi",
    ("sapa", "danang"): "hanoi",
    ("sapa", "hcmc"): "hanoi",
    ("halong", "danang"): "hanoi",
    ("halong", "hcmc"): "hanoi",
    ("phuquoc", "danang"): "hcmc",
    ("phuquoc", "hanoi"): "hcmc",
    ("mekong", "hanoi"): "hcmc",
    ("dalat", "hanoi"): "hcmc",
}


def _normalize(city: str) -> str:
    aliases = {
        "ho chi minh": "hcmc",
        "saigon": "hcmc",
        "da nang": "danang",
        "hoi an": "hoian",
        "phu quoc": "phuquoc",
        "ha long": "halong",
        "nha trang": "nhatrang",
        "da lat": "dalat",
    }
    c = city.lower().strip()
    return aliases.get(c, c)


def get_transport(from_city: str, to_city: str) -> list[tuple[str, float, float]]:
    """Get transport options between two cities. Checks both directions."""
    key = (_normalize(from_city), _normalize(to_city))
    if key in TRANSPORT_NETWORK:
        return TRANSPORT_NETWORK[key]
    reverse = (key[1], key[0])
    if reverse in TRANSPORT_NETWORK:
        return TRANSPORT_NETWORK[reverse]
    return []


def optimize_route(destinations: list[str]) -> OptimizedRoute:
    """Optimize visit order using nearest-neighbor heuristic. Returns best-effort route."""
    if not destinations:
        return OptimizedRoute(destinations=[], legs=[], total_cost=0, total_hours=0)

    normalized = list(dict.fromkeys(_normalize(d) for d in destinations))  # Dedupe, preserve order

    if len(normalized) <= 1:
        return OptimizedRoute(destinations=normalized, legs=[], total_cost=0, total_hours=0)

    # Simple nearest-neighbor: start from first destination
    visited = [normalized[0]]
    remaining = set(normalized[1:])
    legs: list[Routeleg] = []
    total_cost = 0.0
    total_hours = 0.0

    while remaining:
        current = visited[-1]
        best_next = None
        best_transport = None
        best_cost = float("inf")

        for candidate in remaining:
            connection = REQUIRED_CONNECTIONS.get((current, candidate))
            options = get_transport(current, candidate)

            if options:
                cheapest = min(options, key=lambda x: x[1])
                if cheapest[1] < best_cost:
                    best_cost = cheapest[1]
                    best_next = candidate
                    best_transport = (cheapest[0], cheapest[1], cheapest[2], None)
            elif connection:
                # Route via connection city
                leg1_opts = get_transport(current, connection)
                leg2_opts = get_transport(connection, candidate)
                if leg1_opts and leg2_opts:
                    c1 = min(leg1_opts, key=lambda x: x[1])
                    c2 = min(leg2_opts, key=lambda x: x[1])
                    combined_cost = c1[1] + c2[1]
                    if combined_cost < best_cost:
                        best_cost = combined_cost
                        best_next = candidate
                        best_transport = (c1[0], combined_cost, c1[2] + c2[2], connection)

        if best_next and best_transport:
            mode, cost, hours, via = best_transport
            legs.append(
                Routeleg(
                    from_city=current,
                    to_city=best_next,
                    transport_mode=mode,
                    cost_usd=cost,
                    duration_hours=hours,
                    via=via,
                )
            )
            total_cost += cost
            total_hours += hours
            visited.append(best_next)
            remaining.remove(best_next)
        else:
            # No route found — add with zero cost and move on
            next_city = remaining.pop()
            legs.append(
                Routeleg(
                    from_city=current,
                    to_city=next_city,
                    transport_mode="unknown",
                    cost_usd=0,
                    duration_hours=0,
                )
            )
            visited.append(next_city)

    logger.info("routing.optimized", destinations=visited, total_cost=total_cost, legs=len(legs))
    return OptimizedRoute(destinations=visited, legs=legs, total_cost=total_cost, total_hours=total_hours)
