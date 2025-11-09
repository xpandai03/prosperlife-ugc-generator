/**
 * Resend Email Notification Service (Phase 8)
 *
 * Sends email notifications to users when video generation completes
 * Supports: UGC Ads, Direct Generations (Veo3/Sora2), future Klap clips
 */

import { Resend } from 'resend';
import { storage } from '../storage.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;

if (!RESEND_API_KEY) {
  console.warn('[Resend] Warning: RESEND_API_KEY not configured - email notifications disabled');
}

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export interface NotificationParams {
  userId: string;
  assetId: string;
  status: 'ready' | 'error';
  assetType: 'ugc-ad' | 'klap-clip' | 'video' | 'image';
  videoUrl?: string;
  errorMessage?: string;
  generationMode?: string; // 'nanobana+veo3', 'veo3-only', 'sora2'
}

/**
 * Send email notification when video generation completes
 */
export async function sendVideoCompleteNotification(params: NotificationParams) {
  if (!resend) {
    console.log('[Resend] Skipping notification - Resend not configured');
    return { success: false, reason: 'not_configured' };
  }

  try {
    // 1. Fetch user email
    console.log(`[Resend] Fetching user data for userId: ${params.userId}`);
    const user = await storage.getUser(params.userId);

    console.log(`[Resend] User lookup result:`, {
      found: !!user,
      hasEmail: !!user?.email,
      email: user?.email || 'MISSING',
      fullName: user?.fullName || 'MISSING',
    });

    if (!user?.email) {
      console.warn(`[Resend] ❌ Cannot send email - no email found for user ${params.userId}`);
      console.warn(`[Resend] User record:`, JSON.stringify(user, null, 2));
      return { success: false, reason: 'no_email' };
    }

    console.log(`[Resend] ✅ Preparing ${params.status} notification for ${user.email}`, {
      assetId: params.assetId,
      assetType: params.assetType,
    });

    // 2. Build email content
    const { subject, html } = buildEmailContent(params, user.fullName);

    // 3. Send via Resend
    const { data, error } = await resend.emails.send({
      from: 'Streamline AI <no-reply@streamline.ai>',
      to: [user.email],
      subject,
      html,
      tags: [
        { name: 'type', value: 'video_notification' },
        { name: 'status', value: params.status },
        { name: 'asset_type', value: params.assetType },
      ],
    });

    if (error) {
      console.error(`[Resend] Failed to send email:`, error);
      return { success: false, error };
    }

    console.log(`[Resend] ✅ Email sent to ${user.email} (ID: ${data?.id})`);
    return { success: true, emailId: data?.id };

  } catch (err: any) {
    console.error(`[Resend] Unexpected error:`, err);
    return { success: false, error: err.message };
  }
}

/**
 * Build email content based on notification params
 */
function buildEmailContent(
  params: NotificationParams,
  fullName?: string | null
): { subject: string; html: string } {
  const userName = fullName || 'there';
  const assetTypeLabel = getAssetTypeLabel(params.assetType);

  if (params.status === 'ready') {
    return {
      subject: `🎬 Your ${assetTypeLabel} is ready!`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Your video is ready!</h1>
          </div>

          <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Hi ${userName},</p>

            <p style="font-size: 16px; margin-bottom: 20px;">
              Your <strong>${assetTypeLabel}</strong> has finished processing and is ready to view!
            </p>

            ${params.generationMode ? `
              <p style="font-size: 14px; color: #6b7280; margin-bottom: 20px;">
                Generation mode: <code style="background: #e5e7eb; padding: 2px 6px; border-radius: 4px;">${params.generationMode}</code>
              </p>
            ` : ''}

            ${params.videoUrl ? `
              <div style="text-align: center; margin: 30px 0;">
                <a href="${params.videoUrl}"
                   style="display: inline-block; background: #667eea; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  View Your Video
                </a>
              </div>

              <p style="font-size: 14px; color: #6b7280; margin-top: 30px; word-break: break-all;">
                Or copy this link: <a href="${params.videoUrl}" style="color: #667eea;">${params.videoUrl}</a>
              </p>
            ` : `
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://streamline.ai/dashboard"
                   style="display: inline-block; background: #667eea; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  View in Dashboard
                </a>
              </div>
            `}
          </div>

          <div style="margin-top: 30px; padding: 20px; background: white; border-radius: 8px; font-size: 12px; color: #6b7280; text-align: center;">
            <p style="margin: 0;">
              This is an automated notification from Streamline AI.<br>
              Need help? Contact us at <a href="mailto:support@streamline.ai" style="color: #667eea;">support@streamline.ai</a>
            </p>
          </div>
        </body>
        </html>
      `,
    };
  } else {
    // Error case
    return {
      subject: `⚠️ Your ${assetTypeLabel} failed to generate`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
          <div style="background: linear-gradient(135deg, #f87171 0%, #dc2626 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">⚠️ Generation Failed</h1>
          </div>

          <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Hi ${userName},</p>

            <p style="font-size: 16px; margin-bottom: 20px;">
              Unfortunately, your <strong>${assetTypeLabel}</strong> failed to generate.
            </p>

            ${params.errorMessage ? `
              <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px; color: #991b1b;">
                  <strong>Error:</strong> ${params.errorMessage}
                </p>
              </div>
            ` : ''}

            <p style="font-size: 16px; margin: 20px 0;">
              Please try again or contact our support team if the issue persists.
            </p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="https://streamline.ai/dashboard"
                 style="display: inline-block; background: #dc2626; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Go to Dashboard
              </a>
            </div>
          </div>

          <div style="margin-top: 30px; padding: 20px; background: white; border-radius: 8px; font-size: 12px; color: #6b7280; text-align: center;">
            <p style="margin: 0;">
              Need help? Contact us at <a href="mailto:support@streamline.ai" style="color: #dc2626;">support@streamline.ai</a>
            </p>
          </div>
        </body>
        </html>
      `,
    };
  }
}

/**
 * Get user-friendly asset type label
 */
function getAssetTypeLabel(assetType: string): string {
  const labels: Record<string, string> = {
    'ugc-ad': 'UGC Ad',
    'klap-clip': 'Shorts Clip',
    'video': 'Video',
    'image': 'Image',
  };
  return labels[assetType] || 'Asset';
}
