"""
Mock STT (Speech-to-Text): accepts audio bytes, returns a placeholder transcript.
Replace with a real STT API (e.g. Whisper) for production.
"""


def transcribe(audio_bytes: bytes) -> str:
    """Mock STT: return a fixed transcript. Real impl would call an STT API."""
    if not audio_bytes or len(audio_bytes) < 100:
        return "Please say something."
    # Placeholder so the agent still gets a message; real STT would decode audio.
    return "User said something via voice."
