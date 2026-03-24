// ─── claude-web-client.js ───
// Talks to claude.ai internal API using your browser session cookies.
// No API key needed — uses the same auth as when you visit claude.ai.

const CLAUDE_BASE = 'https://claude.ai';

class ClaudeWebClient {
  constructor() {
    this.organizationId = null;
    this.sessionReady = false;
  }

  // ─── Cookie / Session ───

  async getSessionCookie() {
    // Get all cookies from claude.ai
    const cookies = await chrome.cookies.getAll({ domain: '.claude.ai' });
    // Build cookie header string
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    if (!cookieStr) return null;
    return cookieStr;
  }

  async getHeaders() {
    const cookie = await this.getSessionCookie();
    if (!cookie) throw new Error('NOT_LOGGED_IN');
    return {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream, application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      'Origin': CLAUDE_BASE,
      'Referer': `${CLAUDE_BASE}/chats`,
      'Cookie': cookie
    };
  }

  // ─── Organization ───

  async getOrganizationId() {
    if (this.organizationId) return this.organizationId;

    const headers = await this.getHeaders();
    const res = await fetch(`${CLAUDE_BASE}/api/organizations`, { headers });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) throw new Error('NOT_LOGGED_IN');
      throw new Error(`Failed to get org: ${res.status}`);
    }

    const orgs = await res.json();
    if (!orgs || orgs.length === 0) throw new Error('NO_ORGANIZATION');

    this.organizationId = orgs[0].uuid;
    this.sessionReady = true;
    return this.organizationId;
  }

  // ─── Check if logged in ───

  async checkSession() {
    try {
      await this.getOrganizationId();
      return { loggedIn: true, orgId: this.organizationId };
    } catch (e) {
      return { loggedIn: false, error: e.message };
    }
  }

  // ─── Init (alias used by sidepanel.js) ───

  async init() {
    const result = await this.checkSession();
    return { success: result.loggedIn, orgId: result.orgId, error: result.error };
  }

  // ─── Conversations ───

  async listConversations() {
    const orgId = await this.getOrganizationId();
    const headers = await this.getHeaders();
    const res = await fetch(
      `${CLAUDE_BASE}/api/organizations/${orgId}/chat_conversations`,
      { headers }
    );
    if (!res.ok) throw new Error(`Failed to list conversations: ${res.status}`);
    return await res.json();
  }

  async getConversation(conversationId) {
    const orgId = await this.getOrganizationId();
    const headers = await this.getHeaders();
    const res = await fetch(
      `${CLAUDE_BASE}/api/organizations/${orgId}/chat_conversations/${conversationId}`,
      { headers }
    );
    if (!res.ok) throw new Error(`Failed to get conversation: ${res.status}`);
    return await res.json();
  }

  async createConversation(name = '') {
    const orgId = await this.getOrganizationId();
    const headers = await this.getHeaders();
    const uuid = crypto.randomUUID();
    const res = await fetch(
      `${CLAUDE_BASE}/api/organizations/${orgId}/chat_conversations`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ uuid, name })
      }
    );
    if (!res.ok) throw new Error(`Failed to create conversation: ${res.status}`);
    return await res.json();
  }

  // ─── Projects ───

  async listProjects() {
    const orgId = await this.getOrganizationId();
    const headers = await this.getHeaders();
    const res = await fetch(
      `${CLAUDE_BASE}/api/organizations/${orgId}/projects`,
      { headers }
    );
    if (!res.ok) throw new Error(`Failed to list projects: ${res.status}`);
    return await res.json();
  }

  // ─── Send Message (SSE Streaming) ───
  // Supports two calling conventions:
  //   1. Legacy:  sendMessage(convId, text, attachments, onChunk)
  //   2. Modern:  sendMessage(convId, text, { onText, onDone, onError })

  async sendMessage(conversationId, text, attachmentsOrCallbacks = [], onChunkOrNull = null) {
    // Detect calling convention
    let attachments = [];
    let onText = null, onDone = null, onError = null;
    if (attachmentsOrCallbacks && typeof attachmentsOrCallbacks === 'object' && !Array.isArray(attachmentsOrCallbacks)) {
      // Modern callback-object API used by sidepanel.js
      onText = attachmentsOrCallbacks.onText || null;
      onDone = attachmentsOrCallbacks.onDone || null;
      onError = attachmentsOrCallbacks.onError || null;
    } else {
      // Legacy positional API used by background.js
      attachments = attachmentsOrCallbacks || [];
      const legacyChunk = onChunkOrNull;
      if (legacyChunk) onText = (fullText, delta) => legacyChunk(delta, fullText);
    }

    const orgId = await this.getOrganizationId();
    const headers = await this.getHeaders();

    const body = {
      prompt: text,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      model: 'claude-sonnet-4-6',
      attachments: attachments,
      files: []
    };

    const res = await fetch(
      `${CLAUDE_BASE}/api/organizations/${orgId}/chat_conversations/${conversationId}/completion`,
      {
        method: 'POST',
        headers: {
          ...headers,
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify(body)
      }
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      const msg = `Send failed (${res.status}): ${errText.slice(0, 2000)}`;
      if (onError) { onError(msg); return ''; }
      throw new Error(msg);
    }

    // Parse SSE stream
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';
    // Tracks in-progress artifact tool_use blocks: index → partial JSON string
    const artifactAccum = {};

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete last line in buffer

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const dataStr = line.slice(6).trim();
          if (!dataStr) continue;

          try {
            const data = JSON.parse(dataStr);

            // ── Legacy format ──────────────────────────────────────────
            if (data.type === 'completion' && data.completion) {
              fullText += data.completion;
              if (onText) onText(fullText, data.completion);
            }

            // ── Modern content_block format ────────────────────────────
            // Text delta
            if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
              fullText += data.delta.text;
              if (onText) onText(fullText, data.delta.text);
            }

            // Artifact (tool_use) block starts
            if (data.type === 'content_block_start' && data.content_block?.type === 'tool_use') {
              artifactAccum[data.index] = { json: '' };
            }

            // Artifact JSON accumulates chunk by chunk
            if (data.type === 'content_block_delta' && data.delta?.type === 'input_json_delta') {
              if (artifactAccum[data.index] != null) {
                artifactAccum[data.index].json += data.delta.partial_json || '';
              }
            }

            // Artifact block complete — embed marker into fullText
            if (data.type === 'content_block_stop' && artifactAccum[data.index] != null) {
              try {
                const input = JSON.parse(artifactAccum[data.index].json);
                // Embed a sentinel so renderMarkdown can render an artifact card
                fullText += `\n\x01ARTIFACT${JSON.stringify(input)}\x01`;
                if (onText) onText(fullText, '');
              } catch { /* malformed JSON — skip */ }
              delete artifactAccum[data.index];
            }

            if (data.type === 'error') {
              throw new Error(data.error?.message || 'Stream error');
            }
          } catch (e) {
            if (e.message === 'Stream error') throw e;
            // Not all data lines are valid JSON — that's fine
          }
        }
      }
    } catch (e) {
      if (onError) { onError(e.message); return fullText; }
      throw e;
    }

    if (onDone) onDone(fullText);
    return fullText;
  }

  // ─── Rename Conversation ───

  async renameConversation(conversationId, name) {
    const orgId = await this.getOrganizationId();
    const headers = await this.getHeaders();
    const res = await fetch(
      `${CLAUDE_BASE}/api/organizations/${orgId}/chat_conversations/${conversationId}`,
      { method: 'PUT', headers, body: JSON.stringify({ name }) }
    );
    return res.ok;
  }

  // ─── Delete Conversation ───

  async deleteConversation(conversationId) {
    const orgId = await this.getOrganizationId();
    const headers = await this.getHeaders();
    const res = await fetch(
      `${CLAUDE_BASE}/api/organizations/${orgId}/chat_conversations/${conversationId}`,
      { method: 'DELETE', headers }
    );
    return res.ok;
  }
}

// Export singleton
const claudeClient = new ClaudeWebClient();
