"""Small in-memory sliding-window rate limiter.

Serverless note: limits are per warm instance. That is acceptable for an MVP
abuse brake; a shared store (Redis/KV) can be dropped in behind this interface.
"""

from __future__ import annotations

import time
from collections import deque


class RateLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = {}

    def check(self, key: str, limit: int, window_seconds: int = 60) -> tuple[bool, int]:
        """Return (allowed, retry_after_seconds)."""
        now = time.time()
        bucket = self._hits.setdefault(key, deque())
        cutoff = now - window_seconds
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        if len(bucket) >= limit:
            retry_after = int(max(1, window_seconds - (now - bucket[0])))
            return False, retry_after
        bucket.append(now)
        # Opportunistic pruning so memory stays bounded.
        if len(self._hits) > 5000:
            for k in list(self._hits):
                if not self._hits[k] or self._hits[k][-1] < cutoff:
                    self._hits.pop(k, None)
        return True, 0
