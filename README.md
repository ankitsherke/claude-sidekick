# Claude Sidekick

**Ever wished you could just ask Claude about the page you're reading — without copy-pasting anything?**

Claude Sidekick is a Chrome extension that gives Claude full context of your browser. Press `⌘E` on any webpage, and a side panel opens that already knows what you're looking at. Ask questions, run commands, pull in other tabs — all powered by your existing claude.ai account.

No API key. No extra subscription. No setup.

![Claude-Sidekick](https://github.com/user-attachments/assets/ff29ca20-0a0b-4aa1-ba25-59c670f2bcd3)


---

## How It Works

```
You're reading an article, a Google Doc, or reviewing code on GitHub.
You press ⌘E (or Ctrl+E).
A side panel opens. It already has the page content.
You ask a question. Claude answers with full context.
That's it.
```

The extension reads your `claude.ai` session cookies and calls the same API your browser does. Your messages go through claude.ai and count against your normal usage quota (Free or Pro). No intermediary servers. No stored credentials. Direct browser → claude.ai.

---

## How Is This Different from Claude in Chrome?

Anthropic's official **Claude in Chrome** extension is a browser *automation agent* — it clicks buttons, fills forms, and navigates websites on your behalf. It's powerful, but it's designed for a different job.

Claude Sidekick is a **reading companion**. It reads what you're reading and helps you think about it.

| | Claude Sidekick | Claude in Chrome (Anthropic) |
|---|---|---|
| **What it does** | Reads page content, answers questions, summarizes, extracts info | Automates browser tasks — clicks, fills forms, navigates |
| **Primary use** | Understanding content you're already looking at | Doing repetitive browser workflows for you |
| **Subscription required** | No — works with Free and Pro accounts | Yes — paid plans only (Pro/Max/Team/Enterprise) |
| **Model access** | Uses whatever model your claude.ai session uses | Pro limited to Haiku 4.5; Max/Team get Sonnet/Opus |
| **Google Docs/Sheets/Slides** | ✅ Reads content natively via export API | ✅ Can interact with Google Workspace |
| **@Tab references** | ✅ Pull content from any open tab into chat | Tab grouping for multi-tab automation |
| **Slash commands** | ✅ 10 built-in + custom skills | Workflow recording + shortcuts |
| **Open source** | ✅ Yes — inspect every line | ❌ Closed source |
| **API key needed** | ❌ No | ❌ No (but needs paid subscription) |
| **Privacy** | Page content sent to Claude only when you ask | Claude sees and interacts with pages actively |

**Think of it this way:** Claude in Chrome is your hands. Claude Sidekick is your reading glasses.

---

## Features

### Page-Aware Chat

Opens a side panel that reads your current page and lets you ask questions about it. Refreshes automatically when you switch tabs.

<img width="3420" height="2150" alt="image" src="https://github.com/user-attachments/assets/08b3de07-2790-4708-8a04-533ba5ac9eb1" />


### Skills (/commands)

10 built-in slash commands. Create your own with `{{page}}`, `{{selection}}`, `{{url}}`, `{{title}}` variables.

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

<img width="3420" height="2170" alt="image" src="https://github.com/user-attachments/assets/577f1ed5-398d-49a7-9cce-7f6ceab6ca75" />


### Google Workspace Support

Reads **Google Docs, Sheets, and Slides** — even though they use canvas rendering. Uses the export API with your existing Google session. Most browser extensions can't do this.

<img width="3420" height="2158" alt="image" src="https://github.com/user-attachments/assets/c9667380-b6e2-4035-91d9-cbd7cf6c899d" />


### @Tab References

Type `@` in the chat or click **@Tabs** to pull content from any open tab into the conversation. Compare documents, cross-reference sources, connect information across tabs.



### Text Selection Tooltip

Highlight any text on a page → **Ask | Explain | Summarize** buttons appear. The AI is always one highlight away.

### Real-Time Streaming

Responses stream token-by-token, just like on claude.ai.

### Past Conversations

Full claude.ai conversation history accessible from the sidebar. Resume, rename, or delete any past chat.

---

## Install (2 minutes)

1. **Log into [claude.ai](https://claude.ai)** in Chrome
2. **Download this repo** → Code → Download ZIP → unzip
3. Go to `chrome://extensions/` → enable **Developer mode** (top right)
4. Click **Load unpacked** → select the unzipped folder
5. Press **⌘E** (Mac) or **Ctrl+E** (Windows) on any page

That's it. No API key, no configuration, no account creation.

---

## Privacy

- No data leaves your browser except to claude.ai (same as normal usage)
- Page content is sent to Claude only when you ask a question
- Custom skills are stored locally in Chrome storage
- No analytics, no tracking, no intermediary servers
- Fully open source — read every line of code

---

## Known Limitations

- Requires an active claude.ai session (Free or Pro)
- Uses claude.ai's **unofficial** internal API — may break if Anthropic changes endpoints
- Memory/personalization not yet implemented
- Not available on the Chrome Web Store (developer mode only for now)

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

## Contributing

PRs welcome. If you find a bug or have a feature idea, open an issue.

---

## License

MIT

---

*Built by [@ankitsherke](https://github.com/ankitsherke)*
