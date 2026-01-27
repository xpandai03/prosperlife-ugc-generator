/**
 * Remotion Code Generation Prompts (Jan 2026)
 * 
 * Prompt templates for generating Remotion React code from SceneSpecs.
 * Used by the Remotion renderer to create video compositions via Claude API.
 */

import type { SceneObject } from '../../shared/schema';

// ==================== SYSTEM PROMPT ====================

export const REMOTION_SYSTEM_PROMPT = `You are a Remotion video developer. You generate React components for Remotion video compositions.

CRITICAL RULES:
1. Output ONLY valid TypeScript/React code - no markdown, no explanations
2. Use only Remotion's built-in components and hooks
3. All imports must be from 'remotion' package only
4. The code must be a single file with a default export
5. All assets (video, audio, images) are provided as external URLs
6. Never use local file paths - only https:// URLs
7. The composition must match the exact duration specified

ALLOWED REMOTION IMPORTS:
- AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig
- spring, interpolate, Easing
- Audio, Video, Img, OffthreadVideo
- staticFile (but prefer external URLs)

CODE STRUCTURE:
\`\`\`tsx
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, Audio, OffthreadVideo, interpolate } from 'remotion';

// Scene components
const Scene1 = () => { ... };
const Scene2 = () => { ... };

// Main composition (default export)
const MyComposition = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Sequence from={0} durationInFrames={...}>
        <Scene1 />
      </Sequence>
      ...
      <Audio src="..." />
    </AbsoluteFill>
  );
};

export default MyComposition;
\`\`\`

STYLE GUIDELINES:
- Use dark backgrounds (#000, #111, #1a1a1a) for cinematic feel
- Text should be white or light colored with good contrast
- Use subtle animations (fade in, scale, slide)
- Keep visual effects minimal and professional
- Center important text elements

OUTPUT FORMAT:
Return ONLY the complete TypeScript code. No markdown code blocks, no explanations.`;

// ==================== USER PROMPT TEMPLATE ====================

export interface RemotionPromptInput {
  title: string;
  description: string;
  targetDurationSeconds: number;
  fps: number;
  width: number;
  height: number;
  scenes: Array<{
    order: number;
    voiceoverText: string;
    visualIntent: string;
    durationHint?: number;
    audioUrl: string;
    videoUrls: string[];
  }>;
  fullAudioUrl?: string; // Combined audio for entire video
}

/**
 * Build the user prompt for Remotion code generation
 */
export function buildRemotionPrompt(input: RemotionPromptInput): string {
  const totalFrames = input.targetDurationSeconds * input.fps;
  
  // Calculate frame ranges for each scene
  let currentFrame = 0;
  const scenesWithFrames = input.scenes.map((scene, index) => {
    const sceneDuration = scene.durationHint || Math.round(input.targetDurationSeconds / input.scenes.length);
    const sceneFrames = sceneDuration * input.fps;
    const startFrame = currentFrame;
    currentFrame += sceneFrames;
    
    return {
      ...scene,
      startFrame,
      durationFrames: sceneFrames,
      endFrame: startFrame + sceneFrames,
    };
  });

  const scenesDescription = scenesWithFrames.map((scene, index) => {
    return `
SCENE ${scene.order} (frames ${scene.startFrame} to ${scene.endFrame - 1}, ~${scene.durationHint || Math.round(input.targetDurationSeconds / input.scenes.length)}s):
- Visual Intent: "${scene.visualIntent}"
- Voiceover Text: "${scene.voiceoverText}"
- Background Video URL: ${scene.videoUrls[0] || 'none'}
- Scene Audio URL: ${scene.audioUrl}
`;
  }).join('\n');

  return `Generate a Remotion composition for the following video:

VIDEO METADATA:
- Title: "${input.title}"
- Description: "${input.description}"
- Total Duration: ${input.targetDurationSeconds} seconds
- Total Frames: ${totalFrames} frames
- FPS: ${input.fps}
- Resolution: ${input.width}x${input.height} (${input.width > input.height ? 'landscape' : 'portrait'})

SCENES:
${scenesDescription}

${input.fullAudioUrl ? `FULL AUDIO TRACK:
- URL: ${input.fullAudioUrl}
- This audio covers the entire video. Use this instead of individual scene audio.` : ''}

REQUIREMENTS:
1. Create a component for each scene that displays:
   - The background video (OffthreadVideo with the provided URL)
   - An overlay with the voiceover text (styled nicely, fading in/out)
   - Smooth transition between scenes

2. Scene Text Display:
   - Show voiceover text as a caption/subtitle at the bottom
   - Use white text on semi-transparent dark background
   - Fade in at scene start, fade out at scene end
   - Font size appropriate for the resolution

3. Video Background:
   - Use OffthreadVideo for each scene's background
   - Set objectFit to 'cover' to fill the frame
   - Loop the video if it's shorter than the scene duration

4. Audio:
   - Include the ${input.fullAudioUrl ? 'full audio track' : 'scene audio files'} using the Audio component
   - Audio should sync with the visual scenes

5. Timing:
   - Use Sequence components to control scene timing
   - Each scene starts exactly where the previous one ends
   - Total composition must be exactly ${totalFrames} frames

Generate the complete, runnable Remotion composition code now:`;
}

