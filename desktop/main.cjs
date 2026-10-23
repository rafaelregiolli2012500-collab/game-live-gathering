const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");

let mainWindow = null;
let serviceChild = null;
let serviceState = { ok: false, state: "disconnected", message: "Serviço local não iniciado" };
const dedupe = new Set();

function serviceEntry() {
  return path.join(__dirname, "service", "main.mjs");
}

function startService() {
  if (serviceChild) return;
  const entry = serviceEntry();
  if (!fs.existsSync(entry)) {
    serviceState = { ok: false, state: "error", message: "desktop/service/main.mjs ausente" };
    return;
  }
  // Usa Node embutido do Electron
  serviceChild = spawn(process.execPath, [entry], {
    cwd: path.join(__dirname, "service"),
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    stdio: ["pipe", "pipe", "pipe"],
  });
  serviceChild.stdout.on("data", (buf) => {
    for (const line of String(buf).split("\n").filter(Boolean)) {
      try {
        const msg = JSON.parse(line);
        if (msg.type === "status") {
          serviceState = {
            ok: !!msg.ok,
            state: msg.state || (msg.ok ? "connected" : "error"),
            message: msg.message || "",
          };
          mainWindow?.webContents.send("desktop:status", serviceState);
        } else if (msg.type === "gift" && msg.row) {
          const id = String(msg.row.event_id || msg.row.id);
          if (dedupe.has(id)) continue;
          dedupe.add(id);
          if (dedupe.size > 3000) dedupe.clear();
          mainWindow?.webContents.send("desktop:gift", msg.row);
        }
      } catch {
        /* ignore */
      }
    }
  });
  serviceChild.stderr.on("data", (buf) => {
    // logs do serviço — não muda status para connected
    if (process.env.DEBUG_SERVICE) console.error(String(buf));
  });
  serviceChild.on("exit", (code) => {
    serviceChild = null;
    serviceState = {
      ok: false,
      state: "disconnected",
      message: code === 0 ? "Serviço encerrado" : `Serviço parou (${code})`,
    };
    mainWindow?.webContents.send("desktop:status", serviceState);
  });
}

function stopService() {
  if (!serviceChild) return;
  try {
    serviceChild.kill();
  } catch {
    /* ignore */
  }
  serviceChild = null;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "GAME.LIVE",
    fullscreenable: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    // Build estático: dist na raiz do projeto
    const indexHtml = path.join(__dirname, "..", "dist", "index.html");
    if (fs.existsSync(indexHtml)) {
      mainWindow.loadFile(indexHtml);
    } else {
      mainWindow.loadURL("data:text/html,<h1>Build ausente</h1><p>Execute npm run build antes do desktop.</p>");
    }
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    startService();
    createWindow();
  });

  app.on("window-all-closed", () => {
    stopService();
    if (process.platform !== "darwin") app.quit();
  });
  app.on("before-quit", () => stopService());
}

ipcMain.handle("desktop:getStatus", async () => serviceState);
ipcMain.handle("desktop:ackGift", async (_e, eventId, ok, error) => {
  if (serviceChild?.stdin?.writable) {
    serviceChild.stdin.write(JSON.stringify({ type: "ack", event_id: eventId, ok, error: error || null }) + "\n");
  }
});
ipcMain.handle("desktop:testIngest", async (_e, payload) => {
  if (serviceChild?.stdin?.writable) {
    serviceChild.stdin.write(JSON.stringify({ type: "test_ingest", ...payload }) + "\n");
    return { ok: true };
  }
  return { ok: false, reason: "serviço offline" };
});
