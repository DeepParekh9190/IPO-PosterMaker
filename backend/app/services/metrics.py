"""In-process application metrics: recent errors and counters.

Serverless note: metrics are per warm instance and are used for the admin
overview only. A persistent metrics sink can replace this later.
"""

from __future__ import annotations

import threading
from collections import deque
from datetime import datetime, timezone
from typing import Any

_lock = threading.Lock()
_errors: deque[dict[str, Any]] = deque(maxlen=50)


def record_error(path: str, detail: str, status_code: int) -> None:
    with _lock:
        _errors.append(
            {
                "at": datetime.now(timezone.utc).isoformat(),
                "path": path,
                "status": status_code,
                "detail": detail[:300],
            }
        )


def recent_errors(limit: int = 10) -> list[dict[str, Any]]:
    with _lock:
        return list(_errors)[-limit:][::-1]


def reset() -> None:
    with _lock:
        _errors.clear()
