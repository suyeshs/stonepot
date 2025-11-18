#!/usr/bin/env node

/**
 * Upload menu items from client menuData.ts to Firebase
 * This ensures backend can search the same menu that client displays
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Menu data (copied from stonepot-restaurant-client/app/data/menuData.ts)
const menuItems = [
  // Combos
  {
    name: 'Veg Kuttu Curry Combo [serves 1]',
    price: 199,
    description: 'Puttus, Otti or Rice of your choice - serves One',
    category: 'combos',
    type: 'veg',
    tag: 'bestseller',
    choices: ['Paputtu', 'Kadambuttu', 'Noolputtu', 'Akki Otti', 'Ney Kulu', 'Steamed Rice'],
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/7770c2bb-c535-4854-6ee6-a356bb407300/public',
    available: true,
    rating: 4.5
  },
  {
    name: 'Veg Curry Combo (Bimballe curry)',
    price: 199,
    description: 'Puttus, Otti or Rice of your choice - serves One',
    category: 'combos',
    type: 'veg',
    choices: ['Paputtu', 'Kadambuttu', 'Noolputtu', 'Akki Otti', 'Ney Kulu', 'Steamed Rice'],
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/7770c2bb-c535-4854-6ee6-a356bb407300/public',
    available: true
  },
  {
    name: 'Egg Curry Combo -1ps Eggserve 1',
    price: 240,
    description: 'Choose any one Puttu / Rice of your choice',
    category: 'combos',
    type: 'non-veg',
    choices: ['Paputtu', 'Kadambuttu', 'Noolputtu', 'Akki Otti', 'Ney Kulu', 'Steamed Rice'],
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/7770c2bb-c535-4854-6ee6-a356bb407300/public',
    available: true
  },
  {
    name: 'Pandi Curry Combo',
    price: 255,
    description: 'Choose any one Puttu / Rice of your choice',
    category: 'combos',
    type: 'non-veg',
    choices: ['Paputtu', 'Kadambuttu', 'Noolputtu', 'Akki Otti', 'Ney Kulu', 'Steamed Rice'],
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/dc08d86c-83d9-466f-56fc-959070195600/public',
    available: true
  },
  {
    name: 'Koli Curry Combo (Chicken)',
    price: 250,
    description: 'Choose any one Puttu / Rice of your choice',
    category: 'combos',
    type: 'non-veg',
    choices: ['Paputtu', 'Kadambuttu', 'Noolputtu', 'Akki Otti', 'Ney Kulu', 'Steamed Rice'],
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/7770c2bb-c535-4854-6ee6-a356bb407300/public',
    available: true
  },

  // Appetizers
  {
    name: 'Spicy Smoked Pork(onake Erachi)',
    price: 460,
    description: 'Onake Erachi Spicy Smoked Pork',
    category: 'appetizers',
    rating: 4.7,
    type: 'non-veg',
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/30bd3da1-423d-42f5-6a53-e7c3f471df00/public',
    available: true
  },
  {
    name: 'Mutton Pepper Fry',
    price: 460,
    description: 'Mutton roasted in fresh pepper sourced from our estates in Coorg.',
    category: 'appetizers',
    rating: 4.6,
    type: 'non-veg',
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/30bd3da1-423d-42f5-6a53-e7c3f471df00/public',
    available: true
  },
  {
    name: 'Pepper Chicken Fry(kodava Koli Bharthad',
    price: 300,
    description: 'Succulent pepper chicken fry.',
    category: 'appetizers',
    rating: 4.1,
    type: 'non-veg',
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/c4e60a3d-43a7-41d2-2b19-d64c18cc9600/public',
    available: true
  },
  {
    name: 'Chicken Cutlet-4ps',
    price: 315,
    description: 'Mildly spiced, soft chicken cutlets.',
    category: 'appetizers',
    rating: 4.1,
    type: 'non-veg',
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/c4e60a3d-43a7-41d2-2b19-d64c18cc9600/public',
    available: true
  },
  {
    name: 'Pork Fry (pandi Barthad)-220gm',
    price: 340,
    description: 'Slow cooked pork in traditional black masala.',
    category: 'appetizers',
    rating: 4.2,
    type: 'non-veg',
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/c4e60a3d-43a7-41d2-2b19-d64c18cc9600/public',
    available: true
  },
  {
    name: 'Veg Cutlet',
    price: 225,
    description: 'Check for the day special.',
    category: 'appetizers',
    type: 'veg',
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/2a0b331f-03f2-4daa-b9a0-5f25e2d6df00/public',
    available: true
  },
  {
    name: 'Crispy Bhendi Fry',
    price: 225,
    description: 'Ladies finger batter fried to a crisp with spices.',
    category: 'appetizers',
    type: 'veg',
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/6ce44b67-2b64-4211-9f8f-4f22b921e700/public',
    available: true
  },
  {
    name: 'Tangy Bitter Gourd Fry(kaipake Fry)',
    price: 225,
    description: 'Tangy bitter gourd fried, and seasoned with chilli and lime.',
    category: 'appetizers',
    type: 'veg',
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/d20f696b-956c-4f89-bd05-679c3e5d3400/public',
    available: true
  },
  {
    name: 'Kadle Palya',
    price: 210,
    description: 'Steamed black chana seasoned in spices.',
    category: 'appetizers',
    type: 'veg',
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/cee7e8b9-efed-41e5-c10c-2417d02fa300/public',
    available: true
  },
  {
    name: 'Crispy Banana Fritters(bale Kai Fry)',
    price: 225,
    description: 'Crispy Tangy raw banana fritters.',
    category: 'appetizers',
    type: 'veg',
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/2810bb84-7864-4891-4e2f-324568792500/public',
    available: true
  },

  // Ottis-Puttus-Rice
  {
    name: 'Paputtu',
    price: 60,
    description: 'Traditional Coorgi rice cake',
    category: 'ottis-puttus-rice',
    type: 'veg',
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/30bd3da1-423d-42f5-6a53-e7c3f471df00/public',
    available: true
  },
  {
    name: 'Kadambuttu',
    price: 60,
    description: 'Rice dumplings',
    category: 'ottis-puttus-rice',
    type: 'veg',
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/30bd3da1-423d-42f5-6a53-e7c3f471df00/public',
    available: true
  },
  {
    name: 'Noolputtu',
    price: 60,
    description: 'String hoppers',
    category: 'ottis-puttus-rice',
    type: 'veg',
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/30bd3da1-423d-42f5-6a53-e7c3f471df00/public',
    available: true
  },

  // Curries
  {
    name: 'Pandi Curry',
    price: 245,
    description: 'Traditional Coorgi pork curry',
    category: 'curries',
    type: 'non-veg',
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/30bd3da1-423d-42f5-6a53-e7c3f471df00/public',
    available: true
  },
  {
    name: 'Kadle Curry',
    price: 165,
    description: 'Black chickpea curry',
    category: 'curries',
    type: 'veg',
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/30bd3da1-423d-42f5-6a53-e7c3f471df00/public',
    available: true
  },
  {
    name: 'Koli Curry',
    price: 225,
    description: 'Spicy chicken curry',
    category: 'curries',
    type: 'non-veg',
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/30bd3da1-423d-42f5-6a53-e7c3f471df00/public',
    available: true
  },

  // Desserts
  {
    name: 'Payasam',
    price: 80,
    description: 'Sweet milk pudding with vermicelli',
    category: 'desserts',
    type: 'veg',
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/2810bb84-7864-4891-4e2f-324568792500/public',
    available: true
  },
  {
    name: 'Elaneer Payasam',
    price: 90,
    description: 'Tender coconut pudding',
    category: 'desserts',
    type: 'veg',
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/2810bb84-7864-4891-4e2f-324568792500/public',
    available: true
  },
  {
    name: 'Chikkrotti',
    price: 70,
    description: 'Traditional Coorgi sweet',
    category: 'desserts',
    type: 'veg',
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/2810bb84-7864-4891-4e2f-324568792500/public',
    available: true
  },

  // Coolers
  {
    name: 'Neer More',
    price: 60,
    description: 'Spiced buttermilk',
    category: 'coolers',
    type: 'veg',
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/2810bb84-7864-4891-4e2f-324568792500/public',
    available: true
  },
  {
    name: 'Fresh Lime Soda',
    price: 70,
    description: 'Refreshing lime soda',
    category: 'coolers',
    type: 'veg',
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/2810bb84-7864-4891-4e2f-324568792500/public',
    available: true
  },
  {
    name: 'Tender Coconut Water',
    price: 80,
    description: 'Natural coconut water',
    category: 'coolers',
    type: 'veg',
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/2810bb84-7864-4891-4e2f-324568792500/public',
    available: true
  },

  // Soups
  {
    name: 'Tomato Soup',
    price: 90,
    description: 'Classic tomato soup',
    category: 'soups',
    type: 'veg',
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/2810bb84-7864-4891-4e2f-324568792500/public',
    available: true
  },
  {
    name: 'Chicken Sweet Corn Soup',
    price: 110,
    description: 'Creamy chicken and corn soup',
    category: 'soups',
    type: 'non-veg',
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/2810bb84-7864-4891-4e2f-324568792500/public',
    available: true
  },
  {
    name: 'Mushroom Soup',
    price: 100,
    description: 'Creamy mushroom soup',
    category: 'soups',
    type: 'veg',
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/2810bb84-7864-4891-4e2f-324568792500/public',
    available: true
  }
];

async function uploadMenuToFirebase() {
  try {
    // Initialize Firebase Admin
    const serviceAccountPath = join(__dirname, '../credentials/sahamati-labs-firebase-key.json');
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

    initializeApp({
      credential: cert(serviceAccount),
      projectId: 'sahamati-labs'
    });

    const db = getFirestore();
    const tenantId = 'demo-restaurant';

    console.log(`📤 Uploading ${menuItems.length} menu items to Firebase...`);
    console.log(`   Tenant: ${tenantId}`);
    console.log(`   Collection: tenants/${tenantId}/menu_items\n`);

    let uploaded = 0;
    const batch = db.batch();

    for (const item of menuItems) {
      const docRef = db.collection('tenants').doc(tenantId).collection('menu_items').doc();

      // Transform to match backend schema
      const menuItem = {
        id: docRef.id,
        name: item.name,
        description: item.description,
        price: item.price,
        category: item.category,
        type: item.type,
        imageUrl: item.imageUrl,
        available: item.available !== false,
        rating: item.rating || null,
        reviews: item.reviews || null,
        tag: item.tag || null,
        choices: item.choices || null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      batch.set(docRef, menuItem);
      uploaded++;
    }

    await batch.commit();

    console.log(`✅ Successfully uploaded ${uploaded} menu items!`);
    console.log(`\nYou can now test voice ordering with dishes like:`);
    console.log(`  - "Tell me about Pandi Curry Combo"`);
    console.log(`  - "Add Chicken Cutlet to my order"`);
    console.log(`  - "Show me the Mutton Pepper Fry"\n`);

  } catch (error) {
    console.error('❌ Error uploading menu:', error);
    process.exit(1);
  }
}

uploadMenuToFirebase();
