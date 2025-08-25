const fs = require('fs');
const path = require('path');

function fixESMImports(dirPath) {
  const files = fs.readdirSync(dirPath);
  
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      fixESMImports(filePath);
    } else if (file.endsWith('.js')) {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Fix relative imports to add .js extension
      let fixedContent = content;
      
      // Handle both single and double quotes, and relative imports
      const patterns = [
        /import\s+([^'"]*from\s+)['"](\.[^'"]*?)['"];/g,
        /import\s+['"](\.[^'"]*?)['"];/g
      ];
      
      patterns.forEach(pattern => {
        fixedContent = fixedContent.replace(pattern, (match, beforeOrPath, maybePath) => {
          const importPath = maybePath || beforeOrPath;
          
          // Only process relative imports that don't already have extensions
          if (importPath.startsWith('./') || importPath.startsWith('../')) {
            if (!importPath.includes('.js') && !importPath.includes('.json') && !importPath.includes('.mjs')) {
              if (maybePath) {
                // Pattern 1: import { something } from './path'
                return match.replace(maybePath, maybePath + '.js');
              } else {
                // Pattern 2: import './path'
                return match.replace(beforeOrPath, beforeOrPath + '.js');
              }
            }
          }
          
          return match;
        });
      });
      
      if (content !== fixedContent) {
        fs.writeFileSync(filePath, fixedContent);
        console.log(`Fixed ESM imports in ${filePath}`);
      }
    }
  }
}

const distPath = path.join(__dirname, 'dist/apps/backend');
if (fs.existsSync(distPath)) {
  fixESMImports(distPath);
}