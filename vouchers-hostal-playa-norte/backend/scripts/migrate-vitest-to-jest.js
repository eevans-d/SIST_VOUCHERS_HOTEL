#!/usr/bin/env node

/**
 * Script to migrate test files from Vitest to Jest
 * Replaces Vitest imports and API calls with Jest equivalents
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { globSync } from 'glob';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

// Find all test files
const testFiles = globSync('tests/**/*.test.js', { cwd: rootDir });

console.log(`Found ${testFiles.length} test files`);

let migratedCount = 0;

testFiles.forEach((file) => {
  const filePath = path.join(rootDir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;

  // Replace Vitest imports with Jest globals
  if (content.includes("from 'vitest'")) {
    content = content.replace(
      /import\s*{\s*([^}]*)\s*}\s*from\s*['"]vitest['"]/g,
      (match, imports) => {
        // Extract imports and ensure describe, it, expect are there
        const importList = imports
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

        // Filter out 'vi' since Jest uses 'jest' instead
        const jestImports = importList.filter((imp) => imp !== 'vi');

        // If vi was imported, we'll handle it separately
        const hasVi = importList.includes('vi');

        let result = '';
        if (jestImports.length > 0) {
          result += `// Auto-migrated from vitest\n`;
        }
        return result;
      }
    );

    // Replace standalone vi usage with jest
    content = content.replace(/\bvi\.fn\(/g, 'jest.fn(');
    content = content.replace(/\bvi\.spyOn\(/g, 'jest.spyOn(');
    content = content.replace(/\bvi\.mock\(/g, 'jest.mock(');
    content = content.replace(/\bvi\.unmock\(/g, 'jest.unmock(');
    content = content.replace(/\bvi\.clearAllMocks\(/g, 'jest.clearAllMocks(');
    content = content.replace(/\bvi\.resetAllMocks\(/g, 'jest.resetAllMocks(');
    content = content.replace(/\bvi\.restoreAllMocks\(/g, 'jest.restoreAllMocks(');

    // Clean up empty imports lines
    content = content.replace(/import\s*{\s*}\s*from\s*['"]@jest\/globals['"]\s*;\n/g, '');
    content = content.replace(/import\s*{\s*}\s*;\n/g, '');

    modified = true;
  }

  // Also handle @jest/globals imports
  if (content.includes("from '@jest/globals'")) {
    // If it has 'vi', replace with 'jest'
    content = content.replace(
      /import\s*{\s*([^}]*)\s*}\s*from\s*['"]@jest\/globals['"]/g,
      (match, imports) => {
        const importList = imports
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

        const cleanImports = importList.filter((imp) => imp !== 'vi');
        if (cleanImports.length > 0) {
          return `// Jest globals auto-imported`;
        }
        return '';
      }
    );

    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf-8');
    migratedCount++;
    console.log(`✓ Migrated: ${file}`);
  }
});

console.log(`\nMigration complete: ${migratedCount} files updated`);
