#!/usr/bin/env python3
import base64
import json
import shutil
import subprocess
import tempfile
import time
import urllib.parse
import urllib.request
from pathlib import Path

import websocket


REPO_ROOT = Path(__file__).resolve().parent.parent
CHROME_BIN = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
DEVTOOLS_PORT = 9222
APP_URL = "http://127.0.0.1:5173/"
OUTPUT_DIR = REPO_ROOT / "blackbook" / "figures" / "chap4"


CAPTURE_PLAN = [
    {
        "name": "figure-4-1-dashboard.png",
        "tab": "Dashboard",
        "button": None,
        "delay": 1.2,
    },
    {
        "name": "figure-4-2-inventory.png",
        "tab": "Inventory",
        "button": None,
        "delay": 1.2,
    },
    {
        "name": "figure-4-3-product-form.png",
        "tab": "Products",
        "button": "New Product",
        "delay": 1.2,
    },
    {
        "name": "figure-4-4-purchase-workflow.png",
        "tab": "Purchases",
        "button": "New Purchase",
        "delay": 1.2,
    },
    {
        "name": "figure-4-5-sales-workflow.png",
        "tab": "Sales",
        "button": "New Sale",
        "delay": 1.2,
    },
    {
        "name": "figure-4-6-quotation-workflow.png",
        "tab": "Quotation",
        "button": "Create Quotation",
        "delay": 1.2,
    },
    {
        "name": "figure-4-7-billing-note-workflow.png",
        "tab": "Billing Notes",
        "button": "Create Billing Note",
        "delay": 1.2,
    },
    {
        "name": "figure-4-8-payment-batch-workflow.png",
        "tab": "Payment Batches",
        "button": "Create Payment Batch",
        "delay": 1.2,
    },
]


class CDPClient:
    def __init__(self, ws_url: str):
        self.ws = websocket.create_connection(ws_url, timeout=20)
        self.msg_id = 0

    def send(self, method: str, params=None):
        self.msg_id += 1
        payload = {"id": self.msg_id, "method": method, "params": params or {}}
        self.ws.send(json.dumps(payload))
        while True:
            raw = self.ws.recv()
            message = json.loads(raw)
            if message.get("id") != self.msg_id:
                continue
            if "error" in message:
                raise RuntimeError(f"CDP error for {method}: {message['error']}")
            return message.get("result", {})

    def close(self):
        self.ws.close()


def chrome_running() -> bool:
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{DEVTOOLS_PORT}/json/version", timeout=1):
            return True
    except Exception:
        return False


def start_headless_chrome(profile_dir: str):
    args = [
        CHROME_BIN,
        f"--remote-debugging-port={DEVTOOLS_PORT}",
        f"--user-data-dir={profile_dir}",
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--remote-allow-origins=*",
        "--force-device-scale-factor=1",
        "--window-size=1600,1400",
        "about:blank",
    ]
    return subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def wait_for_devtools(timeout=15):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if chrome_running():
            return
        time.sleep(0.2)
    raise RuntimeError("Timed out waiting for headless Chrome devtools endpoint.")


def open_tab(url: str) -> str:
    encoded = urllib.parse.quote(url, safe="")
    endpoints = [
        f"http://127.0.0.1:{DEVTOOLS_PORT}/json/new?{encoded}",
        f"http://127.0.0.1:{DEVTOOLS_PORT}/json/new/{encoded}",
    ]
    last_error = None
    for endpoint in endpoints:
        try:
            req = urllib.request.Request(endpoint, method="PUT")
            with urllib.request.urlopen(req, timeout=10) as response:
                return json.load(response)["webSocketDebuggerUrl"]
        except Exception as exc:
            last_error = exc
            try:
                req = urllib.request.Request(endpoint, method="GET")
                with urllib.request.urlopen(req, timeout=10) as response:
                    return json.load(response)["webSocketDebuggerUrl"]
            except Exception as inner:
                last_error = inner
    raise RuntimeError(f"Unable to open Chrome tab for {url}: {last_error}")


def js_string(value: str) -> str:
    return json.dumps(value)


def wait_for_page_ready(client: CDPClient, timeout=20):
    deadline = time.time() + timeout
    while time.time() < deadline:
        state = evaluate(client, "document.readyState")
        if state == "complete":
            return
        time.sleep(0.2)
    raise RuntimeError("Timed out waiting for page ready state.")


def evaluate(client: CDPClient, expression: str):
    result = client.send(
        "Runtime.evaluate",
        {
            "expression": expression,
            "returnByValue": True,
            "awaitPromise": True,
        },
    )
    return result.get("result", {}).get("value")


