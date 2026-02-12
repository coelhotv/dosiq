/**
 * Import Fix Script for Feature Organization Refactor
 * 
 * This script fixes all remaining relative imports in the codebase
 * to use the new path aliases.
 */

const fs = require('fs');
const path = require('path');

// Import mapping from old paths to new path aliases
const importMappings = [
  // Two-level relative paths (../../)
  { from: /from ['"]\.\.\/\.\.\/lib\/supabase['"]/g, to: "from '@shared/utils/supabase'" },
  { from: /from ['"]\.\.\/\.\.\/services\/api\/cachedServices['"]/g, to: "from '@shared/services/cachedServices'" },
  { from: /from ['"]\.\.\/\.\.\/services\/api\/medicineService['"]/g, to: "from '@medications/services/medicineService'" },
  { from: /from ['"]\.\.\/\.\.\/services\/api\/protocolService['"]/g, to: "from '@protocols/services/protocolService'" },
  { from: /from ['"]\.\.\/\.\.\/services\/api\/stockService['"]/g, to: "from '@stock/services/stockService'" },
  { from: /from ['"]\.\.\/\.\.\/services\/api\/logService['"]/g, to: "from '@shared/services/api/logService'" },
  { from: /from ['"]\.\.\/\.\.\/services\/api\/treatmentPlanService['"]/g, to: "from '@protocols/services/treatmentPlanService'" },
  { from: /from ['"]\.\.\/\.\.\/services\/api\/titrationService['"]/g, to: "from '@protocols/services/titrationService'" },
  { from: /from ['"]\.\.\/\.\.\/services\/insightService['"]/g, to: "from '@dashboard/services/insightService'" },
  { from: /from ['"]\.\.\/\.\.\/services\/analyticsService['"]/g, to: "from '@dashboard/services/analyticsService'" },
  { from: /from ['"]\.\.\/\.\.\/services\/milestoneService['"]/g, to: "from '@dashboard/services/milestoneService'" },
  { from: /from ['"]\.\.\/\.\.\/services\/adherenceTrendService['"]/g, to: "from '@dashboard/services/adherenceTrendService'" },
  { from: /from ['"]\.\.\/\.\.\/services\/paginationService['"]/g, to: "from '@shared/services/paginationService'" },
  { from: /from ['"]\.\.\/\.\.\/services\/migrationService['"]/g, to: "from '@shared/services/migrationService'" },
  { from: /from ['"]\.\.\/\.\.\/services\/index['"]/g, to: "from '@shared/services'" },
  { from: /from ['"]\.\.\/\.\.\/hooks\/useCachedQuery['"]/g, to: "from '@shared/hooks/useCachedQuery'" },
  { from: /from ['"]\.\.\/\.\.\/hooks\/useTheme['"]/g, to: "from '@shared/hooks/useTheme'" },
  { from: /from ['"]\.\.\/\.\.\/hooks\/useShake['"]/g, to: "from '@shared/hooks/useShake'" },
  { from: /from ['"]\.\.\/\.\.\/hooks\/useHapticFeedback['"]/g, to: "from '@shared/hooks/useHapticFeedback'" },
  { from: /from ['"]\.\.\/\.\.\/hooks\/useAdherenceTrend['"]/g, to: "from '@adherence/hooks/useAdherenceTrend'" },
  { from: /from ['"]\.\.\/\.\.\/hooks\/useInsights['"]/g, to: "from '@dashboard/hooks/useInsights'" },
  { from: /from ['"]\.\.\/\.\.\/hooks\/useDashboardContext['"]/g, to: "from '@dashboard/hooks/useDashboardContext'" },
  { from: /from ['"]\.\.\/\.\.\/utils\/adherenceLogic['"]/g, to: "from '@dashboard/utils/adherenceLogic'" },
  { from: /from ['"]\.\.\/\.\.\/utils\/titrationUtils['"]/g, to: "from '@protocols/utils/titrationUtils'" },
  { from: /from ['"]\.\.\/\.\.\/utils\/queryCache['"]/g, to: "from '@shared/utils/queryCache'" },
  { from: /from ['"]\.\.\/\.\.\/schemas\/medicineSchema['"]/g, to: "from '@medications/constants/medicineSchema'" },
  { from: /from ['"]\.\.\/\.\.\/schemas\/protocolSchema['"]/g, to: "from '@protocols/constants/protocolSchema'" },
  { from: /from ['"]\.\.\/\.\.\/schemas\/stockSchema['"]/g, to: "from '@stock/constants/stockSchema'" },
  { from: /from ['"]\.\.\/\.\.\/schemas\/logSchema['"]/g, to: "from '@shared/constants/logSchema'" },
  { from: /from ['"]\.\.\/\.\.\/schemas\/index['"]/g, to: "from '@shared/constants'" },
  { from: /from ['"]\.\.\/\.\.\/schemas\/validationHelper['"]/g, to: "from '@shared/constants/validationHelper'" },
  { from: /from ['"]\.\.\/\.\.\/components\/ui\//g, to: "from '@shared/components/ui/" },
  { from: /from ['"]\.\.\/\.\.\/components\/log\//g, to: "from '@shared/components/log/" },
  { from: /from ['"]\.\.\/\.\.\/components\/gamification\//g, to: "from '@shared/components/gamification/" },
  { from: /from ['"]\.\.\/\.\.\/components\/onboarding\//g, to: "from '@shared/components/onboarding/" },
  { from: /from ['"]\.\.\/\.\.\/components\/animations\//g, to: "from '@shared/components/ui/animations/" },
  { from: /from ['"]\.\.\/\.\.\/components\/medicine\//g, to: "from '@medications/components/" },
  { from: /from ['"]\.\.\/\.\.\/components\/protocol\//g, to: "from '@protocols/components/" },
  { from: /from ['"]\.\.\/\.\.\/components\/stock\//g, to: "from '@stock/components/" },
  { from: /from ['"]\.\.\/\.\.\/components\/adherence\//g, to: "from '@adherence/components/" },
  { from: /from ['"]\.\.\/\.\.\/components\/dashboard\//g, to: "from '@dashboard/components/" },
  { from: /from ['"]\.\.\/\.\.\/styles\/index\.css['"]/g, to: "from '@shared/styles/index.css'" },
  
  // One-level relative paths (../) - feature internal
  { from: /from ['"]\.\.\/services\/medicineService['"]/g, to: "from '@medications/services/medicineService'" },
  { from: /from ['"]\.\.\/services\/protocolService['"]/g, to: "from '@protocols/services/protocolService'" },
  { from: /from ['"]\.\.\/services\/stockService['"]/g, to: "from '@stock/services/stockService'" },
  { from: /from ['"]\.\.\/services\/adherenceService['"]/g, to: "from '@adherence/services/adherenceService'" },
  { from: /from ['"]\.\.\/services\/titrationService['"]/g, to: "from '@protocols/services/titrationService'" },
  { from: /from ['"]\.\.\/services\/treatmentPlanService['"]/g, to: "from '@protocols/services/treatmentPlanService'" },
  { from: /from ['"]\.\.\/services\/insightService['"]/g, to: "from '@dashboard/services/insightService'" },
  { from: /from ['"]\.\.\/services\/analyticsService['"]/g, to: "from '@dashboard/services/analyticsService'" },
  { from: /from ['"]\.\.\/services\/milestoneService['"]/g, to: "from '@dashboard/services/milestoneService'" },
  { from: /from ['"]\.\.\/services\/adherenceTrendService['"]/g, to: "from '@dashboard/services/adherenceTrendService'" },
  { from: /from ['"]\.\.\/constants\/medicineSchema['"]/g, to: "from '@medications/constants/medicineSchema'" },
  { from: /from ['"]\.\.\/constants\/protocolSchema['"]/g, to: "from '@protocols/constants/protocolSchema'" },
  { from: /from ['"]\.\.\/constants\/stockSchema['"]/g, to: "from '@stock/constants/stockSchema'" },
  { from: /from ['"]\.\.\/utils\/adherenceLogic['"]/g, to: "from '@dashboard/utils/adherenceLogic'" },
  { from: /from ['"]\.\.\/utils\/titrationUtils['"]/g, to: "from '@protocols/utils/titrationUtils'" },
  { from: /from ['"]\.\.\/hooks\/useCachedQuery['"]/g, to: "from '@shared/hooks/useCachedQuery'" },
  { from: /from ['"]\.\.\/hooks\/useInsights['"]/g, to: "from '@dashboard/hooks/useInsights'" },
  { from: /from ['"]\.\.\/hooks\/useDashboardContext['"]/g, to: "from '@dashboard/hooks/useDashboardContext'" },
  { from: /from ['"]\.\.\/hooks\/useAdherenceTrend['"]/g, to: "from '@adherence/hooks/useAdherenceTrend'" },
  { from: /from ['"]\.\.\/components\//g, to: "from './" },
];

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let newContent = content;
  let modified = false;

  for (const mapping of importMappings) {
    if (mapping.from.test(newContent)) {
      newContent = newContent.replace(mapping.from, mapping.to);
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, newContent);
    console.log(`✅ Fixed: ${filePath}`);
    return true;
  }
  return false;
}

function walkDir(dir, callback) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory() && !file.includes('__tests__') && !file.includes('node_modules')) {
      walkDir(fullPath, callback);
    } else if ((file.endsWith('.js') || file.endsWith('.jsx')) && !file.includes('.test.')) {
      callback(fullPath);
    }
  }
}

// Process directories
const dirsToProcess = [
  'src/shared/components',
  'src/shared/services',
  'src/shared/hooks',
  'src/shared/utils',
  'src/features',
];

let totalFixed = 0;

console.log('🔧 Fixing imports...\n');

for (const dir of dirsToProcess) {
  if (fs.existsSync(dir)) {
    walkDir(dir, (filePath) => {
      if (processFile(filePath)) {
        totalFixed++;
      }
    });
  }
}

console.log(`\n✨ Done! Fixed ${totalFixed} files.`);
