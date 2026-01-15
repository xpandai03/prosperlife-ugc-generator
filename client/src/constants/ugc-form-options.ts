/**
 * UGC Ad Studio - Form Options (Phase 4)
 *
 * Dropdown options for simplified 5-field product brief form
 * - Customer Personas (ICP)
 * - Video Settings (Scene)
 * - Generation Modes
 */

// ==================== CUSTOMER PERSONAS (ICP) ====================

export interface ICPOption {
  value: string;
  label: string;
  description: string;
}

export const ICP_OPTIONS: ICPOption[] = [
  {
    value: "fitness-enthusiast-20s-30s",
    label: "Fitness Enthusiast (20s-30s)",
    description: "Active gym-goers who prioritize health and wellness"
  },
  {
    value: "busy-professional-25-40",
    label: "Busy Professional (25-40)",
    description: "Career-focused individuals seeking efficiency and quality"
  },
  {
    value: "health-conscious-parent-30s-40s",
    label: "Health-Conscious Parent (30s-40s)",
    description: "Parents looking for family-friendly, healthy products"
  },
  {
    value: "wellness-influencer-20s-30s",
    label: "Wellness Influencer (20s-30s)",
    description: "Content creators focused on lifestyle and self-care"
  },
  {
    value: "college-student-18-25",
    label: "College Student (18-25)",
    description: "Young adults seeking affordable, trendy solutions"
  },
  {
    value: "beauty-skincare-enthusiast-20s-40s",
    label: "Beauty & Skincare Lover (20s-40s)",
    description: "Individuals passionate about skincare and beauty routines"
  },
  {
    value: "tech-savvy-millennial-25-35",
    label: "Tech-Savvy Millennial (25-35)",
    description: "Early adopters who value innovation and convenience"
  },
  {
    value: "outdoor-adventurer-20s-40s",
    label: "Outdoor Adventurer (20s-40s)",
    description: "Active individuals who enjoy hiking, camping, and nature"
  },
];

// ==================== VIDEO SETTINGS (SCENE) ====================

export interface SceneOption {
  value: string;
  label: string;
  description: string;
  emoji: string;
}

export const SCENE_OPTIONS: SceneOption[] = [
  {
    value: "modern-gym",
    label: "Modern Gym",
    description: "Weights, mirrors, and fitness equipment in background",
    emoji: "🏋️"
  },
  {
    value: "kitchen-counter",
    label: "Kitchen Counter",
    description: "Bright, clean kitchen with natural lighting",
    emoji: "🍳"
  },
  {
    value: "office-desk",
    label: "Office Desk",
    description: "Professional workspace with laptop and coffee",
    emoji: "💼"
  },
  {
    value: "outdoor-park",
    label: "Outdoor Park",
    description: "Natural scenery with trees and greenery",
    emoji: "🌳"
  },
  {
    value: "cozy-living-room",
    label: "Cozy Living Room",
    description: "Comfortable home setting with soft lighting",
    emoji: "🛋️"
  },
  {
    value: "bathroom-mirror",
    label: "Bathroom Mirror",
    description: "Bright bathroom ideal for skincare/beauty products",
    emoji: "🪞"
  },
  {
    value: "coffee-shop",
    label: "Coffee Shop",
    description: "Casual café environment with warm ambiance",
    emoji: "☕"
  },
  {
    value: "bedroom-morning",
    label: "Bedroom (Morning)",
    description: "Relaxed morning routine setting with natural light",
    emoji: "🛏️"
  },
  {
    value: "car-interior",
    label: "Car Interior",
    description: "Inside vehicle (great for on-the-go products)",
    emoji: "🚗"
  },
  {
    value: "yoga-studio",
    label: "Yoga Studio",
    description: "Calm, minimalist space with mats and props",
    emoji: "🧘"
  },
];

// ==================== GENERATION MODES ====================

export interface ModeOption {
  value: string;
  label: string;
  description: string;
  badge: string;
  estimatedTime: string;
  maxDuration: number; // Maximum allowed duration in seconds
}

export const MODE_OPTIONS: ModeOption[] = [
  {
    value: "nanobana+veo3",
    label: "Mode A: Premium Quality",
    description: "Best visuals, short clips (~8s max)",
    badge: "RECOMMENDED",
    estimatedTime: "~2-3 min",
    maxDuration: 8, // Provider hard-caps at ~8s for image-to-video
  },
  {
    value: "veo3-only",
    label: "Mode B: Fast",
    description: "Balanced quality, supports longer videos (up to 20s)",
    badge: "FASTER",
    estimatedTime: "~1-2 min",
    maxDuration: 20,
  },
  {
    value: "sora2",
    label: "Mode C: Budget",
    description: "Budget option, strict duration limits (up to 15s)",
    badge: "CHEAPER",
    estimatedTime: "~1-2 min",
    maxDuration: 15, // Sora2 non-storyboard models only support n_frames "10" or "15"
  },
];

// ==================== VIDEO DURATION OPTIONS ====================

export interface DurationOption {
  value: number;
  label: string;
}

export const DURATION_OPTIONS: DurationOption[] = [
  { value: 8, label: "8 seconds" },
  { value: 10, label: "10 seconds" },
  { value: 15, label: "15 seconds" },
  { value: 20, label: "20 seconds" },
  { value: 25, label: "25 seconds" },
];

/**
 * Get allowed durations for a given generation mode
 */
export function getAllowedDurations(mode: string): number[] {
  const modeOption = MODE_OPTIONS.find(opt => opt.value === mode);
  const maxDuration = modeOption?.maxDuration || 20;
  return DURATION_OPTIONS
    .filter(opt => opt.value <= maxDuration)
    .map(opt => opt.value);
}

/**
 * Check if a duration is valid for a given mode
 */
export function isValidDuration(mode: string, duration: number): boolean {
  const allowedDurations = getAllowedDurations(mode);
  return allowedDurations.includes(duration);
}

/**
 * Get the default duration (10 seconds)
 */
export const DEFAULT_DURATION = 6

// ==================== HELPER FUNCTIONS ====================

/**
 * Get ICP description text from value
 */
export function getICPDescription(value: string): string {
  const option = ICP_OPTIONS.find(opt => opt.value === value);
  return option?.description || '';
}

/**
 * Get scene description text from value
 */
export function getSceneDescription(value: string): string {
  const option = SCENE_OPTIONS.find(opt => opt.value === value);
  return option?.description || '';
}

/**
 * Get mode info from value
 */
export function getModeInfo(value: string): ModeOption | null {
  return MODE_OPTIONS.find(opt => opt.value === value) || null;
}

/**
 * Convert form value to human-readable text for prompt variables
 */
export function formatICPForPrompt(value: string): string {
  const option = ICP_OPTIONS.find(opt => opt.value === value);
  if (!option) return value;

  // Extract age range and persona name
  // "Fitness Enthusiast (20s-30s)" → "Fitness enthusiast in their 20s-30s"
  const match = option.label.match(/^(.+?)\s*\((.+?)\)$/);
  if (match) {
    const [, persona, ageRange] = match;
    return `${persona} in their ${ageRange}`;
  }

  return option.label;
}

/**
 * Convert scene value to descriptive text for prompts
 */
export function formatSceneForPrompt(value: string): string {
  const option = SCENE_OPTIONS.find(opt => opt.value === value);
  if (!option) return value;

  // Use the label with additional context from description
  return `${option.label} with ${option.description.toLowerCase()}`;
}
