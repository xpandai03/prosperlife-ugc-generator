API Documentation
=================

Copy as Markdown

Authentication
--------------

All API requests require authentication using an API key in the Authorization header.

# Include your API key in the Authorization header

curl -H "Authorization: Bearer YOUR_API_KEY" https://getlate.dev/api/v1/posts

Users
-----

List team users (root + invited) and fetch a specific user by ID.

### GET /v1/users

GET/v1/users

Returns all users visible to the authenticated account.

### GET /v1/users/[userId]

GET/v1/users/[userId]

Get a single user (self or invited) by ID.

Reddit
------

Submit self or link posts to subreddits. Provide `platformSpecificData.subreddit` per post, or set a default subreddit in account settings.

# Schedule a Reddit post

curl -X POST https://getlate.dev/api/v1/posts\
-H "Authorization: Bearer YOUR_API_KEY"\
-H "Content-Type: application/json"\
-d '{
  "content": "Discussion thread for our latest article",
  "platforms": [
    {
      "platform": "reddit",
      "accountId": "REDDIT_ACCOUNT_ID",
      "platformSpecificData": { "subreddit": "reactjs", "url": "https://example.com/article" }
    }
  ]
}'

Reddit Feed
-----------

Fetch subreddit posts (hot/new/top/rising) using your connected Reddit account.

### GET /v1/reddit/feed

GET/v1/reddit/feed

Query params:

-   accountId: required. Your connected Reddit account ID.
-   subreddit: optional. e.g. r/reactjs or reactjs. If omitted, shows a global feed.
-   sort: optional. hot (default) | new | top | rising.
-   limit: optional. 1-100 (default 25).
-   after: optional. Pagination token.
-   t: optional. Only for top: hour|day|week|month|year|all.

# Example

curl "https://getlate.dev/api/v1/reddit/feed?accountId=ACCOUNT_ID&subreddit=r/reactjs&sort=hot&limit=10"\
-H "Authorization: Bearer YOUR_API_KEY"

#### Response

{
  "items": [
    {
      "id": "abc123",
      "fullname": "t3_abc123",
      "title": "Interesting discussion",
      "author": "example_user",
      "subreddit": "reactjs",
      "url": "https://example.com",
      "permalink": "https://www.reddit.com/r/reactjs/comments/abc123/...",
      "selftext": "...",
      "createdUtc": 1700000000,
      "score": 123,
      "numComments": 45,
      "over18": false,
      "stickied": false,
      "flairText": null
    }
  ],
  "after": "t3_def456",
  "before": null
}

API Keys
--------

Manage API keys for your account.

### GET /v1/api-keys

GET/v1/api-keys

List API keys for the current user.

### POST /v1/api-keys

POST/v1/api-keys

Create a new API key.

{
  "name": "CI Token",
  "permissions": ["posts:read", "posts:write"],
  "expiresIn": 30
}

### DELETE /v1/api-keys/[keyId]

DELETE/v1/api-keys/[keyId]

Delete an API key by ID.

Reddit Search
-------------

Search posts in a subreddit or across Reddit.

### GET /v1/reddit/search

GET/v1/reddit/search

Query params:

-   accountId: required. Your connected Reddit account ID.
-   q: required. Search query.
-   subreddit: optional. e.g. r/technology or technology.
-   restrict_sr: optional. 1/0. Defaults to 1 if subreddit provided.
-   sort: optional. relevance|hot|top|new|comments (default new).
-   limit: optional. 1-100 (default 25).
-   after: optional. Pagination token.

# Example

curl "https://getlate.dev/api/v1/reddit/search?accountId=ACCOUNT_ID&subreddit=r/technology&q=AI&sort=new&limit=10"\
-H "Authorization: Bearer YOUR_API_KEY"

#### Response

{
  "items": [
    {
      "id": "ghi789",
      "fullname": "t3_ghi789",
      "title": "AI is transforming workflows",
      "author": "another_user",
      "subreddit": "technology",
      "url": "https://example.com",
      "permalink": "https://www.reddit.com/r/technology/comments/ghi789/...",
      "selftext": "...",
      "createdUtc": 1700000001,
      "score": 98,
      "numComments": 12,
      "over18": false,
      "stickied": false,
      "flairText": null
    }
  ],
  "after": null,
  "before": null
}

Team Invites & Platform Connections
-----------------------------------

Generate secure, time-limited invite links to grant access to your profiles or allow others to connect social accounts on your behalf. All invites expire after 7 days.

#### Two Types of Invites

-   → Team Member Invites: Invite collaborators to access your profiles for posting and management
-   → Platform Connection Invites: Let someone else connect a social account (useful for client onboarding)

### POST /v1/invite/tokens

POST/v1/invite/tokens

Create a team member invite token. Invited users can sign up and access specified profiles or all your profiles.

#### Use Cases

-   → Invite team members to manage social accounts
-   → Grant collaborators access to specific client profiles
-   → Onboard agency staff with controlled profile access
-   → Share access without sharing your API key or password

#### Request Body

{
  "scope": "all",
  "profileIds": ["profile_id_1", "profile_id_2"]
}

#### Parameters

-   scope - "all" (access to all profiles) or "profiles" (specific profiles only)
-   profileIds - Array of profile IDs (required if scope is "profiles")

#### Response

{
  "token": "abc123def456...",
  "scope": "profiles",
  "invitedProfileIds": ["profile_id_1", "profile_id_2"],
  "expiresAt": "2024-01-22T00:00:00.000Z",
  "inviteUrl": "https://getlate.dev/signup?inviteToken=abc123def456..."
}

# Grant access to all profiles

curl -X POST https://getlate.dev/api/v1/invite/tokens\
  -H "Authorization: Bearer YOUR_API_KEY"\
  -H "Content-Type: application/json"\
  -d '{
    "scope": "all"
  }'

# Grant access to specific profiles

curl -X POST https://getlate.dev/api/v1/invite/tokens\
  -H "Authorization: Bearer YOUR_API_KEY"\
  -H "Content-Type: application/json"\
  -d '{
    "scope": "profiles",
    "profileIds": ["profile_id_1", "profile_id_2"]
  }'

### GET /v1/platform-invites

GET/v1/platform-invites

List all platform connection invites you've created.

#### Query Parameters

-   profileId - Optional. Filter invites by profile ID

#### Response

{
  "invites": [
    {
      "_id": "invite_id_123",
      "token": "def456ghi789...",
      "userId": "user_id",
      "profileId": {
        "_id": "profile_id",
        "name": "Client Profile"
      },
      "platform": "instagram",
      "inviterName": "Your Name",
      "inviterEmail": "you@example.com",
      "expiresAt": "2024-01-22T00:00:00.000Z",
      "isUsed": false,
      "createdAt": "2024-01-15T00:00:00.000Z"
    }
  ]
}

# List all platform invites

curl -H "Authorization: Bearer YOUR_API_KEY" https://getlate.dev/api/v1/platform-invites

### POST /v1/platform-invites

POST/v1/platform-invites

Create a platform connection invite. Perfect for client onboarding - they connect their social account without accessing your Late account.

#### Client Onboarding Workflow

1.  Create a profile for your client
2.  Generate a platform invite for Instagram (or any platform)
3.  Send the invite URL to your client
4.  Client clicks the link, authenticates with Instagram
5.  Their Instagram is now connected to your profile - you can post on their behalf
6.  Client never gets access to your Late account

#### Request Body

{
  "profileId": "profile_id_123",
  "platform": "instagram"
}

#### Parameters

-   profileId - Profile ID to connect the account to (required)
-   platform - Platform to connect: facebook, instagram, linkedin, twitter, threads, tiktok, youtube, pinterest, reddit, bluesky (required)

#### Response

{
  "invite": {
    "_id": "invite_id_123",
    "token": "def456ghi789...",
    "userId": "user_id",
    "profileId": "profile_id_123",
    "platform": "instagram",
    "inviterName": "Your Name",
    "inviterEmail": "you@example.com",
    "expiresAt": "2024-01-22T00:00:00.000Z",
    "isUsed": false,
    "createdAt": "2024-01-15T00:00:00.000Z",
    "inviteUrl": "https://getlate.dev/api/v1/platform-invites/def456.../connect"
  }
}

# Create Instagram connection invite

curl -X POST https://getlate.dev/api/v1/platform-invites\
  -H "Authorization: Bearer YOUR_API_KEY"\
  -H "Content-Type: application/json"\
  -d '{
    "profileId": "profile_id_123",
    "platform": "instagram"
  }'

### DELETE /v1/platform-invites

DELETE/v1/platform-invites

Revoke an unused platform connection invite. Only unused invites can be deleted.

#### Query Parameters

-   id - Invite ID to revoke (required)

# Revoke a platform invite

curl -X DELETE -H "Authorization: Bearer YOUR_API_KEY" "https://getlate.dev/api/v1/platform-invites?id=INVITE_ID"

#### Security & Expiration

-   → All invites expire automatically after 7 days
-   → Invite tokens are single-use and cryptographically secure
-   → Team member invites grant scoped access (not full API access)
-   → Platform invites only allow connecting one specific social account
-   → Invitees never gain access to your API keys or password
-   → You can revoke unused invites at any time

Reddit Subreddits
-----------------

List and set a default subreddit for a connected Reddit account.

### GET /v1/accounts/[accountId]/reddit-subreddits

