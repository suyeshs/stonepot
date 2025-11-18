#!/usr/bin/env node
/**
 * Load TCFC Menu Data into Firebase
 * Loads menu items from menu-display.json into Firestore
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import FirebaseService from '../src/services/FirebaseService.js';
import config from '../src/config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const MENU_FILE = join(__dirname, '../data/menu-display.json');
const TENANT_ID = 'demo-restaurant';

/**
 * Load menu data into Firebase
 */
async function loadMenuData() {
  console.log('🔥 Firebase Menu Loader');
  console.log('======================\n');

  try {
    // Initialize Firebase service
    console.log('📡 Initializing Firebase...');
    const firebaseService = new FirebaseService(config);
    await firebaseService.initialize();
    console.log('✅ Firebase initialized\n');

    // Read menu data
    console.log(`📖 Reading menu file: ${MENU_FILE}`);
    const menuData = JSON.parse(readFileSync(MENU_FILE, 'utf8'));
    console.log(`✅ Loaded menu data for: ${menuData.restaurant}`);
    console.log(`   Categories: ${menuData.categories.length}`);
    console.log(`   Total Items: ${menuData.metadata.totalItems}`);
    console.log(`   Total Combos: ${menuData.metadata.totalCombos}\n`);

    // Create restaurant profile
    console.log('📝 Creating restaurant profile...');
    const restaurantProfile = {
      tenantId: TENANT_ID,
      name: menuData.restaurant,
      description: 'Authentic Coorg cuisine with traditional flavors',
      cuisine: ['Coorg', 'South Indian', 'Traditional'],
      location: {
        city: 'Bangalore',
        state: 'Karnataka',
        country: 'India'
      },
      contactInfo: {
        phone: '+91-XXXXXXXXXX',
        email: 'info@coorgflavours.com'
      },
      menuVersion: menuData.version,
      menuLastUpdated: menuData.lastUpdated,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true
    };

    await firebaseService.createDocument('restaurants', restaurantProfile, TENANT_ID);
    console.log(`✅ Restaurant profile created\n`);

    // Load menu items
    console.log('📝 Loading menu items...');
    let itemCount = 0;

    for (const category of menuData.categories) {
      console.log(`\n   Processing category: ${category.name}`);

      for (const item of category.items) {
        const menuItem = {
          tenantId: TENANT_ID,
          type: 'menu_item',  // Document type for Firebase query
          itemId: item.id,
          dishType: item.type,  // Dish category (appetizer, curry, etc.)
          name: item.name,
          description: item.description,
          price: item.variantPrice,
          fullPrice: item.fullPrice,
          imageId: item.imageId,
          imageUrl: item.imageUrl,
          category: category.name,
          categoryId: category.id,
          categoryOrder: category.displayOrder,
          dietary: item.dietary,
          allergens: item.allergens,
          spiceLevel: item.spiceLevel,
          tags: item.tags,
          available: item.available,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await firebaseService.createDocument('tenant_content', menuItem, item.id);
        itemCount++;
        process.stdout.write(`\r   Items loaded: ${itemCount}`);
      }
    }

    console.log(`\n   ✅ Loaded ${itemCount} menu items`);

    // Load combos
    console.log('\n📝 Loading combo meals...');
    let comboCount = 0;

    for (const combo of menuData.combos) {
      const comboItem = {
        tenantId: TENANT_ID,
        type: 'menu_item',  // Document type for Firebase query
        itemId: combo.id,
        dishType: combo.type,  // 'combo'
        name: combo.name,
        description: combo.description,
        price: combo.price,
        curryOptions: combo.curryOptions,
        sideOptions: combo.sideOptions,
        imageId: combo.imageId,
        imageUrl: combo.imageUrl,
        dietary: combo.dietary,
        allergens: combo.allergens,
        tags: combo.tags,
        available: combo.available,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await firebaseService.createDocument('tenant_content', comboItem, combo.id);
      comboCount++;
      process.stdout.write(`\r   Combos loaded: ${comboCount}`);
    }

    console.log(`\n   ✅ Loaded ${comboCount} combo meals`);

    // Create menu metadata
    console.log('\n📝 Creating menu metadata...');
    const metadata = {
      tenantId: TENANT_ID,
      version: menuData.version,
      lastUpdated: menuData.lastUpdated,
      totalItems: menuData.metadata.totalItems,
      totalCombos: menuData.metadata.totalCombos,
      categoriesCount: menuData.metadata.categoriesCount,
      categories: menuData.categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        description: cat.description,
        displayOrder: cat.displayOrder,
        itemCount: cat.items.length
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await firebaseService.createDocument('menu_metadata', metadata, TENANT_ID);
    console.log(`✅ Menu metadata created\n`);

    // Print summary
    console.log('✨ Menu Data Load Complete!');
    console.log('===========================');
    console.log(`📊 Summary:`);
    console.log(`   Restaurant: ${menuData.restaurant}`);
    console.log(`   Tenant ID: ${TENANT_ID}`);
    console.log(`   Menu Items: ${itemCount}`);
    console.log(`   Combo Meals: ${comboCount}`);
    console.log(`   Categories: ${menuData.categories.length}`);
    console.log('\n🚀 Next Steps:');
    console.log('   1. Verify data in Firebase Console');
    console.log('   2. Test menu search API endpoints');
    console.log('   3. Deploy updated backend to Cloud Run');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run loader
loadMenuData();
