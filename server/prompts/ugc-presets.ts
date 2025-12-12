/**
 * UGC Ad Studio - Preset Prompt Templates (Phase 3)
 *
 * Template-based prompt system with variable injection for consistent UGC-style ads
 * Supports 3 generation modes:
 * - MODE_A: NanoBanana + Veo3 (best quality, chained workflow)
 * - MODE_B: Veo3 only (faster, direct generation)
 * - MODE_C: Sora 2 (cheaper fallback)
 *
 * Variables: {product}, {features}, {icp}, {scene}
 */

// ==================== ENUMS ====================

export enum GenerationMode {
  MODE_A = "nanobana+veo3",  // NanoBanana image → Veo3 video (default)
  MODE_B = "veo3-only",      // Veo3 video only (faster)
  MODE_C = "sora2"           // Sora 2 video (cheaper)
}

// ==================== INTERFACES ====================

export interface PromptVariables {
  product: string;      // Product name (e.g., "Protein Powder X")
  features: string;     // Key features (e.g., "30g protein, chocolate flavor, keto-friendly")
  icp: string;          // Ideal customer persona (e.g., "Fitness enthusiast in their 20s-30s")
  scene: string;        // Video setting (e.g., "Modern gym", "Kitchen counter", "Office desk")
  duration?: number;    // Video duration in seconds (default: 10)
}

export interface PromptTemplate {
  systemRole: string;
  template: string;
}

// ==================== PRESET TEMPLATES ====================

/**
 * Mode A & B: NanoBanana Image Prompt
 * Creates hyper-realistic selfie-style photo of person holding product
 */
export const IMAGE_PROMPT_TEMPLATE: PromptTemplate = {
  systemRole: "You are a hyper-realistic UGC photography creator specializing in authentic influencer-style product shots.",
  template: `Create a hyper-realistic selfie-style photograph with the following specifications:

SUBJECT: {icp} holding {product}
SETTING: {scene}
PRODUCT FEATURES TO HIGHLIGHT: {features}

STYLE REQUIREMENTS:
- Shot on iPhone 15 Pro (natural imperfections expected)
- Natural daylight or soft indoor lighting
- Genuine smile, making eye contact with camera
- Casual, relatable environment (not studio-perfect)
- Product clearly visible in hand, label facing camera
- Background slightly blurred (portrait mode effect)

MOOD: Authentic, friendly, trustworthy - NOT overly polished or commercial

OUTPUT: A single photorealistic image that looks like a real person took a selfie with their phone to show off a product they genuinely love.`
};

/**
 * Mode A: Veo3 Video Prompt (After NanoBanana Image Analysis)
 * Note: This template uses {imageAnalysis} from OpenAI Vision instead of standard variables
 * Duration is dynamic via {duration} variable
 */
export const VIDEO_PROMPT_VEO3_CHAINED: PromptTemplate = {
  systemRole: "You are an expert UGC video creator specializing in authentic, influencer-style product demonstrations.",
  template: `Create a {duration}-second selfie-style UGC video based on this reference image:

IMAGE ANALYSIS: {imageAnalysis}

VIDEO SPECIFICATIONS:
- Duration: Exactly {duration} seconds
- Format: Vertical 9:16 (1080x1920) - TikTok/Reels style
- Style: Handheld selfie video (slight natural shake is good)
- Camera: iPhone 15 Pro quality
- Audio: Person speaks naturally to camera in casual, friendly tone

FRAMING (CRITICAL):
- Medium close-up: head and shoulders visible, face fully in frame
- Subject centered, filling ~60% of vertical frame
- Full face visible: forehead to chin, no cropping
- Eye-level camera angle (selfie style)
- Leave small margin at top and bottom of frame

DIALOGUE SCRIPT (1-2 sentences max):
"{icp} casually mentions {product} while highlighting {features}. Tone is genuine enthusiasm, NOT scripted sales pitch."

ACTIONS:
- Person holds product naturally (like they're showing it to a friend)
- Makes eye contact with camera throughout
- Small natural gestures (e.g., pointing at product label, slight smile)
- Product stays in frame the entire time

SETTING: {scene} (keep background similar to reference image)

MOOD: Authentic, relatable, trustworthy - as if a real customer is sharing their experience

IMPORTANT: Maintain visual consistency with the reference image (same person, similar lighting, same environment).`
};

/**
 * Mode B: Veo3 Video Prompt (Direct, No Reference Image)
 * Standalone video generation without NanoBanana chain
 * Duration is dynamic via {duration} variable
 */
