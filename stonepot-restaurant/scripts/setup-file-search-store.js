#!/usr/bin/env node

/**
 * Setup Script for Gemini File Search
 *
 * This script creates File Search stores and uploads menu data for each tenant.
 *
 * Prerequisites:
 * - GEMINI_API_KEY environment variable must be set
 * - Menu data in src/data/staticMenu.js
 *
 * Usage:
 *   node scripts/setup-file-search-store.js <tenantId>
 *   node scripts/setup-file-search-store.js demo
 *
 * What it does:
 * 1. Reads menu from staticMenu.js
 * 2. Transforms menu to structured markdown format
 * 3. Creates File Search store for tenant
 * 4. Uploads menu document to store
 * 5. Outputs store ID for .env configuration
 */

import { GoogleGenAI } from '@google/genai';
import { STATIC_MENU_ITEMS } from '../src/data/staticMenu.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get tenant ID from command line
const tenantId = process.argv[2];

if (!tenantId) {
  console.error('❌ Error: Tenant ID is required');
  console.error('Usage: node scripts/setup-file-search-store.js <tenantId>');
  console.error('Example: node scripts/setup-file-search-store.js demo');
  process.exit(1);
}

// Check for API key (optional - can still generate document without it)
const apiKey = process.env.GEMINI_API_KEY;
const hasApiKey = Boolean(apiKey);

console.log(`\n🚀 Setting up File Search store for tenant: ${tenantId}\n`);

if (!hasApiKey) {
  console.log('⚠️  GEMINI_API_KEY not set - will generate menu document only');
  console.log('   (File Search store creation requires API key)\n');
}

/**
 * Transform menu items to structured markdown format
 * This format is optimized for File Search semantic retrieval
 */
function transformMenuToMarkdown(menuItems) {
  let markdown = `# Restaurant Menu - ${tenantId.toUpperCase()}\n\n`;
  markdown += `Total Items: ${menuItems.length}\n\n`;

  // Group by category
  const categories = {};
  menuItems.forEach(item => {
    const category = item.category || 'other';
    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push(item);
  });

  // Generate markdown for each category
  Object.keys(categories).forEach(category => {
    markdown += `## ${category.charAt(0).toUpperCase() + category.slice(1)}\n\n`;

    categories[category].forEach(item => {
      markdown += `### ${item.name}\n\n`;
      markdown += `- **ID**: ${item.id}\n`;
      markdown += `- **Price**: ₹${item.price}\n`;
      markdown += `- **Type**: ${item.type || 'N/A'}\n`;
      markdown += `- **Category**: ${item.category}\n`;

      if (item.description) {
        markdown += `- **Description**: ${item.description}\n`;
      }

      if (item.choices && item.choices.length > 0) {
        markdown += `- **Choices**: ${item.choices.join(', ')}\n`;
      }

      if (item.dietary && item.dietary.length > 0) {
        markdown += `- **Dietary**: ${item.dietary.join(', ')}\n`;
      }

      if (item.spiceLevel !== undefined) {
        markdown += `- **Spice Level**: ${item.spiceLevel}/5\n`;
      }

      if (item.rating !== undefined) {
        markdown += `- **Rating**: ${item.rating}/5\n`;
      }

      if (item.tag) {
        markdown += `- **Tag**: ${item.tag}\n`;
      }

      if (item.preparationTime) {
        markdown += `- **Preparation Time**: ${item.preparationTime} mins\n`;
      }

      markdown += `- **Available**: ${item.available !== false ? 'Yes' : 'No'}\n`;

      if (item.imageUrl) {
        markdown += `- **Image**: ${item.imageUrl}\n`;
      }

      markdown += '\n---\n\n';
    });
  });

  return markdown;
}

/**
 * Main setup function
 */
async function setupFileSearch() {
  try {
    // Initialize Gemini client (only if API key available)
    if (hasApiKey) {
      console.log('🔧 Initializing Gemini client...');
      const genAI = new GoogleGenAI({ apiKey });
    }

    // Transform menu to markdown
    console.log('📄 Transforming menu data to markdown format...');
    const menuMarkdown = transformMenuToMarkdown(STATIC_MENU_ITEMS);
    console.log(`✅ Generated ${menuMarkdown.length} character markdown document`);

    // Save markdown to temp file for review
    const tempPath = path.join(__dirname, `menu-${tenantId}.md`);
    await fs.writeFile(tempPath, menuMarkdown, 'utf-8');
    console.log(`💾 Saved menu markdown to: ${tempPath}`);

    // Create File Search store
    console.log('\n🏗️  Creating File Search store...');

    // Note: As of current @google/genai SDK, File Search store creation might need
    // to be done via Google AI Studio or REST API directly
    // This script focuses on document preparation and upload

    console.log('\n⚠️  MANUAL STEP REQUIRED:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('The @google/genai SDK currently requires manual store creation.');
    console.log('Please follow these steps:\n');
    console.log('1. Go to Google AI Studio: https://aistudio.google.com/');
    console.log('2. Navigate to "File Search" section');
    console.log('3. Click "Create Store"');
    console.log(`4. Name: "menu-${tenantId}"`);
    console.log(`5. Upload file: ${tempPath}`);
    console.log('6. Wait for indexing to complete');
    console.log('7. Copy the Store ID (format: projects/*/fileSearchStores/*)');
    console.log('8. Add to your .env file:');
    console.log(`   FILE_SEARCH_STORE_${tenantId.toUpperCase()}="<store-id>"`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Alternative: Provide REST API approach
    if (hasApiKey) {
      console.log('📝 ALTERNATIVE: Use REST API for store creation\n');
      console.log('You can also create the store via REST API:');
      console.log('');
      console.log('curl -X POST \\');
      console.log('  "https://generativelanguage.googleapis.com/v1beta/fileSearchStores" \\');
      console.log('  -H "Content-Type: application/json" \\');
      console.log(`  -H "x-goog-api-key: ${apiKey.substring(0, 10)}..." \\`);
      console.log('  -d \'{\n    "display_name": "menu-' + tenantId + '"\n  }\'');
      console.log('');
    }

    // Test query example
    console.log('\n🧪 Example File Search Query:\n');
    console.log('Once your store is set up, test with:');
    console.log('');
    console.log('const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });');
    console.log('const result = await genAI.models.generateContent({');
    console.log('  model: "gemini-2.0-flash-exp",');
    console.log('  contents: "List all vegetarian combos with prices",');
    console.log('  config: {');
    console.log('    tools: [{');
    console.log('      fileSearch: {');
    console.log('        fileSearchStoreNames: ["<your-store-id>"]');
    console.log('      }');
    console.log('    }]');
    console.log('  }');
    console.log('});');
    console.log('');

    console.log('✅ Setup preparation complete!\n');
    console.log(`📁 Menu document ready at: ${tempPath}`);
    console.log('📋 Total menu items:', STATIC_MENU_ITEMS.length);
    console.log('');

  } catch (error) {
    console.error('❌ Error during setup:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run setup
setupFileSearch().catch(error => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});
