#!/usr/bin/env node

/**
 * Bulletproof Multi-Language (i18n) Synchronization Script for MSD700 Documentation
 * Supports English -> Bahasa Indonesia (/id/) & Japanese (/ja/)
 * Translates: Markdown Content, Frontmatter Hero/Features, LinkCard components, and Badge components.
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

async function translateFrontmatter(fm, targetLang) {
  if (!fm) return '';
  const lines = fm.split('\n');
  const newLines = [];

  for (const line of lines) {
    const nameMatch = line.match(/^(\s*name:\s*)(["']?)(.*?)\2$/);
    const tagMatch = line.match(/^(\s*tagline:\s*)(["']?)(.*?)\2$/);
    const titleMatch = line.match(/^(\s*-?\s*title:\s*)(["']?)(.*?)\2$/);
    const textMatch = line.match(/^(\s*-?\s*text:\s*)(["']?)(.*?)\2$/);
    const detailsMatch = line.match(/^(\s*details:\s*)(["']?)(.*?)\2$/);
    const linkTextMatch = line.match(/^(\s*linkText:\s*)(["']?)(.*?)\2$/);
    const linkMatch = line.match(/^(\s*link:\s*)(["']?)(\/[^"'\s]*)\2(.*)$/);

    if (nameMatch) {
      const translated = await translateChunk(nameMatch[3], targetLang);
      newLines.push(`${nameMatch[1]}"${translated.replace(/"/g, '\\"')}"`);
    } else if (tagMatch) {
      const translated = await translateChunk(tagMatch[3], targetLang);
      newLines.push(`${tagMatch[1]}"${translated.replace(/"/g, '\\"')}"`);
    } else if (detailsMatch) {
      const translated = await translateChunk(detailsMatch[3], targetLang);
      newLines.push(`${detailsMatch[1]}"${translated.replace(/"/g, '\\"')}"`);
    } else if (linkTextMatch) {
      const translated = await translateChunk(linkTextMatch[3], targetLang);
      newLines.push(`${linkTextMatch[1]}${translated}`);
    } else if (titleMatch) {
      const translated = await translateChunk(titleMatch[3], targetLang);
      newLines.push(`${titleMatch[1]}${translated}`);
    } else if (textMatch && !line.includes('by ITB de Labo')) {
      const translated = await translateChunk(textMatch[3], targetLang);
      newLines.push(`${textMatch[1]}${translated}`);
    } else if (linkMatch) {
      const url = linkMatch[3];
      const newUrl = url.startsWith(`/${targetLang}/`) ? url : `/${targetLang}${url}`;
      newLines.push(`${linkMatch[1]}${linkMatch[2]}${newUrl}${linkMatch[2]}${linkMatch[4]}`);
    } else {
      newLines.push(line);
    }
  }
  return newLines.join('\n');
}

async function translateMarkdownFile(content, targetLang) {
  // 1. Separate & Translate YAML frontmatter
  let frontmatter = '';
  let body = content;
  if (content.startsWith('---')) {
    const secondIndex = content.indexOf('---', 3);
    if (secondIndex !== -1) {
      const rawFm = content.slice(0, secondIndex + 3);
      body = content.slice(secondIndex + 3);
      frontmatter = await translateFrontmatter(rawFm, targetLang);
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

  // 5. Extract and Translate <LinkCard ... /> Components
  const linkCards = [];
  body = body.replace(/<LinkCard\s+([^>]*?)\/>/g, (match, attrs) => {
    const iconMatch = attrs.match(/icon="([^"]*)"/);
    const titleMatch = attrs.match(/title="([^"]*)"/);
    const detailsMatch = attrs.match(/details="([^"]*)"/);
    const linkMatch = attrs.match(/link="([^"]*)"/);

    const icon = iconMatch ? iconMatch[1] : '';
    const title = titleMatch ? titleMatch[1] : '';
    const details = detailsMatch ? detailsMatch[1] : '';
    const link = linkMatch ? linkMatch[1] : '';

    const index = linkCards.length;
    linkCards.push({ icon, title, details, link });
    return `@@LC${index}@@`;
  });

  // 6. Extract and Translate <Badge ... /> Components
  const badges = [];
  body = body.replace(/<Badge\s+([^>]*?)\/>/g, (match, attrs) => {
    const typeMatch = attrs.match(/type="([^"]*)"/);
    const textMatch = attrs.match(/text="([^"]*)"/);
    const type = typeMatch ? typeMatch[1] : 'tip';
    const text = textMatch ? textMatch[1] : '';

    const index = badges.length;
    badges.push({ type, text });
    return `@@BG${index}@@`;
  });

  // 7. Protect other HTML / Vue Tags (<details>, <summary>, <RoleBadge />, <LinkCards>, etc.)
  const htmlTags = [];
  body = body.replace(/<\/?([a-zA-Z][a-zA-Z0-9_\-]*)[^>\n]*>/g, (match) => {
    htmlTags.push(match);
    return `@@HT${htmlTags.length}@@`;
  });

  // 8. Protect Markdown URLs in `](url)`
  const mdUrls = [];
  body = body.replace(/\]\(([^)\n]+)\)/g, (match, url) => {
    mdUrls.push(url);
    return `](@@MU${mdUrls.length}@@)`;
  });

  // 9. Protect inline code `...`
  const inlineCodes = [];
  body = body.replace(/`[^`\n]+`/g, (match) => {
    inlineCodes.push(match);
    return `@@IC${inlineCodes.length}@@`;
  });

  // 10. Split body into paragraphs and translate in chunks < 1800 chars
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

  // 11. Restore Inline Codes
  translatedBody = translatedBody.replace(/@@\s*IC\s*(\d+)\s*@@/gi, (_, id) => inlineCodes[parseInt(id, 10) - 1] || '');

  // 12. Restore Markdown URLs
  translatedBody = translatedBody.replace(/\]\(\s*@@\s*MU\s*(\d+)\s*@@\s*\)/gi, (_, id) => {
    let url = mdUrls[parseInt(id, 10) - 1] || '';
    if (url.startsWith('/') && !url.startsWith('//') && !url.startsWith(`/${targetLang}/`)) {
      url = `/${targetLang}${url}`;
    }
    return `](${url})`;
  });

  // 13. Restore Translated LinkCards
  for (let i = 0; i < linkCards.length; i++) {
    const lc = linkCards[i];
    const transTitle = await translateChunk(lc.title, targetLang);
    const transDetails = await translateChunk(lc.details, targetLang);
    let targetLink = lc.link;
    if (targetLink.startsWith('/') && !targetLink.startsWith('//') && !targetLink.startsWith(`/${targetLang}/`)) {
      targetLink = `/${targetLang}${targetLink}`;
    }
    const restoredCard = `<LinkCard icon="${lc.icon}" title="${transTitle.replace(/"/g, '&quot;')}" details="${transDetails.replace(/"/g, '&quot;')}" link="${targetLink}" />`;
    const regex = new RegExp(`@@\\s*LC\\s*${i}\\s*@@`, 'gi');
    translatedBody = translatedBody.replace(regex, restoredCard);
  }

  // 14. Restore Translated Badges
  for (let i = 0; i < badges.length; i++) {
    const bg = badges[i];
    const transText = await translateChunk(bg.text, targetLang);
    const restoredBadge = `<Badge type="${bg.type}" text="${transText.replace(/"/g, '&quot;')}" />`;
    const regex = new RegExp(`@@\\s*BG\\s*${i}\\s*@@`, 'gi');
    translatedBody = translatedBody.replace(regex, restoredBadge);
  }

  // 15. Restore Other HTML Tags, Comments, Containers, Code Blocks
  translatedBody = translatedBody.replace(/@@\s*HT\s*(\d+)\s*@@/gi, (_, id) => htmlTags[parseInt(id, 10) - 1] || '');
  translatedBody = translatedBody.replace(/@@\s*HC\s*(\d+)\s*@@/gi, (_, id) => htmlComments[parseInt(id, 10) - 1] || '');
  translatedBody = translatedBody.replace(/@@\s*CT\s*(\d+)\s*@@/gi, (_, id) => containerDirectives[parseInt(id, 10) - 1] || '');
  translatedBody = translatedBody.replace(/@@\s*CB\s*(\d+)\s*@@/gi, (_, id) => codeBlocks[parseInt(id, 10) - 1] || '');

  // 16. Reconstruct
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
