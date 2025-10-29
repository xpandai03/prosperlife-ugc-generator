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
 * Response from creating a Late.dev profile
 */
export interface CreateProfileResponse {
  profileId: string;
  email: string;
  createdAt: string;
}

/**
 * Late.dev Service
 *
 * Handles all interactions with the Late.dev API
 */
export const lateService = {
  /**
   * Create a new Late.dev profile for a user
   *
   * @param email - User's email address
   * @param name - User's display name
   * @returns Profile ID and creation details
   * @throws Error if profile creation fails
   */
  async createProfile(email: string, name: string): Promise<CreateProfileResponse> {
    if (!LATE_API_KEY) {
      throw new Error('LATE_API_KEY is not configured. Please add it to your .env file.');
    }

    console.log('[Late Service] Creating profile for:', { email, name });

    try {
      const response = await fetch(`${LATE_BASE_URL}/profiles`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LATE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, name }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[Late Service] Profile creation error:', {
          status: response.status,
          statusText: response.statusText,
          error: data,
        });

        const errorMessage = data.error || data.message || 'Unknown error from Late API';
        throw new Error(`Late API Error (${response.status}): ${errorMessage}`);
      }

      // Debug: Log the full raw response to understand the structure
      console.log('[Late Service] Raw API response:', JSON.stringify(data, null, 2));

      // Extract profile data from the response
      const profileId = data.profile?._id || data.profile?.id || data._id || data.id;
      const profileEmail = data.profile?.email || data.email || email;

      console.log('[Late Service] Profile created successfully:', {
        profileId,
        email: profileEmail,
        message: data.message,
      });

      return {
        profileId,
        email: profileEmail,
        createdAt: data.profile?.createdAt || data.createdAt || new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to reach Late.dev API. Please check your internet connection.');
      }
      throw error;
    }
  },

  /**
   * Post a video to Instagram as a Reel (with support for per-user profiles)
   *
   * @param params - Video URL and caption
   * @param profileId - Optional Late.dev profile ID (uses default if not provided)
   * @param accountId - Optional account ID (uses default if not provided)
   * @returns Late API response with post details and Instagram URL
   * @throws Error if API call fails
   */
  async postToInstagram(
    params: PostToInstagramParams,
    profileId?: string,
    accountId?: string
  ): Promise<LatePostResponse> {
    if (!LATE_API_KEY) {
      throw new Error('LATE_API_KEY is not configured. Please add it to your .env file.');
    }

    // Use provided accountId or fall back to hardcoded default
    const instagramAccountId = accountId || INSTAGRAM_ACCOUNT_ID;

    console.log('[Late Service] Posting to Instagram:', {
      videoUrl: params.videoUrl.substring(0, 50) + '...',
      caption: params.caption,
      captionLength: params.caption.length,
      contentType: params.contentType || 'reel',
      profileId: profileId || 'default',
      accountId: instagramAccountId,
    });

    const requestBody = {
      content: params.caption,
      ...(profileId && { profileId }), // Include profileId if provided
      platforms: [
        {
          platform: 'instagram',
          accountId: instagramAccountId,
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
   * Get all profiles from Late.dev
   *
   * @returns List of all profiles under this API key
   */
  async getProfiles(): Promise<any> {
    if (!LATE_API_KEY) {
      throw new Error('LATE_API_KEY is not configured');
    }

    console.log('[Late Service] Fetching all profiles');

    try {
      const response = await fetch(`${LATE_BASE_URL}/profiles`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${LATE_API_KEY}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = errorText;
        }
        console.error('[Late Service] Failed to fetch profiles:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
          url: `${LATE_BASE_URL}/profiles`
        });
        throw new Error(`Failed to fetch profiles (${response.status}): ${errorText}`);
      }

      const data = await response.json();

      // Log full profile structure to debug what fields are available
      console.log('[Late Service] Profiles fetched:', {
        count: data.profiles?.length || 0,
        profiles: data.profiles?.map((p: any) => ({
          id: p._id,
          email: p.email,
          name: p.name,
          // Log all keys to see what's actually returned
          allKeys: Object.keys(p)
        })),
      });

      return data;
    } catch (error) {
      console.error('[Late Service] Error fetching profiles:', error);
      throw error;
    }
  },

  /**
   * Get connected accounts from Late.dev
   *
   * Useful for debugging and verifying account connections
   *
   * @param profileId - Optional profile ID to filter accounts
   * @returns List of connected social media accounts
   */
  async getAccounts(profileId?: string): Promise<any> {
    if (!LATE_API_KEY) {
      throw new Error('LATE_API_KEY is not configured');
    }

    const url = profileId
      ? `${LATE_BASE_URL}/accounts?profileId=${profileId}`
      : `${LATE_BASE_URL}/accounts`;

    console.log('[Late Service] Fetching accounts:', { profileId, url });

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${LATE_API_KEY}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[Late Service] Failed to fetch accounts:', error);
      throw new Error(`Failed to fetch accounts: ${response.status}`);
    }

    const data = await response.json();
    console.log('[Late Service] Accounts fetched:', {
      count: data.accounts?.length || 0,
      accounts: data.accounts?.map((a: any) => ({ platform: a.platform, username: a.username })),
    });

    return data;
  },

  /**
   * Generate OAuth connect URL for a platform
   *
   * @param profileId - Late.dev profile ID to connect the account to
   * @param platform - Platform to connect (instagram, tiktok, youtube, etc.)
   * @param redirectUrl - Custom redirect URL after OAuth completion
   * @returns OAuth URL that the user should visit
   */
  generateConnectUrl(profileId: string, platform: string, redirectUrl: string): string {
    if (!LATE_API_KEY) {
      throw new Error('LATE_API_KEY is not configured');
    }

    // Construct the Late.dev OAuth URL
    const connectUrl = `${LATE_BASE_URL}/connect/${platform}?profileId=${profileId}&redirect_url=${encodeURIComponent(redirectUrl)}`;

    console.log('[Late Service] Generated connect URL:', {
      profileId,
      platform,
      redirectUrl,
      connectUrl: connectUrl.substring(0, 100) + '...',
    });

    return connectUrl;
  },

  /**
   * Handle OAuth callback and fetch account details
   *
   * After Late.dev redirects back to our app with success parameters,
   * this method fetches the full account details from Late.dev API.
   *
   * @param profileId - Late.dev profile ID
   * @param platform - Platform that was connected
   * @returns Account details including account ID
   */
  async handleOAuthCallback(profileId: string, platform: string): Promise<any> {
    if (!LATE_API_KEY) {
      throw new Error('LATE_API_KEY is not configured');
    }

    console.log('[Late Service] Handling OAuth callback:', { profileId, platform });

    // Fetch accounts for this profile to get the newly connected account
    const accountsData = await this.getAccounts(profileId);

    // Find the account that matches the platform
    const connectedAccount = accountsData.accounts?.find((acc: any) =>
      acc.platform === platform && acc.isActive
    );

    if (!connectedAccount) {
      console.error('[Late Service] No active account found for platform:', { profileId, platform });
      throw new Error(`No active ${platform} account found for profile ${profileId}`);
    }

    console.log('[Late Service] OAuth callback successful:', {
      accountId: connectedAccount._id,
      platform: connectedAccount.platform,
      username: connectedAccount.username,
      displayName: connectedAccount.displayName,
    });

    return connectedAccount;
  },
};
