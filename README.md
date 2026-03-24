# Claude Sidekick

A Chrome extension that brings the [Dia browser](https://dia.so) AI assistant experience to Chrome — powered by your existing **claude.ai account**. No API key, no extra subscriptions.

> Built for early testers. Uses claude.ai's internal API via your browser session.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)
![No API Key](https://img.shields.io/badge/API%20Key-Not%20Required-brightgreen)

---

## Install (Developer Mode)

1. **Log into [claude.ai](https://claude.ai)** in Chrome first
2. Download this repo → click **Code → Download ZIP**, then unzip it
3. Go to `chrome://extensions/` → enable **Developer mode** (top right)
4. Click **Load unpacked** → select the unzipped folder
5. Press **Cmd+E** (Mac) or **Ctrl+E** (Windows) on any page

That's it. No API key, no configuration.

---

## Features

### Page-Aware Chat
Opens a side panel that reads your current page and lets you ask questions about it. Refreshes automatically when you switch tabs.

### Google Workspace Support
Reads **Google Docs, Sheets, and Slides** — even though they use canvas rendering. Uses the export API with your existing Google session.

### @Tab References
Type `@` in the chat input or click **@Tabs** to pull content from any open tab into the conversation.

### Skills (`/commands`)
10 built-in slash commands:

| Command | What it does |
|---|---|
| `/summarize` | Concise summary of the page |
| `/keypoints` | Bullet-point key takeaways |
| `/eli5` | Explain like I'm 5 |
| `/factcheck` | Analyze factual claims |
| `/devil` | Devil's advocate on the arguments |
| `/actions` | Extract action items |
| `/reply` | Draft a reply |
| `/codereview` | Review code for bugs |
| `/translate` | Translate to/from English |
| `/proofread` | Fix grammar and spelling |

Create your own skills in Settings using `{{page}}`, `{{selection}}`, `{{url}}`, `{{title}}` variables.

### Text Selection Tooltip
Highlight any text on a page → **Ask / Explain / Summarize** buttons appear.

### Past Conversations
Full claude.ai conversation history accessible from the sidebar. Resume, rename, or delete any past chat.

### Real-Time Streaming
Responses stream token-by-token, just like on claude.ai.

---

## How It Works

The extension reads your `claude.ai` session cookies and calls claude.ai's internal API directly. Your messages go through claude.ai and count against your normal usage quota (Free or Pro).

```
Chrome Browser
├── claude.ai tab  ← you must be logged in here
│
└── Claude Sidekick Extension
    ├── Reads claude.ai session cookies
    ├── Calls claude.ai/api/* endpoints (SSE streaming)
    └── Content scripts read page text + handle text selection
```

**No intermediary servers. No stored credentials. Direct browser → claude.ai.**

---

## Permissions

| Permission | Why |
|---|---|
| `activeTab` + `scripting` | Read the current page's content |
| `tabs` | List open tabs for @Tab references |
| `storage` | Save custom skills and preferences |
| `cookies` | Read your claude.ai session |
| `sidePanel` | Render the chat UI as a side panel |
| `contextMenus` | Right-click "Ask Claude" actions |
| `host: claude.ai/*` | Call the claude.ai API |
| `host: <all_urls>` | Extract content from any webpage |

---

## Known Limitations

- Requires an active claude.ai session (Free or Pro)
- Uses claude.ai's **unofficial** internal API — may break if Anthropic changes endpoints
- Memory system (browsing personalization) not yet implemented
- Omnibox integration not yet implemented

---

## File Structure

```
claude-sidekick/
├── manifest.json         # MV3 config
├── background.js         # Service worker — routing, extraction, Google Workspace
├── claude-client.js      # claude.ai session API client (SSE streaming)
├── content.js / .css     # Text selection tooltip
├── sidepanel.html        # Side panel markup
├── sidepanel.css         # Side panel styles
├── sidepanel.js          # Side panel logic — chat, skills, history, tabs
└── icons/                # Extension icons
```

---

## Privacy

- No data leaves your browser except to claude.ai (same as normal claude.ai usage)
- Page content is sent to Claude only when you ask a question
- Custom skills are stored locally in Chrome storage
- No analytics, no tracking

---

*Built by [@ankitsherke](https://github.com/ankitsherke)*
