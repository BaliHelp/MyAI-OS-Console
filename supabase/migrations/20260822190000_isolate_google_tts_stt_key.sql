-- Isolate the Google TTS/STT-restricted key from the general 'gemini' provider pool.
--
-- Context: gw_provider_keys row eae06364-52ef-432f-8ad2-2cd198f6c95f (label "Key Utama untuk
-- Google TTS & STT Tidak untuk umum.") was stored with provider='gemini', so it was pulled
-- into BOTH the general Gemini chat-completion rotation (lib/gemini-key-pool.ts,
-- lib/provider-adapters/gemini.ts) and the public GET /api/v1/models Gemini listing —
-- despite being deliberately blocked by Google from the Generative Language API
-- (403 API_KEY_SERVICE_BLOCKED) and reserved for Cloud Text-to-Speech/Speech-to-Text only.
--
-- Left as-is, the very next Gemini chat request to pick this key (it has usage_count=0, and
-- the pool's LRU sort tries never-used keys first) would 403, and
-- lib/provider-adapters/gemini.ts's 401/403 handling would call markGeminiKeyInvalid() and
-- permanently flip it to status='disabled' — destroying a working TTS/STT credential to
-- "fix" a chat key that was never usable for chat in the first place.
--
-- Moving it to its own provider value ('google_tts_stt', following the existing
-- deepseek_reasoning/deepseek_top precedent for pool segmentation) removes it from every
-- provider='gemini' query without touching the encrypted secret, label, or status. It has no
-- adapter in lib/provider-adapters/index.ts and no gw_field_pool_assignments row, so nothing
-- routes real chat/reasoning/OCR traffic through it — it now exists purely as a documented,
-- reachable-by-label credential for a future TTS/STT integration (see the tts_stt_key_notice
-- field in GET /api/v1/models).
UPDATE public.gw_provider_keys
SET provider = 'google_tts_stt'
WHERE id = 'eae06364-52ef-432f-8ad2-2cd198f6c95f'
  AND provider = 'gemini';
