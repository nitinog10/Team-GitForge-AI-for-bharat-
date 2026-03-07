"""Audio Generator Service – Text-to-Speech (ElevenLabs only)

Converts walkthrough scripts into AI voice narration using ElevenLabs API.
"""

import asyncio
import time
from typing import Optional, AsyncIterator, List

import httpx

from app.config import get_settings

settings = get_settings()

ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1"


class AudioGeneratorService:
    """Text-to-speech service using ElevenLabs API."""

    def __init__(self):
        self._api_key: str = settings.elevenlabs_api_key
        self._voice_id: str = settings.elevenlabs_voice_id
        self._model_id: str = settings.elevenlabs_model_id
        self._client: Optional[httpx.AsyncClient] = None

        if not self._api_key:
            print("⚠️  ELEVENLABS_API_KEY not set – audio generation will fail!")
        else:
            print(f"✅ ElevenLabs TTS ready  (voice={self._voice_id}, model={self._model_id})")

    # ------------------------------------------------------------------
    # HTTP client (lazy, reusable)
    # ------------------------------------------------------------------

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=ELEVENLABS_BASE_URL,
                headers={
                    "xi-api-key": self._api_key,
                    "Content-Type": "application/json",
                },
                timeout=120.0,
            )
        return self._client

    def _voice_body(self, text: str) -> dict:
        return {
            "text": text,
            "model_id": self._model_id,
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75,
                "style": 0.0,
                "use_speaker_boost": True,
            },
        }

    # ------------------------------------------------------------------
    # Core generation
    # ------------------------------------------------------------------

    async def generate_segment_audio(
        self,
        text: str,
        voice_id: Optional[str] = None,
    ) -> bytes:
        """Generate MP3 audio for a single text segment via ElevenLabs."""
        if not self._api_key:
            print("⚠️  ElevenLabs API key not configured")
            return b""

        try:
            client = await self._get_client()
            vid = voice_id or self._voice_id
            resp = await client.post(
                f"/text-to-speech/{vid}",
                json=self._voice_body(text),
            )
            if resp.status_code == 401:
                print(f"⚠️  ElevenLabs 401 Unauthorized – check your API key")
                return b""
            if resp.status_code == 422:
                print(f"⚠️  ElevenLabs 422 – invalid voice_id or model_id. Response: {resp.text}")
                return b""
            resp.raise_for_status()
            print(f"✅ ElevenLabs audio generated ({len(resp.content)} bytes)")
            return resp.content
        except httpx.TimeoutException:
            print(f"⚠️  ElevenLabs request timed out for segment ({len(text)} chars)")
            return b""
        except Exception as e:
            print(f"⚠️  ElevenLabs API error: {e}")
            return b""

    async def generate_full_audio(
        self,
        segments: list[str],
        voice_id: Optional[str] = None,
    ) -> bytes:
        """Generate and concatenate MP3 audio for multiple text segments."""
        chunks: list[bytes] = []
        for text in segments:
            chunk = await self.generate_segment_audio(text, voice_id)
            chunks.append(chunk)
        return b"".join(chunks)

    async def generate_segments_parallel(
        self,
        texts: List[str],
        voice_id: Optional[str] = None,
        max_concurrent: int = 3,
    ) -> List[bytes]:
        """Generate audio for multiple segments in parallel.

        Returns a list of bytes in the same order as *texts*.
        """
        semaphore = asyncio.Semaphore(max_concurrent)

        async def _gen(text: str) -> bytes:
            async with semaphore:
                return await self.generate_segment_audio(text, voice_id)

        start = time.perf_counter()
        results = await asyncio.gather(*[_gen(t) for t in texts], return_exceptions=True)
        elapsed = time.perf_counter() - start
        print(f"⚡ Parallel audio generation for {len(texts)} segments completed in {elapsed:.1f}s")

        # Replace exceptions with empty bytes
        return [r if isinstance(r, bytes) else b"" for r in results]

    async def stream_audio(
        self,
        text: str,
        voice_id: Optional[str] = None,
    ) -> AsyncIterator[bytes]:
        """Yield MP3 chunks via ElevenLabs streaming endpoint."""
        if not self._api_key:
            print("⚠️  ElevenLabs API key not configured – cannot stream")
            return

        try:
            client = await self._get_client()
            vid = voice_id or self._voice_id
            async with client.stream(
                "POST",
                f"/text-to-speech/{vid}/stream",
                json=self._voice_body(text),
            ) as resp:
                resp.raise_for_status()
                async for chunk in resp.aiter_bytes(chunk_size=4096):
                    yield chunk
        except Exception as e:
            print(f"⚠️  ElevenLabs streaming error: {e}")

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def estimate_duration(self, text: str) -> float:
        """Estimate audio duration (seconds) at ~150 wpm."""
        words = len(text.split())
        return (words / 150) * 60

    async def get_available_voices(self) -> list[dict]:
        """Fetch the voice catalogue from ElevenLabs (or an Edge-TTS entry)."""
        if self._mode == "edge-tts":
            return [
                {
                    "voice_id": EDGE_TTS_VOICE,
                    "name": "Edge-TTS (free)",
                    "description": f"Microsoft Edge neural voice ({EDGE_TTS_VOICE}) – set ELEVENLABS_API_KEY for premium voices",
                }
            ]

        try:
            client = await self._get_client()
            resp = await client.get("/voices")
            resp.raise_for_status()
            data = resp.json()
            return [
                {
                    "voice_id": v["voice_id"],
                    "name": v["name"],
                    "description": v.get("description", ""),
                }
                for v in data.get("voices", [])
            ]
        except Exception as e:
            print(f"Error fetching voices: {e}")
            return []

    async def save_audio_file(self, audio_data: bytes, file_path: str) -> bool:
        """Persist audio bytes to disk."""
        try:
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            async with aiofiles.open(file_path, "wb") as f:
                await f.write(audio_data)
            return True
        except Exception as e:
            print(f"Error saving audio file: {e}")
            return False

    async def close(self):
        """Shut down the underlying HTTP client."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()

