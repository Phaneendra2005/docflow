from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

# import redis
#import redis.asyncio as redis_asyncio

from app.config import settings


#_publish_client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)


def publish_progress(
    job_id: str,
    event_type: str,
    data: Any,
    progress_percent: int,
) -> None:
    """
    Publish a progress event to: "job_progress:{job_id}"

    All events include: job_id, event_type, message, progress_percent, timestamp.
    """
    channel = f"job_progress:{job_id}"
    ts = datetime.now(timezone.utc).isoformat()

    message: str
    payload: dict[str, Any]

    if isinstance(data, dict):
        # Ensure required keys exist; allow extra keys.
        payload = dict(data)
        message = str(payload.get("message") or event_type)
        payload["message"] = message
    else:
        payload = {"message": str(data)}
        message = str(data)

    payload.update(
        {
            "job_id": job_id,
            "event_type": event_type,
            "progress_percent": int(progress_percent),
            "timestamp": ts,
            "message": message,
        }
    )

    _publish_client.publish(channel, json.dumps(payload))


async def subscribe_to_job(job_id: str):
    """
    Subscribe to Redis Pub/Sub channel "job_progress:{job_id}"
    and return a redis-py pubsub subscription.
    """
    channel = f"job_progress:{job_id}"
   # client = redis_asyncio.from_url(settings.REDIS_URL, decode_responses=True)
    pubsub = client.pubsub(ignore_subscribe_messages=True)
    await pubsub.subscribe(channel)
    return pubsub

