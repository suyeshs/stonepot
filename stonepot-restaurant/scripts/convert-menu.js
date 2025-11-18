#!/usr/bin/env node
/**
 * TCFC Menu Excel to JSON Converter
 * Converts Excel menu to JSONL (for Vertex AI RAG) and hierarchical JSON (for client display)
 */

import XLSX from 'xlsx';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const EXCEL_FILE = join(__dirname, '../../stonepot-restaurant-display/TCFC Menu.xlsx');
const OUTPUT_DIR = join(__dirname, '../data');
const CLOUDFLARE_IMAGE_BASE = 'https://imagedelivery.net/YOUR_ACCOUNT_HASH'; // TODO: Update with actual hash

// Category mapping
const CATEGORY_MAP = {
  'APPETIZERS': { id: 'appetizers', type: 'appetizer', displayOrder: 1, description: 'Traditional Coorg starters' },
  'OTTIS, PUTTUS AND RICE': { id: 'rice-dishes', type: 'main', displayOrder: 2, description: 'Rice and traditional Coorg flatbreads' },
  'CURRIES': { id: 'curries', type: 'curry', displayOrder: 3, description: 'Authentic Coorg curries' },
  'DESSERTS': { id: 'desserts', type: 'dessert', displayOrder: 4, description: 'Sweet treats to end your meal' },
  'COOLERS': { id: 'beverages', type: 'beverage', displayOrder: 5, description: 'Refreshing drinks' },
  'SOUPS': { id: 'soups', type: 'soup', displayOrder: 6, description: 'Warm and comforting soups' }
};

/**
 * Clean and normalize price
 */
function normalizePrice(value) {
  if (!value) return null;

  // Remove ₹ symbol and whitespace
  const cleaned = String(value).replace(/[₹\s]/g, '');
  const parsed = parseFloat(cleaned);

  return isNaN(parsed) ? null : parsed;
}

/**
 * Extract dietary tags from item name and description
 */
function extractDietaryTags(name, description) {
  const tags = [];
  const text = `${name} ${description}`.toLowerCase();

  // Check for vegetarian marker
  if (name.includes('(V)') || name.includes(' V ')) {
    tags.push('vegetarian');
  } else if (text.includes('chicken') || text.includes('koli') || text.includes('pork') ||
             text.includes('pandi') || text.includes('mutton') || text.includes('erachi') ||
             text.includes('fish') || text.includes('prawn') || text.includes('egg')) {
    tags.push('non-veg');
  }

  // Check for spicy markers
  if (text.includes('spicy') || text.includes('fire') || text.includes('chilly') ||
      text.includes('chilli') || text.includes('hot')) {
    tags.push('spicy');
  }

  return tags.length > 0 ? tags : ['non-veg']; // Default to non-veg if not specified
}

/**
 * Infer spice level from description (1-5 scale)
 */
function inferSpiceLevel(description) {
  const text = description.toLowerCase();

  if (text.includes('extra spicy') || text.includes('fire') || text.includes('birds eye chilly')) {
    return 5;
  } else if (text.includes('spicy') || text.includes('hot')) {
    return 3;
  } else if (text.includes('mild')) {
    return 1;
  }

  return 2; // Default medium
}

/**
 * Extract tags from name and description
 */
function extractTags(name, description, category) {
  const tags = new Set();
  const text = `${name} ${description}`.toLowerCase();

  // Ingredient tags
  const ingredients = ['chicken', 'pork', 'mutton', 'fish', 'prawn', 'egg', 'paneer',
                       'mushroom', 'vegetables', 'rice', 'puttu', 'otti'];

  ingredients.forEach(ingredient => {
    if (text.includes(ingredient)) {
      tags.add(ingredient);
    }
  });

  // Cooking style tags
  if (text.includes('fry') || text.includes('fried')) tags.add('fried');
  if (text.includes('grilled')) tags.add('grilled');
  if (text.includes('roasted')) tags.add('roasted');
  if (text.includes('curry')) tags.add('curry');

  // Regional tags
  if (text.includes('coorg') || text.includes('kodava')) tags.add('coorg');
  if (text.includes('traditional')) tags.add('traditional');

  return Array.from(tags);
}

