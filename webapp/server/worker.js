import { spawn } from "node:child_process";
import readline from "node:readline";
import { config, ROOT } from "./config.js";

export class MlWorker {
  constructor() {
    this.pending = new Map();
    this.nextId = 1;
    this.ready = null;
    this.proc = null;
  }

  start() {
    if (this.ready) return this.ready;
    this.ready = new Promise((resolve, reject) => {
      const proc = spawn(config.pythonBin, ["-u", "-m", "src.ml_worker"], {
        cwd: ROOT,
        env: { ...process.env, PYTHONIOENCODING: "utf-8" },
        stdio: ["pipe", "pipe", "pipe"],
      });
      this.proc = proc;
      let started = false;
      proc.on("error", (err) => {
        this.ready = null;
        reject(new Error(`Could not start Python (${config.pythonBin}): ${err.message}`));
      });
      proc.stderr.on("data", (d) => process.stderr.write(`[ml] ${d}`));
      readline.createInterface({ input: proc.stdout }).on("line", (line) => {
        let msg;
        try { msg = JSON.parse(line); } catch { return; }
        if (msg.ready) { started = true; resolve(); return; }
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        clearTimeout(p.timer);
        if (msg.error) {
          const err = new Error(msg.error.messages.join("; "));
          err.type = msg.error.type;
          err.messages = msg.error.messages;
          p.reject(err);
        } else p.resolve(msg.result);
      });
      proc.on("exit", (code) => {
        this.ready = null;
        for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new Error("ML worker stopped")); }
        this.pending.clear();
        if (!started) reject(new Error(`ML worker exited with code ${code}. Run: python -m src.train`));
      });
    });
    return this.ready;
  }

  async call(action, payload = {}, timeoutMs = 60000) {
    await this.start();
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error("ML worker timed out")); }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.proc.stdin.write(JSON.stringify({ id, action, payload }) + "\n");
    });
  }

  stop() { if (this.proc) this.proc.kill(); }
}
