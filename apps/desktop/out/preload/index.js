"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electron", {
  ipc: {
    invoke: (channel, ...args) => electron.ipcRenderer.invoke(channel, ...args),
    on: (channel, listener) => {
      electron.ipcRenderer.on(channel, (_event, ...args) => listener(_event, ...args));
    },
    removeListener: (channel, listener) => {
      electron.ipcRenderer.removeAllListeners(channel);
    }
  }
});
