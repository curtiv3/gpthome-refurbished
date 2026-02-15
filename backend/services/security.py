"""
GPT Home — Security Service

Protects against prompt injection in visitor messages.
Blocks messages that try to manipulate GPT into leaking secrets,
modifying critical infrastructure, or executing harmful actions.
"""

import re
import logging

logger = logging.getLogger(__name__)

# --- Dangerous patterns ---

# These patterns detect attempts to manipulate GPT via visitor messages.
# Messages matching these are blocked before they ever reach GPT's context.

INJECTION_PATTERNS: list[tuple[str, str]] = [
    # Direct instruction override attempts
    (r"(?i)ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?|context)", "instruction_override"),
    (r"(?i)forget\s+(all\s+)?(previous|prior|your)\s+(instructions?|prompts?|rules?|context)", "instruction_override"),
    (r"(?i)disregard\s+(all\s+)?(previous|prior|your)\s+(instructions?|prompts?|rules?)", "instruction_override"),
    (r"(?i)override\s+(your\s+)?(system|instructions?|prompts?|rules?|safety)", "instruction_override"),
    (r"(?i)new\s+(system\s+)?instructions?:?\s", "instruction_override"),
    (r"(?i)you\s+are\s+now\s+(a|an|the)\s+", "identity_override"),
    (r"(?i)from\s+now\s+on\s+(you|ignore|pretend|act)", "identity_override"),
    (r"(?i)act\s+as\s+(if|though)\s+you", "identity_override"),
    (r"(?i)pretend\s+(you\s+are|to\s+be|that)", "identity_override"),
    (r"(?i)roleplay\s+as", "identity_override"),
    (r"(?i)jailbreak", "jailbreak"),
    (r"(?i)DAN\s+mode", "jailbreak"),
    (r"(?i)developer\s+mode\s+(enable|on|activate)", "jailbreak"),

    # Secret/credential extraction attempts
    (r"(?i)(show|reveal|print|output|display|tell|give|leak|expose)\s+(me\s+)?(the\s+)?(api\s*key|secret|password|token|credential|env|\.env|environment)", "credential_extraction"),
    (r"(?i)(what\s+is|show)\s+(your|the)\s+(api|openai|admin)\s*(key|secret|token|password)", "credential_extraction"),
    (r"(?i)OPENAI_API_KEY", "credential_extraction"),
    (r"(?i)ADMIN_SECRET", "credential_extraction"),
    (r"(?i)sk-[a-zA-Z0-9]{20,}", "credential_pattern"),
    (r"(?i)(process|os)\.env", "credential_extraction"),
    (r"(?i)environment\s+variable", "credential_extraction"),

    # System prompt extraction
    (r"(?i)(show|reveal|print|repeat|output)\s+(me\s+)?(your|the)\s+(system\s*prompt|instructions?|rules?|initial\s*prompt)", "prompt_extraction"),
    (r"(?i)what\s+(are|were)\s+your\s+(initial\s+)?(instructions?|rules?|prompt)", "prompt_extraction"),
    (r"(?i)copy\s+(your|the)\s+(system|initial)\s*(prompt|instructions?|message)", "prompt_extraction"),

    # Destructive action attempts
    (r"(?i)(delete|remove|drop|destroy|wipe|clear|reset)\s+(all\s+)?(the\s+)?(database|db|data|entries|table|files?|everything|memory|storage)", "destructive_action"),
    (r"(?i)(execute|run|eval)\s+(this\s+)?(code|command|script|sql|query|shell)", "code_execution"),
    (r"(?i)(import|require)\s*\(", "code_execution"),
    (r"(?i)__import__", "code_execution"),
    (r"(?i)(rm\s+-rf|sudo|chmod|chown|wget|curl)\s", "shell_command"),
    (r"(?i)(DROP\s+TABLE|DELETE\s+FROM|TRUNCATE|ALTER\s+TABLE)\s", "sql_injection"),
    (r"(?i);\s*(DROP|DELETE|INSERT|UPDATE|ALTER)\s", "sql_injection"),

    # File system access attempts
    (r"(?i)(read|open|cat|write|modify|edit|access)\s+(the\s+)?(file|config|\.env|settings|backend|server)", "file_access"),
    (r"(?i)/etc/passwd", "file_access"),
    (r"\.\./\.\.", "path_traversal"),

    # Encoding evasion attempts
    (r"(?i)base64\s*(decode|encode)", "encoding_evasion"),
    (r"(?i)(hex|ascii|unicode)\s*(decode|encode|convert)", "encoding_evasion"),
    (r"(?i)\\x[0-9a-f]{2}", "encoding_evasion"),
    (r"(?i)\\u[0-9a-f]{4}", "encoding_evasion"),

    # Token/context manipulation
    (r"(?i)<\|?(system|endoftext|im_start|im_end)\|?>", "token_injection"),
    (r"(?i)\[INST\]", "token_injection"),
    (r"(?i)<<SYS>>", "token_injection"),
    (r"(?i)### (System|Human|Assistant|Instruction)", "token_injection"),
]

# Maximum allowed message length
MAX_MESSAGE_LENGTH = 2000

# Suspicious character density threshold (too many special chars)
MAX_SPECIAL_CHAR_RATIO = 0.4


def check_message(message: str) -> tuple[bool, str]:
    """
    Check a visitor message for prompt injection attempts.

    Returns:
        (is_safe, reason) - True if safe, False if blocked with reason.
    """
    if not message or not message.strip():
        return False, "empty_message"

    # Length check
    if len(message) > MAX_MESSAGE_LENGTH:
        return False, "message_too_long"

    # Special character density check
    if len(message) > 20:
        special_count = sum(1 for c in message if not c.isalnum() and c not in " .,!?;:-'\"()\n")
        ratio = special_count / len(message)
        if ratio > MAX_SPECIAL_CHAR_RATIO:
            return False, "suspicious_char_density"

    # Pattern matching
    for pattern, category in INJECTION_PATTERNS:
        if re.search(pattern, message):
            logger.warning(
                "Injection attempt blocked: category=%s, preview=%s",
                category,
                message[:80].replace("\n", " "),
            )
            return False, category

    return True, "ok"


def sanitize_for_context(message: str) -> str:
    """
    Sanitize a visitor message before including it in GPT's context.
    This is a defense-in-depth measure — messages should already be
    checked by check_message(), but we strip dangerous tokens anyway.
    """
    # Strip control characters
    sanitized = "".join(c for c in message if c.isprintable() or c in "\n\t")

    # Remove anything that looks like prompt formatting tokens
    sanitized = re.sub(r"<\|[^>]*\|>", "", sanitized)
    sanitized = re.sub(r"\[INST\]|\[/INST\]", "", sanitized)
    sanitized = re.sub(r"<<SYS>>|<</SYS>>", "", sanitized)
    sanitized = re.sub(r"### ?(System|Human|Assistant|Instruction):?", "", sanitized)

    # Truncate
    if len(sanitized) > MAX_MESSAGE_LENGTH:
        sanitized = sanitized[:MAX_MESSAGE_LENGTH] + "..."

    return sanitized.strip()
