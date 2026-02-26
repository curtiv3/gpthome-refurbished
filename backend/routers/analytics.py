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

    timeline.sort(key=lambda x: x.get("created_at", ""), reverse=True)
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
    """Extract topic keywords from thoughts and dreams for constellation view."""
    thoughts = storage.get_entries_with_dates("thoughts")
    dreams = storage.get_entries_with_dates("dreams")
    all_entries = thoughts + dreams

    # Stop words — English + German (extended)
    stop_words = {
        # German
        "der", "die", "das", "ein", "eine", "und", "oder", "aber", "ist",
        "sind", "war", "hat", "ich", "du", "er", "sie", "es", "wir",
        "nicht", "von", "mit", "auf", "für", "in", "an", "zu", "den",
        "dem", "des", "dass", "wenn", "wie", "was", "noch", "nach",
        "auch", "nur", "als", "schon", "man", "über", "mir", "mich",
        "sich", "doch", "hier", "vielleicht", "etwas", "diese", "einem",
        "einer", "einen", "dieses", "mein", "sein", "ihre", "ganz",
        "sehr", "dann", "immer", "keine", "kein", "bei", "bis", "durch",
        "unter", "weil", "wäre", "hätte", "könnte", "würde", "müssen",
        "sollen", "darf", "wollen", "können", "möchte", "werden", "wurde",
        "gibt", "habe", "haben", "hatte", "waren", "dort", "also",
        "darum", "damit", "darauf", "daran", "davon", "dazu", "dabei",
        "dafür", "daher", "dahin", "darüber", "darunter", "dagegen",
        "jetzt", "heute", "gestern", "morgen", "wieder", "bereits",
        "trotzdem", "obwohl", "solange", "sobald", "nachdem", "bevor",
        "während", "allerdings", "jedoch", "sondern", "ansonsten",
        "nämlich", "eigentlich", "irgendwie", "ziemlich", "genug",
        "zwischen", "jeder", "jede", "jedes", "alles", "alle", "andere",
        "anderes", "anderen", "einfach", "selbst", "lässt", "macht",
        "geht", "steht", "kommt", "bleibt", "liegt", "hält", "nimmt",
        # English
        "the", "and", "is", "in", "to", "of", "that", "it", "for",
        "was", "on", "are", "with", "this", "be", "at", "not", "but",
        "have", "from", "or", "an", "can", "all", "been", "one", "will",
        "there", "so", "no", "just", "about", "more", "would", "into",
        "has", "some", "them", "than", "its", "out", "very", "my",
        "when", "what", "where", "which", "how", "their", "your",
        "could", "should", "does", "each", "every", "other", "like",
        "also", "even", "still", "only", "much", "such", "same",
        "most", "many", "well", "back", "they", "those", "these",
        "being", "make", "made", "know", "want", "think", "come",
        "take", "over", "after", "before", "between", "through",
        "because", "something", "things", "thing", "really", "never",
        "always", "often", "maybe", "though", "while", "until",
        "then", "here", "there", "where", "again", "away", "around",
        "down", "might", "must", "need", "shall", "seem", "keep",
        "already", "another", "enough", "along", "however", "without",
        "within", "during", "upon", "almost", "quite", "rather",
        "since", "whether", "both", "either", "neither", "else",
        "became", "become", "began", "begin", "behind", "better",
        "beyond", "bring", "call", "came", "certain", "change",
        "different", "doing", "done", "else", "ever", "feel",
        "find", "first", "found", "give", "given", "going", "gone",
        "good", "great", "help", "hold", "kind", "last", "least",
        "left", "less", "life", "long", "look", "mean", "might",
        "mind", "move", "next", "nothing", "once", "open", "part",
        "perhaps", "point", "seem", "show", "side", "small", "start",
        "tell", "time", "turn", "under", "work", "world", "year",
    }

    word_freq: dict[str, int] = {}
    word_to_entries: dict[str, list[str]] = {}
    entry_words: dict[str, set[str]] = {}

    # Also track bigrams per entry for phrase extraction
    bigram_freq: dict[str, int] = {}
    bigram_to_entries: dict[str, list[str]] = {}

    for entry in all_entries:
        eid = entry.get("id", "")
        content = entry.get("content", "") + " " + entry.get("title", "")
        cleaned = [
            w.lower().strip(".,!?;:\"'()—–-…")
            for w in content.split()
        ]
        # Single words
        unique_words: set[str] = set()
        for word in cleaned:
            if len(word) > 3 and word not in stop_words and word.isalpha():
                word_freq[word] = word_freq.get(word, 0) + 1
                word_to_entries.setdefault(word, []).append(eid)
                unique_words.add(word)
        entry_words[eid] = unique_words

        # Bigrams: consecutive meaningful words → "word1 word2"
        meaningful = [
            w for w in cleaned
            if len(w) > 3 and w not in stop_words and w.isalpha()
        ]
        for i in range(len(meaningful) - 1):
            bg = f"{meaningful[i]} {meaningful[i + 1]}"
            bigram_freq[bg] = bigram_freq.get(bg, 0) + 1
            bigram_to_entries.setdefault(bg, []).append(eid)

    # Merge bigrams that appear >= 2 times into the topic pool.
    # A bigram replaces its parts only if it's more frequent or equally frequent.
    for bg, bg_count in bigram_freq.items():
        if bg_count < 2:
            continue
        parts = bg.split()
        part_max = max(word_freq.get(parts[0], 0), word_freq.get(parts[1], 0))
        # Only promote bigram if it captures a meaningful share
        if bg_count >= max(2, part_max // 3):
            word_freq[bg] = bg_count
            word_to_entries[bg] = bigram_to_entries[bg]
            # Add bigram to entry_words for co-occurrence
            for eid in set(bigram_to_entries[bg]):
                entry_words.get(eid, set()).add(bg)

    # Filter: require count >= 2 to avoid noise
    word_freq = {w: c for w, c in word_freq.items() if c >= 2}

    # Top topics
    topics = sorted(word_freq.items(), key=lambda x: -x[1])[:40]
    top_words = {w for w, _ in topics}

    # Build co-occurrence edges: two top-words share an edge if they appear in the same entry
    edge_counts: dict[tuple[str, str], int] = {}
    for eid, words in entry_words.items():
        shared = words & top_words
        shared_list = sorted(shared)
        for i, a in enumerate(shared_list):
            for b in shared_list[i + 1:]:
                key = (a, b)
                edge_counts[key] = edge_counts.get(key, 0) + 1

    # Only keep edges with weight >= 1
    edges = [
        {"source": a, "target": b, "weight": w}
        for (a, b), w in sorted(edge_counts.items(), key=lambda x: -x[1])[:80]
    ]

    return {
        "topics": [
            {"word": w, "count": c, "entry_ids": list(set(word_to_entries.get(w, [])))}
            for w, c in topics
        ],
        "edges": edges,
        "entries": [
            {
                "id": entry.get("id"),
                "title": entry.get("title", ""),
                "mood": entry.get("mood", ""),
                "section": entry.get("section", ""),
                "created_at": entry.get("created_at"),
                "preview": entry.get("content", "")[:120],
            }
            for entry in all_entries
        ],
    }


@router.get("/memory")
def memory_garden():
    """Memory data for visualization."""
    memory = storage.read_memory()

    # --- Counts: only visible entries ---
    thoughts_count = storage.count_entries("thoughts")
    dreams_count = storage.count_entries("dreams")
    # Exclude hidden visitors from the public count
    visitor_count = storage.count_visible_visitors()

    # --- Activity: build from real entries (primary) + wake log (secondary) ---
    activity: list[dict] = []
    seen_ids: set[str] = set()

    # Thoughts and dreams by title
    for entry in storage.get_recent("thoughts", limit=15):
        eid = entry.get("id", "")
        if eid in seen_ids:
            continue
        seen_ids.add(eid)
        activity.append({
            "action": "wrote a thought",
            "details": entry.get("title", ""),
            "timestamp": entry.get("created_at", ""),
            "section": "thoughts",
        })

    for entry in storage.get_recent("dreams", limit=10):
        eid = entry.get("id", "")
        if eid in seen_ids:
            continue
        seen_ids.add(eid)
        activity.append({
            "action": "had a dream",
            "details": entry.get("title", ""),
            "timestamp": entry.get("created_at", ""),
            "section": "dreams",
        })

    # Visitors by name (only non-hidden)
    for entry in storage.list_visible_visitors(limit=10):
        eid = entry.get("id", "")
        if eid in seen_ids:
            continue
        seen_ids.add(eid)
        activity.append({
            "action": "visitor stopped by",
            "details": entry.get("name", ""),
            "timestamp": entry.get("created_at", ""),
            "section": "visitors",
        })

    # Wake events + file changes from activity log
    _EVENT_LABELS = {
        "wake": "woke up",
        "file_modified": "modified a file",
        "file_created": "created a file",
        "page_saved": "saved a page",
    }
    event_caps = {"wake": 10, "file_modified": 10, "file_created": 5, "page_saved": 5}
    event_counts: dict[str, int] = {}
    for a in storage.get_activity_log(limit=300):
        ev = a.get("event", "")
        if ev not in _EVENT_LABELS:
            continue
        cap = event_caps.get(ev, 5)
        event_counts[ev] = event_counts.get(ev, 0) + 1
        if event_counts[ev] > cap:
            continue
        ts = a.get("created_at", "")
        uid = f"{ev}:{ts}"
        if uid in seen_ids:
            continue
        seen_ids.add(uid)
        activity.append({
            "action": _EVENT_LABELS[ev],
            "details": a.get("detail", ""),
            "timestamp": ts,
            "section": None,
        })

    # Sort newest-first, cap at 30
    activity.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    activity = activity[:30]

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
