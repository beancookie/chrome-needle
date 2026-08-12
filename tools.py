import needle
from typing import Literal, Annotated
from datetime import datetime, timedelta
import json
import random
import os

_DATA_FILE = os.path.join(os.path.dirname(__file__), "mock_data.json")


def _load_data():
    if os.path.exists(_DATA_FILE):
        with open(_DATA_FILE) as f:
            return json.load(f)
    return {}


def _save_data(data):
    with open(_DATA_FILE, "w") as f:
        json.dump(data, f)


@needle.tool
def get_weather(city: str):
    "Get the current weather for a city."
    conditions = ["sunny", "cloudy", "rainy", "partly cloudy", "windy"]
    return {
        "city": city,
        "temp_c": random.randint(-10, 40),
        "condition": random.choice(conditions),
        "humidity": random.randint(20, 95),
    }


@needle.tool
def send_message(to: str, body: str):
    "Send a text message to a contact."

    return {"sent": True, "to": to, "body": body, "timestamp": datetime.now().isoformat()}


@needle.tool
def set_reminder(text: str, when: str):
    """Set a reminder.

    Args:
        text: what to be reminded about
        when: natural language time expression (e.g. 'in 5 minutes', 'tomorrow at 3pm')
    """
    data = _load_data()
    reminders = data.get("reminders", [])
    reminder = {"text": text, "when": when, "created": datetime.now().isoformat()}
    reminders.append(reminder)
    data["reminders"] = reminders
    _save_data(data)
    return {"created": True, "reminder": reminder, "total_reminders": len(reminders)}


@needle.tool
def get_reminders():
    "Get all pending reminders."
    data = _load_data()
    return {"reminders": data.get("reminders", [])}


@needle.tool
def search_web(query: str):
    "Search the web for information."
    mock_results = [
        {"title": f"Result for: {query}", "url": "https://example.com/1", "snippet": f"Found information about {query}."},
        {"title": f"More on {query}", "url": "https://example.com/2", "snippet": f"Additional results for {query}."},
    ]
    return {"query": query, "results": mock_results, "count": len(mock_results)}


@needle.tool
def calculate(expression: Annotated[str, needle.Field(description="mathematical expression to evaluate", min_length=1)]):
    """Evaluate a mathematical expression safely.

    Args:
        expression: a simple arithmetic expression like '2 + 3 * 4'
    """
    allowed = set("0123456789+-*/.() ")
    if not all(c in allowed for c in expression):
        return {"error": "expression contains disallowed characters"}
    try:
        result = eval(expression, {"__builtins__": {}}, {})
        return {"expression": expression, "result": result}
    except Exception as e:
        return {"error": str(e)}


@needle.tool
def set_alarm(time: str, label: Annotated[str, needle.Field(max_length=40)] = ""):
    """Set an alarm.

    Args:
        time: time to set the alarm (e.g. '07:30', '14:00')
        label: optional label for the alarm
    """
    return {"set": True, "time": time, "label": label or "Alarm"}


ALL_TOOLS = [
    get_weather,
    send_message,
    set_reminder,
    get_reminders,
    search_web,
    calculate,
    set_alarm,
]
