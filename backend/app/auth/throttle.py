"""In-memory failed-login throttle (per process; fine for the pilot's single VPS)."""
import threading
import time
from collections import defaultdict, deque


class FailureThrottle:
    def __init__(self, limit: int, window_seconds: int):
        self.limit = limit
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def _purge(self, key: str, now: float) -> deque[float]:
        q = self._hits[key]
        while q and now - q[0] > self.window:
            q.popleft()
        return q

    def blocked(self, key: str) -> bool:
        with self._lock:
            return len(self._purge(key, time.monotonic())) >= self.limit

    def record(self, key: str) -> None:
        with self._lock:
            now = time.monotonic()
            self._purge(key, now).append(now)

    def reset(self, key: str | None = None) -> None:
        with self._lock:
            if key is None:
                self._hits.clear()
            else:
                self._hits.pop(key, None)


# 5 failures / 15 min per email, and 20 / 15 min per client IP.
email_throttle = FailureThrottle(limit=5, window_seconds=900)
ip_throttle = FailureThrottle(limit=20, window_seconds=900)
