Here's your ready-to-paste Markdown file for Claude.

It's written as an internal build specification --- clear, complete, and formatted for Claude to understand context, problems, and implementation scope.

* * * * *

```
# 📘 Phase 4.7 --- UGC Ad Studio Redesign & Video Generation Fix
**Date:** Nov 2025
**Owner:** Streamline AI Dev Team

---

## 🎯 Objective
Simplify the user experience for **UGC Ad creation** while fixing the **stuck Veo3 video generation** issue.
Goal: Let users upload a product photo and automatically generate **UGC-style images and videos** using pre-set AI prompt templates.

---

## 🧱 Current System Summary

- **Image generation (`kie-4o-image`)** → ✅ Works perfectly (visible in gallery)
- **Video generation (`kie-veo3`)** → ⚠️ Stuck in `processing` (no result URLs saved)
- **Polling loop** → Works for images, not for Veo3 (never detects `SUCCESS`)
- **Frontend (AI Studio page)** → UI too complex; needs redesign for simple "Create Ad" flow

---

## ⚠️ Problem Breakdown

### 1. Video Generation (Backend Issue)
- Endpoint: `/api/ai/media/use-for-video`
- Behavior: Starts KIE Veo3 task but `processMediaGeneration()` never resolves.
- Logs show:
  ```json
  status: "PROCESSING"
  [KIE FIX ✅] Extracted resultUrls: []
```

-   Veo3 responses don't follow the same structure as image jobs:

    -   Images: response.resultUrls[0]

    -   Videos: data.resultJson.resultUrls[0] or data.resources[0].url

### **2\. User Flow / Frontend UX**

-   Current form exposes unnecessary details (model names, captions, etc.).

-   Need to streamline the creation flow --- "one brief, one click."

* * * * *

**🧾 Desired User Inputs (Simplified UGC Brief)**
-------------------------------------------------

|

**Field**

 |

**Type**

 |

**Example**

 |

**Notes**

 |
| --- | --- | --- | --- |
|

**Product Image**

 |

Upload / URL

 |

https://.../creatine.jpg

 |

Required

 |
|

**Product Name**

 |

Text

 |

"Creatine Gummies"

 |

Required

 |
|

**Features**

 |

Textarea

 |

"Tasty, easy daily use, boosts energy"

 |

Required

 |
|

**Customer Persona (ICP)**

 |

Dropdown

 |

"Gym-goer", "Beauty enthusiast"

 |

Optional

 |
|

**Scene / Setting**

 |

Dropdown

 |

"Car", "Kitchen", "Gym", "Outdoors"

 |

Optional

 |
|

*(Hidden)* Mode

 |

Enum

 |

Default → "NanoBanana + Veo3"

 |

Optional override

 |

Everything else --- prompt generation, chaining, and posting --- is automatic.

* * * * *

**🧠 Prompt Orchestration Logic**
---------------------------------

-   Prompt source: /client/prompts/veo-3-prompts.md

-   Use placeholders:

```
{product}, {feature}, {icp}, {scene}
```

-   Select prompt template based on **mode**:

    -   **Mode A (default)** → NanoBanana → Veo3

    -   **Mode B** → Veo3 only (direct from product image)

    -   **Mode C** → Sora2 (budget / fallback)

* * * * *

**🛠️ Backend Work Required**
-----------------------------

### **1\. Fix Veo3 Polling**

-   Update processMediaGeneration() logic:

    -   Detect status === "SUCCESS" or state === "success".

    -   Check these possible URL paths:

        -   data.resultJson.resultUrls[0]

        -   data.resources[0].url

        -   response.resultUrls[0]

    -   Save the first valid result URL to DB.

-   Add 30-minute timeout → mark asset failed.

-   Add [KIE Veo3 ✅] and [KIE Veo3 ❌] logs for debugging.

### **2\. Add Retry Endpoint**

-   Endpoint: POST /api/ai/media/retry/:id

    -   Requeues failed job using the same parameters.

    -   Returns { success: true, newTaskId }.

    -   Visible in gallery (Retry button).

### **3\. Enhance Error Handling**

-   Update DB schema: Add error_message field to media_assets.

-   Record failed KIE job responses.

* * * * *

**🎨 Frontend Redesign Plan**
-----------------------------

### **Page: **

### **/ai-studio**

**Section 1 --- Create Ad (Brief Form)**

-   Simplified input panel with:

    -   Image upload field

    -   Product name

    -   Features textarea

    -   Persona dropdown

    -   Scene dropdown

-   Hidden "Mode" selector (defaults to NanoBanana + Veo3)

-   Button: ✨ Create UGC Ad

-   On submit:

    -   Sends data to /api/ai/generate-media

    -   Auto-fills prompt using veo-3-prompts.md

    -   Triggers chained image → video workflow

**Section 2 --- Your UGC Ads (Gallery)**

-   Each card shows:

    -   Thumbnail (image or video preview)

    -   Status badge → Processing, Ready, Failed

    -   Buttons:

        -   ▶️ Preview

        -   🔁 Retry (if failed)

        -   📥 Download

        -   📤 Post to Instagram (Late.dev)

-   Modal preview (UGCAdPreviewModal):

    -   Embed mediaUrl (img/video)

    -   Shows generation metadata (model, status, date)

* * * * *

**🧪 Testing Plan**
-------------------

### **Backend Tests**

-   ✅ Start a Veo3 generation job and confirm:

    -   Status changes to ready

    -   result_url saved in DB

-   ❌ Simulate timeout → ensure job marked as failed

-   ✅ Retry endpoint → new task created

-   ✅ Polling stops after URL found or 30 min timeout

### **Frontend Tests**

-   ✅ "Create Ad" brief submits successfully

-   ✅ Image and video previews appear in gallery

-   ✅ Retry button re-triggers generation

-   ✅ Post button triggers Late.dev call

-   ✅ Mobile layout tested for /ai-studio

* * * * *

**🧩 Deliverables for Claude**
------------------------------

Claude must:

1.  Refactor /api/ai/media/use-for-video logic (Veo3 fix)

2.  Patch processMediaGeneration() for Veo3 success/timeout logic

3.  Add /api/ai/media/retry/:id

4.  Redesign /ai-studio with simplified inputs and mode pre-selection

5.  Integrate dynamic prompt injection using /client/prompts/veo-3-prompts.md

6.  Update gallery to show Retry + Post buttons

7.  Ensure videos display in modal previews

8.  Write small helper: generatePrompt(mode, inputs) → returns final text

* * * * *

**✅ Success Criteria**
----------------------

-   🟢 New images and videos appear correctly in the gallery

-   🟢 No infinite polling for Veo3 video generation

-   🟢 Retry endpoint working

-   🟢 User can generate ad with 5 inputs only

-   🟢 UI feels like: *Upload → Generate → View → Post*

* * * * *

**📋 Expected Output from Claude**
----------------------------------

Claude should produce:

1.  A **phased implementation plan**

2.  File-by-file code changes

3.  Updated endpoint specifications

4.  Example prompts with injected variables

5.  Step-by-step testing checklist

* * * * *

```
---

Once you feed this file to Claude, pair it with this short system prompt:

> "Read `Phase4.7-UGC-AdStudio-Redesign.md`. Understand all required changes. Then produce a structured phased implementation plan that addresses both the frontend UX redesign and the KIE Veo3 video generation fix, using the latest working app code."

Would you like me to also draft that Claude system prompt for you (so you can paste both together cleanly)?
```