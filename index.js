import { spawn } from 'child_process';
import os from 'os';

console.log("--- INICIANDO SENTINEL SHIFT ---");

// Detecta si es Windows o Linux para usar el comando correcto
const npmCmd = os.platform() === 'win32' ? 'npm.cmd' : 'npm';

// Ejecuta el comando 'npm run dev'
const child = spawn(npmCmd, ['run', 'dev'], { stdio: 'inherit' });

child.on('error', (err) => {
  console.error('ERROR CRÍTICO al iniciar:', err);
});