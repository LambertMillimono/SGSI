// Wrapper pour lancer electron-vite dev en s'assurant que ELECTRON_RUN_AS_NODE est supprimé
// (quand cette variable est présente, même vide, Electron se comporte comme Node.js pur)
import { spawn } from 'child_process'

delete process.env.ELECTRON_RUN_AS_NODE

const proc = spawn('npx', ['electron-vite', 'dev'], {
  stdio: 'inherit',
  shell: true,
  env: process.env,
})

proc.on('exit', (code) => process.exit(code ?? 0))
