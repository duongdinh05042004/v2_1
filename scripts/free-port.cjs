const { execSync } = require('child_process');

const port = Number(process.env.PORT || 3000);

function pidsOnPortWindows(listenPort) {
  try {
    const out = execSync('netstat -ano -p tcp', { encoding: 'utf8' });
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      if (!line.includes('LISTENING')) continue;
      if (!line.includes(`:${listenPort} `) && !line.endsWith(`:${listenPort}`)) continue;
      const parts = line.trim().split(/\s+/);
      const pid = Number(parts[parts.length - 1]);
      if (pid > 0) pids.add(pid);
    }
    return [...pids];
  } catch {
    return [];
  }
}

function pidsOnPortUnix(listenPort) {
  try {
    const out = execSync(`lsof -ti tcp:${listenPort} -sTCP:LISTEN`, { encoding: 'utf8' });
    return out
      .split(/\s+/)
      .map((value) => Number(value))
      .filter((pid) => pid > 0);
  } catch {
    return [];
  }
}

const pids = process.platform === 'win32' ? pidsOnPortWindows(port) : pidsOnPortUnix(port);
for (const pid of pids) {
  if (pid === process.pid) continue;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
    } else {
      process.kill(pid, 'SIGTERM');
    }
  } catch {
    /* already gone */
  }
}
