/** Logs estruturados em stderr (stdout é canal IPC com o Electron). */
export function log(level, message, extra = {}) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    message,
    ...extra,
  });
  process.stderr.write(line + "\n");
}

export const logger = {
  info: (m, e) => log("info", m, e),
  warn: (m, e) => log("warn", m, e),
  error: (m, e) => log("error", m, e),
};
