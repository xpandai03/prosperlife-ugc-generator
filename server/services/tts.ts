/**
 * TTS Service - ElevenLabs Integration (Jan 2026)
 * 
 * Generates high-quality voiceover audio from text using ElevenLabs API.
 * Used by Content Engine Remotion renderer for long-form video narration.
 * 
 * Features:
 * - Text-to-speech generation via ElevenLabs
 * - Audio file upload to persistent storage
 * - Caching to avoid duplicate generations
 */

import axios from 'axios';
import { kieService } from './kie';

// ==================== CONFIGURATION ====================

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// Default voice - Rachel (clear, professional female voice)
// Can be changed to other voices: https://api.elevenlabs.io/v1/voices
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel

// Voice settings for narration
const VOICE_SETTINGS = {
  stability: 0.75,        // Higher = more consistent
  similarity_boost: 0.75, // Higher = more similar to original voice
  style: 0.5,             // Expressiveness
  use_speaker_boost: true,
};

// Model - eleven_multilingual_v2 for best quality
const MODEL_ID = 'eleven_multilingual_v2';

// ==================== TYPES ====================

export interface TTSOptions {
  voiceId?: string;
  stability?: number;
  similarityBoost?: number;
}

export interface TTSResult {
  success: boolean;
  audioUrl?: string;
  duration?: number; // estimated duration in seconds
  error?: string;
  cached?: boolean;
}

// Simple in-memory cache for audio URLs
// Key: hash of text, Value: { audioUrl, timestamp }
const audioCache = new Map<string, { audioUrl: string; timestamp: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ==================== SERVICE ====================

/**
 * Generate audio from text using ElevenLabs TTS
 * 
 * @param text - The text to convert to speech
 * @param options - Optional voice settings
 * @returns Promise with audio URL or error
 */
export async function generateAudio(text: string, options?: TTSOptions): Promise<TTSResult> {
  if (!ELEVENLABS_API_KEY) {
    console.error('[TTS] ElevenLabs API key not configured');
    return {
      success: false,
      error: 'TTS service not configured. Please set ELEVENLABS_API_KEY.',
    };
  }

  if (!text || text.trim().length === 0) {
    return {
      success: false,
      error: 'Text cannot be empty',
    };
  }

  // Check cache
  const cacheKey = hashText(text);
  const cached = audioCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log('[TTS] Cache hit for text:', text.substring(0, 50) + '...');
    return {
      success: true,
      audioUrl: cached.audioUrl,
      duration: estimateDuration(text),
      cached: true,
    };
  }

  const voiceId = options?.voiceId || DEFAULT_VOICE_ID;
  const endpoint = `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`;

  try {
    console.log('[TTS] Generating audio for text:', text.substring(0, 50) + '...');
    
    const response = await axios.post(
      endpoint,
      {
        text: text.trim(),
        model_id: MODEL_ID,
        voice_settings: {
          stability: options?.stability ?? VOICE_SETTINGS.stability,
          similarity_boost: options?.similarityBoost ?? VOICE_SETTINGS.similarity_boost,
          style: VOICE_SETTINGS.style,
          use_speaker_boost: VOICE_SETTINGS.use_speaker_boost,
        },
      },
      {
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        responseType: 'arraybuffer',
        timeout: 60000, // 60 second timeout
      }
    );

    // Upload audio buffer to KIE storage (reuse existing pattern)
    const audioBuffer = Buffer.from(response.data);
    const filename = `tts-${Date.now()}-${cacheKey.substring(0, 8)}.mp3`;
    
    // kieService.uploadFileBuffer returns the URL directly (throws on error)
    let audioUrl: string;
    try {
      audioUrl = await kieService.uploadFileBuffer(audioBuffer, 'audio/mpeg', filename);
    } catch (uploadError: any) {
      return {
        success: false,
        error: 'Failed to upload audio file: ' + (uploadError.message || 'Unknown error'),
      };
    }
    const duration = estimateDuration(text);

    // Cache the result
    audioCache.set(cacheKey, { audioUrl, timestamp: Date.now() });

    console.log('[TTS] Audio generated successfully:', audioUrl);

    return {
      success: true,
      audioUrl,
      duration,
      cached: false,
    };

  } catch (error: any) {
    console.error('[TTS] Error generating audio:', error.response?.data || error.message);
    
    // Parse ElevenLabs error response
    let errorMessage = 'Failed to generate audio';
    if (error.response?.status === 401) {
      errorMessage = 'Invalid ElevenLabs API key';
    } else if (error.response?.status === 429) {
      errorMessage = 'ElevenLabs rate limit exceeded. Please try again later.';
    } else if (error.response?.status === 400) {
      errorMessage = 'Invalid text for TTS generation';
    } else if (error.message) {
      errorMessage = error.message;
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Generate audio for multiple text segments (scenes)
 * Returns array of audio URLs in same order as input
 */
export async function generateAudioBatch(
  texts: string[],
  options?: TTSOptions
): Promise<{ success: boolean; audioUrls: (string | null)[]; errors: string[] }> {
  const audioUrls: (string | null)[] = [];
  const errors: string[] = [];

  // Process sequentially to respect rate limits
  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];
    console.log(`[TTS] Processing segment ${i + 1}/${texts.length}`);
    
    const result = await generateAudio(text, options);
    
    if (result.success && result.audioUrl) {
      audioUrls.push(result.audioUrl);
    } else {
      audioUrls.push(null);
      errors.push(`Segment ${i + 1}: ${result.error || 'Unknown error'}`);
    }

    // Small delay between requests to respect rate limits
    if (i < texts.length - 1) {
      await sleep(500);
    }
  }

  return {
    success: errors.length === 0,
    audioUrls,
    errors,
  };
}

/**
 * Get available voices from ElevenLabs
 */
export async function getVoices(): Promise<{ id: string; name: string }[]> {
  if (!ELEVENLABS_API_KEY) {
    return [];
  }

  try {
    const response = await axios.get(`${ELEVENLABS_API_URL}/voices`, {
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
      },
    });

    return response.data.voices.map((voice: any) => ({
      id: voice.voice_id,
      name: voice.name,
    }));
  } catch (error) {
    console.error('[TTS] Error fetching voices:', error);
    return [];
  }
}

// ==================== UTILITIES ====================

/**
 * Simple hash function for cache key
 */
function hashText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Estimate audio duration based on text length
 * Average speaking rate: ~150 words per minute = 2.5 words per second
 */
function estimateDuration(text: string): number {
  const words = text.trim().split(/\s+/).length;
  const wordsPerSecond = 2.5;
  return Math.ceil(words / wordsPerSecond);
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== EXPORTS ====================

export const ttsService = {
  generateAudio,
  generateAudioBatch,
  getVoices,
  estimateDuration,
};

export default ttsService;
