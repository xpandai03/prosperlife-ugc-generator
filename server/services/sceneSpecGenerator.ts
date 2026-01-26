/**
 * SceneSpec Generator Service (Jan 2026)
 *
 * Generates structured SceneSpecs from ChannelConfig using OpenAI
 * Part of the Content Engine feature
 */

import type { ChannelConfig, SceneObject } from '../../shared/schema';
import {
  SCENE_SPEC_SYSTEM_PROMPT,
  buildSceneSpecPrompt,
  parseSceneSpecResponse,
  type GeneratedSceneSpec,
  type SceneSpecGenerationInput,
} from '../prompts/content-engine';

// OpenAI configuration (reuse from existing openai.ts pattern)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
const OPENAI_BASE_URL = 'https://api.openai.com/v1';

// ==================== INTERFACES ====================

export interface SceneSpecGenerationResult {
  success: boolean;
  sceneSpec?: GeneratedSceneSpec;
  error?: string;
  metadata: {
    model: string;
    tokensUsed?: number;
    generatedAt: string;
    inputParams: SceneSpecGenerationInput;
  };
}

// ==================== SERVICE ====================

export const sceneSpecGenerator = {
  /**
   * Generate a SceneSpec from a ChannelConfig
   *
   * @param config - The channel configuration
   * @param durationOverride - Optional override for target duration
   * @returns Generated SceneSpec with metadata
   */
  async generateFromConfig(
    config: ChannelConfig,
    durationOverride?: number
  ): Promise<SceneSpecGenerationResult> {
    if (!OPENAI_API_KEY) {
      return {
        success: false,
        error: 'OPENAI_API_KEY is not configured',
        metadata: {
          model: OPENAI_MODEL,
          generatedAt: new Date().toISOString(),
          inputParams: {
            niche: config.niche,
            tone: config.tone,
            targetDuration: durationOverride || config.defaultDuration,
          },
        },
      };
    }

    const input: SceneSpecGenerationInput = {
      niche: config.niche,
      tone: config.tone,
      targetDuration: durationOverride || config.defaultDuration,
      extraDirectives: config.extraDirectives
        ? JSON.stringify(config.extraDirectives)
        : undefined,
    };

    console.log('[SceneSpec Generator] Generating SceneSpec:', {
      niche: input.niche,
      tone: input.tone,
      duration: input.targetDuration,
      hasExtraDirectives: !!input.extraDirectives,
    });

    try {
      const userPrompt = buildSceneSpecPrompt(input);

      const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages: [
            {
              role: 'system',
              content: SCENE_SPEC_SYSTEM_PROMPT,
            },
            {
              role: 'user',
              content: userPrompt,
            },
          ],
          temperature: 0.7, // Balanced creativity
          max_tokens: 2000, // Allow for detailed scene descriptions
          response_format: { type: 'json_object' }, // Force JSON output
        }),
      });

      // Safe response parsing
      const responseText = await response.text();

      if (responseText.trim() === '') {
        console.error('[SceneSpec Generator] Empty response body received');
        return {
          success: false,
          error: `OpenAI API returned empty response (HTTP ${response.status})`,
          metadata: {
            model: OPENAI_MODEL,
            generatedAt: new Date().toISOString(),
            inputParams: input,
          },
        };
      }

      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('[SceneSpec Generator] JSON parse error:', parseError);
        return {
          success: false,
          error: `OpenAI API returned invalid JSON: ${responseText.substring(0, 200)}`,
          metadata: {
            model: OPENAI_MODEL,
            generatedAt: new Date().toISOString(),
            inputParams: input,
          },
        };
      }

      if (!response.ok) {
        console.error('[SceneSpec Generator] API Error:', {
          status: response.status,
          error: data,
        });
        return {
          success: false,
          error: `OpenAI API Error (${response.status}): ${data.error?.message || 'Unknown error'}`,
          metadata: {
            model: OPENAI_MODEL,
            generatedAt: new Date().toISOString(),
            inputParams: input,
          },
        };
      }

      // Extract content from response
      const content = data.choices?.[0]?.message?.content;

      if (!content || content.trim() === '') {
        console.error('[SceneSpec Generator] No content in response:', data);
        return {
          success: false,
          error: 'OpenAI API returned empty content',
          metadata: {
            model: data.model || OPENAI_MODEL,
            tokensUsed: data.usage?.total_tokens,
            generatedAt: new Date().toISOString(),
            inputParams: input,
          },
        };
      }

      // Parse and validate the SceneSpec
      const sceneSpec = parseSceneSpecResponse(content);

      console.log('[SceneSpec Generator] SceneSpec generated successfully:', {
        title: sceneSpec.title,
        sceneCount: sceneSpec.scenes.length,
        tagCount: sceneSpec.tags.length,
        tokensUsed: data.usage?.total_tokens,
      });

      return {
        success: true,
        sceneSpec,
        metadata: {
          model: data.model || OPENAI_MODEL,
          tokensUsed: data.usage?.total_tokens,
          generatedAt: new Date().toISOString(),
          inputParams: input,
        },
      };
    } catch (error) {
      console.error('[SceneSpec Generator] Generation error:', error);

      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        return {
          success: false,
          error: 'Network error: Unable to reach OpenAI API',
          metadata: {
            model: OPENAI_MODEL,
            generatedAt: new Date().toISOString(),
            inputParams: input,
          },
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown generation error',
        metadata: {
          model: OPENAI_MODEL,
          generatedAt: new Date().toISOString(),
          inputParams: input,
        },
      };
    }
  },

  /**
   * Generate a SceneSpec directly from input parameters
   * (without needing a saved ChannelConfig)
   */
  async generateDirect(input: SceneSpecGenerationInput): Promise<SceneSpecGenerationResult> {
    // Create a mock config from input
    const mockConfig: ChannelConfig = {
      id: 'direct-generation',
      userId: 'direct-generation',
      name: 'Direct Generation',
      niche: input.niche,
      tone: input.tone,
      cadence: null,
      rendererPreference: 'automation',
      defaultDuration: input.targetDuration,
      extraDirectives: input.extraDirectives ? { directives: input.extraDirectives } : null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return this.generateFromConfig(mockConfig);
  },

  /**
   * Test the SceneSpec generator with a sample config
   */
  async testGeneration(): Promise<boolean> {
    console.log('[SceneSpec Generator] Running test generation...');

    const result = await this.generateDirect({
      niche: 'productivity tips',
      tone: 'casual, friendly, motivational',
      targetDuration: 30,
    });

    if (result.success && result.sceneSpec) {
      console.log('[SceneSpec Generator] Test successful:', {
        title: result.sceneSpec.title,
        scenes: result.sceneSpec.scenes.length,
      });
      return true;
    } else {
      console.error('[SceneSpec Generator] Test failed:', result.error);
      return false;
    }
  },
};

export default sceneSpecGenerator;
