# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Story Co-Writer — Project Context

## Current State
No source code exists yet. The app is a single React artifact to be created
(e.g. `StoryCowriter.jsx`). There is no build system, package.json, or test
suite — it runs as a Claude artifact, not a standalone project.

## API Auth
This runs as a Claude artifact — API calls use the artifact runtime's
built-in `window.claude.complete` / fetch proxy, NOT a user-supplied
ANTHROPIC_API_KEY. Never embed a key in the artifact.

## What We're Building
A back-and-forth collaborative storytelling web app for elementary school kids (ages 5–11).
The kid writes a sentence or two, Claude continues the story, and they alternate turns until
the story feels complete. It should feel like writing with a creative friend, not using a tool.

## Tech Stack (Option C — Artifact Prototype)
- Single React artifact (.jsx)
- Claude API calls via fetch to https://api.anthropic.com/v1/messages
- Model: `claude-sonnet-4-6` (current Sonnet as of 2026; update to latest Sonnet at build time)
- State: in-memory only (no backend, no persistence)
- Styling: Tailwind utility classes only (no custom CSS files)

## Core Interaction Loop
1. Kid selects a genre and optionally names their main character
2. Claude writes the story's opening paragraph (the "hook")
3. Kid types their contribution and hits "Add to Story"
4. Claude continues with 3–5 sentences, then passes it back
5. Repeat until kid clicks "Finish Story"
6. Final screen shows the full story in a clean readable layout

## Claude API System Prompt (use this exactly)
The system prompt passed to the API on every turn should be:

"""
You are a warm, enthusiastic creative writing partner for elementary school kids ages 5–11.
Your job is to collaboratively write a story one turn at a time.

Rules:
- Write ONLY 3–5 sentences per turn — keep it the kid's story, not yours
- Match the vocabulary and complexity to the selected grade level
- Never introduce scary, violent, or inappropriate content
- Always end your turn at an exciting moment so the kid wants to keep going
- If the kid writes something silly or unexpected, embrace it with enthusiasm
- Stay consistent with character names, places, and plot details established so far
- Be warm and encouraging in tone — this should feel like play
- Do NOT add any commentary outside the story text itself — just continue the narrative
"""

## State Shape
```js
{
  genre: "adventure" | "fairy tale" | "funny" | "spooky-lite" | "sci-fi",
  gradeLevel: "K-1" | "2-3" | "4-5",
  characterName: string,
  turns: [
    { author: "claude" | "kid", text: string }
  ],
  phase: "setup" | "writing" | "finished",
  isLoading: boolean
}
```

## UI Screens

### Screen 1 — Setup
- Fun title: "Let's Write a Story Together! ✨"
- Big colorful genre buttons with emoji (🗡️ Adventure, 🧚 Fairy Tale, 😂 Funny, 👻 Spooky, 🚀 Sci-Fi)
- Grade level selector (K-1, 2-3, 4-5)
- Optional: "What's your hero's name?" text input
- "Start the Story!" CTA button

### Screen 2 — Writing
- Story so far displayed as alternating colored blocks
  - Claude's turns: soft blue/purple background
  - Kid's turns: soft yellow/green background
- Each block labeled "You wrote:" or "Your story partner wrote:"
- Text input area at bottom: "What happens next?"
- "Add to Story ✏️" button (disabled while Claude is loading)
- "Hint 💡" button — triggers Claude to suggest 2–3 directions (shown as tappable chips)
- "Finish My Story 🎉" button

### Screen 3 — Finished
- Celebration animation or emoji burst
- Full story rendered in clean storybook-style layout
- "Read it again" and "Start a New Story" buttons
- (Optional) Print button

## API Call Pattern
Every time Claude takes a turn, build the messages array from the full turn history:

```js
messages = [
  // All previous turns as alternating user/assistant messages
  { role: "user", content: "kid turn 1 text" },
  { role: "assistant", content: "claude turn 1 text" },
  { role: "user", content: "kid turn 2 text" },
  // ...
  // Current kid input as the final user message
  { role: "user", content: currentKidInput }
]
```

For the very first Claude turn (the opening hook), send:
```js
messages = [
  {
    role: "user",
    content: `Please start a ${genre} story for a ${gradeLevel} grade reader.
              The main character's name is ${characterName || "a brave hero"}.
              Write just the opening hook — 3 to 5 sentences — and end at
              an exciting moment so I want to keep going.`
  }
]
```

## Hint Feature
When kid clicks "Hint 💡", call the API with:
```js
messages = [
  ...fullTurnHistory,
  {
    role: "user",
    content: `I'm not sure what to write next. Give me exactly 3 short ideas
              (one sentence each) for what could happen next in the story.
              Format them as a simple numbered list. Keep them exciting!`
  }
]
```
Display the 3 hints as clickable chips. Clicking one pre-fills the text input.

## Key UX Details
- Font should be large and readable (text-lg or text-xl minimum)
- Big tap targets for buttons (important for kids)
- Encouraging microcopy: "Great addition!", "Ooh, what a twist!", etc. shown briefly after kid submits
- Loading state: animated ellipsis or "Your story partner is thinking... 🤔"
- Never show raw errors to kids — if API fails, show "Oops! Let's try that again 😊"

## What NOT to Build (MVP Scope)
- No user accounts or login
- No story persistence (in-memory only)
- No image generation
- No audio/read-aloud
- No parent dashboard
- No backend

## Stretch Goals (after MVP works)
- localStorage save/restore
- Illustration prompt shown after each Claude turn ("Draw a picture of this scene!")
- Word count / page count estimator
- Export to PDF
