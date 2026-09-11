from __future__ import annotations

import asyncio
import json
import webbrowser
from pathlib import Path
from typing import Any

from aiohttp import web
import pyautogui

ROOT = Path(__file__).resolve().parents[1]
HOST = "127.0.0.1"
PORT = 8765

pyautogui.FAILSAFE = True
pyautogui.PAUSE = 0.01

ALLOWED_KEYS = {
    "left", "right", "up", "down", "space", "enter", "esc",
    "volumeup", "volumedown", "volumemute", "pageup", "pagedown"
}
ALLOWED_BUTTONS = {"left", "right"}


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def handle_message(data: dict[str, Any]) -> None:
    message_type = data.get("type")

    if message_type == "move":
        width, height = pyautogui.size()
        x = clamp(float(data.get("x", 0.5)), 0.0, 1.0)
        y = clamp(float(data.get("y", 0.5)), 0.0, 1.0)
        pyautogui.moveTo(int(x * width), int(y * height), duration=0.02)
        return

    if message_type == "click":
        button = str(data.get("button", "left"))
        if button in ALLOWED_BUTTONS:
            pyautogui.click(button=button)
        return

    if message_type == "mouse_down":
        button = str(data.get("button", "left"))
        if button in ALLOWED_BUTTONS:
            pyautogui.mouseDown(button=button)
        return

    if message_type == "mouse_up":
        button = str(data.get("button", "left"))
        if button in ALLOWED_BUTTONS:
            pyautogui.mouseUp(button=button)
        return

    if message_type == "scroll":
        amount = int(clamp(int(data.get("amount", 0)), -12, 12))
        pyautogui.scroll(amount)
        return

    if message_type == "key":
        key = str(data.get("key", "")).lower()
        if key in ALLOWED_KEYS:
            pyautogui.press(key)
        return

    if message_type == "release_all":
        for button in ALLOWED_BUTTONS:
            try:
                pyautogui.mouseUp(button=button)
            except Exception:
                pass


async def websocket_handler(request: web.Request) -> web.WebSocketResponse:
    ws = web.WebSocketResponse(heartbeat=20)
    await ws.prepare(request)
    await ws.send_json({"type": "hello", "status": "ready"})

    async for msg in ws:
        if msg.type != web.WSMsgType.TEXT:
            continue
        try:
            data = json.loads(msg.data)
            if isinstance(data, dict):
                await asyncio.to_thread(handle_message, data)
        except Exception as exc:
            await ws.send_json({"type": "error", "message": str(exc)[:160]})

    return ws


async def index_handler(_: web.Request) -> web.FileResponse:
    return web.FileResponse(ROOT / "index.html")


def build_app() -> web.Application:
    app = web.Application()
    app.router.add_get("/ws", websocket_handler)
    app.router.add_get("/", index_handler)
    app.router.add_static("/js", ROOT / "js")
    app.router.add_static("/", ROOT)
    return app


if __name__ == "__main__":
    url = f"http://{HOST}:{PORT}/"
    print(f"Gesture Cam Companion em {url}")
    print("Segurança: servidor restrito a 127.0.0.1 e comandos em allowlist.")
    try:
        webbrowser.open(url)
    except Exception:
        pass
    web.run_app(build_app(), host=HOST, port=PORT, print=None)
