# Design Guidelines: YouTube to Shorts Converter

## Design Approach: Utility-Focused SaaS Application

**Selected Approach:** Design System (Utility-Focused)  
**Primary References:** Linear's clean interface + Vercel's dashboard clarity + Material Design patterns  
**Rationale:** This is a video processing utility where efficiency, clear status communication, and data visibility are paramount. Users need to quickly submit videos, track processing status, and manage results.

---

## Core Design Principles

1. **Status-First Design:** Every screen prioritizes showing processing state clearly
2. **Efficient Workflows:** Minimize clicks from submission to result
3. **Information Clarity:** Dense data presented in scannable, digestible formats
4. **Trustworthy Feedback:** Real-time updates build confidence in the processing

---

## Color Palette

**Dark Mode (Primary):**
- Background: 220 15% 8% (deep slate)
- Surface: 220 15% 12% (elevated slate)
- Border: 220 10% 20% (subtle boundaries)
- Text Primary: 0 0% 95%
- Text Secondary: 220 10% 65%

**Accent Colors:**
- Primary (Action): 262 83% 58% (vibrant purple - for CTAs)
- Success (Processing Complete): 142 76% 36% (green)
- Warning (Processing): 38 92% 50% (amber)
- Error (Failed): 0 72% 51% (red)
- Info (Pending): 217 91% 60% (blue)

**Light Mode:**
- Background: 0 0% 98%
- Surface: 0 0% 100%
- Border: 220 13% 91%
- Invert text values for light mode

---

## Typography

**Font Stack:**  
- Primary: 'Inter' via Google Fonts (400, 500, 600)
- Monospace: 'JetBrains Mono' for IDs, URLs, technical data

**Scale:**
- Hero/Page Title: text-3xl font-semibold (30px)
- Section Headers: text-xl font-semibold (20px)
- Card Titles: text-base font-medium (16px)
- Body Text: text-sm (14px)
- Captions/Meta: text-xs text-secondary (12px)

---

## Layout System

**Spacing Primitives:** Use Tailwind units of 2, 4, 6, 8, 12, 16  
(e.g., p-4, gap-6, space-y-8, mt-12)

**Container Strategy:**
- Max width: max-w-7xl mx-auto
- Page padding: px-6 md:px-8
- Section spacing: space-y-8 to space-y-12
- Card padding: p-6

**Grid Patterns:**
- List view: Single column cards on mobile, full-width on desktop
- Detail page: Main content area (2/3) + sidebar (1/3) on lg+ screens
- Status indicators: Inline with content, not separate blocks

---

## Component Library

### Input Form (URL Submission Page)
- **Layout:** Centered card (max-w-2xl) on clean background
- **Input Field:** Large text input with URL validation styling, h-12, rounded-lg border
- **Submit Button:** Primary accent color, h-12, full rounded-lg, prominent
- **Validation:** Real-time URL format checking with subtle error states
- **Helper Text:** Small text below input showing accepted formats (YouTube, S3, etc.)

### Video Records List
- **Card Design:** Elevated surface with rounded-xl borders
- **Layout:** Stack of cards with gap-4, full-width
- **Card Content Structure:**
  - Left: Video thumbnail placeholder (if available) or video icon
  - Center: Title/URL (truncated), submission timestamp, status badge
  - Right: Virality scores (if available), action menu
- **Status Badges:** Colored pills with icons (pending, processing, complete, error)
- **Empty State:** Centered message with illustration placeholder when no records

### Detail/Status Page (details/:id)
- **Header Section:** 
  - Video title/URL prominently displayed
  - Large status indicator with progress information
  - Timestamp and processing duration
  
- **Progress Visualization:**
  - Horizontal progress bar for task completion (0-100%)
  - Step indicators showing: Submitted → Processing → Shorts Generated → Exporting
  - Color-coded by status (blue → amber → green)

- **Generated Shorts Section:**
  - Grid of generated short cards (grid-cols-1 md:grid-cols-2 gap-4)
  - Each card shows: thumbnail, virality score, duration, export button
  - Virality score displayed as prominent metric with color gradient (low to high)

- **Export Status Section:**
  - List of export jobs with individual status indicators
  - Download links appear when export completes
  - Auto-polling indicator (subtle pulsing dot when active)

### Status Indicators
- **Processing:** Animated spinner + amber color + "Processing" text
- **Complete:** Check icon + green color + completion timestamp
- **Error:** X icon + red color + error message
- **Pending:** Clock icon + blue color + "Queued" text

### Navigation
- **Top Bar:** Logo/title on left, user indicator (Admin) on right
- **Height:** h-16 with border-b
- **Background:** Surface color with backdrop blur
- **Back Navigation:** Arrow icon + "Back to List" on detail pages

---

## Images

No hero images needed for this utility application. Focus on:
- **Video Thumbnails:** Use placeholders (16:9 aspect ratio) for video previews in list and detail views
- **Empty State Illustrations:** Simple icon-based graphics when no videos exist
- **Status Icons:** Use Heroicons for all status indicators and actions

---

## Interaction Patterns

### Auto-Polling Mechanism
- Visual indicator when polling is active (subtle dot animation in corner)
- Poll interval: 15-30 seconds depending on status
- Success feedback when status changes detected
- Stop polling when final state reached

### Form Interactions
- Input focus: Border color changes to primary accent
- Validation: Immediate feedback with color-coded borders
- Submit: Button shows loading state during API call
- Success: Redirect to detail page with success toast

### List Interactions
- Hover state: Subtle background color change on cards
- Click: Navigate to detail page
- Menu actions: Dropdown for secondary actions (delete, retry)

---

## Animation Guidelines

**Minimal Animations Only:**
- Status change transitions: 200ms ease
- Progress bar fill: Smooth linear animation
- Polling indicator: Subtle pulse (1.5s infinite)
- Page transitions: None (instant navigation)
- Loading states: Simple spinner, no elaborate animations

---

## Accessibility & Responsive Design

- All status indicators have text labels, not just colors
- Focus states clearly visible with outline-2 outline-offset-2
- Mobile: Stack all multi-column layouts to single column
- Touch targets: Minimum 44px height for all interactive elements
- Dark mode consistency: All components work in both modes
- Form labels: Always visible, never placeholder-only

---

## Key Implementation Notes

- Use Heroicons for all iconography via CDN
- Prioritize clear, scannable information over visual flourish
- Every status has both visual (color/icon) and text indicators
- Real-time updates are subtle but noticeable
- Data density is high but organized with clear hierarchy
- No unnecessary decorative elements - every component serves the workflow