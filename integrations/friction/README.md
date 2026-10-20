# Friction

**Built-in friction for consequential decisions, in any LLM.**

Most decisions should flow without interruption. A few deserve a pause. Friction uses the Checkpoint Scale to tell them apart, inside the assistant you already use.

- `auto_execute`: the model answers normally. No friction.
- `log_and_proceed`: the model answers, then names the biggest risk and one question to ask yourself.
- `hold_for_human`: the model withholds its view, asks three challenges one at a time (steelman the other side, name what can't be undone, set the falsifier), and asks you to write your own call. Only then does it share its view.

AI as the scaffolding to thinking, not the replacement. The human makes the synthesis.

## What's here

| Path | What it is |
|---|---|
| `server/` | MCP server with `score_decision` and `log_decision` tools and a `friction` prompt. The protocol is sent as server instructions, so it works in Claude, ChatGPT, Cursor and any other MCP client |
| `skill/SKILL.md` | The same protocol as a Claude skill |

Scoring runs on the Checkpoint Copilot API. The weighting model is not in this package.

## Install

1. Get an API key at [behaviorist.io](https://behaviorist.io). Without one, Friction runs in demo mode: routing works, nothing is logged.
2. `cd server && npm install`
3. Add it to your MCP client. Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "friction": {
      "command": "node",
      "args": ["/full/path/to/integrations/friction/server/index.js"],
      "env": {
        "BEHAVIORIST_API_KEY": "your_key",
        "FRICTION_CLIENT_NAME": "claude-desktop"
      }
    }
  }
}
```

4. Optional, Claude only: add `skill/` as a skill.

## Check it works

Ask: *"Should I sign a 12-month exclusive partnership with a supplier I met last week?"*

You should see the inferred scores in one line, a hold, then the first challenge. A normal answer means the client isn't calling `score_decision`.

## Environment variables

| Variable | Default |
|---|---|
| `BEHAVIORIST_API_KEY` | none (demo mode) |
| `BEHAVIORIST_BASE_URL` | the Checkpoint Copilot API |
| `SUPABASE_PUBLISHABLE_KEY` | none; set only if the API gateway asks for it |
| `FRICTION_CLIENT_NAME` | `unknown` |

## What gets logged

With a key, each decision records the human side of the [decision log](../../schema/decision-log.schema.json): the five inputs and which ones you corrected, the route and its reason, each challenge and your answer, your own synthesis, whether seeing the model's view changed your mind, whether you skipped, and seconds from hold to synthesis. Logs are tied to your key and are not public.

## Limits

Friction is a thinking aid, not advice. The scores the model infers from a conversation are estimates; correct them when they're wrong.
