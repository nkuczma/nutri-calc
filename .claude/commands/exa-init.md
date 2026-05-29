> **Canonical reference:** https://docs.exa.ai/reference/exa-mcp
>
> If anything below looks outdated or contradicts real MCP behavior, fetch that URL — it is the source of truth for MCP setup, auth, and tools. Report staleness back to the user.

---

# Exa MCP Setup Guide

## Your Configuration

| Setting     | Value            |
| ----------- | ---------------- |
| Coding Tool | Claude           |
| Integration | MCP              |
| Use Case    | I don't know yet |

**Project Description:** (Not provided)

---

## 🔌 Exa MCP Server for Claude Code

Give Claude Code real-time web search, page fetches, and optional advanced search with Exa MCP.

**Run in terminal:**

```bash
claude mcp add --transport http exa https://mcp.exa.ai/mcp
```

**Tool enablement (optional):**
Add a `tools=` query param to the MCP URL.

Enable advanced search:

```
https://mcp.exa.ai/mcp?tools=web_search_advanced_exa
```

Enable all non-deprecated tools:

```
https://mcp.exa.ai/mcp?tools=web_search_exa,web_fetch_exa,web_search_advanced_exa
```

**Authentication:** Exa MCP uses OAuth — no API key needed. Your client opens a browser to sign in to your Exa account on first connection. Manage your account at [dashboard.exa.ai](https://dashboard.exa.ai).

**Troubleshooting:** if tools don't appear, restart your MCP client after updating the config.

📖 Full docs: [docs.exa.ai/reference/exa-mcp](https://docs.exa.ai/reference/exa-mcp)

---

## Resources

- Docs: https://exa.ai/docs
- Dashboard: https://dashboard.exa.ai
- API Status: https://status.exa.ai
