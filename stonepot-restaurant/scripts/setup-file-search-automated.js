#!/usr/bin/env node

/**
 * Fully Automated File Search Setup Script
 *
 * Uses @google/genai SDK for programmatic store creation and file upload
 * No manual Google AI Studio steps required!
 *
 * Usage:
 *   node scripts/setup-file-search-automated.js <tenantId>
 *   node scripts/setup-file-search-automated.js demo
 *
 * What it does:
 * 1. Reads menu from staticMenu.js
 * 2. Transforms menu to structured markdown
 * 3. Creates File Search store via SDK
 * 4. Uploads and indexes menu document automatically
 * 5. Outputs store ID for .env configuration
 */

import { FileSearchService } from '../src/services/FileSearchService.js';
import { STATIC_MENU_ITEMS } from '../src/data/staticMenu.js';
import config from '../src/config/index.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get tenant ID from command line
const tenantId = process.argv[2];

if (!tenantId) {
  console.error('❌ Error: Tenant ID is required');
  console.error('Usage: node scripts/setup-file-search-automated.js <tenantId>');
  console.error('Example: node scripts/setup-file-search-automated.js demo');
  process.exit(1);
}

// Check for API key
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('❌ Error: GEMINI_API_KEY environment variable is not set');
  console.error('Please set your Gemini API key:');
  console.error('  export GEMINI_API_KEY="your-api-key-here"');
  process.exit(1);
}

console.log(`\n🚀 Automated File Search Setup for tenant: ${tenantId}\n`);

/**
 * Transform menu items to structured markdown format
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
    // Initialize File Search Service
    console.log('🔧 Initializing File Search Service...');
    const fileSearchConfig = {
      fileSearch: {
        enabled: true,
        apiKey: apiKey,
        stores: {}
      }
    };
    const fileSearchService = new FileSearchService(fileSearchConfig);

    // Transform menu to markdown
    console.log('📄 Transforming menu data to markdown...');
    const menuMarkdown = transformMenuToMarkdown(STATIC_MENU_ITEMS);
    console.log(`✅ Generated ${menuMarkdown.length} characters`);

    // Save markdown to file
    const menuPath = path.join(__dirname, `menu-${tenantId}.md`);
    await fs.writeFile(menuPath, menuMarkdown, 'utf-8');
    console.log(`💾 Saved to: ${menuPath}\n`);

    // Create File Search store
    console.log('🏗️  Creating File Search store...');
    const displayName = `menu-${tenantId}`;
    const store = await fileSearchService.createStore(displayName);
    console.log(`✅ Store created: ${store.name}\n`);

    // Upload menu document to store
    console.log('📤 Uploading menu document...');
    await fileSearchService.uploadToStore(
      store.name,
      menuPath,
      `${tenantId}-menu-document`,
      {
        whiteSpaceConfig: {
          maxTokensPerChunk: 256,
          maxOverlapTokens: 32
        }
      }
    );
    console.log('✅ Menu uploaded and indexed!\n');

    // Output configuration
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ SETUP COMPLETE!\n');
    console.log('Add this to your .env file:\n');
    console.log(`FILE_SEARCH_ENABLED=true`);
    console.log(`FILE_SEARCH_STORE_${tenantId.toUpperCase()}="${store.name}"`);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📋 Summary:');
    console.log(`   Tenant: ${tenantId}`);
    console.log(`   Store ID: ${store.name}`);
    console.log(`   Menu Items: ${STATIC_MENU_ITEMS.length}`);
    console.log(`   Menu Size: ${menuMarkdown.length} characters`);
    console.log(`   Menu File: ${menuPath}\n`);

    console.log('🧪 Test your setup:');
    console.log('   1. Update your .env with the configuration above');
    console.log('   2. Restart your server');
    console.log('   3. File Search will be used automatically for menu queries\n');

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run setup
setupFileSearch().catch(error => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});
