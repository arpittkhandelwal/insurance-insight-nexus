const fs = require('fs');
const path = require('path');

const REPLACEMENTS = [
  { from: /\btext-white\b/g, to: 'text-slate-900 dark:text-white' },
  { from: /\bbg-navy-900\b/g, to: 'bg-slate-50 dark:bg-navy-900' },
  { from: /\bbg-navy-800\b/g, to: 'bg-white dark:bg-navy-800' },
  { from: /\bbg-navy-700\b/g, to: 'bg-slate-100 dark:bg-navy-700' },
  { from: /\btext-slate-100\b/g, to: 'text-slate-800 dark:text-slate-100' },
  { from: /\btext-slate-200\b/g, to: 'text-slate-700 dark:text-slate-200' },
  { from: /\btext-slate-300\b/g, to: 'text-slate-600 dark:text-slate-300' },
  { from: /\btext-slate-400\b/g, to: 'text-slate-500 dark:text-slate-400' },
  // Exclude text-slate-500 since it is neutral
  { from: /\bborder-white\/10\b/g, to: 'border-slate-200 dark:border-white/10' },
  { from: /\bborder-white\/20\b/g, to: 'border-slate-300 dark:border-white/20' },
  { from: /\bborder-white\/30\b/g, to: 'border-slate-400 dark:border-white/30' },
  { from: /\bborder-white\/40\b/g, to: 'border-slate-500 dark:border-white/40' },
  { from: /\bbg-white\/5\b/g, to: 'bg-slate-50 dark:bg-white/5' },
  { from: /\bbg-white\/10\b/g, to: 'bg-slate-100 dark:bg-white/10' },
  { from: /\bbg-white\/20\b/g, to: 'bg-slate-200 dark:bg-white/20' },
  
  // Recharts specific hardcoded colors in contentStyle
  { from: /background: '#111b33'/g, to: "background: 'var(--tooltip-bg, #111b33)'" },
  { from: /border: '1px solid rgba\(255,255,255,0\.1\)'/g, to: "border: '1px solid var(--tooltip-border, rgba(255,255,255,0.1))'" },
];

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.jsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      for (const { from, to } of REPLACEMENTS) {
        // Prevent double replacement if script is run twice
        if (content.includes(to)) continue;
        content = content.replace(from, to);
      }
      
      fs.writeFileSync(fullPath, content, 'utf8');
    }
  }
}

processDirectory(path.join(__dirname, 'src'));
console.log('Replaced hardcoded colors with light/dark variants in all JSX files.');
