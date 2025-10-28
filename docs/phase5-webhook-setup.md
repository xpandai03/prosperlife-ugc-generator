# Phase 5: Supabase Webhook Configuration

**Date:** October 28, 2025, 3:40 PM PST
**Purpose:** Configure Supabase Database Webhooks to automatically create Late.dev profiles for new users

---

## Overview

Phase 5 implements per-user Late.dev profiles by creating a unique profile for each user when they sign up. This is achieved using Supabase Database Webhooks that trigger when a new user record is inserted into the `public.users` table.

## Implementation Summary

### Code Changes Completed ✅

1. **Late.dev Service** (`server/services/late.ts`)
   - Added `createProfile(email)` method to create new Late.dev profiles
   - Updated `postToInstagram()` to accept optional `profileId` and `accountId` parameters
   - Maintains backward compatibility with default values

2. **Webhook Handler** (`server/routes.ts`)
   - Added `POST /api/auth/webhook` endpoint (public, before auth middleware)
   - Handles `INSERT` events on the `users` table
   - Creates Late.dev profile and updates user record with `late_profile_id`
   - Includes error handling and logging

3. **Social Posting Logic** (`server/routes.ts`)
   - Updated `POST /api/social/post` to fetch user's `late_profile_id`
   - Validates that user has a Late profile before posting
   - Passes user's profile ID to Late.dev API calls
   - Falls back to default Instagram account ID until users connect their own

---

## Supabase Webhook Configuration

### Step 1: Access Database Webhooks

1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/hfnmgonoxkjaqlelnqwc
2. Navigate to **Database** → **Webhooks** in the left sidebar
3. Click **Enable Webhooks** if not already enabled

### Step 2: Create New Webhook

Click **Create a new hook** and configure:

#### Basic Settings

- **Name:** `user-signup-late-profile`
- **Description:** `Create Late.dev profile when new user signs up`
- **Table:** `public.users`
- **Events:** Check only **INSERT**

#### HTTP Request Settings

- **Method:** `POST`
- **URL:** Your production backend URL + `/api/auth/webhook`
  - **Example:** `https://streamline-mvp.onrender.com/api/auth/webhook`
  - **Local testing:** `https://your-ngrok-url.ngrok.io/api/auth/webhook`

#### HTTP Headers

Add the following header for security (optional but recommended):

```
X-Webhook-Secret: your-secret-token-here
```

**Note:** You'll need to validate this secret in your webhook handler if you add it. For now, it's optional.

#### Payload

Use the default payload template. The webhook will send:

```json
{
  "type": "INSERT",
  "table": "users",
  "schema": "public",
  "record": {
    "id": "user-uuid-here",
    "email": "user@example.com",
    "full_name": "User Name",
    "created_at": "2025-10-28T...",
    ...
  },
  "old_record": null
}
```

### Step 3: Test the Webhook

1. Click **Send test request** in the webhook configuration
2. Check your server logs for:
   ```
   [Auth Webhook] Received event: INSERT
   [Auth Webhook] New user created: { userId: '...', email: '...' }
   [Late Service] Creating profile for: user@example.com
   [Late Service] Profile created successfully: { profileId: '...', email: '...' }
   [Auth Webhook] User updated with Late profile ID
   ```

3. If successful, click **Create hook** to save

### Step 4: Verify in Production

After deploying to Render:

1. Sign up a new test user in your application
2. Check Render logs for webhook processing
3. Query the database to verify `late_profile_id` is populated:
   ```sql
   SELECT id, email, late_profile_id, created_at
   FROM public.users
   ORDER BY created_at DESC
   LIMIT 5;
   ```
4. Check Late.dev dashboard for the new profile

---

## Alternative: Database Trigger (Not Implemented)

Instead of webhooks, you could use a Postgres trigger and function:

```sql
-- Create function to handle user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Profile creation will be handled by webhook
  -- This is just a placeholder if webhook approach doesn't work
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
```

**Pros:**
- Runs entirely in database
- No external HTTP call required
- Guaranteed to run synchronously

**Cons:**
- Can't make HTTP requests to Late.dev API from Postgres
- Would need a background job to create profiles

**Decision:** Webhook approach is preferred because it allows immediate HTTP calls to Late.dev API.

---

## Troubleshooting

### Webhook Not Triggering

1. **Check webhook is enabled** in Supabase Dashboard
2. **Verify URL is correct** and publicly accessible
3. **Check server logs** for incoming requests to `/api/auth/webhook`
4. **Test with ngrok** locally:
   ```bash
   ngrok http 5000
   # Use the https URL in webhook config
   ```

### Profile Creation Fails

1. **Check LATE_API_KEY** is configured in environment
2. **Verify API key is valid** by testing `lateService.testConnection()`
3. **Check server logs** for error messages from Late.dev API
4. **Rate limits:** Late.dev may have rate limits on profile creation

### User Has No Profile After Signup

1. **Check webhook logs** in Supabase Dashboard (Database → Webhooks → View logs)
2. **Check server logs** for webhook processing
3. **Manually trigger profile creation:**
   ```bash
   curl -X POST https://your-backend/api/auth/webhook \
     -H "Content-Type: application/json" \
     -d '{
       "type": "INSERT",
       "table": "users",
       "record": {
         "id": "user-uuid",
         "email": "user@example.com"
       }
     }'
   ```

### Profile Created But Not Saved

1. **Check Supabase permissions** - service role should be able to UPDATE users table
2. **Verify schema** - ensure `late_profile_id` column exists in `public.users`
3. **Check for database errors** in logs

---

## Environment Variables Required

Ensure these are set on Render:

```bash
SUPABASE_URL=https://hfnmgonoxkjaqlelnqwc.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...  # Secret - server only
LATE_API_KEY=sk_4db1d4d490bb7515200e27057ce812940413dada899c06215ed761bd5bbc3bd3
INSTAGRAM_ACCOUNT_ID=6900d2cd8bbca9c10cbfff74  # Default account until users connect their own
```

---

## Testing Checklist

- [ ] Webhook configured in Supabase Dashboard
- [ ] Webhook test request succeeds
- [ ] New user signup creates Late profile
- [ ] `late_profile_id` saved to database
- [ ] Late.dev dashboard shows new profile
- [ ] Social posting uses user's profile
- [ ] Error handling works when Late API fails
- [ ] Logs show clear debugging information

---

## Next Steps (Future Phases)

1. **Phase 6:** Allow users to connect their own Instagram accounts via Late.dev OAuth
2. **Phase 7:** Store `late_account_id` per user for truly per-user posting
3. **Phase 8:** Support multiple social accounts per user
4. **Phase 9:** Add Late.dev profile management UI in user settings

---

## References

- [Supabase Database Webhooks Docs](https://supabase.com/docs/guides/database/webhooks)
- [Late.dev API Documentation](https://getlate.dev/docs)
- [Phase 5 Implementation Plan](../docs/phased-auth-implementation.md#phase-5-latedev-per-user-profiles)
