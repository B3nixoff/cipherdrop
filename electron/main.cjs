const { app, BrowserWindow, Menu, shell } = require("electron");

const DEFAULT_REMOTE_URL = "https://cipherdrop.eu";

function resolveAppUrl() {
  return (
    process.env.ELECTRON_START_URL ||
    process.env.DESKTOP_APP_URL ||
    DEFAULT_REMOTE_URL
  );
}

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1460,
    height: 980,
    minWidth: 1120,
    minHeight: 760,
    autoHideMenuBar: true,
    backgroundColor: "#02060a",
    title: "CipherDrop",
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  void win.loadURL(resolveAppUrl());
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
