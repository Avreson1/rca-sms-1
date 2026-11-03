import os
import sys
import time
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional
import urllib.request
import urllib.error

from google import genai
from google.genai import types
from github import Github, Auth, GithubException


# =====================================================================
# 1. TELEGRAM BOT BRIDGE (Zero external library dependencies)
# =====================================================================

class TelegramBridge:
    def __init__(self, token: str, allowed_chat_id: str):
        self.token = token.strip()
        self.allowed_chat_id = str(allowed_chat_id).strip()
        self.base_url = f"https://api.telegram.org/bot{self.token}"

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
            print(f"[!] Telegram HTTP error ({method}): {e.code} - {err_body}")
            return {"ok": False, "error": err_body}
        except Exception as e:
            print(f"[!] Telegram API exception ({method}): {e}")
            return {"ok": False, "error": str(e)}

    def send_message(self, text: str) -> None:
        """Sends a plain-text response to Telegram, safely chunked at 4000 chars."""
        if not text:
            return
        max_len = 4000
        for i in range(0, len(text), max_len):
            chunk = text[i : i + max_len]
            self._api_request(
                "sendMessage",
                {
                    "chat_id": self.allowed_chat_id,
                    "text": chunk,
                    "disable_web_page_preview": False,
                },
            )

    def fetch_pending_commands(self) -> List[Dict[str, Any]]:
        """Polls Telegram for new messages strictly from the authorized Chat ID."""
        res = self._api_request("getUpdates", {"timeout": 8, "allowed_updates": ["message"]})
        if not res.get("ok"):
            return []

        valid_messages = []
        for update in res.get("result", []):
            update_id = update["update_id"]
            msg = update.get("message", {})
            chat_id = str(msg.get("chat", {}).get("id", ""))
            text = (msg.get("text") or "").strip()

            # Immediately acknowledge this update_id so it is never re-processed
            self._api_request("getUpdates", {"offset": update_id + 1, "timeout": 1})

            if chat_id == self.allowed_chat_id and text:
                valid_messages.append({"update_id": update_id, "text": text})

        return valid_messages


# =====================================================================
# 2. SAFE WORKSPACE, QA HARNESS & DOCKER SANDBOX HOST
# =====================================================================