/**
 * Create searchable text field
 */
function createSearchText(item, category) {
  return [
    item.name,
    item.description,
    category,
    ...(item.dietary || []),
    ...(item.tags || [])
  ].filter(Boolean).join(' ').toLowerCase();
}

/**
 * Parse main menu sheet
 */
function parseMainMenu(sheet) {
  const data = XLSX.utils.sheet_to_json(sheet, { header: 'A', defval: '' });
  const items = [];
  let currentCategory = null;
  let itemCounter = {};

  data.forEach((row, index) => {
    // Skip header row
    if (index === 0) return;

    const categoryName = row.A?.trim();
    const itemName = row.B?.trim();
    const description = row.C?.trim();
    const variantPrice = normalizePrice(row.D);
    const fullPrice = normalizePrice(row.E);
    const imageId = row.F?.toString().trim();

    // Check if this is a category row
    if (categoryName && CATEGORY_MAP[categoryName]) {
      currentCategory = categoryName;
      itemCounter[currentCategory] = (itemCounter[currentCategory] || 0);
      return;
    }

    // Skip if no item name or no current category
    if (!itemName || !currentCategory) return;

    // Skip if no price
    if (!variantPrice) return;

    // Increment counter for this category
    itemCounter[currentCategory]++;

    const categoryInfo = CATEGORY_MAP[currentCategory];
    const dietary = extractDietaryTags(itemName, description);
    const tags = extractTags(itemName, description, currentCategory);
    const spiceLevel = inferSpiceLevel(description);

    const item = {
      id: `${categoryInfo.id}-${String(itemCounter[currentCategory]).padStart(3, '0')}`,
      type: categoryInfo.type,
      name: itemName,
      description: description || '',
      variantPrice,
      fullPrice,
      imageId: imageId || null,
      imageUrl: imageId ? `${CLOUDFLARE_IMAGE_BASE}/${imageId}/public` : null,
      category: currentCategory,
      dietary,
      allergens: [],
      spiceLevel,
      tags,
      available: true
    };

    // Add searchText for RAG
    item.searchText = createSearchText(item, currentCategory);

    items.push(item);
  });

  return items;
}

/**
 * Parse combos sheet
 */
function parseCombos(sheet) {
  const data = XLSX.utils.sheet_to_json(sheet, { header: 'A', defval: '', raw: false });
  const combos = [];
  let comboCounter = 0;
  let currentCombo = null;
  let sideOptions = [];

  // Side options that appear in the combos section
  const standardSides = ['Paputtu', 'Kadambuttu', 'Noolputtu', 'Akki Otti', 'Ney Kulu', 'Steamed Rice'];

  data.forEach((row, index) => {
    // Skip header row
    if (index === 0 || row.B === 'COMBO MEALS') return;

    const itemName = row.B?.trim();
    const description = row.C?.trim();
    const price = normalizePrice(row.D);
    const imageId = row.E?.toString().trim();

    // Skip empty rows
    if (!itemName) return;

    // Check if this is a side option row
    if (standardSides.includes(itemName)) {
      sideOptions.push(itemName);
      return;
    }

    // Check if this is an instruction row
    if (itemName.includes('Choose anyone') || itemName.includes('choice')) {
      return;
    }

    // This is a combo meal row (has a price)
    if (price) {
      // If we have a previous combo with collected sides, save it
      if (currentCombo && sideOptions.length > 0) {
        currentCombo.sideOptions = [...sideOptions];
        combos.push(currentCombo);
        currentCombo = null;
      }

      comboCounter++;

      // Extract curry options from the name (in parentheses)
      const curryMatch = itemName.match(/\((.*?)\)/);
      const curryOptions = curryMatch
        ? curryMatch[1].split(/[,/]/).map(s => s.trim())
        : [];

      const cleanName = itemName.replace(/\s*\(.*?\)\s*/g, '').trim();
      const dietary = extractDietaryTags(itemName, description);

      currentCombo = {
        id: `combo-${String(comboCounter).padStart(3, '0')}`,
        type: 'combo',
        name: cleanName,
        description: description || '',
        curryOptions,
        sideOptions: [], // Will be filled when we encounter the next combo or end
        price,
        imageId: imageId || null,
        imageUrl: imageId ? `${CLOUDFLARE_IMAGE_BASE}/${imageId}/public` : null,
        dietary,
        allergens: [],
        tags: ['combo', 'meal'],
        available: true
      };

      // Reset side options for next combo
      sideOptions = [];
    }
  });

  // Don't forget the last combo
  if (currentCombo) {
    if (sideOptions.length > 0) {
      currentCombo.sideOptions = [...sideOptions];
    } else {
      // Use standard sides if none were collected
      currentCombo.sideOptions = [...standardSides];
    }
    combos.push(currentCombo);
  }

  // Add searchText for RAG to each combo
  combos.forEach(combo => {
    combo.searchText = createSearchText(combo, 'COMBOS');
  });

  return combos;
}

