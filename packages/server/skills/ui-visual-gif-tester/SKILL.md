---
name: ui-visual-gif-tester
description: Use whenever creating, editing, or testing UI, front-end components, mockups, or visual styling. Captures high-efficiency animated GIFs using the integrated project-gif engine and inspects them with read() for multimodal visual verification by the provider.
---

# UI Visual GIF Tester & Multimodal Verification

Natively integrates the **project-gif** high-speed capture and quantization engine into ThinkRail. It eliminates "blind coding" for UI, CSS, and frontend changes by capturing dynamic visual states into compact GIFs and submitting them directly to the AI provider via `read()`.

## Core Principles

1. **Never Finalize UI in the Dark**: Code reviews and unit tests do not prove visual fidelity. Every UI feature, mockup, bugfix, or redesign MUST be visually recorded and inspected.
2. **Multimodal Feedback Loop**: The `read` tool natively supports image attachments (`.gif`, `.png`, `.jpg`). Reading a generated GIF transmits its animated frames directly to the model provider, enabling the model to inspect live rendering, alignment, transitions, and hover states.
3. **Compact & Fast**: Uses adaptive 128-color global quantization with `Dither.NONE` and LZW compression to generate tiny, crystal-clear GIFs (< 100 KB - 500 KB) in under 2 seconds.

## Mandatory Workflow for UI & Front-End Tasks

Whenever a plan or task touches UI, follow this sequence:

### Step 1: Render or Prepare the Visual Target
- For isolated components or new screens, write a standalone HTML mockup under `.thinkrail/context/mockups/<name>.html` with complete styles and mock interactions.
- For app UI or running servers, ensure the target window or viewport is positioned or open.

### Step 2: Record the Animated GIF
Execute the integrated recorder via Bun:

```bash
bun scripts/record-ui-gif.ts --duration 2.5 --fps 15 --center 800,600 --output .thinkrail/context/visual-reviews/<name>.gif
```

Options:
- `--duration <seconds>`: Duration of the recording (default: 2.5s).
- `--fps <fps>`: Frames per second (default: 15 for optimal balance of smoothness and payload size).
- `--center <width,height>`: Captures a centered box on the primary screen.
- `--area <left,top,width,height>`: Explicit bounding coordinates.
- `--mockup <path/to/mockup.html>`: Automatically opens the HTML mockup in the default browser before recording.
- `--output <path>`: Destination path (defaults to `.thinkrail/context/visual-reviews/ui_review_<timestamp>.gif`).

### Step 3: Send to Provider via `read`
Immediately invoke the `read` tool on the resulting `.gif` file:

```json
{
  "path": ".thinkrail/context/visual-reviews/<name>.gif",
  "offset": 0,
  "limit": 100
}
```

**What happens**: The Pi harness attaches the GIF frames to the conversation context, sending real pixel data to the multimodal provider (Opus 4.8, GPT, etc.).

### Step 4: Visual Audit & Critique
The provider reviews the returned visual attachment for:
- **Layout & Hierarchy**: Alignment, padding, margins, visual balance.
- **Color & Contrast**: Adherence to dark/light theme, readable text contrast, correct token colors.
- **Typography**: Truncation, font sizes, line heights, wrapped labels.
- **Motion & Transitions**: Smoothness, lack of flicker, correct hover/active states.

### Step 5: Iteration or Verification
- If defects are spotted: adjust CSS/HTML/TSX, record a new GIF, and repeat.
- If approved: include the visual verification summary in the task completion.