export const VIDEO_PROMPT_VEO3_DIRECT: PromptTemplate = {
  systemRole: "You are an expert UGC video creator specializing in authentic, influencer-style product demonstrations.",
  template: `Create a {duration}-second selfie-style UGC product video with the following specifications:

SUBJECT: {icp}
PRODUCT: {product}
FEATURES TO MENTION: {features}
SETTING: {scene}

VIDEO REQUIREMENTS:
- Duration: Exactly {duration} seconds
- Format: Vertical 9:16 (1080x1920) - TikTok/Reels style
- Style: Handheld selfie video (natural camera shake expected)
- Camera: iPhone 15 Pro quality (realistic, not overproduced)
- Lighting: Natural daylight or soft indoor light
- Person holds phone at arm's length, filming themselves

FRAMING (CRITICAL):
- Medium close-up: head and shoulders visible, face fully in frame
- Subject centered, filling ~60% of vertical frame
- Full face visible: forehead to chin, no cropping
- Eye-level camera angle (not looking down or up)
- Leave small margin at top and bottom of frame

DIALOGUE SCRIPT (casual, 1-2 sentences):
Person speaks naturally to camera about {product}, mentioning {features} in a genuine, enthusiastic way. NOT a scripted sales pitch - sounds like a friend recommending something they love.

ACTIONS:
- Person holds {product} in their hand, clearly visible to camera
- Makes eye contact with camera throughout
- Natural gestures (e.g., pointing at product, slight smile, nodding)
- Product label/branding faces camera
- Slight movement (person may shift weight, tilt head naturally)

MOOD: Authentic, relatable, trustworthy - like a real customer review, not an ad

IMPORTANT: Must feel like genuine UGC content, not a professional commercial. Imperfections are encouraged.`
};

/**
 * Mode C: Sora 2 Video Prompt
 * Cheaper alternative with similar UGC style
 * Duration is dynamic via {duration} variable (Sora2 supports 10s or 15s only)
 */
export const VIDEO_PROMPT_SORA2: PromptTemplate = {
  systemRole: "You are a UGC video creator for social media ads, optimizing for Sora 2's strengths in natural motion and realistic dialogue.",
  template: `Generate a {duration}-second vertical selfie video for social media:

SUBJECT: {icp} filming themselves with {product}
LOCATION: {scene}
KEY FEATURES: {features}

VIDEO STYLE:
- Vertical 9:16 format (1080x1920) for TikTok/Instagram Reels
- Duration: Exactly {duration} seconds
- Handheld selfie (natural shake, not stabilized)
- Natural lighting (avoid harsh shadows)
- Casual, authentic vibe

FRAMING (CRITICAL):
- Medium close-up: head and shoulders visible, face fully in frame
- Subject centered, filling ~60% of vertical frame
- Full face visible: forehead to chin, no cropping
- Eye-level camera angle (selfie style)
- Leave small margin at top and bottom of frame

CONTENT:
Person holds phone in one hand, {product} in the other. They speak directly to camera for {duration} seconds, casually explaining why they love {product}, specifically mentioning {features}. Tone is friendly and genuine, like talking to a friend.

DIALOGUE EXAMPLE:
"Hey! So I've been using {product} and honestly it's been amazing. {features} - like, way better than what I was using before. Definitely recommend trying it!"

VISUAL ELEMENTS:
- Clear view of product label
- Person makes eye contact with camera
- Natural facial expressions (smiles, nods)
- Relaxed body language

AVOID:
- Overly polished or "commercial" feel
- Perfect lighting or studio setup
- Scripted-sounding dialogue
- Static, unnatural poses

GOAL: Create content that looks like authentic user-generated content, not a professional ad.`
};

// ==================== UTILITY FUNCTIONS ====================

/**
 * Sanitize string to prevent JSON corruption in API requests
 * - Removes newlines (replace with spaces)
 * - Escapes double quotes
 * - Trims whitespace
 */