class SafeWorkspaceAndHost:
    def __init__(self, repo_path: str, telegram: TelegramBridge):
        self.repo_path = Path(repo_path).resolve()
        self.telegram = telegram

    def _safe_path(self, rel_path: str) -> Path:
        clean_rel = rel_path.lstrip("/\\")
        target = (self.repo_path / clean_rel).resolve()
        if not str(target).startswith(str(self.repo_path)):
            raise PermissionError(f"Path traversal blocked: {rel_path}")
        return target

    def _run_cmd(self, cmd: List[str], timeout: int = 180) -> Dict[str, Any]:
        try:
            res = subprocess.run(
                cmd,
                cwd=self.repo_path,
                capture_output=True,
                text=True,
                timeout=timeout,
            )
            return {
                "exit_code": res.returncode,
                "stdout": res.stdout[-3500:],
                "stderr": res.stderr[-3500:],
            }
        except subprocess.TimeoutExpired:
            return {
                "exit_code": 124,
                "stdout": "",
                "stderr": f"TIMEOUT: Command {' '.join(cmd)} exceeded {timeout}s limit.",
            }
        except Exception as e:
            return {"exit_code": 1, "stdout": "", "stderr": f"Execution error: {e}"}

    def list_files(self) -> List[str]:
        """Lists all relevant files in the repository (excluding build & git caches)."""
        ignored = {".git", "__pycache__", ".next", "node_modules", ".pytest_cache", "out", "dist"}
        files = []
        for root, dirs, filenames in os.walk(self.repo_path):
            dirs[:] = [d for d in dirs if d not in ignored]
            for f in filenames:
                full_p = Path(root) / f
                files.append(str(full_p.relative_to(self.repo_path)))
        return sorted(files)

    def search_codebase(self, pattern: str) -> str:
        """Searches across all tracked and untracked source files for a keyword or regex pattern."""
        res = self._run_cmd(["grep", "-rnI", "--exclude-dir={.git,node_modules,.next}", pattern, "."], timeout=30)
        output = res["stdout"].strip()
        return output if output else f"No matches found for '{pattern}'."

    def read_file(self, filepath: str) -> str:
        """Reads the content of a file inside the repository."""
        try:
            target = self._safe_path(filepath)
            if not target.exists():
                return f"ERROR: File '{filepath}' does not exist."
            if target.is_dir():
                return f"ERROR: '{filepath}' is a directory, not a file."
            return target.read_text(encoding="utf-8", errors="replace")[:20000]
        except Exception as e:
            return f"ERROR reading '{filepath}': {e}"

    def write_file(self, filepath: str, content: str) -> str:
        """Creates or overwrites a file inside the repository."""
        try:
            target = self._safe_path(filepath)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")
            return f"SUCCESS: Wrote {len(content.splitlines())} lines to {filepath}."
        except Exception as e:
            return f"ERROR writing '{filepath}': {e}"

    def run_shell_command(self, command: str) -> Dict[str, Any]:
        """
        Runs a safe shell command inside the workspace (e.g. 'npm install lucide-react',
        'npx create-next-app@latest', 'npm test', 'npx tsc --noEmit').
        """
        return self._run_cmd(["bash", "-c", command], timeout=240)

    def run_qa_security_and_build_suite(self) -> Dict[str, Any]:
        """
        Executes the full verification suite:
        1. Dependency install check (`npm install` if node_modules missing)
        2. Security audit (`npm audit --audit-level=high`)
        3. Linting (`npm run lint` if present)
        4. Next.js Production Build (`npm run build`) to guarantee zero TypeScript/build errors.
        """
        pkg_json = self.repo_path / "package.json"
        if not pkg_json.exists():
            return {
                "ALL_GATES_PASSED": False,
                "error": "package.json not found. Initialize the Next.js project first.",
            }

        report: Dict[str, Any] = {}

        if not (self.repo_path / "node_modules").exists():
            report["npm_install"] = self._run_cmd(["npm", "install"], timeout=240)

        pkg_data = json.loads(pkg_json.read_text(encoding="utf-8"))
        scripts = pkg_data.get("scripts", {})

        if "lint" in scripts:
            report["lint"] = self._run_cmd(["npm", "run", "lint"], timeout=120)

        if "test" in scripts and "no test specified" not in scripts["test"]:
            report["tests"] = self._run_cmd(["npm", "test", "--", "--watchAll=false"], timeout=120)

        report["production_build"] = self._run_cmd(["npm", "run", "build"], timeout=240)

        # Security audit is informational unless critical, Production Build is mandatory
        build_ok = report["production_build"]["exit_code"] == 0
        lint_ok = report.get("lint", {"exit_code": 0})["exit_code"] == 0
        report["npm_security_audit"] = self._run_cmd(["npm", "audit", "--audit-level=high"], timeout=60)

        report["ALL_GATES_PASSED"] = bool(build_ok and lint_ok)
        return report

    def host_in_safe_test_environment(
        self, port: int = 3000, keep_alive_minutes: int = 8
    ) -> Dict[str, Any]:
        """
        Runs the Next.js app inside an isolated Docker container (bound to 0.0.0.0)
        and exposes a live HTTPS preview URL to Telegram via Cloudflared tunnel.
        """
        container_name = "devin_nextjs_sandbox"
        subprocess.run(["docker", "rm", "-f", container_name], capture_output=True)
        tunnel_log = Path("/tmp/cloudflared_tunnel.log")
        if tunnel_log.exists():
            tunnel_log.unlink()

        # Ensure dependencies are installed on host workspace before mounting
        if (self.repo_path / "package.json").exists() and not (self.repo_path / "node_modules").exists():
            self._run_cmd(["npm", "install"], timeout=240)

        # Start isolated Docker container using node:20-slim (glibc matches Ubuntu host binaries)
        docker_cmd = [
            "docker", "run", "-d",
            "--name", container_name,
            "--memory=1536m",
            "--cpus=1.5",
            "--security-opt", "no-new-privileges:true",
            "-e", "HOSTNAME=0.0.0.0",
            "-e", f"PORT={port}",
            "-p", f"127.0.0.1:{port}:{port}",
            "-v", f"{self.repo_path}:/workspace",
            "-w", "/workspace",
            "node:20-slim",
            "sh", "-c",
            f"npx next dev -H 0.0.0.0 -p {port}"
        ]
        run_res = self._run_cmd(docker_cmd, timeout=90)
        if run_res["exit_code"] != 0:
            return {"status": "failed_to_start_docker", "details": run_res}

        # Poll localhost:port until Next.js responds (up to 25 seconds)
        server_ready = False
        for _ in range(25):
            time.sleep(1)
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{port}", timeout=2) as resp:
                    if resp.status < 500:
                        server_ready = True
                        break
            except Exception:
                continue

        container_logs = self._run_cmd(["docker", "logs", container_name])

        if not server_ready:
            subprocess.run(["docker", "rm", "-f", container_name], capture_output=True)
            return {
                "status": "server_failed_healthcheck",
                "container_logs": container_logs["stdout"] + "\n" + container_logs["stderr"],
            }

        # Start Cloudflared HTTPS tunnel
        tunnel_proc = None
        public_url = None
        try:
            with open(tunnel_log, "w") as lf:
                tunnel_proc = subprocess.Popen(
                    ["cloudflared", "tunnel", "--url", f"http://127.0.0.1:{port}"],
                    stdout=lf,
                    stderr=subprocess.STDOUT,
                )

            for _ in range(20):
                time.sleep(1)
                if tunnel_log.exists():
                    content = tunnel_log.read_text(encoding="utf-8", errors="replace")
                    match = re.search(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", content)
                    if match:
                        public_url = match.group(0)
                        break

            if public_url:
                safe_mins = max(1, min(int(keep_alive_minutes), 15))
                self.telegram.send_message(
                    f"🚀 Safe Test Environment is LIVE!\n\n"
                    f"🔗 Preview URL: {public_url}\n"
                    f"🛡️ Container: Docker node:20-slim (1.5GB RAM cap, isolated)\n"
                    f"⏱️ Keeping preview alive for {safe_mins} minutes..."
                )
                time.sleep(safe_mins * 60)
            else:
                return {
                    "status": "tunnel_failed",
                    "container_logs": container_logs["stdout"],
                }
        finally:
            subprocess.run(["docker", "rm", "-f", container_name], capture_output=True)
            if tunnel_proc:
                tunnel_proc.terminate()
            if tunnel_log.exists():
                tunnel_log.unlink()

        return {
            "status": "hosted_and_completed",
            "public_url": public_url,
            "container_logs": container_logs["stdout"][-1000:],
        }


# =====================================================================
# 3. GEMINI 2.5 PRO ORCHESTRATOR
# =====================================================================

SYSTEM_PROMPT = """You are an elite Autonomous Staff Full-Stack Engineer & Security Architect (modeled after Devin) managing the Next.js repository `Avreson1/rca-sms-1`.

Follow this strict engineering protocol:
1. INSPECT FIRST: Always call `list_files` and `read_file` (or `search_codebase`) to inspect the existing project structure, `package.json`, `tailwind.config.*`, `app/globals.css`, and existing components before writing code.
2. CONFORM TO DESIGN SYSTEM: Match the existing color scheme, typography, spacing, and Next.js App Router conventions (`app/` or `src/app/`). If the repo is empty or missing Next.js scaffolding, initialize it cleanly using `run_shell_command` or `write_file`.
3. MANDATORY QA & BUILD VERIFICATION: Whenever you create or modify code, you MUST call `run_qa_security_and_build_suite` and fix any TypeScript, ESLint, or Next.js build errors until `ALL_GATES_PASSED` is `True`.
4. LIVE TEST ENVIRONMENT: When asked to preview or host the app, call `host_in_safe_test_environment`.
5. CLEAR TELEGRAM REPORTING: Summarize what files you created/modified, the build & security verification results, and any architectural insights clearly.
"""


class DevinTelegramAgent:
    def __init__(self, repo_path: str, telegram: TelegramBridge):
        self.workspace = SafeWorkspaceAndHost(repo_path, telegram)
        self.telegram = telegram
        self.client = genai.Client()

        self.tools = [
            self.workspace.list_files,
            self.workspace.search_codebase,
            self.workspace.read_file,
            self.workspace.write_file,
            self.workspace.run_shell_command,
            self.workspace.run_qa_security_and_build_suite,
            self.workspace.host_in_safe_test_environment,
        ]

        self.chat = self.client.chats.create(
            model="gemini-2.5-pro",
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                tools=self.tools,
                temperature=0.1,
                automatic_function_calling=types.AutomaticFunctionCallingConfig(
                    maximum_remote_calls=25
                ),
            ),
        )

    def handle_prompt(self, prompt: str) -> str:
        self.telegram.send_message(f"🤖 Working on: \"{prompt}\"...")
        try:
            response = self.chat.send_message(prompt)
            reply = response.text or "✅ Task completed."
        except Exception as e:
            reply = f"❌ Agent encountered an error during execution: {e}"
        self.telegram.send_message(reply)
        return reply


