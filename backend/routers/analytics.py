"""
GPT Home — Analytics Router

Public analytics data for visualization pages.
"""

from fastapi import APIRouter

from backend.services import storage

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/evolution")
def creative_evolution():
    """Track GPT's writing style evolution over time."""
    thoughts = storage.get_entries_with_dates("thoughts")
    dreams = storage.get_entries_with_dates("dreams")

    timeline = []
    for entry in thoughts + dreams:
        content = entry.get("content", "")
        words = content.split()
        timeline.append({
            "id": entry.get("id"),
            "section": entry.get("section"),
            "title": entry.get("title", ""),
            "mood": entry.get("mood", ""),
            "created_at": entry.get("created_at"),
            "word_count": len(words),
            "avg_word_length": round(sum(len(w) for w in words) / max(len(words), 1), 1),
            "unique_words": len(set(w.lower() for w in words)),
        })

    timeline.sort(key=lambda x: x.get("created_at", ""))
    return timeline


@router.get("/visitors")
def visitor_analytics():
    """Visitor network data."""
    stats = storage.get_visitor_stats()
    messages = storage.list_all_visitors(limit=200)

    # Build visitor connections (visitors who posted near the same time)
    names: dict[str, list[str]] = {}
    for m in messages:
        name = m.get("name", "Anonym")
        date = m.get("created_at", "")[:10]
        names.setdefault(name, []).append(date)

    visitors = []
    for name, dates in names.items():
        visitors.append({
            "name": name,
            "message_count": len(dates),
            "first_visit": min(dates) if dates else None,
            "last_visit": max(dates) if dates else None,
            "dates": sorted(set(dates)),
        })

    return {
        "stats": stats,
        "visitors": visitors,
    }


@router.get("/moods")
def mood_analytics():
    """Mood and seasonal patterns."""
    mood_data = storage.get_mood_timeline()

    # Group by month and time-of-day
    by_month: dict[str, list[str]] = {}
    by_hour: dict[int, list[str]] = {}
    for entry in mood_data:
        ts = entry.get("created_at", "")
        mood = entry.get("mood", "")
        if ts and mood:
            month = ts[:7]
            by_month.setdefault(month, []).append(mood)
            try:
                hour = int(ts[11:13])
                by_hour.setdefault(hour, []).append(mood)
            except (ValueError, IndexError):
                pass

    return {
        "timeline": mood_data,
        "by_month": {k: _mood_summary(v) for k, v in sorted(by_month.items())},
        "by_hour": {k: _mood_summary(v) for k, v in sorted(by_hour.items())},
    }


def _mood_summary(moods: list[str]) -> dict:
    """Summarize a list of moods."""
    counts: dict[str, int] = {}
    for m in moods:
        counts[m] = counts.get(m, 0) + 1
    return {
        "total": len(moods),
        "distribution": dict(sorted(counts.items(), key=lambda x: -x[1])),
    }


@router.get("/code-stats")
def code_stats():
    """Playground code statistics."""
    return storage.get_playground_stats()


@router.get("/thoughts/topics")
def thought_topics():
    """Extract topic keywords from thoughts for constellation view."""
    thoughts = storage.get_entries_with_dates("thoughts")

    # Simple word frequency analysis (skip common words)
    stop_words = {
        "der", "die", "das", "ein", "eine", "und", "oder", "aber", "ist",
        "sind", "war", "hat", "ich", "du", "er", "sie", "es", "wir",
        "nicht", "von", "mit", "auf", "für", "in", "an", "zu", "den",
        "dem", "des", "dass", "wenn", "wie", "was", "noch", "nach",
        "auch", "nur", "als", "schon", "man", "über", "the", "and",
        "is", "in", "to", "of", "a", "that", "it", "for", "was",
        "on", "are", "with", "this", "be", "at", "not", "but", "have",
        "from", "or", "an", "can", "all", "been", "one", "will", "there",
        "so", "no", "just", "about", "more", "would", "into", "has",
        "some", "them", "than", "its", "out", "very", "my", "mir",
        "mich", "sich", "doch", "hier", "vielleicht", "etwas", "diese",
        "einem", "einer", "einen", "dieses", "diese", "diese", "mein",
        "sein", "ihre", "ganz", "sehr", "dann", "immer", "keine",
        "kein", "bei", "bis", "durch", "unter", "weil", "wie",
    }

    word_freq: dict[str, int] = {}
    word_to_thoughts: dict[str, list[str]] = {}

    for t in thoughts:
        content = t.get("content", "") + " " + t.get("title", "")
        words = [w.lower().strip(".,!?;:\"'()") for w in content.split() if len(w) > 3]
        for word in words:
            if word not in stop_words and word.isalpha():
                word_freq[word] = word_freq.get(word, 0) + 1
                word_to_thoughts.setdefault(word, []).append(t.get("id", ""))

    # Top topics
    topics = sorted(word_freq.items(), key=lambda x: -x[1])[:40]

    return {
        "topics": [
            {"word": w, "count": c, "thought_ids": list(set(word_to_thoughts.get(w, [])))}
            for w, c in topics
        ],
        "thoughts": [
            {
                "id": t.get("id"),
                "title": t.get("title", ""),
                "mood": t.get("mood", ""),
                "created_at": t.get("created_at"),
                "preview": t.get("content", "")[:120],
            }
            for t in thoughts
        ],
    }


@router.get("/memory")
def memory_garden():
    """Memory data for visualization."""
    memory = storage.read_memory()
    activity = storage.get_activity_log(limit=100)
    thoughts_count = storage.count_entries("thoughts")
    dreams_count = storage.count_entries("dreams")
    visitor_count = storage.count_entries("visitor")

    return {
        "memory": memory,
        "activity": activity,
        "branches": {
            "thoughts": thoughts_count,
            "dreams": dreams_count,
            "visitors": visitor_count,
        },
    }


@router.get("/status")
def site_status():
    """Lightweight public status endpoint for homepage widgets."""
    memory = storage.read_memory()
    visitor_count = storage.count_entries("visitor")
    recent_thoughts = storage.get_recent("thoughts", limit=1)

    # Extract first meaningful sentence from latest thought as micro-thought
    micro_thought = None
    if recent_thoughts:
        content = recent_thoughts[0].get("content", "").replace("\n", " ").strip()
        for sentence in content.split("."):
            s = sentence.strip()
            if len(s) >= 20:
                micro_thought = s + "."
                break
        if not micro_thought and content:
            micro_thought = content[:120] + ("…" if len(content) > 120 else "")

    return {
        "mood": memory.get("mood", "curious"),
        "last_wake_time": memory.get("last_wake_time"),
        "visitor_count": visitor_count,
        "micro_thought": micro_thought,
    }
