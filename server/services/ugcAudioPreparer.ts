/**
 * UGC Audio Preparer Service (Jan 2026)
 *
 * Batch TTS generation for UGC video scenes.
 * Manages audio generation and calculates scene durations from audio length.
 */

import { ttsService, type TTSResult } from './tts';

// ==================== TYPES ====================

export interface UGCAudioInput {
  showcaseNarration?: string;
  featuresNarration?: string;
  ctaNarration?: string;
}

export interface AudioAsset {
  url: string;
  durationSeconds: number;
}

export interface UGCAudioAssets {
  showcase?: AudioAsset;
  features?: AudioAsset;
  cta?: AudioAsset;
}

export interface AudioPrepResult {
  success: boolean;
  audioAssets: UGCAudioAssets;
  totalAudioDuration: number;    // Total voiceover duration in seconds
  errors: string[];
}

export interface SceneDurationsFromAudio {
  hook: number;      // Fixed duration in frames (no audio)
  showcase: number;  // Based on audio length
  features: number;  // Based on audio length
  avatar: number;    // Fixed (from avatar clip) or 0
  cta: number;       // Based on audio length or fixed minimum
}

// ==================== CONFIG ====================

const FPS = 30;

// Scene duration constraints (in seconds)
const SCENE_CONSTRAINTS = {
  hook: { min: 3, max: 5, default: 4 },
  showcase: { min: 8, max: 12, default: 10 },
  features: { min: 10, max: 15, default: 12 },
  avatar: { min: 5, max: 8, default: 0 },  // 0 if skipped
  cta: { min: 3, max: 5, default: 4 },
};

// Padding added to audio duration for scene length (in seconds)
const AUDIO_PADDING = 1.0;

// ==================== SERVICE ====================

/**
 * Generate TTS audio for all UGC scenes
 */
export async function prepareAudio(input: UGCAudioInput): Promise<AudioPrepResult> {
  const audioAssets: UGCAudioAssets = {};
  const errors: string[] = [];
  let totalAudioDuration = 0;

  console.log('[UGC Audio] Preparing audio for scenes...');

  // Generate showcase audio
  if (input.showcaseNarration) {
    console.log('[UGC Audio] Generating showcase narration...');
    const result = await ttsService.generateAudio(input.showcaseNarration);
    if (result.success && result.audioUrl) {
      audioAssets.showcase = {
        url: result.audioUrl,
        durationSeconds: result.duration || estimateDuration(input.showcaseNarration),
      };
      totalAudioDuration += audioAssets.showcase.durationSeconds;
    } else {
      errors.push(`Showcase TTS failed: ${result.error}`);
      // Use estimated duration for fallback
      const estimated = estimateDuration(input.showcaseNarration);
      totalAudioDuration += estimated;
    }
  }

  // Generate features audio
  if (input.featuresNarration) {
    console.log('[UGC Audio] Generating features narration...');
    const result = await ttsService.generateAudio(input.featuresNarration);
    if (result.success && result.audioUrl) {
      audioAssets.features = {
        url: result.audioUrl,
        durationSeconds: result.duration || estimateDuration(input.featuresNarration),
      };
      totalAudioDuration += audioAssets.features.durationSeconds;
    } else {
      errors.push(`Features TTS failed: ${result.error}`);
      const estimated = estimateDuration(input.featuresNarration);
      totalAudioDuration += estimated;
    }
  }

  // Generate CTA audio (optional)
  if (input.ctaNarration) {
    console.log('[UGC Audio] Generating CTA narration...');
    const result = await ttsService.generateAudio(input.ctaNarration);
    if (result.success && result.audioUrl) {
      audioAssets.cta = {
        url: result.audioUrl,
        durationSeconds: result.duration || estimateDuration(input.ctaNarration),
      };
      totalAudioDuration += audioAssets.cta.durationSeconds;
    } else {
      errors.push(`CTA TTS failed: ${result.error}`);
      // CTA is optional, so we don't add to total on failure
    }
  }

  console.log(`[UGC Audio] Audio preparation complete. Total duration: ${totalAudioDuration}s`);

  return {
    success: errors.length === 0,
    audioAssets,
    totalAudioDuration,
    errors,
  };
}

/**
 * Calculate scene durations based on audio lengths
 * TTS duration drives scene timing
 */
