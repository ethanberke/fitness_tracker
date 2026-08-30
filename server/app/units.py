KG_PER_LB = 0.45359237
METERS_PER_MILE = 1609.344


def to_kg(weight: float | None, unit: str) -> float | None:
    if weight is None:
        return None
    return round(weight * KG_PER_LB, 4) if unit == "lb" else round(weight, 4)


def from_kg(weight_kg: float | None, unit: str) -> float | None:
    if weight_kg is None:
        return None
    return round(weight_kg / KG_PER_LB, 2) if unit == "lb" else round(weight_kg, 2)


def to_meters(distance: float | None, unit: str) -> float | None:
    if distance is None:
        return None
    return round(distance * METERS_PER_MILE, 3) if unit == "mi" else round(distance * 1000, 3)


def from_meters(distance_m: float | None, unit: str) -> float | None:
    if distance_m is None:
        return None
    return round(distance_m / METERS_PER_MILE, 3) if unit == "mi" else round(distance_m / 1000, 3)


def distance_unit_for(weight_unit: str) -> str:
    """Imperial and metric travel together; one preference drives both."""
    return "mi" if weight_unit == "lb" else "km"
