# Phase 7: Social Account Connection (Late.dev OAuth)

**Date:** October 28, 2025
**Status:** ✅ Complete - Ready for testing
**Commit:** TBD

---

## Overview

Implemented Late.dev OAuth integration to allow users to connect their own social media accounts (Instagram, TikTok, YouTube, etc.). Users can now authorize their accounts via OAuth and post to their own profiles.

**Key Features:**
- OAuth URL generation for 10+ platforms
- Secure callback handling with profile verification
- Account listing and management
- Seamless integration with existing video/post workflows

---

## Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Frontend  │────1───>│   Backend    │────2───>│  Late.dev   │
│   Client    │         │   /api/      │         │   OAuth     │
└─────────────┘         └──────────────┘         └─────────────┘
      ^                                                  │
      │                                                  │
      └──────────────────3─────────────────────────────┘
                   (OAuth Redirect Back)
```

**OAuth Flow:**
1. **User** → Frontend: Clicks "Connect Instagram"
2. **Frontend** → Backend: `GET /api/social/connect/instagram`
3. **Backend** → Late.dev: Generates OAuth URL with `profileId` + `redirect_url`
4. **Backend** → Frontend: Returns connect URL
5. **Frontend**: Redirects user to Late.dev OAuth page
6. **User**: Authorizes Instagram account on Late.dev
7. **Late.dev** → Frontend: Redirects to `/oauth-callback?connected=instagram&profileId=...&username=...`
8. **Frontend** → Backend: `POST /api/social/callback` with OAuth params
9. **Backend** → Late.dev: Fetches full account details (`GET /v1/accounts?profileId=...`)
10. **Backend** → Database: Stores `late_account_id` in user record
11. **Backend** → Frontend: Returns success with account details

---

## Files Changed

### **New/Modified Files**

#### 1. **server/services/late.ts** (Enhanced)
Added OAuth methods:

```typescript
// Enhanced getAccounts with profile filtering
async getAccounts(profileId?: string): Promise<any>

// Generate OAuth connect URL for a platform
generateConnectUrl(profileId: string, platform: string, redirectUrl: string): string

// Handle OAuth callback and fetch account details
async handleOAuthCallback(profileId: string, platform: string): Promise<any>
```

#### 2. **server/routes.ts** (3 New Endpoints)

**GET /api/social/connect/:platform**
- Validates platform (instagram, tiktok, youtube, etc.)
- Fetches user's Late.dev profile ID
- Generates OAuth URL with custom redirect
- Returns connect URL for frontend

**POST /api/social/callback**
- Receives OAuth callback parameters
- Verifies profile ID matches authenticated user
- Fetches full account details from Late.dev
- Stores `late_account_id` in database
- Returns account details to frontend

**GET /api/social/accounts**
- Lists all connected accounts for authenticated user
- Fetches from Late.dev API using profile ID
- Returns account details (platform, username, accountId, etc.)

---

## API Endpoints

### **1. GET /api/social/connect/:platform**

Generate Late.dev OAuth URL for connecting a social account.

**Parameters:**
- `:platform` - Platform to connect (instagram, tiktok, youtube, facebook, twitter, linkedin, threads, pinterest, reddit, bluesky)

**Headers:**
- `Authorization: Bearer <JWT_TOKEN>`

**Response (200 OK):**
```json
{
  "success": true,
  "connectUrl": "https://getlate.dev/api/v1/connect/instagram?profileId=...&redirect_url=...",
  "platform": "instagram",
  "profileId": "late_profile_id_123"
}
```

**Error Responses:**
- `400` - Unsupported platform or no Late.dev profile
- `401` - Unauthorized (invalid/missing JWT)
- `500` - Server error

**Example:**
```bash
curl -H "Authorization: Bearer $JWT_TOKEN" \
  https://yourdomain.com/api/social/connect/instagram
```

---

### **2. POST /api/social/callback**

Handle OAuth callback from Late.dev after user authorizes their account.

**Headers:**
- `Authorization: Bearer <JWT_TOKEN>`

**Request Body:**
```json
{
  "connected": "instagram",
  "profileId": "late_profile_id_123",
  "username": "john_doe"
}
```

**Or on error:**
```json
{
  "error": "connection_failed",
  "platform": "instagram"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Successfully connected instagram account",
  "account": {
    "platform": "instagram",
    "username": "john_doe",
    "accountId": "late_account_id_456",
    "displayName": "John Doe",
    "profilePicture": "https://..."
  }
}
```

**Error Responses:**
- `400` - Connection failed or invalid callback data
- `403` - Profile ID mismatch
- `500` - Server error

**Example:**
```bash
curl -X POST https://yourdomain.com/api/social/callback \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "connected": "instagram",
    "profileId": "late_profile_id_123",
    "username": "john_doe"
  }'
