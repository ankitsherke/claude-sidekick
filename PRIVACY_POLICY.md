# Privacy Policy — Parsely - Browser Copilot

**Last updated: March 28, 2026**

## What This Extension Does

Parsely - Browser Copilot is a Chrome browser extension that opens a side panel on any webpage, reads the page content, and lets you chat with Claude AI about it — using your existing claude.ai account. No API key is required.

---

## Data Collection

**We collect nothing. There is no server, no database, no analytics, no tracking.**

All data flow is strictly between your browser and claude.ai — the same destination as when you use claude.ai normally.

---

## Permissions and Why They're Needed

| Permission | Why it's needed |
|---|---|
| `activeTab` | To read the content of the current tab when you open the panel |
| `storage` | To save your custom Skills (slash commands) locally on your device |
| `scripting` | To extract readable text from the current page |
| `tabs` | To list open tabs for the @Tabs reference feature and refresh context on tab changes |
| `contextMenus` | To show "Ask Claude" / "Summarize" options in the right-click menu |
| `sidePanel` | To open the chat panel alongside the page |
| `cookies` | To read your claude.ai session cookie for authentication — so the extension can call claude.ai on your behalf without an API key |
| `<all_urls>` (host permission) | To run the page-reading content script on any site you visit, and to show the text-selection tooltip on any page |

---

## Data Flow

```
Your browser
    ↓  (reads page content locally)
Parsely - Browser Copilot
    ↓  (sends your message + page context)
claude.ai API (Anthropic)
    ↓  (returns Claude's response)
Your browser
```

No data passes through any intermediate server. The extension communicates directly with `claude.ai` using your existing session, exactly as your browser does when you visit claude.ai.

---

## What Leaves Your Browser

Only when you actively send a message:

- **Your question** — what you typed
- **Page content** (if "Page" toggle is on) — the readable text of the page you're viewing
- **Tab content** (if you used @Tabs) — readable text from tabs you explicitly referenced
- **File content** (if you attached a file) — text content of files you attached

Nothing is sent silently or in the background.

---

## What's Stored Locally

- **Custom Skills** — stored in `chrome.storage.local` on your device only. Never transmitted.
- Nothing else is persisted between sessions.

---

## Conversation History

Past conversations are stored on claude.ai's servers (not by this extension). The extension only reads them when you open the history panel — it does not cache or copy them.

---

## Cookies

The extension reads your `claude.ai` session cookie once per session to authenticate requests. This cookie is never transmitted to any server other than `claude.ai`. It is not stored, logged, or shared.

---

## Third Parties

None. The extension does not use any analytics services, advertising networks, or third-party tracking.

---

## Children's Privacy

This extension is not directed at children under 13. It requires an active claude.ai account to function.

---

## Changes

If this policy changes, the updated version will be published alongside the extension.

---

## Contact

For questions: open an issue on the [GitHub repository](https://github.com/ankitsherke/parsely).
