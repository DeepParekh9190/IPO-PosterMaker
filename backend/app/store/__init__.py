from .base import Store
from .memory import MemoryStore

__all__ = ["Store", "MemoryStore", "build_store"]


def build_store(settings):  # imported lazily to avoid circular import
    if settings.persistence == "supabase":
        from .supabase import SupabaseStore

        return SupabaseStore(settings)
    return MemoryStore()