```

---

### **3. GET /api/social/accounts**

List all connected social accounts for the authenticated user.

**Headers:**
- `Authorization: Bearer <JWT_TOKEN>`

**Response (200 OK):**
```json
{
  "success": true,
  "accounts": [
    {
      "_id": "late_account_id_456",
      "platform": "instagram",
      "username": "john_doe",
      "displayName": "John Doe",
      "profilePicture": "https://...",
      "isActive": true,
      "profileId": "late_profile_id_123"
    },
    {
      "_id": "late_account_id_789",
      "platform": "tiktok",
      "username": "johndoe_tiktok",
      "displayName": "John Doe TikTok",
      "profilePicture": "https://...",
      "isActive": true,
      "profileId": "late_profile_id_123"
    }
  ],
  "profileId": "late_profile_id_123"
}
```

**Error Responses:**
- `401` - Unauthorized
- `500` - Server error

**Example:**
```bash
curl -H "Authorization: Bearer $JWT_TOKEN" \
  https://yourdomain.com/api/social/accounts
```

---

## Testing Plan

### **Prerequisites**

1. ✅ Late.dev API key configured (`LATE_API_KEY` in .env)
2. ✅ User authenticated with valid JWT token
3. ✅ User has `late_profile_id` in database (Phase 5 complete)
4. ✅ Frontend has `/oauth-callback` route to handle redirects
5. ✅ `FRONTEND_URL` environment variable set (or defaults to `http://localhost:5000`)

---

### **Test 1: Generate OAuth URL**

**Goal:** Verify that OAuth URL is generated correctly

```bash
export JWT_TOKEN="your-jwt-token"
export BASE_URL="https://launchready-streamline-mvp.onrender.com"

# Test 1: Generate Instagram connect URL
curl -H "Authorization: Bearer $JWT_TOKEN" \
  $BASE_URL/api/social/connect/instagram

# Expected Response:
# {
#   "success": true,
#   "connectUrl": "https://getlate.dev/api/v1/connect/instagram?profileId=...&redirect_url=http://localhost:5000/oauth-callback",
#   "platform": "instagram",
#   "profileId": "late_profile_id_123"
# }
```

**Verification:**
- ✅ Response contains `connectUrl`
- ✅ URL includes correct `profileId`
- ✅ URL includes correct `redirect_url`
- ✅ Platform is correct

---

### **Test 2: Invalid Platform**

**Goal:** Verify platform validation works

```bash
curl -H "Authorization: Bearer $JWT_TOKEN" \
  $BASE_URL/api/social/connect/snapchat

# Expected Response (400):
# {
#   "error": "Unsupported platform",
#   "message": "Platform \"snapchat\" is not supported. Supported platforms: instagram, tiktok, youtube, facebook, twitter, linkedin, threads, pinterest, reddit, bluesky"
# }
```

---

### **Test 3: Complete OAuth Flow (Manual)**

**Goal:** Verify full OAuth flow from start to finish

**Steps:**
1. **Generate connect URL:**
   ```bash
   curl -H "Authorization: Bearer $JWT_TOKEN" \
     $BASE_URL/api/social/connect/instagram
   ```

2. **Visit the `connectUrl` in a browser**
   - You'll be redirected to Late.dev OAuth page
   - Authorize the app to access your Instagram account
   - You'll be redirected back to your frontend: `http://localhost:5000/oauth-callback?connected=instagram&profileId=...&username=...`

3. **Frontend captures the OAuth params and calls backend:**
   ```bash
   curl -X POST $BASE_URL/api/social/callback \
     -H "Authorization: Bearer $JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "connected": "instagram",
       "profileId": "YOUR_PROFILE_ID",
       "username": "YOUR_INSTAGRAM_USERNAME"
     }'
   ```

4. **Expected Response:**
   ```json
   {
     "success": true,
     "message": "Successfully connected instagram account",
     "account": {
       "platform": "instagram",
       "username": "your_username",
       "accountId": "late_account_id_456",
       "displayName": "Your Name",
       "profilePicture": "https://..."
     }
   }
   ```

**Verification:**
- ✅ User can visit OAuth URL
- ✅ User can authorize on Late.dev
- ✅ Redirect back to frontend works
- ✅ Callback endpoint returns account details
- ✅ `late_account_id` stored in database

**Check Database:**
```sql
SELECT id, email, late_profile_id, late_account_id
FROM users
WHERE email = 'your-test-email@example.com';
```

