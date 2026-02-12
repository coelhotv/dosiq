const fs = require('fs');
const path = require('path');

const replacements = [
  { from: /from ['"]\.\.\/\.\.\/lib\/supabase['"]/g, to: "from '@shared/utils/supabase'" },
  { from: /from ['"]\.\.\/\.\.\/services\//g, to: "from '@shared/services/" },
  { from: /from ['"]\.\.\/\.\.\/hooks\//g, to: "from '@shared/hooks/" },
  { from: /from ['"]\.\.\/\.\.\/components\//g, to: "from '@shared/components/" },
  { from: /from ['"]\.\.\/\.\.\/schemas\//g, to: "from '@shared/constants/" },
  { from: /from ['"]\.\.\/\.\.\/utils\//g, to: "from '@shared/utils/" },
  { from: /from ['"]\.\.\/lib\/supabase['"]/g, to: "from '@shared/utils/supabase'" },
  { from: /from ['"]\.\.\/services\//g, to: "from '@shared/services/" },
  { from: /from ['"]\.\.\/hooks\//g, to: "from '@shared/hooks/" },
  { from: /from ['"]\.\.\/components\//g, to: "from '@shared/components/" },
  { from: /from ['"]\.\.\/schemas\//g, to: "from '@shared/constants/" },
  { from: /from ['"]\.\.\/utils\//g, to: "from '@shared/utils/" },
];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  for (const r of replacements) {
    if (r.from.test(content)) {
      content = content.replace(r.from, r.to);
      modified = true;
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log('Fixed:', filePath);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory() && !file.includes('__tests__')) {
      walkDir(fullPath);
    } else if ((file.endsWith('.js') || file.endsWith('.jsx')) && !file.includes('.test.')) {
      processFile(fullPath);
    }
  }
}

walkDir('src/shared');
console.log('Done!');
