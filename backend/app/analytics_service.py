# app/analytics_service.py
from typing import Any, Dict
from sqlalchemy import text
from .storage import storage


class AnalyticsService:
    def student_performance(self, student_id: str) -> Dict[str, Any]:
        subs = [
            s for s in storage.submissions.values() if s.student_id == student_id
        ]
        data = []
        for s in subs:
            evals = [
                e for e in storage.evaluations.values() if e.submission_id == s.id
            ]
            score = evals[0].score if evals else None
            data.append(
                {
                    "submission_id": s.id,
                    "timestamp": s.created_at,
                    "activity_type": s.activity_type,
                    "score": score,
                }
            )
        return {"student_id": student_id, "items": data}

    def class_dashboard(self) -> Dict[str, Any]:
        scores_by_student: Dict[str, list[int]] = {}
        for e in storage.evaluations.values():
            sub = storage.submissions.get(e.submission_id)
            if not sub:
                continue
            scores_by_student.setdefault(sub.student_id, []).append(e.score)

        summary = []
        for sid, scores in scores_by_student.items():
            avg = sum(scores) / len(scores)
            summary.append({"student_id": sid, "avg_score": avg, "count": len(scores)})

        return {"students": summary}
    
    from sqlalchemy import text

def update_mistake_stats(db_session, submission_id: str):
    """
    Aggregates repeated mistakes per student and updates mistake_stats table.
    """
    sql = text("""
    MERGE mistake_stats AS target
    USING (
        SELECT
            s.student_id,
            m.error_type,
            COUNT(*) AS c
        FROM mistakes m
        JOIN submissions s ON s.id = m.submission_id
        WHERE m.submission_id = :submission_id
        GROUP BY s.student_id, m.error_type
    ) AS src
    ON target.student_id = src.student_id
    AND target.error_type = src.error_type
    WHEN MATCHED THEN
        UPDATE SET
            target.occurrence_count = target.occurrence_count + src.c,
            target.last_seen_at = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN
        INSERT (student_id, error_type, occurrence_count, first_seen_at, last_seen_at)
        VALUES (src.student_id, src.error_type, src.c, SYSUTCDATETIME(), SYSUTCDATETIME());
    """)
    db_session.execute(sql, {"submission_id": submission_id})
    db_session.commit()

def get_repeated_mistakes(db_session, student_id: str):
    sql = text("""
        SELECT
            error_type,
            occurrence_count
        FROM mistake_stats
        WHERE student_id = :student_id
        ORDER BY occurrence_count DESC
    """)
    result = db_session.execute(sql, {"student_id": student_id})
    return [
        {
            "error_type": row.error_type,
            "count": row.occurrence_count
        }
        for row in result
    ]

analytics_service = AnalyticsService()
