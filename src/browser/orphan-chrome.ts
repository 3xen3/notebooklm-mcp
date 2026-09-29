/**
 * Kill Chrome processes left behind by a previous server run.
 *
 * When the MCP client (Claude Desktop, ChatGPT desktop, …) quits, it often
 * terminates the server without a signal the server can handle — notably on
 * Windows. The headless Chrome the server launched keeps running, keeps the
 * persistent profile locked, and the next launch fails with
 * "exitCode=21" (Windows) / "ProcessSingleton" (macOS/Linux). Because a
 * browser session lives for `session_timeout` (15 min by default), this
 * happens on practically every client restart.
 *
 * Before launching against a profile directory we therefore kill every
 * Chrome/Chromium process whose command line points `--user-data-dir` at
 * exactly that directory. Only call this when *this* server process holds no
 * live browser context on that directory.
 */

import { execFile } from "child_process";
import { log } from "../utils/logger.js";

function run(cmd: string, args: string[], timeoutMs = 15_000): Promise<string> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: timeoutMs, windowsHide: true }, (err, stdout) => {
      if (err) {
        log.dim(`  (orphan check: ${cmd} failed: ${err.message.split("\n")[0]})`);
        resolve("");
        return;
      }
      resolve(String(stdout));
    });
  });
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Pids of Chrome processes whose `--user-data-dir` is exactly `userDataDir`. */
async function findProfileChromePids(userDataDir: string): Promise<number[]> {
  if (process.platform === "win32") {
    // PowerShell single-quoted string: escape ' by doubling it.
    const dir = userDataDir.replace(/'/g, "''");
    const script = [
      `$d = [regex]::Escape('${dir}')`,
      `$re = '--user-data-dir="?' + $d + '"?(\\s|$)'`,
      "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe' OR Name='chromium.exe'\" |",
      "  Where-Object { $_.CommandLine -and ($_.CommandLine -match $re) } |",
      "  ForEach-Object { $_.ProcessId }",
    ].join("\n");
    const out = await run("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      script,
    ]);
    return out
      .split(/\r?\n/)
      .map((l) => parseInt(l.trim(), 10))
      .filter((n) => Number.isInteger(n) && n > 0);
  }

  const out = await run("ps", ["-eo", "pid=,args="]);
  const re = new RegExp(`--user-data-dir="?${escapeRegExp(userDataDir)}"?(\\s|$)`);
  const pids: number[] = [];
  for (const line of out.split("\n")) {
    const m = line.trim().match(/^(\d+)\s+(.*)$/);
    if (!m) continue;
    const [, pid, args] = m;
    if (/chrom(e|ium)/i.test(args) && re.test(args)) pids.push(parseInt(pid, 10));
  }
  return pids;
}

/**
 * Kill leftover Chrome processes that hold `userDataDir`. Best-effort: never
 * throws; returns the number of processes it tried to kill.
 */
export async function killOrphanedChrome(userDataDir: string): Promise<number> {
  try {
    const pids = (await findProfileChromePids(userDataDir)).filter((p) => p !== process.pid);
    if (pids.length === 0) return 0;

    log.warning(
      `  🧹 Found ${pids.length} leftover Chrome process(es) holding the profile — closing them…`
    );
    if (process.platform === "win32") {
      // /T also ends the renderer/GPU children of each browser process.
      for (const pid of pids) {
        await run("taskkill", ["/PID", String(pid), "/T", "/F"]);
      }
    } else {
      for (const pid of pids) {
        try {
          process.kill(pid, "SIGKILL");
        } catch {
          /* already gone */
        }
      }
    }
    // Give Chrome a moment to release the profile lock.
    await new Promise((r) => setTimeout(r, 1_500));
    return pids.length;
  } catch (error) {
    log.warning(`  ⚠️  Orphan Chrome cleanup skipped: ${error}`);
    return 0;
  }
}
