// Render tools/og-card.html to public/og-card.png at exactly 1200x630.
//
// Uses the Electron already installed for the app, so this needs no extra
// dependency. Run: node tools/render-og.js  (via the app's electron binary)
const { app, BrowserWindow } = require("electron");
const { join } = require("node:path");
const { writeFileSync } = require("node:fs");

const ROOT = join(__dirname, "..");

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1200, height: 630,
    show: false,
    useContentSize: true,
    webPreferences: { offscreen: true },
  });
  await win.loadFile(join(ROOT, "tools", "og-card.html"));
  // Give the webfonts a moment; a card rendered in Times is worse than none.
  await new Promise((r) => setTimeout(r, 2500));
  const img = await win.webContents.capturePage({ x: 0, y: 0, width: 1200, height: 630 });
  const out = join(ROOT, "public", "og-card.png");
  writeFileSync(out, img.toPNG());
  const s = img.getSize();
  console.log(`og-card.png  ${s.width}x${s.height}  ->  ${out}`);
  app.exit(0);
});
