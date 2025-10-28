/**
 * Late.dev API Service
 *
 * Wrapper for Late.dev social media posting API
 * Documentation: https://getlate.dev/docs
 */

const LATE_BASE_URL = 'https://getlate.dev/api/v1';
const LATE_API_KEY = process.env.LATE_API_KEY;
const INSTAGRAM_ACCOUNT_ID = '6900d2cd8bbca9c10cbfff74'; // Connected Instagram account

// Validation: Ensure API key is configured
if (!LATE_API_KEY) {
  console.warn('[Late Service] Warning: LATE_API_KEY is not configured in environment');
}

/**
 * Parameters for posting to Instagram
 */
export interface PostToInstagramParams {
  videoUrl: string;
  caption: string;
  contentType?: 'reel' | 'post' | 'story';
}

/**
 * Late.dev API response structure
 */
export interface LatePostResponse {
  post: {
    _id: string;
    status: string;
    content: string;
    platforms: Array<{
      platform: string;
      accountId: string;
      platformPostUrl?: string;
      status: string;
      error?: string;
    }>;
    createdAt: string;
    publishNow?: boolean;
  };
}

/**
 * Late.dev error response
 */
export interface LateErrorResponse {
  error: string;
  details?: any;
}

/**
 * Late.dev Service
 *
 * Handles all interactions with the Late.dev API
 */
export const lateService = {
  /**
   * Post a video to Instagram as a Reel
   *
   * @param params - Video URL and caption
   * @returns Late API response with post details and Instagram URL
   * @throws Error if API call fails
   */
  async postToInstagram(params: PostToInstagramParams): Promise<LatePostResponse> {
    if (!LATE_API_KEY) {
      throw new Error('LATE_API_KEY is not configured. Please add it to your .env file.');
    }

    console.log('[Late Service] Posting to Instagram:', {
      videoUrl: params.videoUrl.substring(0, 50) + '...',
      caption: params.caption, // Log full caption
      captionLength: params.caption.length,
      contentType: params.contentType || 'reel',
    });

    const requestBody = {
      content: params.caption,
      platforms: [
        {
          platform: 'instagram',
          accountId: INSTAGRAM_ACCOUNT_ID,
          platformSpecificData: {
            contentType: params.contentType || 'reel',
          },
        },
      ],
      mediaItems: [
        {
          type: 'video',
          url: params.videoUrl,
        },
      ],
      publishNow: true, // Post immediately, not scheduled
    };

    console.log('[Late Service] Request body:', JSON.stringify(requestBody, null, 2));

    try {
      const response = await fetch(`${LATE_BASE_URL}/posts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LATE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[Late Service] API Error:', {
          status: response.status,
          statusText: response.statusText,
          error: data,
        });

        // Extract error message from Late API response
        const errorMessage = data.error || data.message || 'Unknown error from Late API';
        throw new Error(`Late API Error (${response.status}): ${errorMessage}`);
      }

      console.log('[Late Service] Post successful:', {
        postId: data.post?._id,
        status: data.post?.status,
        platformUrl: data.post?.platforms?.[0]?.platformPostUrl,
      });

      return data as LatePostResponse;
    } catch (error) {
      // Re-throw with more context if it's a network error
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to reach Late.dev API. Please check your internet connection.');
      }
      throw error;
    }
  },

  /**
   * Test connection to Late.dev API
   *
   * Validates that the API key is correct and the service is reachable
   *
   * @returns True if connection is successful
   */
  async testConnection(): Promise<boolean> {
    if (!LATE_API_KEY) {
      console.error('[Late Service] Cannot test connection: LATE_API_KEY not configured');
      return false;
    }

    try {
      console.log('[Late Service] Testing connection to Late.dev API...');

      const response = await fetch(`${LATE_BASE_URL}/accounts`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${LATE_API_KEY}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[Late Service] ✓ Connection successful');
        console.log(`[Late Service] Found ${data.accounts?.length || 0} connected accounts`);
        return true;
      } else {
        console.error('[Late Service] ✗ Connection failed:', response.status, response.statusText);
        return false;
      }
    } catch (error) {
      console.error('[Late Service] ✗ Connection test error:', error);
      return false;
    }
  },

  /**
   * Get connected accounts from Late.dev
   *
   * Useful for debugging and verifying account connections
   *
   * @returns List of connected social media accounts
   */
  async getAccounts(): Promise<any> {
    if (!LATE_API_KEY) {
      throw new Error('LATE_API_KEY is not configured');
    }

    const response = await fetch(`${LATE_BASE_URL}/accounts`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${LATE_API_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch accounts: ${response.status}`);
    }

    return await response.json();
  },
};