def click_by_text(client: CDPClient, text: str):
    script = f"""
(() => {{
  const targetText = {js_string(text)};
  const normalize = (value) => (value || "").replace(/\\s+/g, " ").trim();
  const selectors = [
    ".sidebar-nav-button",
    "button",
    "[role='button']",
    "a"
  ];
  const elements = [...document.querySelectorAll(selectors.join(","))];
  const target = elements.find((element) => normalize(element.innerText || element.textContent) === targetText);
  if (!target) {{
    return {{
      ok: false,
      available: elements
        .map((element) => normalize(element.innerText || element.textContent))
        .filter(Boolean)
        .slice(0, 80),
    }};
  }}
  target.scrollIntoView({{ block: "center", inline: "center" }});
  target.click();
  return {{ ok: true }};
}})()
"""
    response = evaluate(client, script)
    if not response or not response.get("ok"):
      raise RuntimeError(f"Unable to find button/tab with text {text!r}. Available: {response.get('available') if response else 'n/a'}")


def ensure_guest_mode(client: CDPClient):
    evaluate(
        client,
        """
        (() => {
          sessionStorage.setItem("inventory_is_guest", "true");
          localStorage.removeItem("inventory_refresh_token");
          localStorage.removeItem("inventory_access_token");
          sessionStorage.removeItem("inventory_refresh_token");
          sessionStorage.removeItem("inventory_access_token");
          return true;
        })()
        """,
    )
    client.send("Page.reload", {"ignoreCache": True})
    wait_for_page_ready(client)
    time.sleep(1.5)


def wait_for_app_shell(client: CDPClient, timeout=20):
    deadline = time.time() + timeout
    while time.time() < deadline:
        has_shell = evaluate(
            client,
            """
            (() => Boolean(
              document.querySelector(".app-shell") &&
              document.querySelector(".sidebar-nav-button")
            ))()
            """,
        )
        if has_shell:
            return
        time.sleep(0.25)
    raise RuntimeError("Timed out waiting for application shell.")


def collapse_login_if_present(client: CDPClient):
    has_guest_button = evaluate(
        client,
        """
        (() => [...document.querySelectorAll("button")]
          .some((button) => (button.innerText || "").includes("Continue as Guest")))()
        """,
    )
    if has_guest_button:
        click_by_text(client, "Continue as Guest")
        wait_for_page_ready(client)
        time.sleep(1.5)


def close_existing_overlays(client: CDPClient):
    for label in ["Cancel", "Close", "X", "Back"]:
        try:
            click_by_text(client, label)
            time.sleep(0.4)
        except Exception:
            continue
    evaluate(
        client,
        """
        (() => {
          document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
          document.dispatchEvent(new KeyboardEvent("keyup", { key: "Escape", bubbles: true }));
          return true;
        })()
        """,
    )
    time.sleep(0.4)


def screenshot_visible_page(client: CDPClient, output_path: Path):
    metrics = client.send("Page.getLayoutMetrics")
    viewport = metrics["cssVisualViewport"]
    screenshot = client.send(
        "Page.captureScreenshot",
        {
            "format": "png",
            "fromSurface": True,
            "captureBeyondViewport": False,
            "clip": {
                "x": 0,
                "y": 0,
                "width": viewport["clientWidth"],
                "height": viewport["clientHeight"],
                "scale": 1,
            },
        },
    )
    output_path.write_bytes(base64.b64decode(screenshot["data"]))


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    profile_dir = tempfile.mkdtemp(prefix="blackbook-chrome-", dir="/private/tmp")
    chrome_process = start_headless_chrome(profile_dir)
    try:
        wait_for_devtools()
        ws_url = open_tab(APP_URL)
        client = CDPClient(ws_url)
        try:
            client.send("Page.enable")
            client.send("Runtime.enable")
            client.send(
                "Emulation.setDeviceMetricsOverride",
                {
                    "width": 1600,
                    "height": 1400,
                    "deviceScaleFactor": 1,
                    "mobile": False,
                },
            )
            wait_for_page_ready(client)
            ensure_guest_mode(client)
            wait_for_app_shell(client)

            for item in CAPTURE_PLAN:
                close_existing_overlays(client)
                click_by_text(client, item["tab"])
                wait_for_page_ready(client)
                time.sleep(item["delay"])
                if item["button"]:
                    click_by_text(client, item["button"])
                    wait_for_page_ready(client)
                    time.sleep(item["delay"])
                screenshot_visible_page(client, OUTPUT_DIR / item["name"])
        finally:
            client.close()
    finally:
        chrome_process.terminate()
        try:
            chrome_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            chrome_process.kill()
        shutil.rmtree(profile_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
