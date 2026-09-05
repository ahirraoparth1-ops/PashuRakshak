RED_FLAG_KEYWORDS = (
    "mouth blister",
    "foot-and-mouth",
    "sudden mortality",
    "avian influenza",
    "anthrax",
)
HIGH_PRIORITY_KEYWORDS = ("high fever", "laboured breathing", "nodules")


def apply_priority(symptoms: str) -> str:
    text = symptoms.lower()
    if any(keyword in text for keyword in RED_FLAG_KEYWORDS):
        return "red_flag"
    if any(keyword in text for keyword in HIGH_PRIORITY_KEYWORDS):
        return "high"
    return "normal"
