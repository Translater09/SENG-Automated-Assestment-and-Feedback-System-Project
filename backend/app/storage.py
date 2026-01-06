import json
import os
from typing import Dict
from datetime import datetime

from .config import DATA_FILE
from .models import (
    User, Submission, EvaluationResult,
    Mistake, Quiz
)


def _dt(v):
    if isinstance(v, datetime):
        return v.isoformat()
    return v


class Storage:
    def __init__(self):
        self.users: Dict[str, User] = {}
        self.tokens: Dict[str, str] = {}        # token -> user_id
        self.submissions: Dict[str, Submission] = {}
        self.evaluations: Dict[str, EvaluationResult] = {}
        self.mistakes: Dict[str, Mistake] = {}
        self.quizzes: Dict[str, Quiz] = {}
        self.load_data()

    def save_data(self):
        payload = {
            "users": {k: v.model_dump() for k, v in self.users.items()},
            "tokens": self.tokens,
            "submissions": {k: v.model_dump() for k, v in self.submissions.items()},
            "evaluations": {k: v.model_dump() for k, v in self.evaluations.items()},
            "mistakes": {k: v.model_dump() for k, v in self.mistakes.items()},
            "quizzes": {k: v.model_dump() for k, v in self.quizzes.items()},
        }

        def convert(obj):
            if isinstance(obj, dict):
                return {k: convert(v) for k, v in obj.items()}
            if isinstance(obj, list):
                return [convert(x) for x in obj]
            return _dt(obj)

        payload = convert(payload)

        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)

    def load_data(self):
        if not os.path.exists(DATA_FILE):
            return

        with open(DATA_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)

        self.users = {k: User(**v) for k, v in data.get("users", {}).items()}
        self.tokens = data.get("tokens", {})
        self.submissions = {k: Submission(**v) for k, v in data.get("submissions", {}).items()}
        self.evaluations = {k: EvaluationResult(**v) for k, v in data.get("evaluations", {}).items()}
        self.mistakes = {k: Mistake(**v) for k, v in data.get("mistakes", {}).items()}
        self.quizzes = {k: Quiz(**v) for k, v in data.get("quizzes", {}).items()}


storage = Storage()
