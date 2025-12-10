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
  scheduledFor?: string; // ISO 8601 UTC timestamp for scheduled posts (optional)
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

    // Validate scheduled timestamp if provided (Phase 3)
    if (params.scheduledFor) {
      const scheduledDate = new Date(params.scheduledFor);
      const now = new Date();
      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(now.getFullYear() + 1);

      // Reject if scheduled time is in the past
      if (scheduledDate <= now) {
        throw new Error('Scheduled time must be in the future');
      }

      // Reject if scheduled more than 1 year ahead
      if (scheduledDate > oneYearFromNow) {
        throw new Error('Cannot schedule posts more than 1 year in advance');
      }

      console.log('[Late Service] Scheduling post for:', {
        scheduledFor: params.scheduledFor,
        scheduledDate: scheduledDate.toISOString(),
        minutesFromNow: Math.round((scheduledDate.getTime() - now.getTime()) / (1000 * 60)),
      });
    }

    console.log('[Late Service] Posting to Instagram:', {
      videoUrl: params.videoUrl.substring(0, 50) + '...',
      caption: params.caption,
      captionLength: params.caption.length,
      contentType: params.contentType || 'reel',
      profileId: profileId || 'default',
      accountId: instagramAccountId,
      isScheduled: !!params.scheduledFor,
      scheduledFor: params.scheduledFor || 'immediate',
    });

    // Construct request body with conditional scheduling (Phase 3)
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
      // Conditional scheduling: if scheduledFor is provided, use Late.dev's scheduling
      ...(params.scheduledFor
        ? {
            publishNow: false, // Don't publish immediately
            scheduledFor: params.scheduledFor, // ISO 8601 UTC timestamp
            timezone: 'UTC', // Always use UTC for consistency
          }
        : {
            publishNow: true, // Publish immediately (default behavior)
          }
      ),
    };

    console.log('[Late Service] Request body:', JSON.stringify(requestBody, null, 2));

    try {
      // Phase 1 Debug: Log complete request metadata
      console.log('[Late Debug] Request:', {
        url: `${LATE_BASE_URL}/posts`,
        videoUrl: params.videoUrl,
        caption: params.caption?.substring(0, 50),
        profileId: profileId || 'none',
        accountId: instagramAccountId,
        bodySize: JSON.stringify(requestBody).length,
        timestamp: new Date().toISOString(),
      });

      const response = await fetch(`${LATE_BASE_URL}/posts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LATE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      // Phase 1 Debug: Capture raw response metadata
      console.log('[Late Debug] Response:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        contentType: response.headers.get('content-type'),
      });

      // Phase 3 Fix: Read response as text first to handle empty/malformed responses
      const responseText = await response.text();
      console.log('[Late Debug] Raw body:', responseText.substring(0, 500));

      // Phase 3 Fix: Parse JSON safely with proper error handling
      let data: any;
      if (responseText.trim() === '') {
        console.error('[Late Service] Empty response body received');
        throw new Error(`Late API returned empty response (HTTP ${response.status})`);
      }

      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('[Late Service] JSON parse error:', parseError);
        console.error('[Late Service] Raw response:', responseText);
        throw new Error(`Late API returned invalid JSON (HTTP ${response.status}): ${responseText.substring(0, 200)}`);
      }

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
   * This method makes an authenticated server-side request to Late.dev's connect endpoint,
   * which returns a 302 redirect to the actual OAuth authorization page.
   * We extract and return that OAuth URL for the browser to open.
   *
   * @param profileId - Late.dev profile ID to connect the account to
   * @param platform - Platform to connect (instagram, tiktok, youtube, etc.)
   * @param redirectUrl - Custom redirect URL after OAuth completion
   * @returns OAuth URL that the user should visit (e.g., https://auth.late.dev/oauth/instagram)
   */
  async generateConnectUrl(profileId: string, platform: string, redirectUrl: string): Promise<string> {
    if (!LATE_API_KEY) {
      throw new Error('LATE_API_KEY is not configured');
    }

    // Construct the Late.dev connect endpoint URL (requires authentication)
    const connectEndpoint = `${LATE_BASE_URL}/connect/${platform}?profileId=${profileId}&redirect_url=${encodeURIComponent(redirectUrl)}`;

    console.log('[Late Service] Requesting OAuth URL from Late.dev:', {
      profileId,
      platform,
      redirectUrl,
      endpoint: connectEndpoint.substring(0, 100) + '...',
    });

    try {
      // Make authenticated request with redirect: 'manual' to capture redirects
      const response = await fetch(connectEndpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${LATE_API_KEY}`,
        },
        redirect: 'manual', // Don't auto-follow redirects
      });

      console.log('[Late Service] Late.dev response received:', {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
      });

      // Handle 302/301 redirect response (older API behavior)
      if (response.status === 302 || response.status === 301) {
        const oauthUrl = response.headers.get('location');

        if (!oauthUrl) {
          console.error('[Late Service] Missing Location header in redirect response:', {
            status: response.status,
            headers: Object.fromEntries(response.headers.entries()),
          });
          throw new Error('Late.dev redirect missing Location header');
        }

        console.log('[Late Service] OAuth URL extracted from Location header:', {
          oauthUrl: oauthUrl.substring(0, 100) + '...',
          method: 'redirect',
        });

        return oauthUrl;
      }

      // Handle 200 JSON response with authUrl (current API behavior)
      if (response.status === 200) {
        const responseText = await response.text();
        let data;

        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.error('[Late Service] Failed to parse 200 response as JSON:', {
            responseText: responseText.substring(0, 200),
            parseError,
          });
          throw new Error(`Late.dev returned 200 but response is not valid JSON: ${responseText.substring(0, 100)}`);
        }

        // Extract authUrl from JSON response
        if (data.authUrl) {
          console.log('[Late Service] OAuth URL extracted from JSON authUrl field:', {
            authUrl: data.authUrl.substring(0, 100) + '...',
            method: 'json',
          });

          return data.authUrl;
        }

        // 200 response but no authUrl field
        console.error('[Late Service] 200 response missing authUrl field:', {
          data,
          availableFields: Object.keys(data),
        });
        throw new Error('Late.dev returned 200 but JSON response missing authUrl field');
      }

      // Handle error responses (4xx, 5xx)
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = errorText;
      }

      console.error('[Late Service] Error response from connect endpoint:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
        endpoint: connectEndpoint.substring(0, 100) + '...',
      });

      throw new Error(`Late.dev connect endpoint returned ${response.status}: ${errorText}`);
    } catch (error) {
      console.error('[Late Service] Error generating OAuth URL:', error);
      throw error;
    }
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

  /**
   * Get analytics data from Late.dev
   *
   * Fetches post performance metrics including views, likes, comments, shares, etc.
   *
   * @param options - Query parameters for filtering analytics
   * @returns Analytics data with overview and per-post metrics
   */
  async getAnalytics(options: {
    profileId?: string;
    platform?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
    page?: number;
    sortBy?: 'date' | 'engagement';
    order?: 'asc' | 'desc';
  } = {}): Promise<any> {
    if (!LATE_API_KEY) {
      throw new Error('LATE_API_KEY is not configured');
    }

    // Build query string from options
    const params = new URLSearchParams();
    if (options.profileId) params.append('profileId', options.profileId);
    if (options.platform) params.append('platform', options.platform);
    if (options.fromDate) params.append('fromDate', options.fromDate);
    if (options.toDate) params.append('toDate', options.toDate);
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.page) params.append('page', options.page.toString());
    if (options.sortBy) params.append('sortBy', options.sortBy);
    if (options.order) params.append('order', options.order);

    const queryString = params.toString();
    const url = `${LATE_BASE_URL}/analytics${queryString ? `?${queryString}` : ''}`;

    console.log('[Late Service] Fetching analytics:', { url, options });

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${LATE_API_KEY}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Late Service] Analytics fetch error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        throw new Error(`Late API Error (${response.status}): ${errorText}`);
      }

      const data = await response.json();

      console.log('[Late Service] Analytics fetched:', {
        totalPosts: data.overview?.totalPosts,
        publishedPosts: data.overview?.publishedPosts,
        postsReturned: data.posts?.length || 0,
      });

      return data;
    } catch (error) {
      console.error('[Late Service] Error fetching analytics:', error);
      throw error;
    }
  },
};
