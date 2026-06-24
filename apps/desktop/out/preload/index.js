"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electron", {
  ipc: {
    invoke: (channel, ...args) => electron.ipcRenderer.invoke(channel, ...args)
  }
});
