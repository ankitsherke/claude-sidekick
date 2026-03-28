# Chrome Web Store Listing — Parsely - Browser Copilot

Copy-paste ready. All fields are at or under their character limits.

---

## Extension Name (max 75 chars)

```
Parsely - Browser Copilot — AI Sidebar for Any Page
```
*(42 chars)*

> ⚠️ "Claude" is Anthropic's trademark. If the listing is rejected for trademark reasons, fallback names:
> - `Parsely — Chat Sidebar for Claude`
> - `Parsely — Browser Chat Panel`

---

## Short Description (max 132 chars)

```
AI sidebar powered by your Claude.ai account. Ask questions about any page, summarize, translate, and access past chats. No API key needed.
```
*(139 chars — trim to:)*

```
AI sidebar powered by your claude.ai account. Ask questions about any page, summarize content, and access past chats. No API key needed.
```
*(136 chars — still over, use:)*

```
AI sidebar using your claude.ai session. Ask questions about any page, summarize, translate, review code. No API key needed.
```
*(125 chars ✓)*

---

## Long Description (max 16,000 chars)

```
Parsely - Browser Copilot puts a Claude AI chat panel right next to whatever you're reading — powered by your existing claude.ai account. No API key, no extra subscription, no setup.

Press ⌘E (Mac) or Ctrl+E (Windows) on any webpage and a side panel opens that already knows what you're looking at. Ask a question. Claude answers with full context of the page.

──────────────────────────────────────
FEATURES
──────────────────────────────────────

Page-Aware Chat
The side panel reads your current page automatically. Ask questions, request explanations, or have Claude dig into any part of the content. Switches context automatically when you change tabs.

10 Built-in Skills (/commands)
Type / to see instant commands:
• /summarize — Concise summary of the page
• /keypoints — Bullet-point key takeaways
• /eli5 — Explain like I'm 5
• /factcheck — Analyze factual claims
• /devil — Devil's advocate on the arguments
• /actions — Extract action items and next steps
• /reply — Draft a reply to an email or message
• /codereview — Review code for bugs and improvements
• /translate — Translate to/from English
• /proofread — Fix grammar and spelling

You can also create your own custom skills with variables like {{page}}, {{selection}}, {{url}}, {{title}}.

Google Workspace Support
Reads Google Docs, Sheets, and Slides natively — even though they use canvas rendering and are invisible to most extensions. Uses the export API with your existing Google session.

@Tab References
Type @ in the chat or click @Tabs to pull content from any open tab into the conversation. Compare documents, cross-reference sources, connect information across multiple tabs.

File Attachments
Attach text files (.txt, .md, .csv, .json, .js, .py, .html, .css, and more) directly into chat for Claude to read and analyze alongside page content.

Text Selection Tooltip
Highlight any text on any webpage and Ask / Explain / Summarize buttons appear instantly. The AI is always one highlight away.

Past Conversations
Your full claude.ai conversation history is accessible from the sidebar. Load, rename, search, or delete any past chat without leaving the page.

Real-Time Streaming
Responses stream token-by-token, just like on claude.ai. No waiting for a full response to appear.

Minimal, Focused Design
Clean black-and-white interface that complements any page without distracting from your work.

──────────────────────────────────────
HOW IT WORKS
──────────────────────────────────────

The extension uses your existing claude.ai session (the same one your browser uses when you visit claude.ai). Messages go directly from your browser to claude.ai. No intermediary server. No stored credentials. Your usage counts against your normal claude.ai quota (Free or Pro).

──────────────────────────────────────
PRIVACY
──────────────────────────────────────

• No data leaves your browser except to claude.ai
• Page content is sent to Claude only when you ask a question
• Custom skills are stored locally on your device
• No analytics, no tracking, no advertising networks
• Fully open source — every line of code is readable on GitHub

──────────────────────────────────────
REQUIREMENTS
──────────────────────────────────────

• Chrome 116 or later
• An active claude.ai account (Free or Pro)
• Must be logged into claude.ai in your browser

──────────────────────────────────────
OPEN SOURCE
──────────────────────────────────────

Parsely - Browser Copilot is fully open source. Read, audit, and contribute at:
github.com/ankitsherke/parsely
```

---

## Category

**Primary:** `Productivity`
**Secondary:** `AI`

---

## Permission Justifications

These are entered in the Chrome Web Store developer console under "Permissions."

### `cookies`
> This extension requires the `cookies` permission to read the user's claude.ai session cookie. This is the only authentication mechanism available — claude.ai does not offer a public API key for individual accounts. The cookie is read once per session and used exclusively for authenticating requests to claude.ai on the user's behalf. It is never transmitted to any server other than claude.ai and is never stored or logged.

### `<all_urls>` (host permission)
> The `<all_urls>` host permission is required for two purposes: (1) running a content script on any page the user visits, which extracts readable text from the page so Claude can answer questions about it; and (2) showing the text-selection tooltip on any page so users can Ask, Explain, or Summarize highlighted text with one click. The extension cannot function as a page-reading AI assistant without access to the content of arbitrary pages the user visits.

---

## Screenshots

Take 1280×800 screenshots (or 640×400) of:

1. **Hero shot** — Side panel open on a news article, showing a summary response
2. **Skills dropdown** — `/` typed in the input, showing the skills menu
3. **@Tab reference** — Two tabs referenced, showing cross-tab comparison
4. **History panel** — Past conversations list open
5. **File attachment** — File pill visible in input area with a code review response

Upload order: hero first.

---

## Promotional Tile (440×280) — Optional but recommended

Simple dark background, the Parsely logo, and the tagline:
> "Ask Claude about anything you're reading."

---

## Homepage URL

```
https://github.com/ankitsherke/parsely
```

---

## Support URL

```
https://github.com/ankitsherke/parsely/issues
```

---

## Privacy Policy URL

Host `PRIVACY_POLICY.md` as a public webpage (GitHub Pages, Notion, or any public URL) and paste the URL here.

Quick option — GitHub raw file will work if it's a public repo:
```
https://ankitsherke.github.io/parsely/privacy
```
or just point to a dedicated page on your GitHub profile/repo.
