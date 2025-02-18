const { app, BrowserWindow, Menu, ipcMain } = require("electron");
const path = require("path");
const https = require("https");
const http = require("http");

let mainWindow;
let overlayWindow;
let localServer = null;
let localPort = 3000;
let isLocalServerStarted = false;
let initiallyLoadedLocal = false;

function checkInternet(url, timeout = 3000) {
  return new Promise((resolve) => {
    let isResolved = false;
    let req;
    const timer = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        req.destroy();
        resolve(false);
      }
    }, timeout);

    req = https.get(url, (res) => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timer);
        if (res.statusCode >= 200 && res.statusCode < 400) {
          resolve(true);
        } else {
          resolve(false);
        }
      }
    });

    req.on("error", () => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timer);
        resolve(false);
      }
    });

    req.end();
  });
}

async function startNextProgrammatically() {
  if (isLocalServerStarted) return;
  isLocalServerStarted = true;

  const next = require(path.join(__dirname, "app-next", "node_modules", "next"));

  const dev = false;
  const dir = path.join(__dirname, "app-next");

  const nextApp = next({ dev, dir });
  await nextApp.prepare();

  const handle = nextApp.getRequestHandler();
  localServer = http.createServer((req, res) => handle(req, res));

  return new Promise((resolve, reject) => {
    localServer.listen(localPort, "127.0.0.1", (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

function positionOverlay() {
  if (!mainWindow || !overlayWindow) return;
  const [mainX, mainY] = mainWindow.getPosition();
  const [mainWidth, mainHeight] = mainWindow.getSize();

  const overlayWidth = 220;
  const overlayHeight = 80;

  const offsetX = 12;
  const offsetY = -10;

  const overlayX = mainX + offsetX;
  const overlayY = mainY + mainHeight - overlayHeight - offsetY;

  overlayWindow.setBounds({
    x: overlayX,
    y: overlayY,
    width: overlayWidth,
    height: overlayHeight
  });
}

function createOverlayWindow() {
  overlayWindow = new BrowserWindow({
    width: 220,
    height: 80,
    frame: false,
    transparent: true,
    skipTaskbar: true,
    resizable: false,
    center: true,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js")
    }
  });

  overlayWindow.loadFile(path.join(__dirname, "overlay.html"));
  overlayWindow.once("ready-to-show", () => {
    overlayWindow.show();
  });
}

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1050,
    height: 750,
    minWidth: 1050,
    minHeight: 770,
    resizable: true,
    show: false,
    webPreferences: {
      contextIsolation: true
    }
  });

  Menu.setApplicationMenu(null);

  const hasNet = await checkInternet("", 3000);

  if (hasNet) {
    mainWindow.loadURL("");
    initiallyLoadedLocal = false;
  } else {
    await startNextProgrammatically();
    mainWindow.loadURL("http://127.0.0.1:" + localPort + "/wallet");
    initiallyLoadedLocal = true;
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    if (overlayWindow) {
      overlayWindow.setParentWindow(mainWindow);
      positionOverlay();
    }
  });

  mainWindow.on("move", positionOverlay);
  mainWindow.on("resize", positionOverlay);

  mainWindow.on("closed", () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.close();
      overlayWindow = null;
    }
    if (localServer) {
      localServer.close();
      localServer = null;
    }
    mainWindow = null;
  });
}

ipcMain.handle("check-network", async (_event, urlToCheck, customTimeout = 3000) => {
  return checkInternet(urlToCheck, customTimeout);
});

ipcMain.handle("switch-online", async () => {
  if (!initiallyLoadedLocal) return;
  if (localServer) {
    localServer.close();
    localServer = null;
    isLocalServerStarted = false;
  }
  if (mainWindow) {
    mainWindow.loadURL("");
  }
});

app.whenReady().then(() => {
  createOverlayWindow();
  createMainWindow();
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createOverlayWindow();
    createMainWindow();
  }
});