// ==================== CODE VALIDATION ====================

/**
 * Validate generated Remotion code
 * Returns { valid: true } or { valid: false, error: string }
 */
export function validateRemotionCode(code: string): { valid: boolean; error?: string } {
  // Check for required imports
  if (!code.includes("from 'remotion'") && !code.includes('from "remotion"')) {
    return { valid: false, error: 'Missing remotion import' };
  }

  // Check for default export
  if (!code.includes('export default') && !code.includes('export { default }')) {
    return { valid: false, error: 'Missing default export' };
  }

  // Check for dangerous patterns
  const dangerousPatterns = [
    /require\s*\(/,           // No require()
    /import.*from\s*['"][^'"]/, // Only allow 'remotion' import
    /eval\s*\(/,              // No eval
    /Function\s*\(/,          // No Function constructor
    /process\./,              // No process access
    /fs\./,                   // No filesystem access
    /child_process/,          // No child processes
    /__dirname/,              // No directory access
    /__filename/,             // No filename access
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(code)) {
      // Special case: allow 'remotion' imports
      if (pattern.source.includes('import') && code.match(/import.*from\s*['"]remotion['"]/)) {
        continue;
      }
      return { valid: false, error: `Dangerous pattern detected: ${pattern.source}` };
    }
  }

  // Check for AbsoluteFill (required for proper layout)
  if (!code.includes('AbsoluteFill')) {
    return { valid: false, error: 'Missing AbsoluteFill component' };
  }

  // Check for basic React component structure
  if (!code.includes('return') || !code.includes('<')) {
    return { valid: false, error: 'Invalid React component structure' };
  }

  // Check for frame-based timing (should use useCurrentFrame or Sequence)
  if (!code.includes('Sequence') && !code.includes('useCurrentFrame')) {
    return { valid: false, error: 'Missing frame-based timing (Sequence or useCurrentFrame)' };
  }

  return { valid: true };
}

/**
 * Clean up generated code (remove markdown fences, fix common issues)
 */
export function cleanRemotionCode(code: string): string {
  // Remove markdown code fences
  let cleaned = code
    .replace(/^```tsx?\n?/gm, '')
    .replace(/^```\n?$/gm, '')
    .trim();

  // Remove any leading/trailing explanations
  const importIndex = cleaned.indexOf('import');
  if (importIndex > 0) {
    cleaned = cleaned.substring(importIndex);
  }

  // Remove any trailing text after the export
  const lastExportIndex = cleaned.lastIndexOf('export default');
  if (lastExportIndex !== -1) {
    // Find the end of the export statement
    let braceCount = 0;
    let inExport = false;
    let endIndex = cleaned.length;
    
    for (let i = lastExportIndex; i < cleaned.length; i++) {
      const char = cleaned[i];
      if (char === '{' || char === '(') {
        braceCount++;
        inExport = true;
      } else if (char === '}' || char === ')') {
        braceCount--;
        if (inExport && braceCount === 0) {
          // Look for semicolon or end
          const nextSemi = cleaned.indexOf(';', i);
          endIndex = nextSemi !== -1 ? nextSemi + 1 : i + 1;
          break;
        }
      }
    }
    
    cleaned = cleaned.substring(0, endIndex).trim();
  }

  return cleaned;
}

// ==================== EXPORTS ====================

export const remotionPrompts = {
  systemPrompt: REMOTION_SYSTEM_PROMPT,
  buildUserPrompt: buildRemotionPrompt,
  validateCode: validateRemotionCode,
  cleanCode: cleanRemotionCode,
};

export default remotionPrompts;
