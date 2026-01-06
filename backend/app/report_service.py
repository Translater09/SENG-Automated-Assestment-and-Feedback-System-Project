# app/report_service.py
import os
from datetime import datetime, timedelta
from typing import List

from fastapi import HTTPException

from .models import WeeklyReport
from .storage import storage


class ReportService:
    def generate_weekly_report(self, student_id: str) -> WeeklyReport:
        now = datetime.utcnow()
        week_start = now - timedelta(days=7)
        subs = [
            s
            for s in storage.submissions.values()
            if s.student_id == student_id and s.created_at >= week_start
        ]
        if not subs:
            raise HTTPException(status_code=404, detail="No weekly data for student")

        evals = [
            e
            for e in storage.evaluations.values()
            if e.submission_id in {s.id for s in subs}
        ]
        avg_score = sum(e.score for e in evals) / len(evals) if evals else 0.0

        fbs = [
            f
            for f in storage.feedbacks.values()
            if f.submission_id in {s.id for s in subs}
        ]
        highlight = "\n\n".join(f.text[:200] for f in fbs[:3])

        summary = f"{len(subs)} activities, average score {avg_score:.1f}."
        report = WeeklyReport(
            id=str(datetime.utcnow().timestamp()).replace(".", ""),
            student_id=student_id,
            week_start=week_start,
            week_end=now,
            summary=summary,
            average_score=avg_score,
            activities_count=len(subs),
            feedback_highlights=highlight,
            created_at=now,
        )
        storage.weekly_reports[report.id] = report
        storage.log(student_id, "generate_weekly_report", {"report_id": report.id})
        return report

    def export_report_txt(self, report_id: str) -> str:
        report = storage.weekly_reports.get(report_id)
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")

        path = f"report_{report.id}.txt"
        with open(path, "w", encoding="utf-8") as f:
            f.write(f"Weekly Report for student {report.student_id}\n")
            f.write(f"Week: {report.week_start} - {report.week_end}\n\n")
            f.write(f"Summary: {report.summary}\n")
            f.write(f"Average score: {report.average_score:.1f}\n")
            f.write(f"Activities: {report.activities_count}\n\n")
            f.write("Feedback highlights:\n")
            f.write(report.feedback_highlights)
        report.file_path = os.path.abspath(path)
        storage.weekly_reports[report.id] = report
        return report.file_path

    def get_student_reports(self, student_id: str) -> List[WeeklyReport]:
        return [
            r for r in storage.weekly_reports.values() if r.student_id == student_id
        ]


report_service = ReportService()
