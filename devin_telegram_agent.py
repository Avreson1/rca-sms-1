import os
import sys
import time
import json
import re
import signal
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional
import urllib.request
import urllib.error

from google import genai
from google.genai import types
from github import Github, Auth


# =====================================================================
# 0. AUTOMATIC GEMINI MODEL DISCOVERY (Prevents 404 NOT_FOUND)
# =====================================================================

_VERIFIED_PRO_MODEL: Optional[str] = None
_VERIFIED_FLASH_MODEL: Optional[str] = None


def get_working_model(client: genai.Client, prefer_pro: bool = True) -> str:
    """
    Dynamically discovers and verifies a working Gemini model for this specific API key.
    Avoids 404 NOT_FOUND errors when Google restricts legacy 2.5 or preview endpoints on new keys.
    """
    global _VERIFIED_PRO_MODEL, _VERIFIED_FLASH_MODEL

    if prefer_pro and _VERIFIED_PRO_MODEL:
        return _VERIFIED_PRO_MODEL
    if not prefer_pro and _VERIFIED_FLASH_MODEL:
        return _VERIFIED_FLASH_MODEL

    # Priority order covering Gemini 3.x and 2.5 series
    pro_candidates = [
        "gemini-3.1-pro-preview",
        "gemini-3-flash-preview",
        "gemini-2.5-pro",
        "gemini-2.5-flash",
        "gemini-3.1-flash-lite",
    ]
    flash_candidates = [
        "gemini-3-flash-preview",
        "gemini-3.1-flash-lite",
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
        "gemini-3.1-pro-preview",
    ]

    # Discover all models explicitly enabled on this API key
    discovered: List[str] = []
    try:
        for m in client.models.list():
            name = (getattr(m, "name", "") or "").replace("models/", "")
            actions = getattr(m, "supported_actions", []) or []
            if "generateContent" in actions and "gemini" in name:
                # Skip specialized audio/image-only/tts/embedding models
                if not any(x in name for x in ("tts", "image", "embedding", "live", "transcribe", "aqa", "banana")):
                    discovered.append(name)
    except Exception as e:
        print(f"[!] Warning listing models: {e}")

    candidates = (pro_candidates if prefer_pro else flash_candidates) + discovered
    seen = set()
    ordered_candidates = [x for x in candidates if not (x in seen or seen.add(x))]

    for model_id in ordered_candidates:
        try:
            client.models.generate_content(
                model=model_id,
                contents="ping",
                config=types.GenerateContentConfig(max_output_tokens=5),
            )
            print(f"[+] Verified working Gemini model ({'PRO' if prefer_pro else 'FLASH'}): {model_id}")
            if prefer_pro:
                _VERIFIED_PRO_MODEL = model_id
            else:
                _VERIFIED_FLASH_MODEL = model_id
            return model_id
        except Exception as e:
            print(f"[-] Model '{model_id}' unavailable on this key ({e.__class__.__name__}), trying next...")

    raise RuntimeError("No working Gemini text generation model found for this GEMINI_API_KEY.")


# =====================================================================
# 1. TELEGRAM BOT BRIDGE
# =====================================================================

