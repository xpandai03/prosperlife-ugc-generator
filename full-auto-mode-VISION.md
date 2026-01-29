# Streamline – Full Autopilot Mode
## Product Vision & User Flow Specification

### High-Level Goal
Streamline Full Autopilot is a **hands-free content engine** for e-commerce and SaaS businesses.

A user onboards **once**, approves a content style, sets a posting cadence, and Streamline continuously:
- Generates long-form and short-form product or SaaS demo videos
- Cycles through their content library
- Auto-publishes to connected social platforms
- Charges usage-based per generated video

The core value proposition:
> “Set it once. Get consistent, published video content forever.”

---

## Target Users
- E-commerce store owners (multiple products, constant content needs)
- SaaS founders (feature demos, explainer-style videos)
- Small-to-mid brands that want content without hiring a content team

---

## Core User Journey (Step-by-Step)

### 1. Initial Onboarding
**Minimal friction required**

User provides:
- Website URL (e-commerce store or SaaS website)

Optional (later step):
- Upload missing assets (images/videos not found during scrape)

System action:
- Crawl and scrape the website
- Extract:
  - Product names
  - Product descriptions
  - Product images
  - Pricing (if available)
  - Key site copy (for SaaS: features, headlines, benefits)

Results are shown inside the UI as a **generated content library**.

User can:
- Review extracted products/content
- Edit titles/descriptions
- Upload additional assets if needed

---

### 2. Content Source Confirmation
User confirms:
- Which products or pages should be included
- Which assets are approved for video generation

This becomes the **Content Pool** that the system cycles through.

---

### 3. Video Style Selection
User selects:
- Video type:
  - UGC-style product demo
  - SaaS explainer / screen-based demo
- Tone:
  - Casual
  - Professional
  - High-energy
  - Educational
- Format preferences:
  - Short-form (30–60s)
  - Long-form (1–4 minutes)
- Optional avatar / voice style (if applicable)

This defines a **Video Style Profile**.

---

### 4. Demo Video Preview & Approval Loop
System generates:
- 1–2 demo videos using the selected style and real scraped content

User can:
- Approve the output
- Adjust style settings and regenerate preview
- Repeat until approved

No publishing happens before approval.

Once approved:
- The Video Style Profile is locked for automation
- Can be edited later if needed

---

### 5. Social Account Connection
User connects social platforms via API (late.dev or equivalent):
- YouTube
- Instagram
- TikTok
- (Optional future: X, LinkedIn)

Permissions:
- Post videos
- Upload captions
- Schedule publishing

System stores tokens securely.

---

### 6. Publishing Schedule Setup
User defines:
- Posting cadence:
  - X videos per week or month
- Platforms per video
- Approval mode:
  - Fully automatic
  - Manual approval before posting

System creates a **Content Schedule** tied to cron jobs.

---

### 7. Billing Setup (Usage-Based)
User adds payment method.

Billing model:
- Charge per generated video
- Usage-based billing tied to:
  - Video length
  - Generation pipeline costs
- Charges triggered when video generation starts

(For MVP/demo: billing can be mocked or simulated.)

---

### 8. Autopilot Execution
Once active:
- System runs continuously on schedule
- Selects next item from Content Pool
- Generates script (Claude)
- Renders video (Remotion + assets)
- Generates captions
- Publishes or queues for approval
- Logs usage and analytics

User dashboard shows:
- Videos generated
- Videos published
- Upcoming scheduled content
- Usage and spend

---

## Core Automation Flywheel
1. Content Pool (products/pages)
2. Video Style Profile
3. Scheduled Trigger
4. Script Generation
5. Video Rendering
6. Optional Approval
7. Auto-Publish
8. Usage Tracking
9. Repeat

---

## Technical Architecture (High-Level)

### Frontend
- Onboarding wizard (step-based)
- Content library UI
- Video preview player
- Schedule & automation controls
- Connected accounts manager

### Backend Services
- Website scraping service
- Asset storage (images/videos)
- Claude-based script generation
- Remotion-based video rendering
- Caption generation
- Publishing service (via late.dev)
- Usage metering & billing hooks

### Automation
- Cron-based job scheduler
- Queue-based video generation
- Retry and failure handling
- Safe fallbacks for missing assets

---

## MVP Scope (What to Build First)
1. URL onboarding + scraping
2. Content library display
3. One selectable video style
4. One demo preview video
5. One social platform connection
6. Basic scheduled publishing
7. Simple usage tracking

Everything else is iterative.

---

## Key Design Principles
- Onboard once
- Preview before automation
- Minimal configuration
- Fully hands-free after setup
- Usage-based, not seat-based

---

## Non-Goals (For Now)
- Complex manual video editing
- Infinite customization
- Marketplace features
- Multi-user teams

---

## Success Criteria
- User can go from URL → published video without manual effort
- One-time setup produces ongoing content
- Clear, visible value within first 24 hours

---

End of specification.