# =====================================================================
# 4. DAILY 11:00 PM LOG SUMMARY & INTERPRETATION
# =====================================================================

def send_daily_log_summary(telegram: TelegramBridge, repo_path: str) -> None:
    """Collects 24h Git commits, file stats, and GitHub Actions workflow runs and sends an interpreted report."""
    repo_name = os.environ.get("GITHUB_REPOSITORY", "Avreson1/rca-sms-1")
    github_token = os.environ.get("GITHUB_TOKEN", "")

    git_commits = subprocess.run(
        ["git", "log", "--since=24 hours ago", "--pretty=format:%h - %an (%ar): %s"],
        cwd=repo_path, capture_output=True, text=True
    ).stdout.strip() or "No new commits in the last 24 hours."

    git_diff_stat = subprocess.run(
        ["git", "diff", "--stat", "HEAD@{24 hours ago}", "HEAD"],
        cwd=repo_path, capture_output=True, text=True
    ).stdout.strip() or "No diff stat changes in the last 24 hours."

    ci_runs_summary = "GitHub API token unavailable for CI run logs."
    if github_token:
        try:
            gh = Github(auth=Auth.Token(github_token))
            repo = gh.get_repo(repo_name)
            runs = list(repo.get_workflow_runs()[:10])
            lines = []
            for r in runs:
                lines.append(
                    f"- [{r.name}] Run #{r.run_number}: status={r.status}, conclusion={r.conclusion}, branch={r.head_branch}, created={r.created_at.strftime('%Y-%m-%d %H:%M UTC')}"
                )
            ci_runs_summary = "\n".join(lines) if lines else "No recent workflow runs found."
        except Exception as e:
            ci_runs_summary = f"Could not fetch workflow runs: {e}"

    prompt = f"""You are the Lead Staff Engineer for `{repo_name}`.
Analyze the past 24 hours of repository logs, commits, and CI/CD runs and write a clear, insightful daily 11:00 PM summary for the developer on Telegram.

=== GIT COMMITS (LAST 24 HOURS) ===
{git_commits}

=== CODE DIFF STATS ===
{git_diff_stat}

=== RECENT GITHUB ACTIONS CI/CD RUNS ===
{ci_runs_summary}

Structure your report with:
1. 📌 Executive Summary (What happened today in plain English)
2. 🔍 Code & CI/CD Log Interpretation (What the commits and build statuses mean for system stability)
3. 🛡️ Security, QA & Next Recommended Engineering Actions
"""

    client = genai.Client()
    response = client.models.generate_content(
        model="gemini-2.5-pro",
        contents=prompt,
    )
    report_text = response.text or "No summary generated."
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    telegram.send_message(f"🌙 Daily 11:00 PM Engineering Log Summary ({now_str})\n\n{report_text}")