GET/v1/accounts/[accountId]/reddit-subreddits

Returns subreddits you can post to from this account and the current default (if any).

{
  "subreddits": [
    { "name": "programming", "display_name_prefixed": "r/programming" },
    { "name": "reactjs", "display_name_prefixed": "r/reactjs" }
  ],
  "defaultSubreddit": "programming"
}

### PUT /v1/accounts/[accountId]/reddit-subreddits

PUT/v1/accounts/[accountId]/reddit-subreddits

Set the default subreddit used when a post doesn't specify one.

{
  "defaultSubreddit": "reactjs"
}

Pinterest
---------

Post image or video Pins to boards. Provide at least one image or a single video, plus a target board. Optionally set a destination link. Video Pins require a cover image (we accept a provided image URL or auto-select a key frame).

# Schedule an image Pin

curl -X POST https://getlate.dev/api/v1/posts\
-H "Authorization: Bearer YOUR_API_KEY"\
-H "Content-Type: application/json"\
-d '{
  "content": "My new pin --- learn more on our site",
  "platforms": [
    {
      "platform": "pinterest",
      "accountId": "PINTEREST_ACCOUNT_ID",
      "platformSpecificData": { "boardId": "BOARD_ID", "link": "https://example.com" }
    }
  ],
  "mediaItems": [
    { "type": "image", "url": "https://.../image.jpg" }
  ]
}'

# Schedule a video Pin

curl -X POST https://getlate.dev/api/v1/posts\
-H "Authorization: Bearer YOUR_API_KEY"\
-H "Content-Type: application/json"\
-d '{
  "content": "Quick tip video --- visit our site for more",
  "platforms": [
    {
      "platform": "pinterest",
      "accountId": "PINTEREST_ACCOUNT_ID",
      "platformSpecificData": {
        "boardId": "BOARD_ID",
        "link": "https://example.com",
        "coverImageUrl": "https://.../cover.jpg"
      }
    }
  ],
  "mediaItems": [
    { "type": "video", "url": "https://.../video.mp4" }
  ]
}'

#### Requirements

-   → Image Pins: at least one image in `mediaItems`
-   → Video Pins: exactly one video in `mediaItems`
-   → Video cover image: provide `platformSpecificData.coverImageUrl` or include an image in `mediaItems`; otherwise we default to `cover_image_key_frame_time=0`. You may override the key frame time via `platformSpecificData.coverImageKeyFrameTime` (seconds).
-   → `platformSpecificData.boardId` required (or set a default board)
-   → Optional: `platformSpecificData.link` sets the Pin's destination URL
-   → Title is taken from the first line of `content`

### GET /v1/accounts/[accountId]/pinterest-boards

GET/v1/accounts/[accountId]/pinterest-boards

List boards for a connected Pinterest account and the configured default.

{
  "boards": [
    { "id": "123", "name": "Inspiration" },
    { "id": "456", "name": "Engineering" }
  ],
  "defaultBoardId": "123"
}

### PUT /v1/accounts/[accountId]/pinterest-boards

PUT/v1/accounts/[accountId]/pinterest-boards

Set a default board for posts that do not include `platformSpecificData.boardId`.

{
  "defaultBoardId": "123",
  "defaultBoardName": "Inspiration"
}

Plan Tiers & Limits
-------------------

Late offers 4 plan tiers with different usage limits. All limits are enforced at the API level and reset based on your billing period.

### Free

$0/month

10 posts/month

2 profiles

### Build

$19/month

120 posts/month

10 profiles

### Accelerate

MOST POPULAR

$49/month

Unlimited posts

50 profiles (stackable)

### Unlimited

$999/month

Unlimited posts

Unlimited profiles

#### 💡 Annual Billing

Save 40% with annual billing! Usage limits reset on your billing anniversary.

Usage Tracking
--------------

Your usage is tracked in real-time and enforced at every API call. Usage resets automatically based on your billing period.

#### Reset Schedule

-   Monthly Plans: Usage resets on your signup anniversary day each month
-   Annual Plans: Usage resets on your signup anniversary date each year
-   Free Users: Automatic reset based on signup date
-   Paid Users: Reset triggered by Stripe billing webhooks

#### What's Tracked

