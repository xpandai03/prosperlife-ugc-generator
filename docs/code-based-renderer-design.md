# Code-Based Renderer Design Document

**Status:** Design Only (Not Implemented)
**Date:** January 2026
**Author:** Content Engine Team

## Overview

The Code-Based Renderer is a premium rendering path for the Content Engine that uses Claude AI to generate Remotion (React-based video) code from SceneSpecs, then renders the code into actual video files.

This document outlines the architecture and implementation plan for future development.

## Why Code-Based Rendering?

| Aspect | Automation Renderer | Code-Based Renderer |
|--------|---------------------|---------------------|
| Speed | Fast (seconds) | Slow (minutes) |
| Cost | Low | High (Claude API + compute) |
| Quality | Template-based | Fully custom |
| Best For | Volume content | Premium content |
| Control | Limited | Full programmatic control |

**Use Cases for Code-Based:**
- Product demo videos with custom animations
- Explainer videos with data visualizations
- Sales/authority content with branded elements
- Videos requiring precise timing and transitions

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Content Engine                              │
├─────────────────────────────────────────────────────────────────┤
│  SceneSpec                                                       │
│  ├── title, description, tags                                    │
│  ├── targetDuration                                              │
│  └── scenes[]                                                    │
│      ├── voiceoverText                                           │
│      ├── visualIntent                                            │
│      └── styleHints                                              │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Code-Based Renderer                           │
├─────────────────────────────────────────────────────────────────┤
│  1. Code Generation (Claude API)                                 │
│     ├── SceneSpec → Remotion prompt                              │
│     ├── Claude generates React component                         │
│     └── Code validation (syntax, security)                       │
│                                                                  │
│  2. Render Infrastructure                                        │
│     ├── Upload code to render worker                             │
│     ├── Execute Remotion render                                  │
│     └── Poll for completion                                      │
│                                                                  │
│  3. Output                                                       │
│     ├── Retrieve rendered video                                  │
│     ├── Upload to permanent storage                              │
│     └── Create MediaAsset                                        │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Claude Code Generation

**Goal:** Generate valid Remotion code from SceneSpecs

**Tasks:**
1. Create Remotion-specific system prompt
2. Define code structure template (imports, composition, scenes)
3. Implement code validation (AST parsing, security checks)
4. Add retry logic for malformed outputs

**Example Prompt Structure:**
```
You are a Remotion video developer. Generate a React component for a {duration}s video.

SCENES:
1. [0-10s] {visualIntent1} - "{voiceover1}"
2. [10-20s] {visualIntent2} - "{voiceover2}"
...

OUTPUT FORMAT:
- Single default export component
- Use Remotion's useCurrentFrame(), spring(), Sequence
- Include all scene transitions
- No external dependencies beyond Remotion stdlib

Generate the complete, runnable React component code.
```

### Phase 2: Render Infrastructure

**Option A: AWS Lambda (Recommended)**
- Use Remotion's Lambda rendering
- Pay per render, scales automatically
- ~30-60s render time for short videos

**Option B: Docker Worker**
- Self-hosted render worker
- More control, predictable costs at scale
- Requires infrastructure management

**Key Components:**
1. Code package builder (zip code + assets)
2. Render job queue (Redis/SQS)
3. Status polling endpoint
4. Output storage handler

### Phase 3: Integration

1. Add `code_based` to renderer selection in routes
2. Credit pricing for premium renders
3. Preview capability (first frame only)
4. Error handling and retry UI

## Cost Estimation

| Component | Cost Per Render |
|-----------|-----------------|
| Claude API (code gen) | ~$0.05-0.10 |
| Lambda render (60s video) | ~$0.15-0.30 |
| Storage | ~$0.01 |
| **Total** | **~$0.25-0.50** |

Recommended credit cost: 50-100 credits per render

## Security Considerations

1. **Code Sandbox:** All generated code must run in isolated environment
2. **Import Restrictions:** Only allow Remotion stdlib imports
3. **Resource Limits:** Cap CPU/memory/time for renders
4. **Output Validation:** Verify rendered video before serving

## API Design

### POST /api/content-engine/render/:id (code_based)

Request:
```json
{
  "provider": "code_based",
  "options": {
    "quality": "high",
    "preview": false
  }
}
```

Response:
```json
{
  "success": true,
  "mediaAssetId": "uuid",
  "metadata": {
    "provider": "code_based",
    "codeGenerationTime": 5000,
    "renderTime": 45000,
    "totalTime": 50000
  }
}
```

## Dependencies

- Claude API (Anthropic)
- Remotion framework
- AWS Lambda or Docker runtime
- S3 or equivalent storage

## Timeline (Estimated)

- Phase 1: 2 weeks (code generation + validation)
- Phase 2: 3 weeks (render infrastructure)
- Phase 3: 1 week (integration + testing)
- Total: 6 weeks for MVP

## Open Questions

1. Should we support custom assets (logos, images) in generated code?
2. Preview before full render - how much should it cost?
3. Code caching - save and reuse successful generations?
4. User-editable code - allow power users to modify generated code?

## Conclusion

The Code-Based Renderer extends Content Engine with a premium path for high-quality, programmatic video generation. The architecture is designed to be:

- **Modular:** Uses existing IRenderer interface
- **Scalable:** Lambda-based rendering
- **Safe:** Sandboxed code execution
- **Extensible:** Foundation for advanced features

Implementation should proceed once the Automation Renderer is validated in production and there is demonstrated demand for premium content generation.