/**
 * Generate JSONL format for Vertex AI RAG
 */
function generateJSONL(items, combos) {
  const allItems = [...items, ...combos];
  return allItems.map(item => JSON.stringify(item)).join('\n');
}

/**
 * Generate hierarchical JSON for client display
 */
function generateHierarchicalJSON(items, combos) {
  const categories = {};

  // Group items by category
  items.forEach(item => {
    const categoryKey = item.category;
    if (!categories[categoryKey]) {
      const categoryInfo = CATEGORY_MAP[categoryKey];
      categories[categoryKey] = {
        id: categoryInfo.id,
        name: categoryKey,
        description: categoryInfo.description,
        displayOrder: categoryInfo.displayOrder,
        items: []
      };
    }

    // Remove searchText from client display format
    const { searchText, ...displayItem } = item;
    categories[categoryKey].items.push(displayItem);
  });

  // Sort categories by display order
  const sortedCategories = Object.values(categories)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  // Remove searchText from combos
  const displayCombos = combos.map(({ searchText, ...combo }) => combo);

  return {
    lastUpdated: new Date().toISOString(),
    restaurant: 'The Coorg Flavours Company',
    version: '1.0',
    categories: sortedCategories,
    combos: displayCombos,
    metadata: {
      totalItems: items.length,
      totalCombos: combos.length,
      categoriesCount: sortedCategories.length
    }
  };
}

/**
 * Generate metadata file
 */
function generateMetadata(items, combos) {
  const categoryStats = {};

  items.forEach(item => {
    if (!categoryStats[item.category]) {
      categoryStats[item.category] = {
        count: 0,
        avgPrice: 0,
        priceRange: { min: Infinity, max: 0 }
      };
    }

    const stats = categoryStats[item.category];
    stats.count++;

    if (item.variantPrice) {
      stats.priceRange.min = Math.min(stats.priceRange.min, item.variantPrice);
      stats.priceRange.max = Math.max(stats.priceRange.max, item.variantPrice);
    }
  });

  // Calculate averages
  Object.keys(categoryStats).forEach(category => {
    const categoryItems = items.filter(item => item.category === category);
    const totalPrice = categoryItems.reduce((sum, item) => sum + (item.variantPrice || 0), 0);
    categoryStats[category].avgPrice = Math.round(totalPrice / categoryItems.length);
  });

  return {
    generated: new Date().toISOString(),
    source: 'TCFC Menu.xlsx',
    schema: {
      jsonl: {
        description: 'JSONL format for Vertex AI RAG ingestion',
        fields: {
          id: 'string - unique identifier',
          type: 'string - item type (appetizer, main, curry, dessert, beverage, soup, combo)',
          name: 'string - dish name',
          description: 'string - dish description',
          variantPrice: 'number - smaller portion price',
          fullPrice: 'number - larger portion price (optional)',
          imageId: 'string - image identifier',
          imageUrl: 'string - full image URL',
          category: 'string - menu category',
          dietary: 'array - dietary tags (vegetarian, non-veg, spicy)',
          allergens: 'array - allergen information',
          spiceLevel: 'number - spice level (1-5)',
          tags: 'array - searchable tags',
          searchText: 'string - concatenated searchable content',
          available: 'boolean - availability status'
        }
      },
      hierarchical: {
        description: 'Hierarchical JSON for client display',
        structure: 'categories array with nested items, separate combos array'
      }
    },
    statistics: {
      totalItems: items.length,
      totalCombos: combos.length,
      categoryBreakdown: categoryStats
    }
  };
}

