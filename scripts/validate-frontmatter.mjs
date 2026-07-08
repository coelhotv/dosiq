import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get root directory (parent of scripts/)
const rootDir = path.resolve(__dirname, '..');

const semverRegex = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

// Allow string YYYY-MM-DD or raw Date object (js-yaml parses unquoted date as Date)
const dateSchema = z.union([
  z.string().regex(dateRegex, 'must be in YYYY-MM-DD format'),
  z.date().transform(d => d.toISOString().split('T')[0])
]);

// Define validation schema
const frontmatterSchema = z.object({
  title: z.string().min(1, 'title cannot be empty'),
  description: z.string().min(1, 'description cannot be empty'),
  version: z.string().regex(semverRegex, 'version must be a valid SemVer string (e.g. 1.0.0)'),
  status: z.enum(['active', 'draft', 'deprecated', 'archived']),
  category: z.enum([
    'architecture',
    'reference',
    'standard',
    'feature',
    'guide',
    'operation',
    'setup',
    'legal',
    'release'
  ]),
  audience: z.array(z.enum(['dev', 'agent', 'ops', 'product', 'legal'])).min(1, 'audience must contain at least one element'),
  tags: z.array(z.string()).optional(),
  created_at: dateSchema,
  updated_at: dateSchema,
  epic: z.union([z.string(), z.number()]).transform(String).optional(),
  supersedes: z.string().optional()
}).strict(); // strict schema: do not allow undocumented fields

// Helper to validate a file
function validateFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/);
    
    if (lines.length === 0 || lines[0].trim() !== '---') {
      return { success: false, errors: ['Missing YAML frontmatter starting marker "---" at line 1'] };
    }
    
    const closingIdx = lines.indexOf('---', 1);
    if (closingIdx === -1) {
      return { success: false, errors: ['Missing YAML frontmatter closing marker "---"'] };
    }
    
    const frontmatterYaml = lines.slice(1, closingIdx).join('\n');
    let parsedYaml;
    try {
      parsedYaml = yaml.load(frontmatterYaml);
    } catch (e) {
      return { success: false, errors: [`Invalid YAML syntax: ${e.message}`] };
    }
    
    if (!parsedYaml || typeof parsedYaml !== 'object') {
      return { success: false, errors: ['Frontmatter must be a valid YAML object'] };
    }
    
    const result = frontmatterSchema.safeParse(parsedYaml);
    if (!result.success) {
      const errorMsgs = result.error.issues.map(err => {
        const field = err.path.join('.');
        return `${field ? `Field "${field}": ` : ''}${err.message}`;
      });
      return { success: false, errors: errorMsgs };
    }
    
    return { success: true };
  } catch (err) {
    return { success: false, errors: [`Failed to read file: ${err.message}`] };
  }
}

// Ignore logic
function shouldIgnore(filePath) {
  const relPath = path.relative(rootDir, filePath);
  // Match docs/archive and docs/_schema explicitly
  return relPath.startsWith('docs/archive') || 
         relPath.startsWith('docs/_schema') || 
         relPath.split(path.sep).includes('archive') || 
         relPath.split(path.sep).includes('_schema');
}

// Recursive directory walker
function getFilesRecursively(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      if (shouldIgnore(filePath)) continue;
      getFilesRecursively(filePath, fileList);
    } else if (file.endsWith('.md')) {
      if (shouldIgnore(filePath)) continue;
      fileList.push(filePath);
    }
  }
  return fileList;
}

// Main execution block
function main() {
  const args = process.argv.slice(2);
  let targets = [];
  
  if (args.length > 0) {
    // Validate specified files or directories
    for (const arg of args) {
      const targetPath = path.resolve(rootDir, arg);
      if (!fs.existsSync(targetPath)) {
        console.error(`Error: Path does not exist: ${arg}`);
        process.exit(1);
      }
      const stat = fs.statSync(targetPath);
      if (stat.isDirectory()) {
        targets.push(...getFilesRecursively(targetPath));
      } else if (targetPath.endsWith('.md')) {
        targets.push(targetPath);
      } else {
        console.log(`Skipping non-markdown file: ${arg}`);
      }
    }
  } else {
    // Default to scan docs/ directory recursively
    const defaultTargetDir = path.join(rootDir, 'docs');
    if (!fs.existsSync(defaultTargetDir)) {
      console.error(`Error: Default directory docs/ does not exist.`);
      process.exit(1);
    }
    targets = getFilesRecursively(defaultTargetDir);
  }
  
  // Deduplicate target paths
  targets = Array.from(new Set(targets));
  
  if (targets.length === 0) {
    console.log('No markdown files found to validate.');
    process.exit(0);
  }
  
  const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    bold: '\x1b[1m'
  };
  
  let failedCount = 0;
  let checkedCount = 0;
  
  for (const target of targets) {
    checkedCount++;
    const result = validateFile(target);
    const relPath = path.relative(rootDir, target);
    
    if (!result.success) {
      failedCount++;
      console.error(`${colors.red}${colors.bold}✗ Fail:${colors.reset} ${relPath}`);
      for (const err of result.errors) {
        console.error(`  - ${err}`);
      }
    } else {
      console.log(`${colors.green}✓ Valid:${colors.reset} ${relPath}`);
    }
  }
  
  if (failedCount > 0) {
    console.error(`\n${colors.red}${colors.bold}Validation failed:${colors.reset} ${failedCount}/${checkedCount} file(s) had frontmatter errors.`);
    process.exit(1);
  } else {
    console.log(`\n${colors.green}${colors.bold}Validation successful:${colors.reset} ${checkedCount} file(s) checked.`);
    process.exit(0);
  }
}

main();
