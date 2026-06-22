#!/usr/bin/env node
/**
 * 跨平台啟動腳本
 * 執行 npx serve . 並在伺服器就緒後自動開啟瀏覽器
 * 支援 Windows / macOS / Linux
 */

const { spawn, exec } = require('child_process');
const os = require('os');

const server = spawn('npx', ['serve', '.'], {
  stdio: ['inherit', 'pipe', 'inherit'],
  shell: true,
});

let opened = false;

// 從 serve 輸出中解析實際 URL（動態 port 也能正確捕捉）
server.stdout.on('data', (data) => {
  const text = data.toString();
  process.stdout.write(text);

  if (!opened) {
    const match = text.match(/https?:\/\/localhost:\d+/);
    if (match) {
      opened = true;
      setTimeout(() => openBrowser(match[0]), 300);
    }
  }
});

// 保底：3 秒後若仍未偵測到 URL，直接嘗試 localhost:3000
setTimeout(() => {
  if (!opened) {
    opened = true;
    openBrowser('http://localhost:3000');
  }
}, 3000);

function openBrowser(url) {
  const platform = os.platform();
  const cmd =
    platform === 'win32'  ? `start "" "${url}"` :
    platform === 'darwin' ? `open "${url}"` :
                            `xdg-open "${url}"`;

  const lanIp = getLanIp();
  const port = url.match(/:(\d+)/)?.[1] ?? '3000';
  console.log(`\n本機：${url}`);
  if (lanIp) console.log(`區網：http://${lanIp}:${port}  ← 可分享給同網域使用者`);
  console.log();

  exec(cmd, (err) => {
    if (err) console.error('無法自動開啟瀏覽器，請手動前往：', url);
  });
}

function getLanIp() {
  const ifaces = os.networkInterfaces();
  for (const iface of Object.values(ifaces)) {
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address;
    }
  }
  return null;
}

server.on('close', (code) => process.exit(code ?? 0));

process.on('SIGINT', () => {
  server.kill();
  process.exit(0);
});
