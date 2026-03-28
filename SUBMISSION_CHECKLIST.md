# Chrome Web Store Submission Checklist

## ⚠️ Critical Risks — Read First

### 1. Unofficial API
This extension calls **claude.ai's internal (undocumented) API** using the user's session cookie. This is not an officially supported integration.

**Risk:** Anthropic may update their API endpoints without notice, breaking the extension. More critically, Anthropic's [Terms of Service](https://www.anthropic.com/legal/aup) may prohibit automated access to claude.ai in this manner. Google may reject the extension, or Anthropic may file a complaint post-launch.

**Mitigation:** The extension is transparent about this in the description. Users must log in themselves — no credentials are ever harvested or stored. All traffic goes directly to claude.ai.

### 2. Trademark
The name **"Parsely - Browser Copilot"** uses Anthropic's "Claude" trademark. Google may reject the listing, or Anthropic may request removal.

**Mitigation options if rejected:**
- `Parsely — Browser Chat Panel`
- `Parsely`
- `Parsely`

### 3. `cookies` Permission
Reading another site's cookies is a high-scrutiny permission. Google will ask for written justification (template in [STORE_LISTING.md](STORE_LISTING.md)).

---

## Pre-Submission Checklist

### Code & Manifest

- [ ] Run `bash build.sh` and confirm the ZIP builds without errors
- [ ] Load the ZIP as an unpacked extension in `chrome://extensions/` and test all features
- [ ] Confirm no `console.error` spam in DevTools
- [ ] Confirm the extension works on at least: a news article, a GitHub page, a Google Doc

### Store Assets (Required)

- [ ] **1–5 Screenshots** at 1280×800 or 640×400 PNG/JPG
  - [ ] Screenshot 1: Side panel open on an article with a summary
  - [ ] Screenshot 2: Skills `/` dropdown
  - [ ] Screenshot 3: Past chats history drawer
  - [ ] Screenshot 4: File attachment in use (optional)
  - [ ] Screenshot 5: @Tabs multi-tab reference (optional)
- [ ] **Store icon** — `icons/icon128.png` is already 128×128 ✓
- [ ] **Privacy Policy hosted at a public URL**
  - Options: GitHub Pages, Notion public page, any public website
  - Content: use [PRIVACY_POLICY.md](PRIVACY_POLICY.md)

### Store Assets (Optional but Recommended)

- [ ] **Promotional tile** 440×280 PNG (shown in search results)
- [ ] **Small promo tile** 920×680 PNG (featured placements)

### Developer Console Setup

- [ ] Create a Chrome Web Store developer account at [chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole)
- [ ] Pay the one-time $5 developer registration fee
- [ ] Upload the ZIP from `bash build.sh`

### Listing Fields to Fill In

- [ ] **Name:** `Parsely - Browser Copilot — AI Sidebar for Any Page`
- [ ] **Short description** (125 chars): use copy from [STORE_LISTING.md](STORE_LISTING.md)
- [ ] **Long description**: use copy from [STORE_LISTING.md](STORE_LISTING.md)
- [ ] **Category:** Productivity
- [ ] **Language:** English
- [ ] **Homepage URL:** your GitHub repo
- [ ] **Support URL:** your GitHub issues page
- [ ] **Privacy Policy URL:** your hosted privacy policy

### Permission Justifications

The developer console will prompt for justifications for sensitive permissions.

- [ ] **`cookies`** — paste from [STORE_LISTING.md](STORE_LISTING.md) → Permission Justifications section
- [ ] **`<all_urls>`** — paste from [STORE_LISTING.md](STORE_LISTING.md) → Permission Justifications section

---

## After Submission

- Review typically takes **1–3 business days** for new submissions
- You'll receive an email at your developer account email
- If rejected, the rejection reason will appear in the developer console — most rejections are fixable

### Common Rejection Reasons + Fixes

| Rejection | Fix |
|---|---|
| "Broad permissions not justified" | Improve the permission justification text |
| "Trademark violation" | Rename to remove "Claude" from the title |
| "Single purpose not clear" | Update description to emphasize the single purpose |
| "Privacy policy missing or inadequate" | Ensure policy URL is accessible and covers all data flows |
| "Remote code execution" | N/A — extension uses no `eval()` or dynamic code loading |

---

## Build the ZIP

```bash
cd "path/to/dia-clone-extension 2"
bash build.sh
```

Output: `parsely-v2.1.0.zip` — upload this to the developer console.
