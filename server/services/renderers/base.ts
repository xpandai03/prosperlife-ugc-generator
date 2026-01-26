/**
 * Base Renderer Interface (Jan 2026)
 *
 * Defines the contract for all Content Engine renderers.
 * Both Automation and Code-Based renderers implement this interface.
 */

import type { SceneSpec, SceneObject } from '../../../shared/schema';

// ==================== INTERFACES ====================

/**
 * Result from a render operation
 */
export interface RenderResult {
  success: boolean;
  mediaAssetId?: string;
  resultUrl?: string;
  error?: string;
  metadata?: {
    provider?: string;
    duration?: number;
    renderTime?: number; // ms
  };
}

/**
 * Options for rendering
 */
export interface RenderOptions {
  provider?: 'veo3' | 'sora2'; // Default: veo3
  aspectRatio?: string; // Default: 9:16 (vertical for shorts)
  quality?: 'fast' | 'quality'; // Default: quality
}

/**
 * Base renderer interface - all renderers implement this
 */
export interface IRenderer {
  /**
   * Unique identifier for this renderer
   */
  readonly name: string;

  /**
   * Render a SceneSpec into a video
   *
   * @param sceneSpec - The scene specification to render
   * @param options - Optional rendering configuration
   * @returns Promise with render result
   */
  render(sceneSpec: SceneSpec, options?: RenderOptions): Promise<RenderResult>;

  /**
   * Check if this renderer can handle the given SceneSpec
   * Used for routing specs to the correct renderer
   */
  canHandle(sceneSpec: SceneSpec): boolean;
}

// ==================== UTILITIES ====================

/**
 * Transform SceneSpec scenes into a unified video prompt
 * Combines voiceover texts and visual intents into a cohesive description
 */
export function transformScenesToPrompt(scenes: SceneObject[], targetDuration: number): string {
  // Combine all scene visual intents and voiceover texts
  const sceneDescriptions = scenes
    .sort((a, b) => a.order - b.order)
    .map((scene, index) => {
      const durationHint = scene.durationHint || Math.round(targetDuration / scenes.length);
      return `[Scene ${index + 1}, ~${durationHint}s]: ${scene.visualIntent}. Narrator says: "${scene.voiceoverText}"`;
    })
    .join('\n\n');

  // Create a unified video prompt
  const prompt = `Create a ${targetDuration}-second vertical video (9:16 aspect ratio) with the following scenes:

${sceneDescriptions}

VIDEO REQUIREMENTS:
- Total duration: ${targetDuration} seconds
- Format: Vertical 9:16 (1080x1920) for TikTok/Instagram Reels/YouTube Shorts
- Style: Professional but authentic, engaging
- Transitions: Smooth cuts between scenes
- Audio: Clear narration matching the script

The video should feel cohesive and maintain consistent style throughout all scenes.`;

  return prompt;
}

/**
 * Combine all voiceover texts into a single script
 */
export function combineVoiceoverTexts(scenes: SceneObject[]): string {
  return scenes
    .sort((a, b) => a.order - b.order)
    .map(scene => scene.voiceoverText)
    .join(' ');
}

/**
 * Calculate total duration from scene hints
 */
export function calculateTotalDuration(scenes: SceneObject[], targetDuration: number): number {
  const sceneDurations = scenes.reduce((sum, scene) => {
    return sum + (scene.durationHint || 0);
  }, 0);

  // If scenes have duration hints, use them; otherwise use target
  return sceneDurations > 0 ? sceneDurations : targetDuration;
}
