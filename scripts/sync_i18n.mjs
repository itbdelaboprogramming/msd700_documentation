#!/usr/bin/env node

/**
 * Bulletproof Multi-Language (i18n) Synchronization Script for MSD700 Documentation
 * Supports English -> Bahasa Indonesia (/id/) & Japanese (/ja/)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DOCS_DIR = path.resolve(__dirname, '../docs');

const TARGET_LANGS = [
  { code: 'id', name: 'Bahasa Indonesia', prefix: '/id' },
  { code: 'ja', name: '日本語', prefix: '/ja' }
];

async function translateChunk(text, targetLang) {
  if (!text || text.trim() === '') return text;

  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data && data[0]) {
      let piece = data[0].map(x => x[0]).join('');
      // Clean em-dashes
      piece = piece.replace(/—/g, ' - ').replace(/–/g, '-');
      return piece;
    }
  } catch (err) {
    console.error(`  [WARN] Translation chunk failed (${targetLang}):`, err.message);
  }
  return text;
}

async function translateMarkdownFile(content, targetLang) {
  // 1. Separate YAML frontmatter
  let frontmatter = '';
  let body = content;
  if (content.startsWith('---')) {
    const secondIndex = content.indexOf('---', 3);
    if (secondIndex !== -1) {
      frontmatter = content.slice(0, secondIndex + 3);
      body = content.slice(secondIndex + 3);
    }
  }

  // 2. Protect Code Blocks & Mermaid Blocks
  const codeBlocks = [];
  body = body.replace(/```[\s\S]*?```/g, (match) => {
    codeBlocks.push(match);
    return `@@CB${codeBlocks.length}@@`;
  });

  // 3. Protect VitePress Container Directives (::: tip, ::: warning, ::: info, ::: danger, :::)
  const containerDirectives = [];
  body = body.replace(/^:::[^\n]*$/gm, (match) => {
    containerDirectives.push(match);
    return `@@CT${containerDirectives.length}@@`;
  });

  // 4. Protect HTML Comments <!-- ... -->
  const htmlComments = [];
  body = body.replace(/<!--[\s\S]*?-->/g, (match) => {
    htmlComments.push(match);
    return `@@HC${htmlComments.length}@@`;
  });

  // 5. Protect all HTML / Vue Tags (<details>, <summary>, <RoleBadge />, etc.)
  const htmlTags = [];
  body = body.replace(/<\/?([a-zA-Z][a-zA-Z0-9_\-]*)[^>\n]*>/g, (match) => {
    htmlTags.push(match);
    return `@@HT${htmlTags.length}@@`;
  });

  // 6. Protect Markdown URLs in `](url)`
  const mdUrls = [];
  body = body.replace(/\]\(([^)\n]+)\)/g, (match, url) => {
    mdUrls.push(url);
    return `](@@MU${mdUrls.length}@@)`;
  });

  // 7. Protect inline code `...`
  const inlineCodes = [];
  body = body.replace(/`[^`\n]+`/g, (match) => {
    inlineCodes.push(match);
    return `@@IC${inlineCodes.length}@@`;
  });

  // 8. Split body into paragraphs and translate in chunks < 1800 chars
  const paragraphs = body.split('\n\n');
  const translatedParagraphs = [];

  let currentBatch = [];
  let currentBatchLen = 0;

  for (const para of paragraphs) {
    if (currentBatchLen + para.length > 1800) {
      const batchText = currentBatch.join('\n\n');
      const transBatch = await translateChunk(batchText, targetLang);
      translatedParagraphs.push(transBatch);
      currentBatch = [para];
      currentBatchLen = para.length;
    } else {
      currentBatch.push(para);
      currentBatchLen += para.length + 2;
    }
  }

  if (currentBatch.length > 0) {
    const batchText = currentBatch.join('\n\n');
    const transBatch = await translateChunk(batchText, targetLang);
    translatedParagraphs.push(transBatch);
  }

  let translatedBody = translatedParagraphs.join('\n\n');

  // 9. Restore Tokens with tolerance for whitespace
  translatedBody = translatedBody.replace(/@@\s*IC\s*(\d+)\s*@@/gi, (_, id) => inlineCodes[parseInt(id, 10) - 1] || '');
  
  // Restore Markdown URLs and prefix with target language if root-relative
  translatedBody = translatedBody.replace(/\]\(\s*@@\s*MU\s*(\d+)\s*@@\s*\)/gi, (_, id) => {
    let url = mdUrls[parseInt(id, 10) - 1] || '';
    if (url.startsWith('/') && !url.startsWith('//') && !url.startsWith(`/${targetLang}/`)) {
      url = `/${targetLang}${url}`;
    }
    return `](${url})`;
  });

  translatedBody = translatedBody.replace(/@@\s*HT\s*(\d+)\s*@@/gi, (_, id) => htmlTags[parseInt(id, 10) - 1] || '');
  translatedBody = translatedBody.replace(/@@\s*HC\s*(\d+)\s*@@/gi, (_, id) => htmlComments[parseInt(id, 10) - 1] || '');
  translatedBody = translatedBody.replace(/@@\s*CT\s*(\d+)\s*@@/gi, (_, id) => containerDirectives[parseInt(id, 10) - 1] || '');
  translatedBody = translatedBody.replace(/@@\s*CB\s*(\d+)\s*@@/gi, (_, id) => codeBlocks[parseInt(id, 10) - 1] || '');

  // 10. Reconstruct
  if (frontmatter) {
    return `${frontmatter}\n${translatedBody}`;
  }
  return translatedBody;
}

function findSourceMarkdownFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['.vitepress', 'id', 'ja', 'node_modules'].includes(entry.name)) {
        continue;
      }
      files.push(...findSourceMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files;
}

async function run() {
  console.log('=== MSD700 Bulletproof Multi-Language (i18n) Synchronization ===');
  const sourceFiles = findSourceMarkdownFiles(DOCS_DIR);
  console.log(`Discovered ${sourceFiles.length} source documentation files in English.\n`);

  for (const lang of TARGET_LANGS) {
    console.log(`\n>>> Synchronizing Locale: ${lang.name} [${lang.code}] >>>`);
    const targetBaseDir = path.join(DOCS_DIR, lang.code);
    if (!fs.existsSync(targetBaseDir)) {
      fs.mkdirSync(targetBaseDir, { recursive: true });
    }

    for (let i = 0; i < sourceFiles.length; i++) {
      const srcFile = sourceFiles[i];
      const relPath = path.relative(DOCS_DIR, srcFile);
      const destFile = path.join(targetBaseDir, relPath);
      const destDir = path.dirname(destFile);

      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      console.log(`  [${i + 1}/${sourceFiles.length}] (${lang.code}) ${relPath}`);
      const content = fs.readFileSync(srcFile, 'utf-8');
      const translated = await translateMarkdownFile(content, lang.code);
      fs.writeFileSync(destFile, translated, 'utf-8');
    }
  }

  console.log('\n=== Multi-Language Synchronization Complete! ===');
}

run().catch(err => {
  console.error('Fatal sync error:', err);
  process.exit(1);
});
