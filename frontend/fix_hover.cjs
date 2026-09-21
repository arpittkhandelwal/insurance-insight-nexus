const fs = require('fs');
const path = require('path');

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.jsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      content = content.replace(/hover:text-slate-([0-9]+)\sdark:text-(white|slate-[0-9]+)/g, 'hover:text-slate-$1 dark:hover:text-$2');
      content = content.replace(/hover:border-slate-([0-9]+)\sdark:border-(white\/[0-9]+|slate-[0-9]+)/g, 'hover:border-slate-$1 dark:hover:border-$2');
      content = content.replace(/hover:bg-slate-([0-9]+)\sdark:bg-(white\/[0-9]+|navy-[0-9]+)/g, 'hover:bg-slate-$1 dark:hover:bg-$2');
      
      fs.writeFileSync(fullPath, content, 'utf8');
    }
  }
}
processDirectory(path.join(__dirname, 'src'));