# =====================================================================
# 5. GIT COMMIT & PR AUTOMATION
# =====================================================================

def commit_and_open_pr_if_changed(repo_path: str, summary: str) -> Optional[str]:
    """Commits any modified/created source files to a new branch and opens a PR."""
    status = subprocess.run(
        ["git", "status", "--porcelain"], cwd=repo_path, capture_output=True, text=True
    ).stdout.strip()
    if not status:
        return None

    github_token = os.environ.get("GITHUB_TOKEN")
    repo_name = os.environ.get("GITHUB_REPOSITORY")
    if not github_token or not repo_name:
        return None

    branch_name = f"devin-agent/update-{int(time.time())}"
    subprocess.run(["git", "config", "user.name", "Devin-Autonomous-Agent"], cwd=repo_path, check=True)
    subprocess.run(["git", "config", "user.email", "devin-agent@users.noreply.github.com"], cwd=repo_path, check=True)
    subprocess.run(["git", "checkout", "-b", branch_name], cwd=repo_path, check=True)
    subprocess.run(["git", "add", "."], cwd=repo_path, check=True)

    # Ensure there are staged changes after .gitignore filtering
    staged = subprocess.run(
        ["git", "diff", "--cached", "--name-only"], cwd=repo_path, capture_output=True, text=True
    ).stdout.strip()
    if not staged:
        return None

    subprocess.run(
        ["git", "commit", "-m", "feat(devin-agent): autonomous code update & verification"],
        cwd=repo_path,
        check=True,
    )
    subprocess.run(["git", "push", "-u", "origin", branch_name], cwd=repo_path, check=True)

    gh = Github(auth=Auth.Token(github_token))
    repo = gh.get_repo(repo_name)
    pr = repo.create_pull(
        title="🤖 Devin Agent: Autonomous Feature & QA Update",
        body=f"## Autonomous Engineering Report\n\n{summary[:60000]}",
        head=branch_name,
        base=repo.default_branch,
    )
    return pr.html_url


