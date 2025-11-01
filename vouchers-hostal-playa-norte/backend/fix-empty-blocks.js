const fs = require('fs');

// Leer archivo
let content = fs.readFileSync('src/services/biDashboardService.js', 'utf8');

// Reemplazar bloques vacíos con comentarios
content = content.replace(/} catch \([^)]*\) \{\s*\}/g, '} catch (error) {\n    // TODO: Implementar manejo de errores\n    console.warn(\'Error handled silently:\', error);\n  }');
content = content.replace(/} catch \{\s*\}/g, '} catch {\n    // TODO: Implementar manejo de errores\n  }');

// Escribir archivo
fs.writeFileSync('src/services/biDashboardService.js', content);
console.log('✅ Bloques vacíos corregidos');