**Expected:** `late_account_id` column populated with account ID

---

### **Test 4: List Connected Accounts**

**Goal:** Verify account listing works

```bash
curl -H "Authorization: Bearer $JWT_TOKEN" \
  $BASE_URL/api/social/accounts

# Expected Response:
# {
#   "success": true,
#   "accounts": [
#     {
#       "_id": "late_account_id_456",
#       "platform": "instagram",
#       "username": "your_username",
#       "displayName": "Your Name",
#       "profilePicture": "https://...",
#       "isActive": true,
#       "profileId": "late_profile_id_123"
#     }
#   ],
#   "profileId": "late_profile_id_123"
# }
```

**Verification:**
- ✅ Response contains accounts array
- ✅ Instagram account appears in list
- ✅ Account details are correct

---

### **Test 5: Profile ID Mismatch (Security Test)**

**Goal:** Verify that profile ID validation prevents unauthorized access

**Steps:**
1. Manually craft a callback request with a **different** `profileId`:
   ```bash
   curl -X POST $BASE_URL/api/social/callback \
     -H "Authorization: Bearer $JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "connected": "instagram",
       "profileId": "DIFFERENT_PROFILE_ID",
       "username": "attacker_account"
     }'
   ```

2. **Expected Response (403):**
   ```json
   {
     "error": "Profile mismatch",
     "message": "The connected profile does not match your account"
   }
   ```

**Verification:**
- ✅ Request rejected with 403
- ✅ Error message explains mismatch
- ✅ Database NOT updated

---

### **Test 6: Multiple Platforms**

**Goal:** Verify users can connect multiple platforms

**Steps:**
1. Connect Instagram (already done)
2. Connect TikTok:
   ```bash
   curl -H "Authorization: Bearer $JWT_TOKEN" \
     $BASE_URL/api/social/connect/tiktok
   ```
3. Complete OAuth flow for TikTok
4. List accounts:
   ```bash
   curl -H "Authorization: Bearer $JWT_TOKEN" \
     $BASE_URL/api/social/accounts
   ```

**Expected Response:**
```json
{
  "success": true,
  "accounts": [
    {
      "platform": "instagram",
      "username": "your_instagram"
    },
    {
      "platform": "tiktok",
      "username": "your_tiktok"
    }
  ]
}
```

**Note:** Current implementation stores only ONE `late_account_id` per user. For multiple accounts, you'd need a separate `connected_accounts` table (see Limitations section below).

---

## Supported Platforms

The following platforms are supported for OAuth connection:

| Platform | Status | Late.dev API Support |
|----------|--------|---------------------|
| Instagram | ✅ Active | Yes |
| TikTok | ✅ Active | Yes |
| YouTube | ✅ Active | Yes |
| Facebook | ✅ Active | Yes |
| Twitter/X | ✅ Active | Yes |
| LinkedIn | ✅ Active | Yes |
| Threads | ✅ Active | Yes |
| Pinterest | ✅ Active | Yes |
| Reddit | ✅ Active | Yes |
| Bluesky | ✅ Active | Yes |

---

## Environment Variables

Required environment variables:

```env
# Late.dev API Key (required)
LATE_API_KEY=your_late_api_key_here

# Frontend URL for OAuth redirects (optional, defaults to http://localhost:5000)
FRONTEND_URL=https://yourdomain.com
```

---

## Database Schema

**Existing Schema (No migration needed):**

