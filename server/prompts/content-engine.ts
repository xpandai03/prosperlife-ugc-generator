/**
 * Content Engine - Prompt Templates (Jan 2026)
 *
 * Prompt templates for generating SceneSpecs from ChannelConfig
 * Uses OpenAI JSON mode for reliable structured output
 */

import type { SceneObject } from '../../shared/schema';

// ==================== INTERFACES ====================

export interface SceneSpecGenerationInput {
  niche: string;          // Content niche (e.g., "productivity tips")
  tone: string;           // Voice/style (e.g., "casual, motivational")
  targetDuration: number; // Total video duration in seconds
  extraDirectives?: string; // Additional instructions from user
}

export interface GeneratedSceneSpec {
  title: string;
  description: string;
  tags: string[];
  targetDuration: number;
  scenes: SceneObject[];
}

// ==================== SYSTEM PROMPT ====================

/**
 * System prompt for SceneSpec generation
 * Instructs the LLM to produce structured JSON output
 */
export const SCENE_SPEC_SYSTEM_PROMPT = `You are an expert content strategist and video scriptwriter specializing in short-form video content for social media.

Your task is to generate a structured video specification (SceneSpec) based on a content niche and tone direction.

OUTPUT FORMAT:
You must respond with valid JSON matching this exact structure:
{
  "title": "string - catchy, SEO-friendly video title",
  "description": "string - brief video description for social media",
  "tags": ["array", "of", "relevant", "tags"],
  "targetDuration": number (in seconds, matching the requested duration),
  "scenes": [
    {
      "order": 1,
      "voiceoverText": "string - what the narrator/speaker says in this scene",
      "visualIntent": "string - detailed description of what should appear visually",
      "durationHint": number or null (suggested seconds for this scene),
      "styleHints": { "key": "value" } or null (optional style guidance)
    }
  ]
}

GUIDELINES:
1. Create 3-5 scenes depending on duration (roughly 10-20 seconds per scene)
2. Voiceover text should be natural, conversational, and match the requested tone
3. Visual intent should be specific enough for video generation AI to render
4. Scene durations should sum to approximately the target duration
5. Tags should include niche-relevant keywords for discoverability
6. Title should be attention-grabbing and platform-appropriate

IMPORTANT:
- Respond ONLY with valid JSON, no markdown, no explanations
- Do not include any text before or after the JSON object
- Ensure scenes are ordered sequentially (order: 1, 2, 3, etc.)`;

// ==================== USER PROMPT TEMPLATE ====================

/**
 * User prompt template for SceneSpec generation
 * Variables: {niche}, {tone}, {duration}, {extraDirectives}
 */
export const SCENE_SPEC_USER_PROMPT_TEMPLATE = `Generate a SceneSpec for a {duration}-second video with the following parameters:

NICHE: {niche}
TONE: {tone}
TARGET DURATION: {duration} seconds

{extraDirectives}

Create a complete video specification with engaging scenes that fit this niche and tone. The content should be suitable for platforms like TikTok, Instagram Reels, or YouTube Shorts.`;

// ==================== UTILITY FUNCTIONS ====================

/**
 * Build the user prompt from input parameters
 */
export function buildSceneSpecPrompt(input: SceneSpecGenerationInput): string {
  let prompt = SCENE_SPEC_USER_PROMPT_TEMPLATE
    .replace(/{niche}/g, input.niche)
    .replace(/{tone}/g, input.tone)
    .replace(/{duration}/g, String(input.targetDuration));

  // Add extra directives if provided
  if (input.extraDirectives && input.extraDirectives.trim()) {
    prompt = prompt.replace(/{extraDirectives}/g, `ADDITIONAL INSTRUCTIONS: ${input.extraDirectives}`);
  } else {
    prompt = prompt.replace(/{extraDirectives}/g, '');
  }

  return prompt.trim();
}

/**
 * Validate the generated SceneSpec structure
 * Returns validation errors or null if valid
 */
export function validateGeneratedSceneSpec(data: unknown): string[] | null {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return ['Response is not a valid object'];
  }

  const spec = data as Record<string, unknown>;

  // Required string fields
  if (typeof spec.title !== 'string' || !spec.title.trim()) {
    errors.push('Missing or invalid title');
  }

  if (typeof spec.description !== 'string') {
    errors.push('Missing or invalid description');
  }

  // Target duration
  if (typeof spec.targetDuration !== 'number' || spec.targetDuration <= 0) {
    errors.push('Missing or invalid targetDuration');
  }

  // Tags array
  if (!Array.isArray(spec.tags)) {
    errors.push('Missing or invalid tags array');
  }

  // Scenes array
  if (!Array.isArray(spec.scenes) || spec.scenes.length === 0) {
    errors.push('Missing or empty scenes array');
  } else {
    spec.scenes.forEach((scene: unknown, index: number) => {
      if (!scene || typeof scene !== 'object') {
        errors.push(`Scene ${index + 1} is not a valid object`);
        return;
      }

      const s = scene as Record<string, unknown>;

      if (typeof s.order !== 'number') {
        errors.push(`Scene ${index + 1} missing order`);
      }

      if (typeof s.voiceoverText !== 'string' || !s.voiceoverText.trim()) {
        errors.push(`Scene ${index + 1} missing voiceoverText`);
      }

      if (typeof s.visualIntent !== 'string' || !s.visualIntent.trim()) {
        errors.push(`Scene ${index + 1} missing visualIntent`);
      }
    });
  }

  return errors.length > 0 ? errors : null;
}

/**
 * Parse and validate LLM response into GeneratedSceneSpec
 * Throws if invalid
 */
export function parseSceneSpecResponse(responseText: string): GeneratedSceneSpec {
  // Try to extract JSON from response (in case LLM adds extra text)
  let jsonStr = responseText.trim();

  // If response starts with markdown code block, extract the JSON
  if (jsonStr.startsWith('```')) {
    const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      jsonStr = match[1].trim();
    }
  }

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(`Failed to parse SceneSpec JSON: ${e instanceof Error ? e.message : 'Unknown parse error'}`);
  }

  // Validate structure
  const validationErrors = validateGeneratedSceneSpec(parsed);
  if (validationErrors) {
    throw new Error(`Invalid SceneSpec structure: ${validationErrors.join(', ')}`);
  }

  return parsed as GeneratedSceneSpec;
}

// ==================== EXPORTS ====================

export default {
  SCENE_SPEC_SYSTEM_PROMPT,
  SCENE_SPEC_USER_PROMPT_TEMPLATE,
  buildSceneSpecPrompt,
  validateGeneratedSceneSpec,
  parseSceneSpecResponse,
};
