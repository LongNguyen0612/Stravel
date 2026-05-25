from pydantic import BaseModel


class ContextTrigger(BaseModel):
    keyword: str
    category: str
    follow_up_questions: list[str]


class ProfileQuestion(BaseModel):
    question: str
    context: str
    category: str


CONTEXT_TRIGGERS: list[ContextTrigger] = [
    ContextTrigger(
        keyword="family",
        category="family_with_kids",
        follow_up_questions=[
            "What are the ages of the children traveling?",
            "Are there any school holiday constraints for your travel dates?",
            "How important are kid-friendly activities and facilities?",
        ],
    ),
    ContextTrigger(
        keyword="diet",
        category="dietary_needs",
        follow_up_questions=[
            "What specific dietary requirements do you have? (vegan, halal, kosher, allergies)",
            "How strict are these dietary needs?",
        ],
    ),
    ContextTrigger(
        keyword="wheelchair",
        category="mobility_issues",
        follow_up_questions=[
            "Do you need wheelchair-accessible accommodations and transport?",
            "What is your comfortable walking distance tolerance?",
            "Do you require elevators at accommodations?",
        ],
    ),
    ContextTrigger(
        keyword="adventure",
        category="adventure_interest",
        follow_up_questions=[
            "What is your fitness level for adventure activities?",
            "What is your risk tolerance? (low, moderate, high)",
            "Any specific activities you're interested in? (trekking, diving, motorbiking)",
        ],
    ),
    ContextTrigger(
        keyword="flexible",
        category="flexible_dates",
        follow_up_questions=[
            "Would you trade specific dates for significantly lower prices?",
            "Are you open to traveling in shoulder season?",
        ],
    ),
    ContextTrigger(
        keyword="budget",
        category="budget_traveler",
        follow_up_questions=[
            "Are you comfortable staying in hostels or guesthouses?",
            "Would you consider overnight buses or trains to save on accommodation?",
            "Are you open to self-catering options?",
        ],
    ),
    ContextTrigger(
        keyword="luxury",
        category="luxury_traveler",
        follow_up_questions=[
            "Do you prefer private transfers between destinations?",
            "Is fine dining and Michelin-star experiences important?",
            "Are you interested in premium or boutique accommodations?",
        ],
    ),
    ContextTrigger(
        keyword="anniversary",
        category="couple_anniversary",
        follow_up_questions=[
            "Are you looking for romantic experiences and settings?",
            "How important is fine dining for this trip?",
            "Would you like any surprise elements arranged?",
        ],
    ),
]

TRIGGER_KEYWORDS: dict[str, ContextTrigger] = {}
for trigger in CONTEXT_TRIGGERS:
    TRIGGER_KEYWORDS[trigger.keyword] = trigger
    # Add common variations
    if trigger.keyword == "family":
        TRIGGER_KEYWORDS["kids"] = trigger
        TRIGGER_KEYWORDS["children"] = trigger
    elif trigger.keyword == "diet":
        TRIGGER_KEYWORDS["dietary"] = trigger
        TRIGGER_KEYWORDS["vegan"] = trigger
        TRIGGER_KEYWORDS["halal"] = trigger
        TRIGGER_KEYWORDS["kosher"] = trigger
        TRIGGER_KEYWORDS["allergy"] = trigger
        TRIGGER_KEYWORDS["allergies"] = trigger
    elif trigger.keyword == "wheelchair":
        TRIGGER_KEYWORDS["mobility"] = trigger
        TRIGGER_KEYWORDS["accessible"] = trigger
        TRIGGER_KEYWORDS["disability"] = trigger
    elif trigger.keyword == "adventure":
        TRIGGER_KEYWORDS["trekking"] = trigger
        TRIGGER_KEYWORDS["hiking"] = trigger
        TRIGGER_KEYWORDS["diving"] = trigger
        TRIGGER_KEYWORDS["motorbike"] = trigger
    elif trigger.keyword == "flexible":
        TRIGGER_KEYWORDS["anytime"] = trigger
        TRIGGER_KEYWORDS["no fixed dates"] = trigger
    elif trigger.keyword == "budget":
        TRIGGER_KEYWORDS["cheap"] = trigger
        TRIGGER_KEYWORDS["backpack"] = trigger
        TRIGGER_KEYWORDS["hostel"] = trigger
    elif trigger.keyword == "luxury":
        TRIGGER_KEYWORDS["premium"] = trigger
        TRIGGER_KEYWORDS["5-star"] = trigger
        TRIGGER_KEYWORDS["five star"] = trigger
        TRIGGER_KEYWORDS["boutique"] = trigger
    elif trigger.keyword == "anniversary":
        TRIGGER_KEYWORDS["honeymoon"] = trigger
        TRIGGER_KEYWORDS["romantic"] = trigger
        TRIGGER_KEYWORDS["couple"] = trigger