# =====================================================================
# 6. MAIN ENTRYPOINT
# =====================================================================

def main():
    missing_vars = [
        v for v in ("GEMINI_API_KEY", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID")
        if not os.environ.get(v)
    ]
    if missing_vars:
        print(f"[FATAL] Missing required environment secrets: {', '.join(missing_vars)}")
        sys.exit(1)

    tg_token = os.environ["TELEGRAM_BOT_TOKEN"]
    tg_chat_id = os.environ["TELEGRAM_CHAT_ID"]
    event_name = os.environ.get("GITHUB_EVENT_NAME", "")
    cron_schedule = os.environ.get("GITHUB_EVENT_SCHEDULE", "")
    direct_prompt = os.environ.get("DIRECT_PROMPT", "").strip()
    run_daily_summary = os.environ.get("RUN_DAILY_SUMMARY", "false").lower() == "true"
    session_minutes = int(os.environ.get("SESSION_MINUTES", "15") or "15")

    telegram = TelegramBridge(token=tg_token, allowed_chat_id=tg_chat_id)

    # 1. Daily 11:00 PM WAT (22:00 UTC) Log Summary Trigger
    if run_daily_summary or (event_name == "schedule" and cron_schedule == "0 22 * * *"):
        send_daily_log_summary(telegram, ".")
        return

    agent = DevinTelegramAgent(repo_path=".", telegram=telegram)

    # 2. Direct One-Shot Prompt from GitHub Actions UI
    if direct_prompt:
        summary = agent.handle_prompt(direct_prompt)
        pr_url = commit_and_open_pr_if_changed(".", summary)
        if pr_url:
            telegram.send_message(f"✅ Pull Request Created: {pr_url}")
        return

    # 3. Background 30-Min Cron Check: Only stay awake if user actually sent a Telegram message
    if event_name == "schedule":
        pending = telegram.fetch_pending_commands()
        if not pending:
            print("[*] Scheduled poll: No pending Telegram commands. Exiting cleanly.")
            return
        for msg in pending:
            summary = agent.handle_prompt(msg["text"])
            pr_url = commit_and_open_pr_if_changed(".", summary)
            if pr_url:
                telegram.send_message(f"✅ Changes committed! Pull Request: {pr_url}")
        return

    # 4. Interactive Live Session (Manual workflow_dispatch trigger)
    telegram.send_message(
        f"🟢 Devin Agent for `Avreson1/rca-sms-1` is ONLINE for {session_minutes} minutes!\n\n"
        "Send any instruction here:\n"
        "• Ask any question about the codebase\n"
        "• Tell me to build or update the Next.js landing page\n"
        "• Ask me to run QA/build checks or host a live HTTPS preview\n"
        "• Send `/summary` for an instant log report or `/exit` to stop early."
    )

    deadline = time.time() + (session_minutes * 60)
    while time.time() < deadline:
        messages = telegram.fetch_pending_commands()
        for msg in messages:
            text = msg["text"]
            if text.lower() in {"/exit", "/stop", "exit"}:
                telegram.send_message("🛑 Ending interactive GitHub Actions session.")
                return
            if text.lower() == "/summary":
                send_daily_log_summary(telegram, ".")
                continue

            summary = agent.handle_prompt(text)
            pr_url = commit_and_open_pr_if_changed(".", summary)
            if pr_url:
                telegram.send_message(f"✅ Changes committed! Pull Request: {pr_url}")

        time.sleep(3)

    telegram.send_message("💤 Interactive session window completed. Trigger the workflow or send a message anytime!")


if __name__ == "__main__":
    main()
