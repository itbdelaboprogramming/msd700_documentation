import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.Element = dom.window.Element;
globalThis.SVGElement = dom.window.SVGElement;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Node = dom.window.Node;

const mermaid = (await import('mermaid')).default;
mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' });

const root = resolve('docs');
const files = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.vitepress') continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.md')) files.push(p);
  }
})(root);

let total = 0;
let failed = 0;

for (const file of files) {
  const text = readFileSync(file, 'utf-8');
  const fence = /```mermaid\n([\s\S]*?)```/g;
  let match;
  let n = 0;
  while ((match = fence.exec(text))) {
    n += 1;
    total += 1;
    const source = match[1].trim();
    try {
      await mermaid.parse(source);
      console.log(`PASS ${file} #${n}`);
    } catch (err) {
      failed += 1;
      console.error(`FAIL ${file} #${n}:\n${err.message}\n--- Diagram Source:\n${source}\n---`);
    }
  }
}

console.log(`\nResults: ${total - failed}/${total} valid diagrams across ${files.length} files.`);
process.exit(failed ? 1 : 0);
