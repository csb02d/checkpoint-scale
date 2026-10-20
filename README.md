<p align="center"><img src="assets/labyrinth.svg" width="88" alt="Behaviorist labyrinth mark"></p>

<h1 align="center">The Checkpoint Scale</h1>

<p align="center"><b>Should this agent act, log, or wait for a person?</b><br>
A five-dimension instrument for scoring decision points in agentic AI systems.</p>

<p align="center">
<a href="https://behaviorist.io/checkpoint-scale">Specification</a> ·
<a href="https://behaviorist.io">Checkpoint Copilot API</a> ·
<a href="https://behaviorist.io/lab">Research agenda</a>
</p>

---

## Why this exists

You now think with three systems. Only two of them are yours.

Agents now take actions, not just suggestions. Most teams decide where a human approves an action by intuition, late in the build, usually as one approval step before launch. Too few checkpoints and irreversible actions run unreviewed. Too many and reviewers start rubber-stamping, which is worse than no review at all, because the error now ships with a signature on it.

The Checkpoint Scale makes that placement decision explicit, scoreable and auditable, one decision point at a time.

## The unit of measurement

One **decision point**: a specific action an agent can take without a human. Not a system, not a workflow, not an industry. The same agent in the same workflow produces very different scores across its own decision points, and that variance is the point of measuring it.

## Five dimensions

Each dimension is scored 1 to 5 against published anchors.

| | Dimension | What it asks | 1 | 5 |
|---|---|---|---|---|
| 01 | **Reversibility** | How hard is this to undo once it has taken effect? | The agent can reverse it itself, no trace | Money moved, data deleted, message delivered |
| 02 | **Consequence magnitude** | How large is the harm if it is wrong and not caught? | Noise in a log | Safety, legal liability, lasting reputational harm |
| 03 | **Confidence** | How likely is this specific action to be correct? | Ambiguous inputs, conflicting evidence | Deterministic and verifiable before execution |
| 04 | **Precedent** | How well-trodden is this decision type here? | First time this shape has appeared | High volume, stable, known correct answer |
| 05 | **Regulatory exposure** | Does this action, if wrong, create an obligation a regulator would examine? | No regulated artefact | A legally operative decision in a supervised domain |

Full anchor definitions for all five levels are in the [specification](https://behaviorist.io/checkpoint-scale).

> **On confidence.** It is the weakest input and the one most often supplied badly. A fluent answer is not a confident one. Derive it from observable signals (retrieval quality, tool-call success, schema validity, ambiguity in the request) rather than asking the model how sure it is.

## Three routes

| Route | Meaning |
|---|---|
| `auto_execute` | The agent acts. Low risk across the profile. |
| `log_and_proceed` | The agent acts, and a reviewable record is kept. |
| `hold_for_human` | A named person decides before anything executes. |

Every result carries a plain-language reason naming the dimensions that drove it, so the reviewer knows *why* this decision reached them.

## Try it

```bash
curl -X POST "$CHECKPOINT_API_URL" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $CHECKPOINT_API_KEY" \
  -d '{
    "decision": "Send offer letter to candidate",
    "reversibility": 5,
    "consequenceMagnitude": 4,
    "confidence": 3,
    "precedent": 3,
    "regulatoryExposure": 4
  }'
```

```json
{
  "recommendation": "hold_for_human",
  "rationale": "Hard to reverse and high consequence are driving this toward human review."
}
```

A Python client is in [`examples/score.py`](examples/score.py). Get an API key at [behaviorist.io](https://behaviorist.io).

## The decision log

Most agent logs record what the system did. Very few record why a person was brought in, what they were shown, and how they decided.

Checkpoint Copilot links both sides under one decision ID: the agent-side record (proposal, scores, route, reason) and the human-side record (what the reviewer saw, the cue used to prompt real reasoning, their decision, time taken, rationale). The shape of that record is in [`schema/decision-log.schema.json`](schema/decision-log.schema.json).

That paired record is what lets a team prove oversight actually happened, not just that an approve button was clicked.

## Friction: the human side, in any LLM

[`integrations/friction`](integrations/friction) is an MCP server that brings the scale to the human side of a decision. Routine choices pass through. When a decision scores `hold_for_human`, the assistant withholds its view, asks three challenges, and has the person write their own call first. Works in Claude, ChatGPT, Cursor and any MCP client.

## What is open and what is not

| Open | Available to API users and research partners |
|---|---|
| The five dimensions and their anchors | The weighting model and band thresholds |
| The three routes | Numeric risk scores |
| The decision log schema | Calibration against real outcomes |
| API client examples | Custom weights for enterprise deployments |

## Help calibrate it

The v1.0 weights are theory-driven, set from the behavioural literature on automation bias, reversibility and escalation cost. Two things would move them to evidence-weighted:

1. **Independent scorers.** Engineers willing to score the same set of decision points so inter-rater agreement can be measured and published.
2. **Outcome data.** Decision points scored before the fact, paired with what actually happened.

If you have either, write to hello@behaviorist.io.

## Cite

> Burger, C. (2026). *The Checkpoint Scale (v1.0): a five-dimension instrument for scoring agentic decision points.* Behaviorist. https://behaviorist.io/checkpoint-scale

## Limits

This is a prioritisation instrument, not a safety certification or a compliance control. A high score is a reason to put a named human on a decision. It is not evidence that a system is safe, and it does not discharge any obligation.

---

Built by [Behaviorist](https://behaviorist.io): decision science for the human side of agentic AI. Founded by [Carla Burger](https://carlaburger.com).
