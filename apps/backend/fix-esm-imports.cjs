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
      
      // Fix relative imports and exports to add .js extension
      let fixedContent = content;
      
      // Handle import statements with from
      const importPatterns = [
        /import\s+([^'"]*from\s+)['"](\.[^'"]*?)['"];/g,
        /import\s+['"](\.[^'"]*?)['"];/g
      ];
      
      // Handle export statements with from
      const exportPatterns = [
        /export\s+([^'"]*from\s+)['"](\.[^'"]*?)['"];/g,
        /export\s+\*\s+from\s+['"](\.[^'"]*?)['"];/g
      ];
      
      // Process import patterns
      importPatterns.forEach(pattern => {
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
      
      // Process export patterns
      exportPatterns.forEach(pattern => {
        fixedContent = fixedContent.replace(pattern, (match, ...groups) => {
          // Handle different capture group patterns
          const exportPath = groups.find(group => group && (group.startsWith('./') || group.startsWith('../')));
          
          if (exportPath) {
            // Only process relative exports that don't already have extensions
            if (!exportPath.includes('.js') && !exportPath.includes('.json') && !exportPath.includes('.mjs')) {
              return match.replace(exportPath, exportPath + '.js');
            }
          }
          
          return match;
        });
      });
      
      if (content !== fixedContent) {
        fs.writeFileSync(filePath, fixedContent);
        console.log(`Fixed ESM imports/exports in ${filePath}`);
      }
    }
  }
}

// Fix backend dist
const backendDistPath = path.join(__dirname, 'dist/apps/backend');
if (fs.existsSync(backendDistPath)) {
  console.log('Fixing backend ESM imports...');
  fixESMImports(backendDistPath);
}

// Fix shared packages dist
const packagesPath = path.join(__dirname, '..', '..', 'packages');
const packageDirs = ['types', 'utils'];

packageDirs.forEach(packageName => {
  const packageDistPath = path.join(packagesPath, packageName, 'dist');
  if (fs.existsSync(packageDistPath)) {
    console.log(`Fixing ${packageName} package ESM imports...`);
    fixESMImports(packageDistPath);
  }
});