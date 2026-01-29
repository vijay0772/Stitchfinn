"""
TTS (Text-to-Speech): accepts text, returns audio bytes.
Uses edge-tts (free, real speech) when available; falls back to beep + silence.
"""
import io
import logging
import math
import struct

logger = logging.getLogger(__name__)

# Optional: real TTS via Microsoft Edge (free, no API key)
try:
    import edge_tts
    _HAS_EDGE_TTS = True
except ImportError:
    _HAS_EDGE_TTS = False


def _mock_synthesize(text: str) -> bytes:
    """Fallback: short beep + silence so the user hears something."""
    sample_rate = 16000
    duration_sec = max(2.0, min(30.0, len(text) * 0.06))
    num_samples = int(sample_rate * duration_sec)
    beep_samples = int(sample_rate * 0.3)
    samples = []
    for i in range(num_samples):
        if i < beep_samples:
            t = i / sample_rate
            samples.append(int(8000 * math.sin(2 * math.pi * 440 * t)))
        else:
            samples.append(0)
    raw = struct.pack(f"<{num_samples}h", *samples)
    data_size = len(raw)
    header = (
        b"RIFF"
        + struct.pack("<I", 36 + data_size)
        + b"WAVE"
        + b"fmt "
        + struct.pack("<IHHIIHH", 16, 1, 1, sample_rate, sample_rate * 2, 2, 16)
        + b"data"
        + struct.pack("<I", data_size)
    )
    return header + raw


async def synthesize_async(text: str) -> tuple[bytes, str]:
    """
    Generate speech from text. Returns (audio_bytes, media_type).
    Uses edge-tts (real speech, MP3) when available; else beep + silence (WAV).
    """
    if not text or not text.strip():
        return _mock_synthesize(" "), "audio/wav"

    if _HAS_EDGE_TTS:
        try:
            communicate = edge_tts.Communicate(text.strip(), voice="en-US-GuyNeural")
            chunks = []
            async for chunk in communicate.stream():
                if chunk.get("type") == "audio":
                    chunks.append(chunk.get("data", b""))
            if chunks:
                return b"".join(chunks), "audio/mpeg"
        except Exception as e:
            logger.warning("edge-tts failed, using mock TTS: %s", e)

    return _mock_synthesize(text), "audio/wav"