-   Uploads: Each successful post creation (drafts don't count) - resets with billing cycle
-   Profiles: Total number of profiles you currently have - decreases when you delete profiles
-   Last Reset: Timestamp of your last usage reset (uploads only)

Plan Limit Errors
-----------------

When you exceed your plan limits, the API returns detailed error messages with upgrade suggestions.

#### Upload Limit Exceeded

HTTP 403 Forbidden

{
  "error": "Post limit reached. Your Free plan allows 10 posts per month. You have used 10.",
  "planName": "Free",
  "limit": 10,
  "current": 10,
  "billingPeriod": "monthly"
}

#### Profile Limit Exceeded

HTTP 403 Forbidden

{
  "error": "Profile limit reached. Your basic plan allows 10 profiles. You currently have 10.",
  "planName": "basic",
  "limit": 10,
  "current": 10,
  "details": {
    "resource": "profiles",
    "plan": "basic",
    "currentUsage": 10,
    "limit": 10,
    "window": "total"
  }
}

Quick Start
-----------

Here's how to set up profiles and schedule your first post:

#### 1\. Create a Profile

# Create a profile to organize your social accounts

curl -X POST https://getlate.dev/api/v1/profiles \ -H "Authorization: Bearer YOUR_API_KEY" \ -H "Content-Type: application/json" \ -d '{ "name": "Personal Brand", "description": "My personal social media accounts", "color": "#ffeda0" }'

#### 2\. Connect Social Accounts

# Connect social accounts to your profile (redirects to OAuth)

curl "https://getlate.dev/api/v1/connect/twitter?profileId=PROFILE_ID" \ -H "Authorization: Bearer YOUR_API_KEY"

#### 3\. Schedule a Post

# Schedule a post using accounts from your profile

curl -X POST https://getlate.dev/api/v1/posts \ -H "Authorization: Bearer YOUR_API_KEY" \ -H "Content-Type: application/json" \ -d '{ "content": "Hello, world! 🌍", "scheduledFor": "2024-01-01T12:00:00", "timezone": "America/New_York", "platforms": [ {"platform": "twitter", "accountId": "TWITTER_ACCOUNT_ID"}, {"platform": "linkedin", "accountId": "LINKEDIN_ACCOUNT_ID"}, {"platform": "threads", "accountId": "THREADS_ACCOUNT_ID"} ] }'

Profiles
--------

Late uses a profile-based architecture to organize your social media accounts. Each profile can have one connected account per platform, allowing you to manage multiple brands, clients, or personal accounts separately.

### GET /v1/profiles

GET/v1/profiles

Get all profiles for your account.

#### Response

{
  "profiles": [
    {
      "_id": "profile_id",
      "name": "Personal Brand",
      "description": "My personal accounts",
      "color": "#ffeda0",
      "isDefault": true,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}

### POST /v1/profiles

POST/v1/profiles

Create a new profile. Subject to plan limits.

⚠️ Plan Limits: Free (2), Basic (10), Professional (50), Advanced (150), Enterprise (250) profiles

Profile limits are enforced in real-time. Creating a profile when at your limit returns HTTP 403.

#### Request Body

{
  "name": "Business Account",
  "description": "Company social media",
  "color": "#4ade80"
}

#### Response Status Codes

-   201 - Profile created successfully
-   400 - Invalid request data or profile name already exists
-   401 - Invalid API key
-   403 - Profile limit reached for your plan
-   404 - User not found

### PUT /v1/profiles/[profileId]

PUT/v1/profiles/[profileId]

Update an existing profile.

### DELETE /v1/profiles/[profileId]

DELETE/v1/profiles/[profileId]

Delete a profile. Cannot delete profiles with connected accounts.

Usage Statistics
----------------

Monitor your current usage against plan limits in real-time.

### GET /v1/usage-stats

GET/v1/usage-stats

Get current usage statistics for your account.

#### Response

{
  "planName": "Accelerate",
  "billingPeriod": "yearly",
  "limits": {
    "uploads": -1,
    "profiles": 50,

  },
  "usage": {
    "uploads": 847,
    "profiles": 12,
    "lastReset": "2024-01-01T00:00:00.000Z"
  },
  "canUpload": true,
  "canCreateProfile": true
}

#### Response Fields

-   limits.uploads - Upload limit (-1 = unlimited)
-   limits.profiles - Profile limit
-   usage.uploads - Current period uploads
-   usage.profiles - Total profiles created
-   canUpload - Whether you can create more posts
-   canCreateProfile - Whether you can create more profiles

# Get your current usage stats

curl -H "Authorization: Bearer YOUR_API_KEY" https://getlate.dev/api/v1/usage-stats

Posts
-----

Schedule and manage social media posts across multiple platforms. Upload limits apply based on your plan.

⚠️ Upload Limits: Free (10/month), Basic (120/month), Professional, Advanced & Enterprise (unlimited)

### GET /v1/posts

GET/v1/posts

Retrieve a list of your scheduled and published posts with pagination.

#### Queued posts in responses

-   → Queued posts appear with `status: "scheduled"` plus `queuedFromProfile` in the post object.
-   → To fetch only queued posts, request `status=scheduled` and filter client-side for posts where `queuedFromProfile` is present.
-   → Use [/v1/queue/next-slot](https://getlate.dev/docs#queue) to compute the next time when creating/updating queued posts.

#### Query Parameters

-   page - Page number (default: 1)
-   limit - Posts per page (default: 10, max: 100)
-   status - Filter by status (draft, scheduled, published, failed)
-   platform - Filter by platform
-   profileId - Filter by a specific profile
-   createdBy - Filter by creator user ID
-   dateFrom - ISO datetime inclusive lower bound
-   dateTo - ISO datetime inclusive upper bound
-   includeHidden - Include hidden posts (default: false)

### POST /v1/posts

POST/v1/posts

Create and schedule a new post across multiple social media platforms. Subject to upload limits.

⚠️ Upload Limits: Each successful post creation counts toward your monthly/yearly limit (drafts don't count)

🔗 Getting Account IDs: To get the account IDs for your platforms, use `GET /v1/accounts?profileId=PROFILE_ID`. Each connected social media account has a unique ID that you need to specify in the platforms array.

#### Queue: Create a post using your queue

Get the next available slot via [GET /v1/queue/next-slot](https://getlate.dev/docs#queue), then create your post with that `scheduledFor`, the returned `timezone`, and include `queuedFromProfile` to mark it as queued.

{
  "content": "Queued via API",
  "scheduledFor": "2024-01-17T22:00:00Z",
  "timezone": "America/New_York",
  "platforms": [
    {"platform": "twitter", "accountId": "ACCOUNT_ID"}
  ],
  "queuedFromProfile": "PROFILE_ID"
}

Note: Queued posts are returned with `status: "scheduled"` and an extra `queuedFromProfile` field.

Note: This endpoint does not read a top-level `profileId` field. Resolve and pass per-platform `accountId` values instead.

New: If you omit the `platforms` field for non-draft posts, Late automatically targets all of your accessible, active accounts (invite restrictions and profile scoping are respected). Draft behavior is unchanged.

# Publish now to all accounts (no platforms field)

curl -X POST https://getlate.dev/api/v1/posts\
-H "Authorization: Bearer YOUR_API_KEY"\
-H "Content-Type: application/json"\
-d '{
  "content": "We ship default-to-all 🎉",
  "publishNow": true
}'

#### Per-account captions (Instagram)

Use `platforms[].customContent` to set a unique caption per Instagram account. If omitted, the main` content` is used as the default caption for that account.

{
  "content": "Default caption",
  "platforms": [
    {
      "platform": "instagram",
      "accountId": "ACCOUNT_ID_1",
      "customContent": "Unique caption for account 1",
      "platformSpecificData": { "contentType": "reel", "collaborators": [] }
    },
    {
      "platform": "instagram",
      "accountId": "ACCOUNT_ID_2",
      "customContent": "Unique caption for account 2",
      "platformSpecificData": { "contentType": "reel", "collaborators": [] }
    }
  ],
  "mediaItems": [{ "type": "video", "url": "https://..." }]
}

Notes: Stories don't use captions the same way; feed/Reels use the caption. `collaborators` supports up to 3 usernames (without @).

#### Instagram First Comment

Automatically add a first comment to your Instagram post or Reel by including `platformSpecificData.firstComment`. Not applied to Stories.

{
  "content": "New reel just dropped!",
  "platforms": [
    {
      "platform": "instagram",
      "accountId": "INSTAGRAM_ACCOUNT_ID",
      "platformSpecificData": {
        "contentType": "reel",
        "firstComment": "Full video and links: https://example.com ✨"
      }
    }
  ],
  "mediaItems": [
    { "type": "video", "url": "https://.../reel.mp4" }
  ]
}

-   → Length: up to ~2,200 characters.
-   → Timing: posted right after the post is published.
-   → Scope: feed posts and Reels only (Stories excluded by Instagram API).
-   → Account type: Instagram Business accounts only (API restriction).

#### Tag people in photos (Instagram)

Tag Instagram users in photos by specifying their username and position coordinates. X and Y values range from 0.0 to 1.0, representing position from the top-left corner. Only works for image posts and carousels (not stories or videos).

{
  "content": "Amazing photo with friends!",
  "platforms": [
    {
      "platform": "instagram",
      "accountId": "INSTAGRAM_ACCOUNT_ID",
      "platformSpecificData": {
        "contentType": "post",
        "userTags": [
          { "username": "friend_username", "x": 0.3, "y": 0.5 },
          { "username": "another_friend", "x": 0.7, "y": 0.5 }
        ]
      }
    }
  ],
  "mediaItems": [{ "type": "image", "url": "https://..." }]
}

Notes: X/Y coordinates specify the tag position. (0.5, 0.5) is the center. Tagged users receive a notification. Not supported for stories or video posts.

#### X (Twitter) Threads

Create multi-tweet threads by passing `platformSpecificData.threadItems` on Twitter platforms. Tweet 1 can use the main `content`; subsequent replies are specified in `threadItems`. Each tweet supports media on the first item only.

{
  "content": "Tweet 1 --- intro",
  "scheduledFor": "2024-01-01T12:00:00",
  "timezone": "UTC",
  "platforms": [
    {
      "platform": "twitter",
      "accountId": "TWITTER_ACCOUNT_ID",
      "platformSpecificData": {
        "threadItems": [
          { "content": "Tweet 1 --- intro", "mediaItems": [{ "type": "image", "url": "https://.../img.jpg" }] },
          { "content": "Tweet 2 --- details" },
          { "content": "Tweet 3 --- CTA" }
        ]
      }
    }
  ]
}

Notes: 280 chars per tweet. We return `thread` with per-tweet permalinks in the publish result. Only the first tweet can include media currently.

#### Threads (Meta) Threads

Create multi-post Threads conversations by passing `platformSpecificData.threadItems` on Threads platforms. Post 1 can use the main `content`; subsequent replies are specified in `threadItems`. Only the first post supports media in the composer.

{
  "content": "Post 1 --- intro",
  "scheduledFor": "2024-01-01T12:00:00",
  "timezone": "UTC",
  "platforms": [
    {
      "platform": "threads",
      "accountId": "THREADS_ACCOUNT_ID",
      "platformSpecificData": {
        "threadItems": [
          { "content": "Post 1 --- intro", "mediaItems": [{ "type": "image", "url": "https://.../img.jpg" }] },
          { "content": "Post 2 --- details" },
          { "content": "Post 3 --- CTA" }
        ]
      }
    }
  ]
}

Notes: 500 chars per post. We return `thread` with per-post permalinks in the publish result. Requires additional OAuth scope `threads_manage_replies`; users may need to re-connect.

#### Bluesky Threads

Create multi-post threads on Bluesky by passing `platformSpecificData.threadItems` on Bluesky platforms. Post 1 can use the main `content`; subsequent replies are specified in `threadItems`. Only the first post supports media in the composer.

{
  "content": "Post 1 --- intro",
  "scheduledFor": "2024-01-01T12:00:00",
  "timezone": "UTC",
  "platforms": [
    {
      "platform": "bluesky",
      "accountId": "BLUESKY_ACCOUNT_ID",
      "platformSpecificData": {
        "threadItems": [
          { "content": "Post 1 --- intro", "mediaItems": [{ "type": "image", "url": "https://.../img.jpg" }] },
          { "content": "Post 2 --- details" },
          { "content": "Post 3 --- CTA" }
        ]
      }
    }
  ]
}

Notes: 300 chars per post. We return `thread` with per-post permalinks in the publish result.

#### Facebook First Comment

Automatically add a first comment to your Facebook Page post. Great for CTAs, links, or extra context.

{
  "content": "New feature live today!",
  "platforms": [
    {
      "platform": "facebook",
      "accountId": "FACEBOOK_ACCOUNT_ID",
      "platformSpecificData": {
        "firstComment": "Read more here: https://example.com 🚀"
      }
    }
  ]
}

-   → Requires Facebook permissions `pages_manage_engagement` and `pages_read_user_content`; you may need to reconnect Facebook to grant them.
-   → Length: up to ~8,000 characters.
-   → Timing: posted right after the post is published.
-   → Scope: works with Facebook Pages (not personal profiles).

#### LinkedIn First Comment

Automatically add a first comment to your LinkedIn post. Great for CTAs, links, or extra context.

{
  "content": "New feature announcement!",
  "platforms": [
    {
      "platform": "linkedin",
      "accountId": "LINKEDIN_ACCOUNT_ID",
      "platformSpecificData": {
        "firstComment": "Learn more about this feature: https://example.com 🚀"
      }
    }
  ]
}

-   → Requires LinkedIn permissions `w_member_social` or `w_organization_social`.
-   → Length: up to 1,250 characters (LinkedIn's comment limit).
-   → Timing: posted right after the post is published.
-   → Scope: works with both personal profiles and company pages.

#### Instagram First Comment

Automatically add a first comment to your Instagram post or Reel. Great for CTAs, links, or extra context. Not applied to Stories.

{
  "content": "New reel just dropped!",
  "platforms": [
    {
      "platform": "instagram",
      "accountId": "INSTAGRAM_ACCOUNT_ID",
      "platformSpecificData": {
        "firstComment": "Full video and links: https://example.com ✨"
      }
    }
  ],
  "mediaItems": [
    { "type": "video", "url": "https://.../reel.mp4" }
  ]
}

-   → Length: up to ~2,200 characters.
-   → Timing: posted right after the post is published.
-   → Scope: feed posts and Reels only (Stories excluded by Instagram API).
-   → Account type: Instagram Business accounts only (API restriction).

#### LinkedIn Mentions (Tag People & Companies)

Create clickable mentions in your LinkedIn posts that notify the mentioned person or company. Use the URN format to tag users.

{
  "content": "Great discussion with @[John Doe](urn:li:person:abc123) and @[Acme Corp](urn:li:organization:456789) about innovation! 🚀",
  "platforms": [
    {
      "platform": "linkedin",
      "accountId": "LINKEDIN_ACCOUNT_ID"
    }
  ]
}

Mention Format:

-   ✓ `@[Display Name](urn:li:person:PERSON_ID)` - Tags a person (clickable, sends notification)
-   ✓ `@[Company Name](urn:li:organization:ORG_ID)` - Tags a company (clickable, sends notification)
-   ✗ `@username` - Plain text only, not clickable (LinkedIn API requires URN format)

How to Find URNs:

-   Organization/Company:\
    Visit company page → URL shows `linkedin.com/company/1337/`\
    → Use: `urn:li:organization:1337`
-   Person:\
    Requires LinkedIn API call to resolve profile to URN\
    → More complex, typically needs LinkedIn Marketing API access

-   → Multiple mentions supported in a single post.
-   → Mentioned users/companies receive a LinkedIn notification.
-   → Mentions appear as clickable links in the published post.
-   → Works with both personal profiles and company page posts.

#### Request Body

{
  "content": "Your post content here",
  "platforms": [
    {"platform": "twitter", "accountId": "TWITTER_ACCOUNT_ID"},
    {"platform": "instagram", "accountId": "INSTAGRAM_ACCOUNT_ID"},
    {"platform": "linkedin", "accountId": "LINKEDIN_ACCOUNT_ID"},
    {"platform": "threads", "accountId": "THREADS_ACCOUNT_ID"},
    {"platform": "youtube", "accountId": "YOUTUBE_ACCOUNT_ID"}
  ],
  "scheduledFor": "2024-01-01T12:00:00",
  "timezone": "America/New_York",
  "publishNow": false,
  "isDraft": false,
  "visibility": "public|private|unlisted",
  "tags": ["programming", "tutorial", "api", "coding"],
  "mediaItems": [
    {
      "type": "image|video|gif|document",
      "url": "media_url_from_/v1/media",
      "filename": "optional_filename"
    }
  ]
}

🕐 Timezone Handling: Two formats are accepted for `scheduledFor`:\
→ Option A (recommended): Local `YYYY-MM-DDTHH:mm` (no Z) together with a valid `timezone` (e.g., "America/New_York").\
→ Option B: ISO UTC with Z (e.g., `2025-01-15T16:00:00Z`). In this case, `timezone` can be "UTC" or omitted.

Note: `platformSpecificData` must be nested inside each `platforms[]` item. Top-level `platformSpecificData` is ignored.

#### LinkedIn PDF (Document) Posts

Upload a PDF (`application/pdf`) via `/v1/media` and include it as a `document` in `mediaItems` to attach it to a LinkedIn post. Limitations: one document per post; size ≤ 100MB; up to ~300 pages.

{
  "content": "Our new product brochure",
  "platforms": [
    { "platform": "linkedin", "accountId": "LINKEDIN_ACCOUNT_ID" }
  ],
  "mediaItems": [
    {
      "type": "document",
      "url": "https://.../brochure.pdf",
      "filename": "brochure.pdf",
      "mimeType": "application/pdf"
    }
  ]
}

-   → Personal and Company posts supported; some organization scenarios may require elevated LinkedIn permissions.
-   → Documents cannot be combined with multi-image content in a single LinkedIn post.

🏷️ Tags: The `tags` field is an optional array primarily used by YouTube for search optimization. Tags should be plain keywords that describe your content. YouTube automatically processes these according to platform constraints (duplicates removed, per-tag ≤ 100 chars, combined ≤ 500). ~15 tags are recommended, but not enforced.

→ Posts are sent using the social accounts connected to the specified profile. Each profile can have one account per platform.

##### Platform permalinks

When a platform publishes successfully, its public URL is exposed as `post.platforms[].platformPostUrl`. For scheduled posts, this appears after the job runs; fetch it later via `GET /v1/posts/[postId]` or `GET /v1/posts`.

{
  "post": {
    "platforms": [
      {
        "platform": "instagram",
        "platformPostUrl": "https://www.instagram.com/p/XXXXXXXX/"
      }
    ]
  }
}

#### Response Status Codes

-   201 - Post published successfully to all platforms
-   207 - Multi-Status: Some platforms succeeded, others failed
-   400 - Invalid request data
-   401 - Invalid API key

### POST /v1/posts/bulk-upload

POST/v1/posts/bulk-upload

Upload a CSV to validate and schedule multiple posts at once. Supports a dry-run mode for validation without creating posts.

#### Request

-   Auth: `Authorization: Bearer YOUR_API_KEY`
-   Body: `multipart/form-data` with a single field `file` (`text/csv`)
-   Validate only: add `?dryRun=true` to validate the CSV without creating posts

# Validate CSV (dry run)

curl -X POST https://getlate.dev/api/v1/posts/bulk-upload?dryRun=true\
  -H "Authorization: Bearer YOUR_API_KEY"\
  -F "file=@/absolute/path/to/bulk.csv;type=text/csv"

# Schedule (create posts)

curl -X POST https://getlate.dev/api/v1/posts/bulk-upload\
  -H "Authorization: Bearer YOUR_API_KEY"\
  -F "file=@/absolute/path/to/bulk.csv;type=text/csv"

#### CSV Essentials

-   Required: `platforms`, `profiles`, and either `schedule_time`+`tz` or `publish_now=true`/`is_draft=true` or `use_queue=true`
-   Content: Provide `post_content` or `title` (YouTube can rely on title/description fields)
-   Media: `media_urls` must be http(s) URLs
-   Profiles: `profiles` accepts profile ObjectIds or exact profile names
-   Queue: Set `use_queue=true` to auto-assign next available slot (requires exactly 1 profile)
-   Advanced (optional): `custom_content_[platform]`, `custom_media_[platform]`, `twitter_thread_items`, `threads_thread_items`, `youtube_*`, `instagram_*`, `tiktok_*`

# Example response

{
  "total": 12,
  "valid": 10,
  "invalid": 2,
  "results": [
    { "rowIndex": 1, "ok": true, "createdPostId": "66..." },
    { "rowIndex": 2, "ok": false, "errors": ["profiles_missing"] }
  ],
  "warnings": []
}

200 when all rows are valid, 207 for partial success, 400/401 on errors.

### GET /v1/posts/[postId]

GET/v1/posts/[postId]

Get details of a specific post by ID.

### PUT /v1/posts/[postId]

PUT/v1/posts/[postId]

Update a post. Only draft and scheduled posts can be edited.

📝 Editable Post Statuses: draft, scheduled\
❌ Non-editable: published, publishing, failed, cancelled

#### Queue: Update queued state

You can set or clear `queuedFromProfile` when updating a draft/scheduled post. To move it into a queue, set the profile ID and provide a new `scheduledFor`/`timezone` (e.g., from [/v1/queue/next-slot](https://getlate.dev/docs#queue)). To remove from queue, set `queuedFromProfile` to `null` and keep the time.

{
  "queuedFromProfile": "PROFILE_ID",
  "scheduledFor": "2024-01-17T22:00:00Z",
  "timezone": "America/New_York"
}

#### Request Body

Same structure as POST /v1/posts, all fields are optional:

{
  "content": "Updated post content",
  "scheduledFor": "2024-01-01T15:00:00",
  "timezone": "America/New_York",
  "platforms": [
    {"platform": "twitter", "accountId": "TWITTER_ACCOUNT_ID"},
    {"platform": "linkedin", "accountId": "LINKEDIN_ACCOUNT_ID"},
    {"platform": "threads", "accountId": "THREADS_ACCOUNT_ID"},
    {"platform": "youtube", "accountId": "YOUTUBE_ACCOUNT_ID"}
  ],
  "tags": ["updated", "tutorial", "new"],
  "isDraft": false,
  "publishNow": false,
  "mediaItems": [...]
}

# Update a scheduled post

curl -X PUT https://getlate.dev/api/v1/posts/POST_ID \ -H "Authorization: Bearer YOUR_API_KEY" \ -H "Content-Type: application/json" \ -d '{"content":"Updated content"}'

Posting to TikTok? See [TikTok Direct Posting](https://getlate.dev/docs#tiktok-direct-posting) for required settings. If you omit them, we apply safe defaults automatically.

### DELETE /v1/posts/[postId]

DELETE/v1/posts/[postId]

Delete a post. Published posts cannot be deleted. All other statuses (draft, scheduled, publishing, failed, cancelled) can be deleted.

⚠️ Deletable Post Statuses: draft, scheduled, publishing, failed, cancelled\
❌ Non-deletable: published (posts that have been successfully published cannot be deleted)

# Delete a scheduled or failed post

curl -X DELETE -H "Authorization: Bearer YOUR_API_KEY" https://getlate.dev/api/v1/posts/POST_ID

### POST /v1/posts/[postId]/retry

POST/v1/posts/[postId]/retry

Retry publishing a failed post. Only failed posts can be retried.

### POST /v1/media

POST/v1/media

Upload media files (images/videos) for use in posts. Supports files up to 5GB. Note: large files use a JSON client-upload flow; raw multipart uploads may hit platform body-size limits.

#### TL;DR

-   Small file (≤ ~4MB): Use the curl example below (multipart/form-data).
-   Large file (> ~4MB up to 5GB): Use the "Large files --- client-upload" steps. Do NOT use curl multipart for big files.
-   Error 413? You used the small-file method for a big file. Switch to the large-file steps.

#### 📁 Upload Methods

-   Small files (under ~4MB): Send multipart/form-data directly to `/v1/media`
-   Large files (≥ ~4MB, up to 5GB): Use the JSON client-upload flow against `/v1/media` (returns a direct upload token). Raw multipart may fail due to function body-size limits.
-   Dashboard: Automatically selects the right method for you.

#### File Upload --- small files via multipart

# Upload small files via multipart/form-data

curl -X POST https://getlate.dev/api/v1/media \ -H "Authorization: Bearer YOUR_API_KEY" \ -F "files=@image.jpg"

#### Large files --- client-upload flow (up to 5GB)

For very large files, initiate a JSON client-upload to `/v1/media` to receive a direct upload token, then upload the file directly to storage. The dashboard uses this automatically. Raw multipart to the API route may fail for very large payloads.

##### Super simple steps

1.  Install once: npm i @vercel/blob
2.  Set your API key: export Late_API_KEY=YOUR_API_KEY
3.  Create a file named `upload-large.mjs` with this content:

import { upload } from '@vercel/blob/client';
import fs from 'node:fs';

const apiKey = process.env.Late_API_KEY;
if (!apiKey) { console.error('Missing Late_API_KEY'); process.exit(1); }

const filepath = process.argv[2];
if (!filepath) { console.error('Usage: node upload-large.mjs <path-to-file>'); process.exit(1); }

const data = fs.readFileSync(filepath);
const filename = filepath.split('/').pop() || 'file.bin';

const res = await upload(filename, data, {
  access: 'public',
  handleUploadUrl: 'https://getlate.dev/api/v1/media',
  headers: { Authorization: 'Bearer ' + apiKey },
  multipart: true,
  // set a valid type for your file
  contentType: filename.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg'
});

console.log('Uploaded to:', res.url);

1.  Run it: node upload-large.mjs ./path/to/big.mp4
2.  Done. Use the printed URL in your posts.

##### Node example (@vercel/blob/client)

# Install
npm i @vercel/blob

# Set API key
export Late_API_KEY=YOUR_API_KEY

# Upload large file via token flow
node -e "import fs from 'node:fs';import('@vercel/blob/client').then(async ({upload})=>{const data=fs.readFileSync('path/to/large.mp4');const res=await upload('large.mp4',data,{access:'public',handleUploadUrl:'https://getlate.dev/api/v1/media',headers:{Authorization:'Bearer '+process.env.Late_API_KEY},multipart:true,contentType:'video/mp4'});console.log(res.url);}).catch(e=>{console.error(e);process.exit(1);})"

Notes:

-   Use an allowed content type. Allowed: image/jpeg, image/jpg, image/png, image/webp, image/gif, video/mp4, video/mpeg, video/quicktime, video/avi, video/x-msvideo, video/webm, video/x-m4v, application/pdf.
-   Set `multipart: true` for large files to enable chunked upload.
-   The `Authorization` header must be sent to `/v1/media` for token generation.

##### Common errors (and fixes)

-   413 Request Entity Too Large: You tried multipart for a big file. Use the large-file client-upload steps.
-   Content type not allowed: Set `contentType` to a valid type (e.g., `video/mp4`, `image/jpeg`).
-   Unauthorized (401): Missing/invalid API key. Add `Authorization: Bearer YOUR_API_KEY`.

# Response

{ "files": [{ "type": "video", "url": "https://xyz.public.blob.vercel-storage.com/large-video.mp4", "filename": "large-video.mp4", "size": 50000000, "mimeType": "video/mp4" }] }

#### 📝 Upload Limits

-   File size limit: Up to 5GB per file supported
-   Automatic optimization: Server automatically chooses best upload method
-   Endpoint: `/v1/media` supports both flows; use JSON client-upload for large files
-   Multiple files: Upload multiple files in a single request
-   Consistent response: Same response format for all file sizes

#### 💡 Error Handling

Common error responses:

{ "error": "File \"huge-video.mp4\" is too large (6.2GB). Maximum supported size is 5GB.", "maxSize": "5GB" }

Social Accounts
---------------

### GET /v1/accounts

GET/v1/accounts

Get connected social media accounts, optionally filtered by profile.

#### Query Parameters

-   profileId - Filter accounts by profile ID (optional)

#### Response

{
  "accounts": [
    {
      "_id": "account_id",
      "profileId": "profile_id",
      "platform": "instagram",
      "username": "your_username",
      "displayName": "Your Display Name",
      "profilePicture": "https://...",
      "isActive": true,
      "tokenExpiresAt": "2024-12-31T23:59:59Z",
      "permissions": ["posts:write", "posts:read"]
    }
  ]
}

# Get accounts for a specific profile

curl -H "Authorization: Bearer YOUR_API_KEY" "https://getlate.dev/api/v1/accounts?profileId=PROFILE_ID"

### GET /v1/connect/[platform]

GET/v1/connect/[platform]

Initiate OAuth connection for a platform to a specific profile.

#### Query Parameters

-   profileId - Profile ID to connect the account to (required)
-   redirect_url - Custom URL to redirect to after OAuth completion (optional)

#### Custom Redirects

By default, users are redirected to the dashboard after connecting an account. Use redirect_url to redirect to your own application instead.

##### Success Parameters

-   connected - Platform name (e.g., "twitter")
-   profileId - Profile ID the account was connected to
-   username - Connected account username

##### Error Parameters

-   error - Error type (e.g., "connection_failed")
-   platform - Platform name

# Basic connection (redirects to dashboard)

curl -H "Authorization: Bearer YOUR_API_KEY" "https://getlate.dev/api/v1/connect/twitter?profileId=PROFILE_ID"

# Custom redirect (redirects to your app)

curl -H "Authorization: Bearer YOUR_API_KEY" "https://getlate.dev/api/v1/connect/twitter?profileId=PROFILE_ID&redirect_url=https://myapp.com/oauth-success"

# After success, user gets redirected to:

# https://myapp.com/oauth-success?connected=twitter&profileId=PROFILE_ID&username=johndoe

### POST /v1/connect/[platform]

POST/v1/connect/[platform]

Complete the OAuth token exchange manually (server-side flows).

{
  "code": "OAUTH_CODE",
  "state": "STATE_FROM_GET",
  "profileId": "PROFILE_ID"
}

### POST /v1/connect/bluesky/credentials

POST/v1/connect/bluesky/credentials

Connect Bluesky using identifier + app password.

{
  "identifier": "you@example.com",
  "appPassword": "xxxx-xxxx-xxxx-xxxx",
  "state": "STATE",
  "redirectUri": "https://yourapp.com/connected"
}

### POST /v1/connect/linkedin/select-organization

POST/v1/connect/linkedin/select-organization

Select LinkedIn personal vs organization after OAuth; optionally provide organization details.

{
  "profileId": "PROFILE_ID",
  "tempToken": "TEMP_TOKEN",
  "userProfile": {},
  "accountType": "organization",
  "selectedOrganization": { "id": "12345", "urn": "urn:li:organization:12345", "name": "Company" }
}

### PUT /v1/accounts/[accountId]

PUT/v1/accounts/[accountId]

Update an existing social account's metadata.

{
  "username": "@new_handle",
  "displayName": "New Display Name"
}

### DELETE /v1/accounts/[accountId]

DELETE/v1/accounts/[accountId]

Disconnect a social media account from its profile.

# Disconnect an account

curl -X DELETE -H "Authorization: Bearer YOUR_API_KEY" https://getlate.dev/api/v1/accounts/ACCOUNT_ID

Connection Sharing
------------------

Reuse OAuth connections across multiple profiles while targeting different pages or organizations. Perfect for managing multiple brands with the same underlying social media accounts.

### POST /v1/profiles/[profileId]/clone-connection

POST/v1/profiles/[profileId]/clone-connection

Import an existing connection from another profile to the target profile. Useful for reusing OAuth tokens while targeting different pages or organizations. Supports both API key and session authentication.

#### 🔄 Connection Sharing

This endpoint allows you to reuse an existing platform connection (OAuth token) from one profile in another profile, while optionally targeting different pages (Facebook) or organizations (LinkedIn). Perfect for managing multiple brands with the same underlying social media account.

#### Request Body

{
  "sourceAccountId": "source_account_id_123",
  "targetPageId": "facebook_page_id_456",
  "targetPageName": "Target Facebook Page",
  "targetPageAccessToken": "page_access_token...",
  "targetOrganizationId": "linkedin_org_id_789",
  "targetOrganizationUrn": "urn:li:organization:789",
  "targetOrganizationName": "Target LinkedIn Company",
  "targetAccountType": "organization"
}

#### Parameters

-   sourceAccountId - ID of existing connection to clone (required)
-   targetPageId - Facebook page ID to target (optional, for Facebook)
-   targetPageName - Facebook page name (optional, for Facebook)
-   targetPageAccessToken - Facebook page access token (optional, for Facebook)
-   targetOrganizationId - LinkedIn organization ID (optional, for LinkedIn)
-   targetOrganizationUrn - LinkedIn organization URN (optional, for LinkedIn)
-   targetOrganizationName - LinkedIn organization name (optional, for LinkedIn)
-   targetAccountType - "personal" or "organization" (optional, for LinkedIn)

#### Response

{
  "message": "Connection cloned successfully",
  "connection": {
    "_id": "new_connection_id",
    "platform": "facebook",
    "username": "Target Facebook Page",
    "displayName": "Target Facebook Page",
    "isActive": true,
    "profileId": "target_profile_id"
  }
}

#### Use Cases

-   → Same target: Clone connection with same settings
-   → Facebook different page: Same account, different page
-   → LinkedIn organization: Switch from personal to company posting
-   → Multi-brand management: One account, multiple profiles/brands

# Clone Facebook connection to different page

curl -X POST -H "Authorization: Bearer YOUR_API_KEY" \ -H "Content-Type: application/json" \ -d '{ "sourceAccountId": "facebook_account_123", "targetPageId": "page_456", "targetPageName": "Brand Page" }' \ https://getlate.dev/api/v1/profiles/TARGET_PROFILE_ID/clone-connection

# Clone LinkedIn connection for organization posting

curl -X POST -H "Authorization: Bearer YOUR_API_KEY" \ -H "Content-Type: application/json" \ -d '{ "sourceAccountId": "linkedin_account_789", "targetAccountType": "organization", "targetOrganizationId": "12345", "targetOrganizationUrn": "urn:li:organization:12345", "targetOrganizationName": "Company Name" }' \ https://getlate.dev/api/v1/profiles/TARGET_PROFILE_ID/clone-connection

Facebook Page Management
------------------------

Facebook connections require special handling because users can manage multiple pages. Late provides dedicated endpoints for page selection and management.

#### Facebook Connection Flow

Unlike other platforms, connecting Facebook requires selecting which page to post to. Users are redirected to a page selection interface after OAuth authorization.

### GET /v1/connect/facebook/select-page

GET/v1/connect/facebook/select-page

Get available Facebook pages for selection during connection process.

#### Query Parameters

-   profileId - Profile ID to connect the page to (required)
-   tempToken - Temporary OAuth token from Facebook (required)

#### Response

{
  "pages": [
    {
      "id": "page_id_123",
      "name": "My Business Page",
      "access_token": "page_access_token_...",
      "category": "Business",
      "tasks": ["MANAGE", "CREATE_CONTENT"]
    }
  ]
}

### POST /v1/connect/facebook/select-page

POST/v1/connect/facebook/select-page

Connect a specific Facebook page to a profile.

#### Request Body

{
  "profileId": "profile_id_123",
  "pageId": "page_id_456",
  "tempToken": "facebook_temp_token...",
  "userProfile": {
    "id": "user_facebook_id",
    "name": "User Name",
    "profilePicture": "https://..."
  }
}

#### Response

{
  "message": "Facebook page connected successfully",
  "account": {
    "platform": "facebook",
    "username": "My Business Page",
    "displayName": "My Business Page",
    "isActive": true,
    "selectedPageName": "My Business Page"
  }
}

### PUT /v1/accounts/[accountId]/facebook-page

PUT/v1/accounts/[accountId]/facebook-page

Update which Facebook page an existing account should post to.

#### Request Body

{
  "selectedPageId": "new_page_id_789"
}

# Update Facebook page for an account

curl -X PUT -H "Authorization: Bearer YOUR_API_KEY" \ -H "Content-Type: application/json" \ -d '{"selectedPageId": "new_page_id"}' \ https://getlate.dev/api/v1/accounts/ACCOUNT_ID/facebook-page

#### Important Notes

-   → Users must be admin of Facebook pages to connect them
-   → Page access tokens are automatically managed
-   → Posts are published to the selected page, not personal profile
-   → Page selection can be changed anytime via the dashboard or API

Facebook Page Stories
---------------------

Publish ephemeral 24-hour Facebook Page Stories. Stories require media (single image or video) and automatically disappear after 24 hours.

#### 📱 Story Publishing

Set `platformSpecificData.contentType="story"` in your Facebook platform entry to publish as a Story instead of a feed post. Stories work for both immediate and scheduled posts.

### Image Stories

# Schedule a Facebook image story

curl -X POST https://getlate.dev/api/v1/posts\
-H "Authorization: Bearer YOUR_API_KEY"\
-H "Content-Type: application/json"\
-d '{
  "content": "Behind the scenes today! 📸",
  "platforms": [
    {
      "platform": "facebook",
      "accountId": "FACEBOOK_ACCOUNT_ID",
      "platformSpecificData": {
        "contentType": "story",
        "pageId": "PAGE_ID"
      }
    }
  ],
  "mediaItems": [
    { "type": "image", "url": "https://.../photo.jpg" }
  ],
  "scheduledFor": "2024-01-15T16:00:00",
  "timezone": "UTC"
}'

### Video Stories

# Schedule a Facebook video story

curl -X POST https://getlate.dev/api/v1/posts\
-H "Authorization: Bearer YOUR_API_KEY"\
-H "Content-Type: application/json"\
-d '{
  "content": "Quick update video! 🎥",
  "platforms": [
    {
      "platform": "facebook",
      "accountId": "FACEBOOK_ACCOUNT_ID",
      "platformSpecificData": {
        "contentType": "story",
        "pageId": "PAGE_ID"
      }
    }
  ],
  "mediaItems": [
    { "type": "video", "url": "https://.../video.mp4" }
  ],
  "publishNow": true
}'

#### Story Requirements

-   → Media is required (single image or video)
-   → Images: JPEG/PNG format, publicly accessible HTTPS URL
-   → Videos: MP4/MOV (H.264 + AAC), ≤4GB, publicly accessible HTTPS URL
-   → Text captions are not displayed with stories (API limitation)
-   → Stories automatically disappear after 24 hours
-   → Works with both immediate (`publishNow: true`) and scheduled posts

#### 💡 Story vs Feed Post

To post to Facebook feed (regular post), simply omit `contentType` or set it to anything other than "story".

-   Story: `"platformSpecificData": { "contentType": "story" }`
-   Feed Post: `"platformSpecificData": {}` (or omit contentType)

LinkedIn Company Pages
----------------------

Post to LinkedIn company pages instead of personal profiles.

#### How to Post as Company

Step 1: Connect your LinkedIn personal account first:

curl -H "Authorization: Bearer YOUR_API_KEY" \ "https://getlate.dev/api/v1/connect/linkedin?profileId=PROFILE_ID"

Step 2: Get your LinkedIn Account ID:

curl -H "Authorization: Bearer YOUR_API_KEY" \ "https://getlate.dev/api/v1/accounts?profileId=PROFILE_ID"

Copy the LinkedIn account's `_id` field from the response.

Step 3: Switch to company posting using the account management endpoint:

curl -X PUT -H "Authorization: Bearer YOUR_API_KEY" \ -H "Content-Type: application/json" \ -d '{ "accountType": "organization", "selectedOrganization": { "id": "123456", "urn": "urn:li:organization:123456", "name": "Your Company Name", "manual": true, "sourceUrl": "https://www.linkedin.com/company/123456/" } }' \ "https://getlate.dev/api/v1/accounts/LINKEDIN_ACCOUNT_ID/linkedin-organization"

Replace `LINKEDIN_ACCOUNT_ID` with the account ID from Step 2.

Step 4: Posts will now go to your company page instead of personal profile.

#### Finding Your Company Page ID

1. Go to your LinkedIn company page

2. Click "Admin tools" or navigate to company/YOUR_ID/admin/

3. Copy the URL with the NUMERIC ID (not company name)

✅ Valid: `linkedin.com/company/107655573/`

❌ Invalid: `linkedin.com/company/company-name/`

#### Requirements

-   → You must be an admin of the LinkedIn company page
-   → Use the numeric company ID, not the vanity URL
-   → Get the `ACCOUNT_ID` from `GET /v1/accounts?profileId=PROFILE_ID`

### GET /v1/accounts/[accountId]/linkedin-organizations

GET/v1/accounts/[accountId]/linkedin-organizations

List organizations available for the connected LinkedIn account.

AI Video Clipping
-----------------

Automatically generate short-form clips from long-form videos using AI. Perfect for creating social media content from podcasts, webinars, and long videos.

#### How It Works

1.  Submit a video URL for AI-powered clipping
2.  AI analyzes the video and generates multiple short clips (typically 10-20 minutes processing)
3.  Each clip includes both watermarked and clean versions (based on your plan)
4.  Clips expire in 3 days - create a post to save them permanently

#### Rate Limits

-   → Free Tier: 5 videos/month with watermark
-   → AI Clipping Add-on: Based on subscription credits (no watermark)
-   → Clip Expiration: Generated clips expire in 3 days
-   → Processing Time: Typically 10-20 minutes per video

### POST /v1/video-clips/process

POST/v1/video-clips/process

Submit a video URL for AI-powered clipping. Processing is asynchronous.

#### Request Body

{
  "video_url": "https://storage.example.com/video.mp4",
  "video_file_name": "my-video.mp4"
}

#### Response

{
  "success": true,
  "job_id": "abc123def456",
  "status": "processing",
  "message": "Video submitted for processing"
}

# Create AI clipping job

curl -X POST https://getlate.dev/api/v1/video-clips/process\
  -H "Authorization: Bearer YOUR_API_KEY"\
  -H "Content-Type: application/json"\
  -d '{
    "video_url": "https://storage.example.com/video.mp4",
    "video_file_name": "my-video.mp4"
  }'

### GET /v1/video-clips/jobs

GET/v1/video-clips/jobs

List all video clipping jobs with pagination.

#### Query Parameters

-   page - Page number (default: 1)
-   limit - Jobs per page (default: 20, max: 100)

# List all jobs

curl -H "Authorization: Bearer YOUR_API_KEY" "https://getlate.dev/api/v1/video-clips/jobs?page=1&limit=20"

### GET /v1/video-clips/status/[jobId]

GET/v1/video-clips/status/[jobId]

Check status and get clips for a specific job.

#### Response (Completed)

{
  "job_id": "abc123def456",
  "status": "completed",
  "total_clips": 5,
  "clips": [
    {
      "index": 1,
      "url": "https://clips.example.com/clip-1-clean.mp4",
      "duration": 58.3,
      "start_time": 120.5,
      "end_time": 178.8,
      "watermarkUrl": "https://clips.example.com/clip-1-watermark.mp4",
      "cleanUrl": "https://clips.example.com/clip-1-clean.mp4"
    }
  ]
}

### GET /v1/video-clips/monthly-stats

GET/v1/video-clips/monthly-stats

Get current usage statistics and limits.

#### Response

{
  "current": 3,
  "limit": 5,
  "remaining": 2,
  "canCreate": true,
  "hasAddon": false,
  "message": "Free tier (with watermark)"
}

Supported Platforms
-------------------

### Instagram Content Types

#### ⚠️ Business Account Required

Instagram integration only works with Business accounts. Personal and Creator accounts cannot use automated posting APIs due to Instagram's API restrictions. You can convert to a Business account for free in your Instagram app settings.

#### Posts

Regular Instagram posts that appear in your profile feed. Supports images and videos with captions.

{
  "content": "Your post caption here",
  "platforms": [
    {"platform": "instagram", "accountId": "INSTAGRAM_ACCOUNT_ID"}
  ],
  "mediaItems": [
    {
      "type": "image",
      "url": "image_url_1"
    },
    {
      "type": "image",
      "url": "image_url_2"
    }
  ]
}

#### Stories

Instagram Stories that are visible for 24 hours. Supports images and videos with basic user tagging. Due to Instagram API limitations, programmatic stickers, text overlays, and interactive elements are not supported.

{
  "content": "Optional story caption",
  "platforms": [
    {"platform": "instagram", "accountId": "INSTAGRAM_ACCOUNT_ID", "platformSpecificData": {"contentType": "story"}}
  ],
  "mediaItems": [
    {
      "type": "image",
      "url": "image_url_1"
    }
  ]
}

#### Reels & Video Thumbnails

Instagram videos are automatically posted as Reels for maximum reach. Custom thumbnails are supported.

{
  "content": "Check out this amazing reel! 🎥",
  "platforms": [
    {"platform": "instagram", "accountId": "INSTAGRAM_ACCOUNT_ID"}
  ],
  "mediaItems": [
    {
      "type": "video",
      "url": "video_url",
      "instagramThumbnail": "thumbnail_image_url"
    }
  ]
}

##### Video Thumbnail Requirements

-   → Format: JPEG only
-   → File Size: Maximum 8MB
-   → Aspect Ratio: 9:16 recommended (vertical)
-   → Fallback: Auto-generated thumbnail if custom upload fails
-   → Limitation: Instagram Graph API has limited thumbnail support
-   → Content Type: Videos automatically become Reels with feed sharing enabled

#### Instagram Collabs

Invite up to 3 collaborators to co-author your Instagram posts. Great for partnerships, influencer collaborations, and multi-account content.

{
  "content": "Amazing collaboration post! 🤝",
  "platforms": [
    {
      "platform": "instagram",
      "accountId": "INSTAGRAM_ACCOUNT_ID",
      "platformSpecificData": {
        "collaborators": ["username1", "username2", "username3"]
      }
    }
  ],
  "mediaItems": [
    {
      "type": "image",
      "url": "https://your-image-url.jpg"
    }
  ]
}

##### Collaborator Features

-   → Max Collaborators: Up to 3 per post
-   → Account Types: Collaborators need Business or Creator accounts
-   → Invitation Process: Collaborators receive notifications and must accept
-   → Visibility: Post appears on all collaborators' profiles once accepted
-   → Shared Metrics: Likes, comments, and shares are shared across all profiles
-   → Supported Content: Works with posts, carousels, and reels (not stories)

#### Important Notes

-   → Only Business accounts supported (Personal/Creator accounts will fail)
-   → Stories are visible for 24 hours only
-   → Stories don't support captions in the same way as posts
-   → User tagging in photos supported via userTags in platformSpecificData (images only)
-   → Tag coordinates use X/Y values from 0.0-1.0 relative to image dimensions
-   → Stickers, text overlays, and interactive elements NOT supported by Instagram API
-   → Both posts and stories support images and videos

### TikTok Direct Posting

#### Recommended Request Shape

Provide TikTok settings under `platformSpecificData.tiktokSettings`. If omitted or partially provided, we apply safe defaults and auto-select a valid `privacy_level` from your creator options.

{
  "content": "My new video 🎥🔥",
  "platforms": [
    {
      "platform": "tiktok",
      "accountId": "TIKTOK_ACCOUNT_ID",
      "platformSpecificData": {
        "tiktokSettings": {
          "privacy_level": "PUBLIC_TO_EVERYONE",
          "video_made_with_ai": true,
          "allow_comment": true,
          "allow_duet": true,
          "allow_stitch": true,
          "commercial_content_type": "none",
          "content_preview_confirmed": true,
          "express_consent_given": true
        }
      }
    }
  ],
  "mediaItems": [
    { "type": "video", "url": "https://.../video.mp4" }
  ],
  "scheduledFor": null,
  "timezone": "UTC"
}

Notes:

-   `privacy_level` must be one of your creator's allowed values (e.g., `PUBLIC_TO_EVERYONE`, `FRIENDS`, `SELF_ONLY`). If not provided, we pick a valid one automatically.
-   `video_made_with_ai`: optional boolean. When true, we label the post as AI-generated (sent to TikTok as `post_info.is_aigc=true`).
-   Title is taken from the main `content`; any `title` field under `platformSpecificData` is ignored.
-   Direct vs scheduled: both flows accept the same shape; defaults apply in both.

#### Commercial Content Type Options

TikTok requires you to declare if your content is commercial. Use `commercial_content_type` to specify the type of content.

"none"

No commercial content. Use for regular, non-promotional posts.

"brand_organic"

Your brand/promotional content. Labeled as "Promotional content" on TikTok.

→ Requires: `is_brand_organic_post: true`

"brand_content"

Branded content/paid partnership. Labeled as "Paid partnership" on TikTok.

→ Requires: `brand_partner_promote: true`

→ Restriction: Cannot use `privacy_level: "SELF_ONLY"` (private)

Example: For a sponsored post, set `"commercial_content_type": "brand_content"` and `"brand_partner_promote": true`. The post must be public or friends-only (not private).

### YouTube Content Types

#### Regular Videos

Standard YouTube videos that appear in your channel and search results. No duration limits. Supports custom thumbnails and tags.

{
  "content": "Amazing tutorial on building APIs! Check it out 🚀",
  "tags": ["programming", "tutorial", "api", "coding", "javascript"],
  "platforms": [
    {
      "platform": "youtube",
      "accountId": "YOUTUBE_ACCOUNT_ID",
      "platformSpecificData": {
        "firstComment": "Thanks for watching! What did you think? Don't forget to like and subscribe! 🎥"
      }
    }
  ],
  "mediaItems": [
    {
      "type": "video",
      "url": "https://your-video-url.mp4",
      "thumbnail": "https://your-custom-thumbnail.jpg"
    }
  ],
  "scheduledFor": "2024-01-15T16:00:00Z"
}

##### 🚀 Smart YouTube Scheduling

When you schedule YouTube videos for later, they are uploaded immediately as private and automatically published at your scheduled time. This gives YouTube's algorithm 1+ hours to process your video for better performance!

→ Immediate: Video uploads to YouTube right away (private)

→ Scheduled: YouTube automatically makes it public at your scheduled time

→ Processing: Algorithm gets time to analyze and prepare your video

→ Response: "Post scheduled successfully. YouTube video uploaded immediately for processing time."

#### YouTube Shorts

Short-form videos automatically detected by YouTube based on duration (≤ 3 minutes). Appear in the Shorts feed. Tags are supported. Custom thumbnails cannot be set via the YouTube API for Shorts.

{
  "content": "Check out this amazing short! #Shorts 🔥",
  "tags": ["shorts", "viral", "trending", "quick"],
  "platforms": [
    {
      "platform": "youtube",
      "accountId": "YOUTUBE_ACCOUNT_ID",
      "platformSpecificData": {
        "title": "Amazing Short Video That Will Blow Your Mind! 🔥",
        "firstComment": "Did you enjoy this Short? Let me know in the comments! 💥"
      }
    }
  ],
  "mediaItems": [
    {
      "type": "video",
      "url": "https://your-vertical-video.mp4"
    }
  ],
  "scheduledFor": "2024-01-15T16:00:00Z"
}

#### YouTube Shorts Detection

-   → Videos ≤ 3 minutes → Automatically detected as YouTube Short
-   → Videos > 3 minutes → Regular YouTube video
-   → Vertical videos (9:16 aspect ratio) work best for Shorts
-   → No manual selection needed - YouTube handles detection automatically
-   → Shorts appear in the dedicated Shorts feed for better discovery

#### Custom Thumbnails

YouTube supports custom thumbnails via API for regular videos only. The YouTube API does not allow setting thumbnails for Shorts. For Shorts, YouTube may allow selecting a frame in the mobile app, and thumbnails uploaded in Studio may not display on Shorts feed surfaces.

-   → Format: JPG, PNG, or GIF
-   → Size: Maximum 2MB
-   → Resolution: Recommended 1280x720 (16:9 aspect ratio)
-   → Optional: Thumbnails are completely optional - YouTube will auto-generate if not provided
-   → Validation: Images are validated for format and size before upload to YouTube

#### Automatic First Comments

YouTube supports automatic first comments that are posted immediately after your video uploads. Perfect for engagement, calls-to-action, and encouraging interaction.

-   → Usage: Include `firstComment` in `platformSpecificData`
-   → Length: Up to 10,000 characters (YouTube's comment limit)
-   → Optional: Completely optional - videos upload normally without comments
-   → Timing: Posted automatically after successful video upload
-   → Visibility: First comments often get prime visibility and engagement
-   → Use Cases: "Like & subscribe" reminders, questions for viewers, links to related content

#### Tags

YouTube uses tags for search and recommendation algorithms. Tags help viewers discover your content through search and suggested videos.

-   → Tags Array: Keywords that describe your video topic and content
-   → Limit: 500 characters total, ~15 tags recommended for best performance
-   → Processing: Duplicate tags automatically removed, length limits enforced
-   → Validation: Tags over 100 characters are filtered out
-   → Best Practice: Use relevant, specific keywords that describe your content
-   → Examples: "programming", "tutorial", "javascript", "web development"

TikTok

✓ active

Pinterest

✓ active

Instagram

✓ active

Facebook

✓ active

YouTube

✓ active

LinkedIn

✓ active

Twitter/X

✓ active

Bluesky

✓ active

Threads

✓ active

Reddit

✓ active

Posting Queue
-------------

Define weekly posting schedules and automatically assign posts to the next available time slot. Perfect for maintaining a consistent posting cadence without manual scheduling.

#### How It Works

1.  Define weekly time slots (e.g., Monday 9 AM, Wednesday 2 PM, Friday 5 PM)
2.  Create posts with "Add to Queue" option - they're automatically scheduled to the next available slot
3.  Posts fill slots sequentially, skipping already-occupied times
4.  Each profile has its own independent queue schedule

### GET /v1/queue/slots

GET/v1/queue/slots

Get the queue schedule configuration for a specific profile.

#### Query Parameters

-   profileId - Profile ID (required)

# Get queue schedule

curl -H "Authorization: Bearer YOUR_API_KEY" "https://getlate.dev/api/v1/queue/slots?profileId=PROFILE_ID"

#### Response

{
  "exists": true,
  "schedule": {
    "profileId": "profile_id_123",
    "timezone": "America/New_York",
    "slots": [
      { "dayOfWeek": 1, "time": "09:00" },
      { "dayOfWeek": 3, "time": "14:00" },
      { "dayOfWeek": 5, "time": "17:00" }
    ],
    "active": true,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-15T00:00:00Z"
  },
  "nextSlots": [
    "2024-01-15T14:00:00Z",
    "2024-01-17T22:00:00Z",
    "2024-01-22T14:00:00Z"
  ]
}

### PUT /v1/queue/slots

PUT/v1/queue/slots

Create or update a queue schedule for a profile.

#### Slot Format

-   dayOfWeek: 0 (Sunday) through 6 (Saturday)
-   time: HH:mm format in 24-hour notation (e.g., "09:00", "14:30", "23:00")
-   timezone: IANA timezone (e.g., "America/New_York", "Europe/London", "UTC")

#### Request Body

{
  "profileId": "profile_id_123",
  "timezone": "America/New_York",
  "slots": [
    { "dayOfWeek": 1, "time": "09:00" },
    { "dayOfWeek": 3, "time": "14:00" },
    { "dayOfWeek": 5, "time": "17:00" }
  ],
  "active": true,
  "reshuffleExisting": false
}

#### Reshuffle Existing Posts

Set `reshuffleExisting: true` to automatically reschedule existing queued posts to match the new time slots. Posts keep their relative order but get new times based on the updated schedule.

If `false` (default), existing queued posts keep their current scheduled times and only new posts use the updated schedule.

# Create or update queue schedule

curl -X PUT https://getlate.dev/api/v1/queue/slots\
  -H "Authorization: Bearer YOUR_API_KEY"\
  -H "Content-Type: application/json"\
  -d '{
    "profileId": "profile_id_123",
    "timezone": "America/New_York",
    "slots": [
      { "dayOfWeek": 1, "time": "09:00" },
      { "dayOfWeek": 3, "time": "14:00" }
    ],
    "active": true
  }'

#### Response

{
  "success": true,
  "schedule": {
    "profileId": "profile_id_123",
    "timezone": "America/New_York",
    "slots": [
      { "dayOfWeek": 1, "time": "09:00" },
      { "dayOfWeek": 3, "time": "14:00" }
    ],
    "active": true,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  },
  "nextSlots": [
    "2024-01-15T14:00:00Z",
    "2024-01-17T14:00:00Z"
  ],
  "reshuffledCount": 3
}

### DELETE /v1/queue/slots

DELETE/v1/queue/slots

Delete the queue schedule for a profile. Existing queued posts remain scheduled at their current times.

#### Query Parameters

-   profileId - Profile ID (required)

# Delete queue schedule

curl -X DELETE -H "Authorization: Bearer YOUR_API_KEY" "https://getlate.dev/api/v1/queue/slots?profileId=PROFILE_ID"

### GET /v1/queue/preview

GET/v1/queue/preview

Preview upcoming queue slots for a profile without considering existing posts.

#### Query Parameters

-   profileId - Profile ID (required)
-   count - Number of slots to preview (1-100, default: 20)

# Preview next 10 slots

curl -H "Authorization: Bearer YOUR_API_KEY" "https://getlate.dev/api/v1/queue/preview?profileId=PROFILE_ID&count=10"

#### Response

{
  "profileId": "profile_id_123",
  "count": 10,
  "slots": [
    "2024-01-15T14:00:00Z",
    "2024-01-17T22:00:00Z",
    "2024-01-22T14:00:00Z",
    "2024-01-24T22:00:00Z",
    "2024-01-29T14:00:00Z",
    "2024-01-31T22:00:00Z",
    "2024-02-05T14:00:00Z",
    "2024-02-07T22:00:00Z",
    "2024-02-12T14:00:00Z",
    "2024-02-14T22:00:00Z"
  ]
}

### GET /v1/queue/next-slot

GET/v1/queue/next-slot

Get the next available queue slot for a profile, taking into account already scheduled posts to avoid conflicts. This is the endpoint used when creating posts with "Add to Queue".

#### Query Parameters

-   profileId - Profile ID (required)

# Get next available slot

curl -H "Authorization: Bearer YOUR_API_KEY" "https://getlate.dev/api/v1/queue/next-slot?profileId=PROFILE_ID"

#### Response

{
  "profileId": "profile_id_123",
  "nextSlot": "2024-01-17T22:00:00Z",
  "timezone": "America/New_York"
}

#### Using with POST /v1/posts

Use this endpoint to get the next available slot, then create a post with that time and include `queuedFromProfile` to mark it as queued:

# Step 1: Get next slot
curl -H "Authorization: Bearer YOUR_API_KEY"\
  "https://getlate.dev/api/v1/queue/next-slot?profileId=PROFILE_ID"

# Response: { "nextSlot": "2024-01-17T22:00:00Z", "timezone": "America/New_York" }

# Step 2: Create post with that time
curl -X POST https://getlate.dev/api/v1/posts\
  -H "Authorization: Bearer YOUR_API_KEY"\
  -H "Content-Type: application/json"\
  -d '{
    "content": "My queued post",
    "scheduledFor": "2024-01-17T22:00:00Z",
    "timezone": "America/New_York",
    "platforms": [{"platform": "twitter", "accountId": "ACCOUNT_ID"}],
    "queuedFromProfile": "PROFILE_ID"
  }'

#### Important Notes

-   → Each profile has its own independent queue schedule
-   → Queues work per-profile, not per-platform or per-account
-   → The `next-slot` endpoint skips times that already have scheduled posts
-   → Inactive queues (`active: false`) cannot be used for scheduling
-   → All times are returned in ISO 8601 UTC format but interpreted in the queue's timezone
-   → Slots repeat weekly - a Monday 9 AM slot occurs every Monday at 9 AM

Rate Limits
-----------

API requests are rate limited based on your plan to ensure fair usage:

-   Free: 60 requests per minute
-   Basic: 120 requests per minute
-   Professional: 600 requests per minute
-   Advanced: 1200 requests per minute

#### Plan-Based Limits

Rate limits are separate from usage limits. Even with unlimited uploads, you're still subject to rate limits to prevent API abuse.

Need Help?
----------

Have questions or need support? We're here to help!

<miki@getlate.dev>[dashboard](https://getlate.dev/dashboard)