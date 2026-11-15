// Exporta el PDF horizontal y, con --revisar <carpeta>, guarda capturas
// por sección y un reporte de contraste.
// Uso: node fuente/exportar.js manual.html manual.pdf [--revisar carpeta]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const [html, pdf] = process.argv.slice(2);
const iRev = process.argv.indexOf('--revisar');
const dirRev = iRev > 0 ? process.argv[iRev + 1] : null;

(async () => {
  const nav = await chromium.launch();
  const url = 'file://' + path.resolve(html);

  if (dirRev) {
    fs.mkdirSync(dirRev, { recursive: true });
    const p = await nav.newPage({ viewport: { width: 1600, height: 900 } });
    await p.goto(url);
    await p.evaluate(() => document.fonts.ready);
    const secs = await p.$$('section.sec');
    for (let i = 0; i < secs.length; i++) {
      await secs[i].screenshot({ path: `${dirRev}/sec-${String(i + 1).padStart(2, '0')}.png` });
    }
    // Contraste de cada texto contra su fondo efectivo
    const malos = await p.evaluate(() => {
      const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
      const L = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
      const rgb = s => (s.match(/[\d.]+/g) || []).map(Number);
      const fondo = el => {
        for (let e = el; e; e = e.parentElement) {
          const c = rgb(getComputedStyle(e).backgroundColor);
          if (c.length === 3 || (c.length === 4 && c[3] > 0)) return c.slice(0, 3);
        }
        return [0, 0, 0];
      };
      const out = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const t = walker.currentNode; const el = t.parentElement;
        if (!t.textContent.trim() || el.closest('style')) continue;
        const a = L(rgb(getComputedStyle(el).color)), b = L(fondo(el));
        const r = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        if (r < 4.5) out.push(`${r.toFixed(2)}  "${t.textContent.trim().slice(0, 40)}"`);
      }
      return out;
    });
    fs.writeFileSync(`${dirRev}/contraste.txt`, malos.length ? malos.join('\n') : 'Todo el texto >= 4.5:1');
    console.log(malos.length ? 'Contraste bajo:\n' + malos.join('\n') : 'Contraste OK (>= 4.5:1)');
    const m = await nav.newPage({ viewport: { width: 390, height: 844 } });
    await m.goto(url);
    await m.evaluate(() => document.fonts.ready);
    await m.screenshot({ path: `${dirRev}/movil.png`, fullPage: true });
    const scrollX = await m.evaluate(() => document.documentElement.scrollWidth);
    console.log('Ancho en móvil (debe ser 390):', scrollX);
  }

  if (pdf) {
    const p = await nav.newPage({ viewport: { width: 1600, height: 900 } });
    await p.goto(url);
    await p.evaluate(() => document.fonts.ready);
    await p.pdf({ path: pdf, width: '1600px', height: '900px', printBackground: true, preferCSSPageSize: true });
    console.log('PDF:', pdf);
  }
  await nav.close();
})();
