/**
 * Media Generation Validation Schemas
 *
 * Zod schemas for validating AI media generation requests
 */

import { z } from "zod";

/**
 * Schema for AI media generation request
 */
export const generateMediaSchema = z.object({
  prompt: z
    .string({ required_error: "Prompt is required" })
    .min(10, "Prompt must be at least 10 characters")
    .max(1000, "Prompt cannot exceed 1000 characters"),

  provider: z
    .enum(["kie-veo3", "kie-4o-image", "kie-flux-kontext", "gemini-flash"], {
      errorMap: () => ({
        message: "Invalid provider. Must be: kie-veo3, kie-4o-image, kie-flux-kontext, or gemini-flash",
      }),
    }),

  type: z
    .enum(["image", "video"], {
      errorMap: () => ({
        message: "Type must be 'image' or 'video'",
      }),
    }),

  referenceImageUrl: z
    .string()
    .url("Reference image must be a valid URL")
    .optional(),

  options: z
    .object({
      // Video options (KIE Veo3)
      aspectRatio: z.enum(["16:9", "9:16", "1:1"]).optional(),
      resolution: z.enum(["720p", "1080p"]).optional(),

      // Image options (KIE 4O / Flux)
      size: z.enum(["1:1", "3:2", "2:3"]).optional(),
      nVariants: z.enum([1, 2, 4]).optional(),
      style: z.string().max(200).optional(),
    })
    .optional(),
});

export type GenerateMediaInput = z.infer<typeof generateMediaSchema>;

/**
 * Provider-specific limits and capabilities
 */
export const PROVIDER_CAPABILITIES = {
  "kie-veo3": {
    supportedTypes: ['video'],
    maxPromptLength: 1000,
    maxDuration: 8, // seconds
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
  },
  "kie-4o-image": {
    supportedTypes: ['image'],
    maxPromptLength: 1000,
    supportedSizes: ['1:1', '3:2', '2:3'],
    maxVariants: 4,
  },
  "kie-flux-kontext": {
    supportedTypes: ['image'],
    maxPromptLength: 1000,
    supportedAspectRatios: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16', '16:21'],
  },
  "gemini-flash": {
    supportedTypes: ['image'],
    maxPromptLength: 1000,
    supportedAspectRatios: ['1:1', '16:9', '9:16'],
  },
} as const;

/**
 * Validate provider/type combination
 */
export function validateProviderType(provider: string, type: string): boolean {
  const capabilities = PROVIDER_CAPABILITIES[provider as keyof typeof PROVIDER_CAPABILITIES];
  if (!capabilities) return false;
  return capabilities.supportedTypes.includes(type as any);
}