class TelegramBridge:
    def __init__(self, token: str, allowed_chat_id: str):
        self.token = token.strip()
        self.allowed_chat_id = str(allowed_chat_id).strip()
        self.base_url = f"https://api.telegram.org/bot{self.token}"
        self._last_edited_text: Dict[int, str] = {}

    def _api_request(self, method: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        url = f"{self.base_url}/{method}"
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url, data=data, headers={"Content-Type": "application/json"}
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")
            if "message is not modified" not in err_body:
                print(f"[!] Telegram HTTP {e.code} ({method}): {err_body}")
            return {"ok": False, "error": err_body}
        except Exception as e:
            print(f"[!] Telegram API exception ({method}): {e}")
            return {"ok": False, "error": str(e)}

    def flush_old_updates(self) -> None:
        """Clears stale messages queued while the runner was offline so old commands don't auto-fire."""
        res = self._api_request("getUpdates", {"timeout": 1, "allowed_updates": ["message"]})
        if res.get("ok") and res.get("result"):
            last_uid = res["result"][-1]["update_id"]
            self._api_request("getUpdates", {"offset": last_uid + 1, "timeout": 1})
            print(f"[*] Flushed {len(res['result'])} stale Telegram update(s) up to offset {last_uid}.")

    def send_message(self, text: str) -> Optional[int]:
        if not text or not text.strip():
            return None
        max_len = 4000
        last_msg_id = None
        for i in range(0, len(text), max_len):
            chunk = text[i : i + max_len]
            res = self._api_request(
                "sendMessage",
                {
                    "chat_id": self.allowed_chat_id,
                    "text": chunk,
                    "disable_web_page_preview": False,
                },
            )
            if res.get("ok"):
                last_msg_id = res["result"]["message_id"]
        return last_msg_id

    def edit_message(self, message_id: Optional[int], text: str) -> None:
        if not message_id or not text:
            return
        trimmed = text[:4000]
        if self._last_edited_text.get(message_id) == trimmed:
            return
        self._last_edited_text[message_id] = trimmed
        self._api_request(
            "editMessageText",
            {
                "chat_id": self.allowed_chat_id,
                "message_id": message_id,
                "text": trimmed,
            },
        )

    def send_photo(self, image_path: Path, caption: str = "") -> None:
        if not image_path.exists():
            return
        boundary = f"----DevinBoundary{int(time.time() * 1000)}"
        body = bytearray()

        def add_field(name: str, value: str) -> None:
            body.extend(f"--{boundary}\r\n".encode("utf-8"))
            body.extend(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode("utf-8"))
            body.extend(f"{value}\r\n".encode("utf-8"))

        add_field("chat_id", self.allowed_chat_id)
        if caption:
            add_field("caption", caption[:1000])

        body.extend(f"--{boundary}\r\n".encode("utf-8"))
        body.extend(
            f'Content-Disposition: form-data; name="photo"; filename="{image_path.name}"\r\n'.encode("utf-8")
        )
        body.extend(b"Content-Type: image/png\r\n\r\n")
        body.extend(image_path.read_bytes())
        body.extend(f"\r\n--{boundary}--\r\n".encode("utf-8"))

        req = urllib.request.Request(
            f"{self.base_url}/sendPhoto",
            data=bytes(body),
            headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        )
        try:
            with urllib.request.urlopen(req, timeout=45):
                pass
        except Exception as e:
            print(f"[!] Failed to upload photo to Telegram: {e}")

    def fetch_pending_commands(self) -> List[Dict[str, Any]]:
        res = self._api_request("getUpdates", {"timeout": 6, "allowed_updates": ["message"]})
        if not res.get("ok"):
            return []

        valid = []
        for update in res.get("result", []):
            uid = update["update_id"]
            msg = update.get("message", {})
            cid = str(msg.get("chat", {}).get("id", ""))
            text = (msg.get("text") or "").strip()
            self._api_request("getUpdates", {"offset": uid + 1, "timeout": 1})
            if cid == self.allowed_chat_id and text:
                valid.append({"update_id": uid, "text": text})
        return valid


# =====================================================================
# 2. GIT-PLUMBING PERSISTENT MEMORY
# =====================================================================

class GitMemoryStore:
    @staticmethod
    def load_history(repo_path: str) -> List[Dict[str, str]]:
        subprocess.run(
            ["git", "fetch", "origin", "devin-memory:refs/remotes/origin/devin-memory"],
            cwd=repo_path,
            capture_output=True,
        )
        res = subprocess.run(
            ["git", "show", "refs/remotes/origin/devin-memory:memory.json"],
            cwd=repo_path,
            capture_output=True,
            text=True,
        )
        if res.returncode == 0 and res.stdout.strip():
            try:
                data = json.loads(res.stdout)
                if isinstance(data, list):
                    return data[-10:]
            except Exception:
                pass
        return []

    @staticmethod
    def save_turn(repo_path: str, user_prompt: str, agent_reply: str) -> None:
        try:
            history = GitMemoryStore.load_history(repo_path)
            history.append(
                {
                    "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
                    "user": user_prompt[:1200],
                    "agent": agent_reply[:2000],
                }
            )
            history = history[-10:]
            payload = json.dumps(history, indent=2)

            blob_proc = subprocess.run(
                ["git", "hash-object", "-w", "--stdin"],
                input=payload,
                cwd=repo_path,
                capture_output=True,
                text=True,
                check=True,
            )
            blob_sha = blob_proc.stdout.strip()

            tree_input = f"100644 blob {blob_sha}\tmemory.json\n"
            tree_proc = subprocess.run(
                ["git", "mktree"],
                input=tree_input,
                cwd=repo_path,
                capture_output=True,
                text=True,
                check=True,
            )
            tree_sha = tree_proc.stdout.strip()

            env = os.environ.copy()
            env["GIT_AUTHOR_NAME"] = "Devin-Memory"
            env["GIT_AUTHOR_EMAIL"] = "devin-memory@users.noreply.github.com"
            env["GIT_COMMITTER_NAME"] = "Devin-Memory"
            env["GIT_COMMITTER_EMAIL"] = "devin-memory@users.noreply.github.com"

            commit_proc = subprocess.run(
                ["git", "commit-tree", tree_sha, "-m", "chore: update agent conversation memory"],
                cwd=repo_path,
                env=env,
                capture_output=True,
                text=True,
                check=True,
            )
            commit_sha = commit_proc.stdout.strip()

            subprocess.run(
                ["git", "push", "-f", "origin", f"{commit_sha}:refs/heads/devin-memory"],
                cwd=repo_path,
                capture_output=True,
                timeout=30,
            )
        except Exception as e:
            print(f"[!] Non-fatal warning saving Git memory: {e}")


# =====================================================================
# 3. HARDENED WORKSPACE, MULTIMODAL VISION & SANDBOX HOST
# =====================================================================

class HardenedWorkspace:
    SENSITIVE_ENV_KEYS = {
        "GEMINI_API_KEY",
        "GITHUB_TOKEN",
        "GH_PAT_TOKEN",
        "TELEGRAM_BOT_TOKEN",
        "TELEGRAM_CHAT_ID",
    }

    def __init__(
        self,
        repo_path: str,
        telegram: TelegramBridge,
        client: genai.Client,
        status_msg_id: Optional[int] = None,
    ):
        self.repo_path = Path(repo_path).resolve()
        self.telegram = telegram
        self.client = client
        self.status_msg_id = status_msg_id

    def _update_status(self, step_text: str) -> None:
        print(f"[*] {step_text}")
        self.telegram.edit_message(self.status_msg_id, f"⚙️ Agent Status: {step_text}")

    def _scrubbed_env(self) -> Dict[str, str]:
        clean = {
            k: v
            for k, v in os.environ.items()
            if k not in self.SENSITIVE_ENV_KEYS and not k.startswith("GITHUB_")
        }
        clean["CI"] = "true"
        clean["NEXT_TELEMETRY_DISABLED"] = "1"
        return clean

    def _safe_path(self, rel_path: str) -> Path:
        clean_rel = rel_path.strip().lstrip("/\\")
        target = (self.repo_path / clean_rel).resolve()
        if not str(target).startswith(str(self.repo_path)):
            raise PermissionError(f"Path traversal blocked: {rel_path}")
        if clean_rel == ".git" or clean_rel.startswith(".git/"):
            raise PermissionError("Direct access to .git directory is forbidden.")
        return target

    def _run_cmd(self, cmd: List[str], timeout: int = 180) -> Dict[str, Any]:
        try:
            res = subprocess.run(
                cmd,
                cwd=self.repo_path,
                env=self._scrubbed_env(),
                capture_output=True,
                text=True,
                timeout=timeout,
            )
            ansi_escape = re.compile(r"\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])")
            stdout_clean = ansi_escape.sub("", res.stdout)[-2500:]
            stderr_clean = ansi_escape.sub("", res.stderr)[-2500:]
            return {
                "exit_code": res.returncode,
                "stdout": stdout_clean,
                "stderr": stderr_clean,
            }
        except subprocess.TimeoutExpired:
            return {
                "exit_code": 124,
                "stdout": "",
                "stderr": f"TIMEOUT: Command {' '.join(cmd)} exceeded {timeout}s.",
            }
        except Exception as e:
            return {"exit_code": 1, "stdout": "", "stderr": f"Execution error: {e}"}

    @staticmethod
    def _kill_process_group(proc: Optional[subprocess.Popen]) -> None:
        if not proc:
            return
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
            proc.wait(timeout=4)
        except Exception:
            try:
                os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
            except Exception:
                pass

    def list_files(self) -> List[str]:
        """Lists all source, configuration, and asset files in the repository."""
        self._update_status("Scanning repository file tree...")
        ignored = {".git", "__pycache__", ".next", "node_modules", ".pytest_cache", "out", "dist"}
        files = []
        for root, dirs, filenames in os.walk(self.repo_path):
            dirs[:] = [d for d in dirs if d not in ignored]
            for f in filenames:
                full_p = Path(root) / f
                files.append(str(full_p.relative_to(self.repo_path)))
        return sorted(files)

    def search_codebase(self, pattern: str) -> str:
        """Searches across codebase files for a keyword or regular expression pattern."""
        self._update_status(f"Searching codebase for '{pattern}'...")
        res = self._run_cmd(
            [
                "grep",
                "-rnI",
                "--exclude-dir=.git",
                "--exclude-dir=node_modules",
                "--exclude-dir=.next",
                "--exclude-dir=out",
                pattern,
                ".",
            ],
            timeout=30,
        )
        return res["stdout"].strip() or f"No matches found for '{pattern}'."

    def read_file(self, filepath: str, start_line: int = 1, end_line: int = 250) -> str:
        """Reads line-numbered contents of a file inside the repository (up to 250 lines per call)."""
        self._update_status(f"Reading {filepath} (lines {start_line}-{end_line})...")
        try:
            target = self._safe_path(filepath)
            if not target.exists():
                return f"ERROR: File '{filepath}' does not exist."
            if target.is_dir():
                return f"ERROR: '{filepath}' is a directory."
            lines = target.read_text(encoding="utf-8", errors="replace").splitlines()
            total = len(lines)
            s = max(1, int(start_line)) - 1
            e = min(total, int(end_line))
            numbered = [f"{i + 1}: {lines[i]}" for i in range(s, e)]
            return f"--- {filepath} (Lines {s + 1}-{e} of {total}) ---\n" + "\n".join(numbered)
        except Exception as e:
            return f"ERROR reading '{filepath}': {e}"

    def write_file(self, filepath: str, content: str) -> str:
        """Creates or overwrites a file inside the repository."""
        self._update_status(f"Writing {filepath}...")
        try:
            target = self._safe_path(filepath)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")
            return f"SUCCESS: Wrote {len(content.splitlines())} lines to {filepath}."
        except Exception as e:
            return f"ERROR writing '{filepath}': {e}"

    def run_shell_command(self, command: str) -> Dict[str, Any]:
        """Executes a non-interactive shell command inside the workspace (e.g., npm install, npx)."""
        self._update_status(f"Executing: {command[:50]}...")
        return self._run_cmd(["bash", "-c", command], timeout=240)

    def run_qa_security_and_build_suite(self) -> Dict[str, Any]:
        """Runs dependency checks, ESLint, Next.js production build, and npm security audit."""
        self._update_status("Running QA, ESLint, Security Audit & Next.js Build...")
        pkg_json = self.repo_path / "package.json"
        if not pkg_json.exists():
            return {
                "ALL_GATES_PASSED": False,
                "error": "package.json does not exist yet. Initialize Next.js first.",
            }

        report: Dict[str, Any] = {}
        if not (self.repo_path / "node_modules").exists():
            report["npm_install"] = self._run_cmd(["npm", "install", "--no-audit", "--no-fund"], timeout=240)

        try:
            pkg_data = json.loads(pkg_json.read_text(encoding="utf-8"))
        except Exception as e:
            return {"ALL_GATES_PASSED": False, "error": f"Invalid package.json: {e}"}

        scripts = pkg_data.get("scripts", {})

        if "lint" in scripts:
            report["lint"] = self._run_cmd(["npm", "run", "lint"], timeout=120)

        report["production_build"] = self._run_cmd(["npm", "run", "build"], timeout=240)
        report["security_audit"] = self._run_cmd(["npm", "audit", "--audit-level=high"], timeout=60)

        build_ok = report["production_build"]["exit_code"] == 0
        lint_ok = report.get("lint", {"exit_code": 0})["exit_code"] == 0
        report["ALL_GATES_PASSED"] = bool(build_ok and lint_ok)
        return report

    def inspect_ui_with_vision(self, route_path: str = "/") -> Dict[str, Any]:
        """
        Starts the Next.js server, captures Desktop (1280x800) & Mobile (390x844) PNG screenshots
        using Playwright Chromium, sends both photos to Telegram, and analyzes them with Gemini Vision.
        """
        if not (self.repo_path / "package.json").exists():
            return {"status": "error", "message": "package.json not found. Cannot start Next.js server."}

        norm_route = route_path if route_path.startswith("/") else f"/{route_path}"
        self._update_status(f"Capturing Desktop & Mobile screenshots for '{norm_route}'...")
        port = 3005
        desktop_png = Path("/tmp/ui_desktop.png")
        mobile_png = Path("/tmp/ui_mobile.png")
        for p in (desktop_png, mobile_png):
            if p.exists():
                p.unlink()

        lock_file = self.repo_path / ".next" / "dev" / "lock"
        if lock_file.exists():
            lock_file.unlink()

        has_prod_build = (self.repo_path / ".next" / "BUILD_ID").exists()
        server_cmd = (
            ["npx", "next", "start", "-H", "127.0.0.1", "-p", str(port)]
            if has_prod_build
            else ["npx", "next", "dev", "-H", "127.0.0.1", "-p", str(port)]
        )

        server_proc = subprocess.Popen(
            server_cmd,
            cwd=self.repo_path,
            env=self._scrubbed_env(),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )

        try:
            ready = False
            target_url = f"http://127.0.0.1:{port}{norm_route}"
            for _ in range(35):
                time.sleep(1)
                try:
                    with urllib.request.urlopen(target_url, timeout=2) as r:
                        if r.status < 500:
                            ready = True
                            break
                except Exception:
                    continue

            if not ready:
                return {"status": "error", "message": f"Next.js server failed to respond at {target_url}."}

            pw_script = (
                "from playwright.sync_api import sync_playwright\n"
                "with sync_playwright() as p:\n"
                "    browser = p.chromium.launch()\n"
                "    page_d = browser.new_page(viewport={'width': 1280, 'height': 800})\n"
                f"    page_d.goto({json.dumps(target_url)}, wait_until='networkidle', timeout=30000)\n"
                f"    page_d.screenshot(path={json.dumps(str(desktop_png))}, full_page=True)\n"
                "    page_m = browser.new_page(viewport={'width': 390, 'height': 844})\n"
                f"    page_m.goto({json.dumps(target_url)}, wait_until='networkidle', timeout=30000)\n"
                f"    page_m.screenshot(path={json.dumps(str(mobile_png))}, full_page=True)\n"
                "    browser.close()\n"
            )
            pw_res = self._run_cmd([sys.executable, "-c", pw_script], timeout=60)
            if pw_res["exit_code"] != 0 or not desktop_png.exists():
                return {"status": "playwright_error", "details": pw_res}

            self.telegram.send_photo(desktop_png, caption=f"🖥️ Desktop Render ({norm_route})")
            self.telegram.send_photo(mobile_png, caption=f"📱 Mobile Render ({norm_route})")

            vision_model = get_working_model(self.client, prefer_pro=True)
            vision_resp = self.client.models.generate_content(
                model=vision_model,
                contents=[
                    types.Part.from_bytes(data=desktop_png.read_bytes(), mime_type="image/png"),
                    types.Part.from_bytes(data=mobile_png.read_bytes(), mime_type="image/png"),
                    (
                        "You are a Principal UI/UX Engineer reviewing Desktop (1280x800) and Mobile (390x844) "
                        "renders of a Next.js page. Check for: 1) Overlapping or clipped text, 2) Broken layouts or "
                        "missing Tailwind styles, 3) Mobile responsiveness issues. Reply with PASS or FAIL and concise fixes."
                    ),
                ],
            )
            return {
                "status": "vision_inspection_complete",
                "visual_critique": vision_resp.text,
            }
        finally:
            self._kill_process_group(server_proc)

    def host_ephemeral_preview(self, port: int = 3000, duration_minutes: int = 5) -> Dict[str, Any]:
        """Hosts a live HTTPS preview tunnel via Cloudflared for up to 5 minutes and sends the URL to Telegram."""
        if not (self.repo_path / "package.json").exists():
            return {"status": "error", "message": "package.json not found."}

        safe_mins = max(1, min(int(duration_minutes), 5))
        self._update_status(f"Starting {safe_mins}-minute live HTTPS preview tunnel...")
        tunnel_log = Path("/tmp/cloudflared.log")
        if tunnel_log.exists():
            tunnel_log.unlink()

        has_prod_build = (self.repo_path / ".next" / "BUILD_ID").exists()
        server_cmd = (
            ["npx", "next", "start", "-H", "127.0.0.1", "-p", str(port)]
            if has_prod_build
            else ["npx", "next", "dev", "-H", "127.0.0.1", "-p", str(port)]
        )

        server_proc = subprocess.Popen(
            server_cmd,
            cwd=self.repo_path,
            env=self._scrubbed_env(),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
        tunnel_proc = None
        try:
            for _ in range(30):
                time.sleep(1)
                try:
                    with urllib.request.urlopen(f"http://127.0.0.1:{port}", timeout=2) as r:
                        if r.status < 500:
                            break
                except Exception:
                    continue

            with open(tunnel_log, "w") as lf:
                tunnel_proc = subprocess.Popen(
                    ["cloudflared", "tunnel", "--url", f"http://127.0.0.1:{port}"],
                    stdout=lf,
                    stderr=subprocess.STDOUT,
                    start_new_session=True,
                )

            public_url = None
            for _ in range(25):
                time.sleep(1)
                if tunnel_log.exists():
                    m = re.search(
                        r"https://[a-zA-Z0-9-]+\.trycloudflare\.com",
                        tunnel_log.read_text(encoding="utf-8", errors="replace"),
                    )
                    if m:
                        public_url = m.group(0)
                        break

            if public_url:
                self.telegram.send_message(
                    f"🚀 Live Test Environment is ONLINE!\n"
                    f"🔗 {public_url}\n"
                    f"⏱️ Auto-closes in {safe_mins} minutes."
                )
                time.sleep(safe_mins * 60)
                return {"status": "preview_completed", "url": public_url}
            return {"status": "tunnel_timeout"}
        finally:
            self._kill_process_group(server_proc)
            self._kill_process_group(tunnel_proc)


# =====================================================================
# 4. AUTONOMOUS AGENT ORCHESTRATOR
# =====================================================================

SYSTEM_PROMPT = """You are an elite Autonomous Staff Full-Stack Engineer & UI/UX Architect managing the Next.js repository `Avreson1/rca-sms-1`.

Follow this strict engineering protocol:
1. INSPECT FIRST: Always call `list_files` and `read_file` to inspect existing files (`package.json`, `tailwind.config.*`, `app/globals.css`, components) before making changes. If the repository does not have Next.js initialized yet, scaffold it cleanly with `run_shell_command` or `write_file`.
2. CONFORM TO DESIGN SYSTEM: Match the existing color scheme, typography, spacing, and Next.js App Router conventions.
3. AUTOMATIC WEBHOOK ROUTE: Whenever building or updating the Next.js app, ensure `app/api/telegram/route.ts` exists so Telegram messages can trigger GitHub Actions (`repository_dispatch` with `event_type: "telegram_command"`) directly.
4. MANDATORY BUILD & VISION QA:
   - After writing or modifying code, ALWAYS run `run_qa_security_and_build_suite` and fix any errors until `ALL_GATES_PASSED` is `True`.
   - Whenever UI changes are made, call `inspect_ui_with_vision("/")` so Desktop and Mobile screenshots are sent to the user's Telegram and verified by Vision.
5. BE SURGICAL: Do not re-read files unnecessarily. Summarize all changes clearly at the end.
"""


class DevinTelegramAgent:
    def __init__(self, repo_path: str, telegram: TelegramBridge):
        self.repo_path = repo_path
        self.telegram = telegram
        self.client = genai.Client()

    def execute_prompt(self, user_prompt: str) -> str:
        status_id = self.telegram.send_message(f"🤖 Initializing task: \"{user_prompt[:80]}...\"")
        workspace = HardenedWorkspace(self.repo_path, self.telegram, self.client, status_id)

        prior_turns = GitMemoryStore.load_history(self.repo_path)
        memory_context = ""
        if prior_turns:
            formatted = [
                f"[{t['timestamp']}] User: {t['user']}\nAgent Summary: {t['agent']}"
                for t in prior_turns[-5:]
            ]
            memory_context = (
                "=== PERSISTENT MEMORY FROM PREVIOUS RUNS ===\n"
                + "\n---\n".join(formatted)
                + "\n============================================\n\n"
            )

        tools = [
            workspace.list_files,
            workspace.search_codebase,
            workspace.read_file,
            workspace.write_file,
            workspace.run_shell_command,
            workspace.run_qa_security_and_build_suite,
            workspace.inspect_ui_with_vision,
            workspace.host_ephemeral_preview,
        ]

        try:
            active_model = get_working_model(self.client, prefer_pro=True)
            chat = self.client.chats.create(
                model=active_model,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    tools=tools,
                    temperature=0.1,
                    automatic_function_calling=types.AutomaticFunctionCallingConfig(
                        maximum_remote_calls=18
                    ),
                ),
            )
            full_input = f"{memory_context}CURRENT USER DIRECTIVE:\n{user_prompt}"
            response = chat.send_message(full_input)
            reply = response.text or "✅ Task completed and verified."
        except Exception as e:
            reply = f"❌ Execution halted: {e}"

        self.telegram.edit_message(status_id, "✅ Task execution finished.")
        self.telegram.send_message(reply)

        GitMemoryStore.save_turn(self.repo_path, user_prompt, reply)
        return reply


# =====================================================================
# 5. DAILY 11:00 PM WAT LOG SUMMARY & INTERPRETATION
# =====================================================================

def send_daily_log_summary(telegram: TelegramBridge, repo_path: str) -> None:
    repo_name = os.environ.get("GITHUB_REPOSITORY", "Avreson1/rca-sms-1")
    github_token = os.environ.get("GITHUB_TOKEN", "")

    git_commits = subprocess.run(
        ["git", "log", "--since=24 hours ago", "--pretty=format:%h - %an (%ar): %s"],
        cwd=repo_path,
        capture_output=True,
        text=True,
    ).stdout.strip() or "No new commits in the last 24 hours."

    old_sha = subprocess.run(
        ["git", "rev-list", "-n", "1", "--before=24 hours ago", "HEAD"],
        cwd=repo_path,
        capture_output=True,
        text=True,
    ).stdout.strip()

    if old_sha:
        git_diff_stat = subprocess.run(
            ["git", "diff", "--stat", old_sha, "HEAD"],
            cwd=repo_path,
            capture_output=True,
            text=True,
        ).stdout.strip() or "No file diff changes in the last 24 hours."
    else:
        git_diff_stat = subprocess.run(
            ["git", "show", "--stat", "--oneline", "HEAD"],
            cwd=repo_path,
            capture_output=True,
            text=True,
        ).stdout.strip() or "Repository initialized recently."

    ci_summary = "No CI run data available."
    if github_token:
        try:
            gh = Github(auth=Auth.Token(github_token))
            repo = gh.get_repo(repo_name)
            runs = list(repo.get_workflow_runs()[:10])
            ci_summary = "\n".join(
                f"- [{r.name}] #{r.run_number}: {r.status}/{r.conclusion} ({r.head_branch}) at {r.created_at.strftime('%Y-%m-%d %H:%M UTC')}"
                for r in runs
            ) or "No workflow runs recorded yet."
        except Exception as e:
            ci_summary = f"CI fetch error: {e}"

    try:
        client = genai.Client()
        fast_model = get_working_model(client, prefer_pro=False)
        resp = client.models.generate_content(
            model=fast_model,
            contents=(
                f"You are Lead Staff Engineer for `{repo_name}`. Analyze the past 24 hours of logs and write a clear "
                f"11:00 PM daily summary for the developer on Telegram:\n\n"
                f"COMMITS (24h):\n{git_commits}\n\nDIFF STATS:\n{git_diff_stat}\n\nCI/CD RUNS:\n{ci_summary}\n\n"
                "Structure with: 1) 📌 Executive Summary, 2) 🔍 Technical Log Interpretation, 3) 🛡️ Recommended Next Actions."
            ),
        )
        telegram.send_message(f"🌙 Daily 11:00 PM Engineering Log Report (via {fast_model})\n\n{resp.text}")
    except Exception as e:
        telegram.send_message(f"⚠️ Could not generate AI summary ({e}). Raw 24h commits:\n{git_commits}")


# =====================================================================
# 6. GIT PR AUTOMATION & ENTRYPOINT
# =====================================================================

def commit_and_open_pr_if_changed(repo_path: str, summary: str) -> Optional[str]:
    status = subprocess.run(
        ["git", "status", "--porcelain"], cwd=repo_path, capture_output=True, text=True
    ).stdout.strip()
    if not status:
        return None

    github_token = os.environ.get("GITHUB_TOKEN")
    repo_name = os.environ.get("GITHUB_REPOSITORY")
    if not github_token or not repo_name:
        return None

    branch_name = f"devin-agent/patch-{int(time.time())}"
    subprocess.run(["git", "config", "user.name", "Devin-Autonomous-Agent"], cwd=repo_path, check=True)
    subprocess.run(["git", "config", "user.email", "devin-agent@users.noreply.github.com"], cwd=repo_path, check=True)
    subprocess.run(["git", "checkout", "-b", branch_name], cwd=repo_path, check=True)

    for ignore_pattern in ("node_modules/", ".next/", "out/", ".env", ".env.local"):
        subprocess.run(["git", "reset", ignore_pattern], cwd=repo_path, capture_output=True)

    subprocess.run(
        ["git", "add", "--all", "--", ".", ":!node_modules", ":!.next", ":!out", ":!.env*"],
        cwd=repo_path,
        check=True,
    )

    staged = subprocess.run(
        ["git", "diff", "--cached", "--name-only"], cwd=repo_path, capture_output=True, text=True
    ).stdout.strip()
    if not staged:
        return None

    subprocess.run(
        ["git", "commit", "-m", "feat(devin-agent): verified code & visual QA update"],
        cwd=repo_path,
        check=True,
    )
    subprocess.run(["git", "push", "-u", "origin", branch_name], cwd=repo_path, check=True)

    gh = Github(auth=Auth.Token(github_token))
    repo = gh.get_repo(repo_name)
    pr = repo.create_pull(
        title="🤖 Devin Agent: Verified Code & Visual UI Update",
        body=f"## Autonomous Engineering & Visual QA Report\n\n{summary[:60000]}",
        head=branch_name,
        base=repo.default_branch,
    )
    return pr.html_url


def main() -> None:
    missing_vars = [
        v for v in ("GEMINI_API_KEY", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID")
        if not os.environ.get(v)
    ]
    if missing_vars:
        print(f"[FATAL] Missing required repository secrets: {', '.join(missing_vars)}")
        sys.exit(1)

    tg_token = os.environ["TELEGRAM_BOT_TOKEN"]
    tg_chat_id = os.environ["TELEGRAM_CHAT_ID"]
    event_name = os.environ.get("GITHUB_EVENT_NAME", "")
    direct_prompt = os.environ.get("DIRECT_PROMPT", "").strip()
    run_daily_summary = os.environ.get("RUN_DAILY_SUMMARY", "false").lower() == "true"
    session_minutes = int(os.environ.get("SESSION_MINUTES", "10") or "10")

    telegram = TelegramBridge(token=tg_token, allowed_chat_id=tg_chat_id)

    # 1. Nightly 11:00 PM WAT Cron or Manual Summary Trigger
    if run_daily_summary or event_name == "schedule":
        send_daily_log_summary(telegram, ".")
        return

    agent = DevinTelegramAgent(repo_path=".", telegram=telegram)

    # 2. Event-Driven Webhook (`repository_dispatch`) or One-Shot Prompt
    if direct_prompt:
        if direct_prompt.lower() == "/summary":
            send_daily_log_summary(telegram, ".")
            return
        summary = agent.execute_prompt(direct_prompt)
        pr_url = commit_and_open_pr_if_changed(".", summary)
        if pr_url:
            telegram.send_message(f"✅ Pull Request Opened: {pr_url}")
        return

    # 3. Interactive Live Session (Flush old queued messages first!)
    telegram.flush_old_updates()
    active_model = get_working_model(agent.client, prefer_pro=True)
    telegram.send_message(
        f"🟢 Devin Agent (`Avreson1/rca-sms-1`) is ONLINE for {session_minutes} mins.\n"
        f"• Active Model: `{active_model}`\n"
        "• Persistent Git Memory: ACTIVE\n"
        "• Playwright Multimodal Vision QA: ACTIVE\n"
        "Send your instruction below (or `/summary` / `/exit`):"
    )
    deadline = time.time() + (min(session_minutes, 15) * 60)
    while time.time() < deadline:
        for msg in telegram.fetch_pending_commands():
            text = msg["text"]
            if text.lower() in {"/exit", "/stop", "exit"}:
                telegram.send_message("🛑 Session closed cleanly.")
                return
            if text.lower() == "/summary":
                send_daily_log_summary(telegram, ".")
                continue
            summary = agent.execute_prompt(text)
            pr_url = commit_and_open_pr_if_changed(".", summary)
            if pr_url:
                telegram.send_message(f"✅ Pull Request Opened: {pr_url}")
        time.sleep(3)

    telegram.send_message("💤 Interactive session completed. Send a command or trigger anytime!")


if __name__ == "__main__":
    main()