```sql
-- users table already has late_account_id column (added in Phase 5)
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  late_profile_id TEXT,        -- Added in Phase 5
  late_account_id TEXT,         -- Used in Phase 7 for OAuth
  stripe_customer_id TEXT,
  subscription_status TEXT DEFAULT 'free',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Note:** `late_account_id` stores the **most recently connected account**. For multiple accounts per user, see Limitations section.

---

## Logging

All OAuth operations are logged with the `[OAuth]` prefix:

```
[OAuth] Connect request: { userId: '...', platform: 'instagram' }
[OAuth] Connect URL generated: { userId: '...', platform: 'instagram', profileId: '...' }
[OAuth Callback] Received: { connected: 'instagram', profileId: '...', username: '...', userId: '...' }
[OAuth Callback] Account connected successfully: { userId: '...', platform: 'instagram', username: '...', accountId: '...' }
[Social Accounts] Fetching accounts for user: ...
[Social Accounts] Accounts fetched: { userId: '...', count: 2 }
```

---

## Error Handling

### **Common Errors:**

**1. User has no Late.dev profile:**
```json
{
  "error": "No Late.dev profile",
  "message": "Please create a Late.dev profile first"
}
```
**Solution:** Ensure Phase 5 is complete and user has `late_profile_id`.

**2. Unsupported platform:**
```json
{
  "error": "Unsupported platform",
  "message": "Platform \"snapchat\" is not supported. Supported platforms: ..."
}
```
**Solution:** Use one of the 10 supported platforms.

**3. Profile mismatch:**
```json
{
  "error": "Profile mismatch",
  "message": "The connected profile does not match your account"
}
```
**Solution:** Ensure OAuth callback contains correct `profileId` for authenticated user.

**4. No active account found:**
```
Error: No active instagram account found for profile late_profile_id_123
```
**Solution:** Verify OAuth flow completed successfully and account exists in Late.dev.

---

## Limitations & Future Enhancements

### **Current Limitations:**

1. **Single Account Per User:** The current implementation stores only ONE `late_account_id` in the `users` table. If a user connects multiple platforms, only the most recent account ID is stored.

2. **No Per-Platform Storage:** While Late.dev supports multiple accounts per profile, our database doesn't track which platforms are connected individually.

### **Future Enhancements (Post Phase 7):**

#### **Option 1: Separate Accounts Table**
Create a new table to store multiple accounts per user:

```sql
CREATE TABLE connected_accounts (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  late_account_id TEXT NOT NULL,
  username TEXT,
  display_name TEXT,
  profile_picture TEXT,
  is_active BOOLEAN DEFAULT true,
  connected_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, platform)
);
```

This would allow:
- Multiple accounts per user (one per platform)
- Platform-specific account tracking
- Easy account disconnection
- Cleaner data model

#### **Option 2: JSON Column**
Store accounts in a JSON column:

```sql
ALTER TABLE users
ADD COLUMN connected_accounts JSONB DEFAULT '{}';

-- Example data:
-- {
--   "instagram": "late_account_id_456",
--   "tiktok": "late_account_id_789"
-- }
```

**For now:** Phase 7 works with single-account model. Users can connect accounts, and the latest account ID is used for posting.

---

## Integration with Existing Workflows

### **Video Posting (Unchanged)**

The existing video posting workflow (`POST /api/social/post`) already uses `late_account_id`:

```typescript
// From server/routes.ts:557
const accountId = user.lateAccountId || INSTAGRAM_ACCOUNT_ID;

const lateResponse = await lateService.postToInstagram(
  {
    videoUrl: export.srcUrl,
    caption,
    contentType: 'reel',
  },
  user.lateProfileId,
  accountId  // Uses connected account ID
);
```

**After Phase 7:** Videos/posts will automatically use the user's connected account instead of the hardcoded default.

---

## Next Steps

**Phase 7 Complete!** ✅

**Ready for:**
- **Phase 7b (Frontend):** Build Connect Accounts UI page
- **Phase 8 (Stripe):** Subscription management and Pro upgrades
- **Phase 9 (Testing):** End-to-end QA and production hardening

**Immediate Testing:**
1. Run migration on Supabase (if needed - `late_account_id` already exists)
2. Deploy to Render
3. Test OAuth flow with curl
4. Test OAuth flow with real frontend
5. Verify connected accounts appear in database
6. Test video posting with connected account

---

## Troubleshooting

### **Issue: OAuth redirect loops**
**Cause:** Frontend `/oauth-callback` route not implemented
**Fix:** Implement frontend route to capture OAuth params and call backend

### **Issue: Profile ID not found**
**Cause:** User doesn't have Late.dev profile
**Fix:** Ensure Phase 5 is complete and `late_profile_id` is populated

### **Issue: Account not found after OAuth**
**Cause:** OAuth flow didn't complete or Late.dev didn't create account
**Fix:** Check Late.dev dashboard, verify OAuth flow completed successfully

### **Issue: CORS errors on OAuth redirect**
**Cause:** `FRONTEND_URL` not configured correctly
**Fix:** Set `FRONTEND_URL` environment variable to match your frontend domain

---

## Summary

**Phase 7 Implementation Complete:**
- ✅ OAuth URL generation for 10+ platforms
- ✅ Secure callback handling with profile verification
- ✅ Account listing via Late.dev API
- ✅ Seamless integration with existing workflows
- ✅ Comprehensive error handling and logging
- ✅ Documentation and testing plan

**Key Benefits:**
- Users can connect their own social accounts
- Secure OAuth flow with Late.dev
- Multi-platform support (Instagram, TikTok, YouTube, etc.)
- Automatic account usage in video/post workflows
- Foundation for Phase 8 (Stripe subscriptions)
