```
# 🎨 PHASE 4 --- AI IMAGE & VIDEO CONTENT GENERATOR
### Document: `PHASE4_AI_MEDIA_IMPLEMENTATION.md` (for planning)
**Owner:** Raunek Pratap
**Date:** Nov 7 2025
**Status:** Ready for Claude Planning

---

## 🧠 PURPOSE
Build a **native AI media-generation system** inside **Streamline AI** so users can create and post original, UGC-style videos or images (ads, social posts, product demos, etc.) using **OpenAI Sora** and **Gemini 2.5 Flash**.

This replaces the external n8n/KIE workflows with a first-party implementation that plugs directly into our Render-based backend and existing caption + scheduler systems.

---

## ⚙️ CURRENT ARCHITECTURE CONTEXT
- **Backend:** Render (Node/Express + TypeScript + Drizzle ORM)
- **Frontend:** React 18 + TypeScript (TanStack Query / Wouter / Radix UI)
- **DB:** PostgreSQL (NeonDB)
- **Integrations:** Klap API (video clipping), Late.dev (posting + scheduling), OpenAI (GPT-4o for captions)
- **Deployed:** Auto-deploy → Render (main branch)

---

## 🎯 GOAL
Let users:
1. Enter a **prompt + optional product image**.
2. Choose between **OpenAI (Sora)** or **Gemini (Flash)** for generation.
3. Receive a generated image or video.
4. Optionally → **Generate AI caption (Phase 2)** and **Schedule/Post (Phase 3)** via Late.dev.

Everything happens seamlessly inside the app --- no n8n, no third-party UIs.

---

## 🧩 PROVIDER STRATEGY
| Function | Provider | Key Endpoint |
|-----------|-----------|--------------|
| AI Video Generation | **OpenAI Sora API** | `/v1/videos` (future Sora endpoint / GPT-4o video) |
| AI Image Generation | **Gemini 2.5 Flash API** | `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent` |

Both providers are called directly via our backend --- no KIE middleware.

---

## 🧱 ARCHITECTURE OVERVIEW

### 1️⃣ Backend Services
Create a unified service file:

```ts
// server/services/mediaGen.ts
export async function generateMedia({ provider, type, prompt, imageUrl }) {
  if (provider === 'openai') {
    // Call Sora / GPT-4o video or image endpoint
  } else if (provider === 'gemini') {
    // Call Gemini 2.5 Flash for image or short video content
  }
  // Poll until result ready → return {url, provider, type, metadata}
}
```

Responsibilities:

-   Builds payloads for each provider.

-   Handles polling / timeouts / error logging.

-   Returns standardized response object.

* * * * *

### **2️⃣ Database Layer**

Add new table media_assets in shared/schema.ts:

```
export const mediaAssets = pgTable("media_assets", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  provider: text("provider"), // 'openai' | 'gemini'
  type: text("type"), // 'image' | 'video'
  prompt: text("prompt"),
  resultUrl: text("result_url"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});
```

Every generation request writes a row → status tracking, retries, and audit.

* * * * *

### **3️⃣ API Endpoints**

|

**Route**

 |

**Method**

 |

**Description**

 |
| --- | --- | --- |
|

/api/ai/generate-media

 |

POST

 |

Accept prompt + provider + (optional) image URL → returns generated asset URL + metadata.

 |
|

/api/ai/media/:id

 |

GET

 |

Retrieve specific generation status or metadata.

 |
|

/api/ai/media

 |

GET

 |

List all user-generated assets for AI Studio dashboard.

 |

Validation via Zod (generateMediaSchema).

* * * * *

### **4️⃣ Frontend --- **

### **AI Studio Page**

New route: /ai-studio

Core UI Elements:

-   Textarea: "Describe your product / scene."

-   Image Uploader (optional reference photo).

-   Dropdown: Model selector (OpenAI Sora / Gemini Flash).

-   Button: **Generate Media** → shows loading state and preview when ready.

-   Post-generation buttons: **"Generate Caption"** → auto-caption (Phase 2), **"Schedule Post"** → Late.dev scheduler (Phase 3).

Result card shows:

-   Thumbnail / video preview

-   Provider used

-   Date created

-   Quick actions (Post, Download, Delete)

* * * * *

### **5️⃣ Error & Timeout Handling**

|

**Case**

 |

**Handling**

 |
| --- | --- |
|

API timeout

 |

Retry up to 3× → mark as failed in DB

 |
|

Invalid input

 |

Return 400 validation error

 |
|

Provider error

 |

Catch and log [MediaGen] Error:  message

 |
|

Upload issues

 |

Validate image URL / file size before sending

 |
|

Render payload limit

 |

Store only URLs, never base64 blobs

 |

* * * * *

**🔒 ENV VARIABLES**
--------------------

```
# OpenAI (Sora)
OPENAI_API_KEY=sk-xxxxx
OPENAI_MODEL=sora-1

# Gemini 2.5 Flash
GEMINI_API_KEY=ya29.xxxxx
GEMINI_MODEL=gemini-2.5-flash
```

* * * * *

**🧪 TESTING CHECKLIST**
------------------------

1.  Generate AI image (Gemini).

    -   Prompt: "Stylized product photo of creatine gummies in gym bag."

    -   Expected: image URL returned < 30 s.

2.  Generate AI video (OpenAI Sora).

    -   Prompt: "8-sec selfie-style video reviewing creatine gummies."

    -   Expected: video URL + metadata (duration, model).

3.  Caption reuse: Click **Generate Caption** → verify caption appears.

4.  Schedule post: Click **Schedule Post** → verify Late.dev creates scheduled record.

5.  Error test: Disconnect API key → verify graceful fallback and toast.

* * * * *

**🪜 PHASE STRUCTURE (for Claude planning)**
--------------------------------------------

Claude should produce a phased plan with these segments:

|

**Phase**

 |

**Description**

 |
| --- | --- |
|

**4.1 Backend Service Layer**

 |

Build mediaGen.ts with dual-provider logic + polling.

 |
|

**4.2 Database Migration**

 |

Add media_assets table + migration script.

 |
|

**4.3 API Endpoints**

 |

Implement POST / GET routes with validation and auth.

 |
|

**4.4 Frontend AI Studio Page**

 |

New UI for prompt → preview → post/schedule.

 |
|

**4.5 Integration + Testing**

 |

Connect to caption assistant + scheduler flows and validate E2E.

 |

Each phase should include:

-   Files to create/modify

-   Code outline examples

-   Testing procedures

-   Success criteria

* * * * *

**✅ EXPECTED OUTCOME**
----------------------

-   Streamline AI users can generate and post AI-made images & videos directly in-app.

-   Unified generation service for OpenAI and Gemini.

-   Seamless handoff to caption and scheduling features.

-   Minimal infrastructure change (works under Render deployment).

-   Fully documented and future-proof for new models (e.g., Sora 3).

* * * * *

**Next Action:**

Claude → Read this file and produce a comprehensive phased implementation plan (PHASE4_AI_MEDIA_BUILD_PLAN.md) detailing exact backend, frontend, and testing steps for this vision.
