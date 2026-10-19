"""Minimal Checkpoint Copilot client.

Set CHECKPOINT_API_URL and CHECKPOINT_API_KEY (get a key at behaviorist.io),
then call score() at any decision point in your agent before it acts.
"""
import os
import requests

API_URL = os.environ["CHECKPOINT_API_URL"]
API_KEY = os.environ["CHECKPOINT_API_KEY"]


def score(decision: str, reversibility: int, consequence_magnitude: int,
          confidence: int, precedent: int, regulatory_exposure: int) -> dict:
    """Score one decision point. Each dimension is an integer from 1 to 5."""
    response = requests.post(
        API_URL,
        headers={"Content-Type": "application/json", "x-api-key": API_KEY},
        json={
            "decision": decision,
            "reversibility": reversibility,
            "consequenceMagnitude": consequence_magnitude,
            "confidence": confidence,
            "precedent": precedent,
            "regulatoryExposure": regulatory_exposure,
        },
        timeout=10,
    )
    response.raise_for_status()
    return response.json()


if __name__ == "__main__":
    result = score(
        "Send offer letter to candidate",
        reversibility=5, consequence_magnitude=4, confidence=3,
        precedent=3, regulatory_exposure=4,
    )
    if result["recommendation"] == "hold_for_human":
        print("Hold for a person:", result["rationale"])
    elif result["recommendation"] == "log_and_proceed":
        print("Proceed and log:", result["rationale"])
    else:
        print("Agent acts:", result["rationale"])