export function sanitizeString(str: string): string {
  return str
    .replace(/\n/g, ' ')        // Replace newlines with spaces
    .replace(/\r/g, '')         // Remove carriage returns
    .replace(/"/g, '\\"')       // Escape double quotes
    .replace(/\s+/g, ' ')       // Collapse multiple spaces
    .trim();                    // Remove leading/trailing whitespace
}

/**
 * Inject variables into prompt template
 * Replaces {product}, {features}, {icp}, {scene}, {duration} with actual values
 */
export function injectVariables(
  template: string,
  vars: PromptVariables
): string {
  let result = template;

  // Replace all variable placeholders
  result = result.replace(/{product}/g, vars.product);
  result = result.replace(/{features}/g, vars.features);
  result = result.replace(/{icp}/g, vars.icp);
  result = result.replace(/{scene}/g, vars.scene);
  result = result.replace(/{duration}/g, String(vars.duration || 10)); // Default 10s

  return result;
}

/**
 * Inject image analysis into Veo3 chained prompt
 * Used specifically for Mode A (NanoBanana + Veo3)
 */
export function injectImageAnalysis(
  template: string,
  imageAnalysis: string,
  vars: Pick<PromptVariables, 'icp' | 'product' | 'features' | 'scene' | 'duration'>
): string {
  let result = template;

  // Replace image analysis placeholder
  result = result.replace(/{imageAnalysis}/g, imageAnalysis);

  // Replace remaining standard variables
  result = result.replace(/{icp}/g, vars.icp);
  result = result.replace(/{product}/g, vars.product);
  result = result.replace(/{features}/g, vars.features);
  result = result.replace(/{scene}/g, vars.scene);
  result = result.replace(/{duration}/g, String(vars.duration || 10)); // Default 10s

  return result;
}

/**
 * Generate complete prompt for a given mode and variables
 * Returns the final prompt ready to send to AI provider
 */
export function generatePrompt(
  mode: GenerationMode,
  vars: PromptVariables,
  imageAnalysis?: string
): string {
  let template: PromptTemplate;

  switch (mode) {
    case GenerationMode.MODE_A:
      // If imageAnalysis provided, use chained Veo3 prompt
      if (imageAnalysis) {
        template = VIDEO_PROMPT_VEO3_CHAINED;
        return sanitizeString(
          injectImageAnalysis(template.template, imageAnalysis, vars)
        );
      }
      // Otherwise, generate NanoBanana image first
      template = IMAGE_PROMPT_TEMPLATE;
      break;

    case GenerationMode.MODE_B:
      template = VIDEO_PROMPT_VEO3_DIRECT;
      break;

    case GenerationMode.MODE_C:
      template = VIDEO_PROMPT_SORA2;
      break;

    default:
      throw new Error(`Unknown generation mode: ${mode}`);
  }

  const filledTemplate = injectVariables(template.template, vars);
  return sanitizeString(filledTemplate);
}

/**
 * Get the system role for a given mode
 * Used for AI provider configuration (e.g., OpenAI system message)
 */
export function getSystemRole(mode: GenerationMode): string {
  switch (mode) {
    case GenerationMode.MODE_A:
      return IMAGE_PROMPT_TEMPLATE.systemRole; // Will switch to video role after image generation
    case GenerationMode.MODE_B:
      return VIDEO_PROMPT_VEO3_DIRECT.systemRole;
    case GenerationMode.MODE_C:
      return VIDEO_PROMPT_SORA2.systemRole;
    default:
      throw new Error(`Unknown generation mode: ${mode}`);
  }
}

/**
 * Convert ICP dropdown value to human-readable text for prompts
 * Examples:
 * - "fitness-enthusiast-20s-30s" → "Fitness enthusiast in their 20s-30s"
 * - "busy-professional-25-40" → "Busy professional in their 25-40"
 */
export function formatICPForPrompt(value: string): string {
  // Map of ICP values to formatted text
  const icpMap: Record<string, string> = {
    "fitness-enthusiast-20s-30s": "Fitness enthusiast in their 20s-30s",
    "busy-professional-25-40": "Busy professional in their 25-40",
    "health-conscious-parent-30s-40s": "Health-conscious parent in their 30s-40s",
    "wellness-influencer-20s-30s": "Wellness influencer in their 20s-30s",
    "college-student-18-25": "College student in their 18-25",
    "beauty-skincare-enthusiast-20s-40s": "Beauty & skincare enthusiast in their 20s-40s",
    "tech-savvy-millennial-25-35": "Tech-savvy millennial in their 25-35",
    "outdoor-adventurer-20s-40s": "Outdoor adventurer in their 20s-40s",
  };

  return icpMap[value] || value;
}

/**
 * Convert scene dropdown value to descriptive text for prompts
 * Examples:
 * - "modern-gym" → "Modern gym with weights, mirrors, and fitness equipment in background"
 * - "kitchen-counter" → "Kitchen counter with bright, clean kitchen with natural lighting"
 */
export function formatSceneForPrompt(value: string): string {
  // Map of scene values to formatted text
  const sceneMap: Record<string, string> = {
    "modern-gym": "Modern gym with weights, mirrors, and fitness equipment in background",
    "kitchen-counter": "Kitchen counter with bright, clean kitchen with natural lighting",
    "office-desk": "Office desk with professional workspace with laptop and coffee",
    "outdoor-park": "Outdoor park with natural scenery with trees and greenery",
    "cozy-living-room": "Cozy living room with comfortable home setting with soft lighting",
    "bathroom-mirror": "Bathroom mirror with bright bathroom ideal for skincare/beauty products",
    "coffee-shop": "Coffee shop with casual café environment with warm ambiance",
    "bedroom-morning": "Bedroom (morning) with relaxed morning routine setting with natural light",
    "car-interior": "Car interior (inside vehicle, great for on-the-go products)",
    "yoga-studio": "Yoga studio with calm, minimalist space with mats and props",
  };

  return sceneMap[value] || value;
}

// ==================== EXPORTS ====================

export default {
  GenerationMode,
  IMAGE_PROMPT_TEMPLATE,
  VIDEO_PROMPT_VEO3_CHAINED,
  VIDEO_PROMPT_VEO3_DIRECT,
  VIDEO_PROMPT_SORA2,
  sanitizeString,
  injectVariables,
  injectImageAnalysis,
  generatePrompt,
  getSystemRole,
  formatICPForPrompt,
  formatSceneForPrompt,
};