/**
 * Main conversion function
 */
function convertMenu() {
  console.log('🍽️  TCFC Menu Converter');
  console.log('========================\n');

  try {
    // Read Excel file
    console.log(`📖 Reading Excel file: ${EXCEL_FILE}`);
    const workbook = XLSX.readFile(EXCEL_FILE);

    // Check sheets
    console.log(`📊 Found ${workbook.SheetNames.length} sheets:`, workbook.SheetNames);

    // Parse main menu
    console.log('\n🔍 Parsing main menu...');
    const mainMenuSheet = workbook.Sheets[workbook.SheetNames[0]];
    const items = parseMainMenu(mainMenuSheet);
    console.log(`✅ Parsed ${items.length} menu items`);

    // Parse combos
    console.log('\n🔍 Parsing combos...');
    const combosSheet = workbook.Sheets[workbook.SheetNames[1]];
    const combos = parseCombos(combosSheet);
    console.log(`✅ Parsed ${combos.length} combo meals`);

    // Create output directory
    mkdirSync(OUTPUT_DIR, { recursive: true });

    // Generate JSONL for Vertex AI RAG
    console.log('\n📝 Generating JSONL for Vertex AI RAG...');
    const jsonl = generateJSONL(items, combos);
    const jsonlPath = join(OUTPUT_DIR, 'menu-items.jsonl');
    writeFileSync(jsonlPath, jsonl, 'utf8');
    console.log(`✅ Saved: ${jsonlPath}`);
    console.log(`   Lines: ${items.length + combos.length}`);

    // Generate hierarchical JSON for client
    console.log('\n📝 Generating hierarchical JSON for client...');
    const hierarchical = generateHierarchicalJSON(items, combos);
    const jsonPath = join(OUTPUT_DIR, 'menu-display.json');
    writeFileSync(jsonPath, JSON.stringify(hierarchical, null, 2), 'utf8');
    console.log(`✅ Saved: ${jsonPath}`);
    console.log(`   Categories: ${hierarchical.categories.length}`);
    console.log(`   Total Items: ${hierarchical.metadata.totalItems}`);

    // Generate metadata
    console.log('\n📝 Generating metadata...');
    const metadata = generateMetadata(items, combos);
    const metadataPath = join(OUTPUT_DIR, 'menu-metadata.json');
    writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
    console.log(`✅ Saved: ${metadataPath}`);

    // Print summary
    console.log('\n✨ Conversion Complete!');
    console.log('========================');
    console.log(`📁 Output directory: ${OUTPUT_DIR}`);
    console.log(`📄 Files created:`);
    console.log(`   - menu-items.jsonl (${(jsonl.length / 1024).toFixed(2)} KB)`);
    console.log(`   - menu-display.json (${(JSON.stringify(hierarchical).length / 1024).toFixed(2)} KB)`);
    console.log(`   - menu-metadata.json`);
    console.log('\n📊 Statistics:');
    console.log(`   Total Items: ${items.length}`);
    console.log(`   Total Combos: ${combos.length}`);
    console.log(`   Categories: ${hierarchical.categories.length}`);

    console.log('\n🚀 Next Steps:');
    console.log('   1. Upload menu-items.jsonl to Google Cloud Storage');
    console.log('   2. Ingest into Vertex AI Search datastore');
    console.log('   3. Upload menu-display.json to Cloudflare KV');
    console.log('   4. Update Cloudflare Worker to serve menu data');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run conversion
convertMenu();