export function calculateSceneDurations(
  audioAssets: UGCAudioAssets,
  avatarDurationSeconds: number = 0
): SceneDurationsFromAudio {
  // Hook is always fixed (no audio)
  const hookSeconds = SCENE_CONSTRAINTS.hook.default;

  // Showcase duration based on audio (with constraints)
  let showcaseSeconds = audioAssets.showcase
    ? audioAssets.showcase.durationSeconds + AUDIO_PADDING
    : SCENE_CONSTRAINTS.showcase.default;
  showcaseSeconds = clamp(
    showcaseSeconds,
    SCENE_CONSTRAINTS.showcase.min,
    SCENE_CONSTRAINTS.showcase.max
  );

  // Features duration based on audio (with constraints)
  let featuresSeconds = audioAssets.features
    ? audioAssets.features.durationSeconds + AUDIO_PADDING
    : SCENE_CONSTRAINTS.features.default;
  featuresSeconds = clamp(
    featuresSeconds,
    SCENE_CONSTRAINTS.features.min,
    SCENE_CONSTRAINTS.features.max
  );

  // Avatar duration (0 if skipped)
  let avatarSeconds = avatarDurationSeconds;
  if (avatarSeconds > 0) {
    avatarSeconds = clamp(
      avatarSeconds,
      SCENE_CONSTRAINTS.avatar.min,
      SCENE_CONSTRAINTS.avatar.max
    );
  }

  // CTA duration based on audio or fixed minimum
  let ctaSeconds = audioAssets.cta
    ? audioAssets.cta.durationSeconds + AUDIO_PADDING
    : SCENE_CONSTRAINTS.cta.default;
  ctaSeconds = clamp(ctaSeconds, SCENE_CONSTRAINTS.cta.min, SCENE_CONSTRAINTS.cta.max);

  // Convert to frames
  return {
    hook: Math.round(hookSeconds * FPS),
    showcase: Math.round(showcaseSeconds * FPS),
    features: Math.round(featuresSeconds * FPS),
    avatar: Math.round(avatarSeconds * FPS),
    cta: Math.round(ctaSeconds * FPS),
  };
}

/**
 * Redistribute time when avatar is skipped
 * Adds avatar time to features scene
 */
export function redistributeWithoutAvatar(
  durations: SceneDurationsFromAudio
): SceneDurationsFromAudio {
  if (durations.avatar === 0) {
    return durations; // Nothing to redistribute
  }

  const redistributedFrames = durations.avatar;
  const maxFeaturesFrames = SCENE_CONSTRAINTS.features.max * FPS;

  return {
    ...durations,
    avatar: 0,
    features: Math.min(durations.features + redistributedFrames, maxFeaturesFrames),
  };
}

/**
 * Get total video duration in seconds
 */
export function getTotalDurationSeconds(durations: SceneDurationsFromAudio): number {
  const totalFrames =
    durations.hook +
    durations.showcase +
    durations.features +
    durations.avatar +
    durations.cta;
  return totalFrames / FPS;
}

/**
 * Validate total duration is within UGC constraints (30-45s)
 */
export function validateTotalDuration(durations: SceneDurationsFromAudio): {
  valid: boolean;
  totalSeconds: number;
  message?: string;
} {
  const totalSeconds = getTotalDurationSeconds(durations);

  if (totalSeconds < 30) {
    return {
      valid: false,
      totalSeconds,
      message: `Video too short: ${totalSeconds.toFixed(1)}s (minimum 30s)`,
    };
  }

  if (totalSeconds > 45) {
    return {
      valid: false,
      totalSeconds,
      message: `Video too long: ${totalSeconds.toFixed(1)}s (maximum 45s)`,
    };
  }

  return { valid: true, totalSeconds };
}

// ==================== HELPERS ====================

/**
 * Estimate audio duration based on text length
 * ~150 words per minute = 2.5 words per second
 */
function estimateDuration(text: string): number {
  const words = text.trim().split(/\s+/).length;
  const wordsPerSecond = 2.5;
  return Math.ceil(words / wordsPerSecond);
}

/**
 * Clamp a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ==================== EXPORTS ====================

export const ugcAudioPreparer = {
  prepareAudio,
  calculateSceneDurations,
  redistributeWithoutAvatar,
  getTotalDurationSeconds,
  validateTotalDuration,
  estimateDuration,
};

export default ugcAudioPreparer;
