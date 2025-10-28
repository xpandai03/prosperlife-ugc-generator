# Supabase Auto-Confirm Email Setup

## Issue
Users getting "Email not confirmed" error after signup, preventing them from logging in.

## Solution
Enable auto-confirm for email signups in Supabase Dashboard.

---

## Setup Steps

### 1. Navigate to Supabase Dashboard
Go to: https://supabase.com/dashboard/project/hfnmgonoxkjaqlelnqwc/auth/providers

### 2. Configure Email Provider
1. Click on **"Email"** provider in the list
2. Scroll to **"Confirm email"** section
3. **DISABLE** the "Confirm email" toggle (turn it OFF)
   - This allows users to sign up without email verification
   - Perfect for MVP and development

### 3. Save Changes
Click **"Save"** at the bottom of the page

---

## Verification

### Test Signup Flow
1. Sign up with a new email (e.g., `newuser@example.com`)
2. After clicking "Sign up", you should:
   - ✅ See "Account created" toast
   - ✅ Be immediately logged in
   - ✅ See user avatar in header
   - ✅ Be redirected to homepage

### Test Login Flow
1. Log out
2. Log in with the same credentials
3. You should:
   - ✅ See "Welcome back" toast
   - ✅ Be logged in immediately
   - ✅ Be redirected to homepage
   - ❌ NOT see "Email not confirmed" error

---

## Alternative: Manual User Confirmation (Development Only)

If you need to confirm a user manually during development:

1. Go to: https://supabase.com/dashboard/project/hfnmgonoxkjaqlelnqwc/auth/users
2. Find the user in the list
3. Click on the user
4. In the user details, find the "Email Confirmed" field
5. Manually mark it as confirmed

---

## Production Considerations

For production, you may want to:
- **Re-enable email confirmation** for security
- Set up email templates in Supabase
- Configure a custom SMTP provider
- Set up proper redirect URLs

For MVP, auto-confirm is acceptable and simplifies the user experience.

---

## Troubleshooting

### Still Getting "Email not confirmed" Error?

1. **Check Supabase Dashboard Settings**
   - Verify "Confirm email" is OFF
   - Check if changes were saved

2. **Delete Test Users**
   - Go to Auth → Users
   - Delete any test users created before disabling confirmation
   - Create new users after the setting change

3. **Check Database Trigger**
   - Verify `handle_new_user()` trigger exists
   - Run: `SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';`

4. **Clear Browser Cache**
   - Clear localStorage
   - Hard refresh (Cmd+Shift+R / Ctrl+Shift+R)

---

## Current Status

✅ Frontend code updated to handle both scenarios:
- Auto-confirm enabled → Immediate login
- Auto-confirm disabled → Shows "Check your email" message

✅ Better error messages for unconfirmed emails

✅ Redirect race condition fixed (waits for session to establish)
