const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopBridge", {
  isDesktop: true,
  getStatus: () => ipcRenderer.invoke("desktop:getStatus"),
  onGift: (handler) => {
    const fn = (_e, row) => handler(row);
    ipcRenderer.on("desktop:gift", fn);
    return () => ipcRenderer.removeListener("desktop:gift", fn);
  },
  onStatus: (handler) => {
    const fn = (_e, status) => handler(status);
    ipcRenderer.on("desktop:status", fn);
    return () => ipcRenderer.removeListener("desktop:status", fn);
  },
  ackGift: (eventId, ok, error) => ipcRenderer.invoke("desktop:ackGift", eventId, ok, error),
  testIngest: (payload) => ipcRenderer.invoke("desktop:testIngest", payload),
});
