**Streamline AI --- Posting Feature Implementation Plan**
=======================================================

**Author:** Raunek Pratap

**Goal:** Extend the current Streamline AI app to allow posting generated short-form videos (clips) directly to connected social media accounts using **Late.dev API** --- *without breaking the existing YouTube → clipping pipeline.*

* * * * *

**🧭 1. Context**
-----------------

### **Current System (working and stable)**

-   **Inputs:** YouTube video URL, user email, clip count, clip duration (15--60 sec)

-   **Pipeline:**

    -   Downloads & processes YouTube video

    -   Generates multiple clips

    -   Sends email once clips are ready

    -   Displays "Auto-Convert & Export" progress page (localhost:8080/details/...)

-   **Outputs:** Download links + viewing page for clips

✅ **No user authentication or sessions** --- everything is open.

✅ **Pipeline works and must not be changed.**

* * * * *

**🎯 2. Objective**
-------------------

Add **posting capabilities** for generated clips via **Late.dev API**, starting with **Instagram**.

### **V1 Goals**

-   "Post to Social" button appears on the *results page* after clips are ready.

-   User clicks → opens modal → selects platform (Instagram for now) → adds caption → submits.

-   Backend calls Late API to post using our connected IG account.

-   Displays "Posted successfully!" with the live Reel URL.

### **Later Goals (V2)**

-   Multi-user (each user connects their own IG/TikTok/YouTube)

-   OAuth onboarding via Late profiles

-   Scheduling posts

-   Platform analytics (views, likes, etc.)

* * * * *

**🧩 3. High-Level Architecture**
---------------------------------

```
Frontend (React / Next.js)
│
├── Results Page (add Post button per clip)
│   ├── PostClipButton.tsx
│   └── PostClipModal.tsx
│
└── Calls → /api/social/post
     ↓
Backend (Express / Next.js API Routes)
│
├── /api/social/post      <-- NEW
│   - Validates clip URL
│   - Posts to Late API
│   - Returns post URL
│
└── /late/lateClient.ts   <-- NEW
    - Wraps Late API calls (headers, endpoints)
```

* * * * *

**⚙️ 4. Environment Configuration**
-----------------------------------

Add to .env:

```
# Late API Key
LATE_API_KEY=sk_4db1d4d490bb7515200e27057ce812940413dada899c06215ed761bd5bbc3bd3

# Local environment
NODE_ENV=development
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

✅ Keep LATE_API_KEY **server-only** (never exposed client-side).

✅ Use Replit or Vercel Secrets to manage it securely.

* * * * *

**🔧 5. Backend Implementation**
--------------------------------

### **File: **

### **/server/late/lateClient.ts**

Lightweight wrapper for Late API requests.

```
const LATE_BASE_URL = "https://getlate.dev/api/v1";

export async function postInstagramReel({ videoUrl, caption }) {
  const res = await fetch(`${LATE_BASE_URL}/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.LATE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: caption,
      platforms: [
        {
          platform: "instagram",
          accountId: "6900d2cd8bbca9c10cbfff74", // existing connected IG account
          platformSpecificData: { contentType: "reel" },
        },
      ],
      mediaItems: [{ type: "video", url: videoUrl }],
      publishNow: true,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Late API Error: ${res.status} ${JSON.stringify(data)}`);
  return data;
}
```

* * * * *

### **File: **

### **/server/routes/socialPost.ts**

```
export async function POST(req) {
  const { clipUrl, caption } = await req.json();

  if (!clipUrl?.startsWith("https://"))
    return new Response(JSON.stringify({ status: "error", message: "Invalid clip URL" }), { status: 400 });

  try {
    const post = await postInstagramReel({ videoUrl: clipUrl, caption: caption || "" });
    const url = post?.post?.platforms?.[0]?.platformPostUrl;
    return new Response(JSON.stringify({ status: "ok", postUrl: url }), { status: 200 });
  } catch (err) {
    console.error("Post error:", err);
    return new Response(JSON.stringify({ status: "error", message: err.message }), { status: 500 });
  }
}
```

* * * * *

**🎨 6. Frontend Implementation**
---------------------------------

### **UI Changes (on "Video Ready" page)**

Each clip card should include:

-   "Download" (existing)

-   "Post to Instagram" button (new)

**PostClipButton.tsx**

```
<Button onClick={() => setShowModal(true)}>Post to Instagram</Button>
<PostClipModal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  clipUrl={clip.url}
/>
```

**PostClipModal.tsx**

```
export function PostClipModal({ isOpen, onClose, clipUrl }) {
  const [caption, setCaption] = useState("");
  const [status, setStatus] = useState("idle");
  const [postUrl, setPostUrl] = useState("");

  async function handlePost() {
    setStatus("posting");
    const res = await fetch("/api/social/post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clipUrl, caption }),
    });
    const data = await res.json();
    if (data.status === "ok") {
      setPostUrl(data.postUrl);
      setStatus("success");
    } else {
      setStatus("error");
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogHeader>Post Clip</DialogHeader>
      <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Add a caption..." />
      {status === "success" ? (
        <a href={postUrl} target="_blank" rel="noopener" className="text-blue-500">
          View on Instagram
        </a>
      ) : (
        <Button onClick={handlePost} disabled={status === "posting"}>
          {status === "posting" ? "Posting..." : "Post"}
        </Button>
      )}
    </Dialog>
  );
}
```

* * * * *

**🧠 7. Data Flow Summary**
---------------------------

```
User → Clicks "Post to Instagram"
→ Frontend: POST /api/social/post
→ Backend: Calls Late API /v1/posts
→ Late: Uploads to Instagram
→ Returns { platformPostUrl }
→ Frontend: shows "View on Instagram"
```

No change to existing clip generation or download flow.

* * * * *

**🧱 8. Testing Plan**
----------------------

|

**Test**

 |

**Expected Result**

 |
| --- | --- |
|

Generate a clip normally

 |

✅ Email & download links work as before

 |
|

Click "Post to Instagram"

 |

✅ Posts to IG, returns public Reel URL

 |
|

Invalid clip URL

 |

❌ Returns 400 "Invalid clip URL"

 |
|

No LATE_API_KEY

 |

❌ Server logs "Unauthorized", request fails

 |
|

Late API downtime

 |

❌ Graceful error message "Could not post clip"

 |
|

Local .env missing key

 |

❌ Startup error

 |

* * * * *

**🔒 9. Security & Reliability**
--------------------------------

-   Do **not** expose LATE_API_KEY to frontend.

-   Validate clip URLs to prevent misuse.

-   Log only safe data (postId, postUrl).

-   Gracefully handle errors.

-   Maintain full backward compatibility with current pipeline.

* * * * *

**🚧 10. Future Extensions**
----------------------------

Once the "Post Clip" flow works stably:

1.  **Add Late Profile Creation**

    POST /v1/profiles for each user.

2.  **Add Connect Links (OAuth)**

    GET /v1/connect/instagram?profileId=...

3.  **Store account IDs per user.**

4.  **Add scheduling via** **/v1/posts** with scheduledFor and timezone.

5.  **Multi-platform support:** TikTok, YouTube, LinkedIn, etc.

* * * * *

**✅ 11. Definition of Done**
----------------------------

-   Users can post generated clips directly from Streamline AI.

-   Posts succeed via Late API and return the IG Reel URL.

-   The current YouTube-to-clip flow remains unaffected.

-   Code is modular, logged, and easily extensible.

* * * * *

**Supporting Files:**

-   late-api-docs.md → Full Late.dev API reference

-   .env.example → Example environment configuration

-   docs/implementation-plan.md → (this file)
