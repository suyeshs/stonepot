import express from 'express';

const router = express.Router();

// Menu data to upload (same as client)
const MENU_ITEMS = [
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
  // Add all other items...
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
  }
];

/**
 * Upload menu items to Firebase
 * POST /api/admin/menu/upload
 */
router.post('/upload', async (req, res) => {
  try {
    const { firebaseService } = req.app.locals;
    const tenantId = req.body.tenantId || 'demo-restaurant';

    console.log(`[MenuUpload] Uploading ${MENU_ITEMS.length} items for tenant ${tenantId}`);

    let uploaded = 0;
    for (const item of MENU_ITEMS) {
      const menuItem = {
        name: item.name,
        description: item.description,
        price: item.price,
        category: item.category,
        type: item.type,
        imageUrl: item.imageUrl,
        available: item.available !== false,
        rating: item.rating || null,
        tag: item.tag || null,
        choices: item.choices || null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await firebaseService.createDocument(
        `tenants/${tenantId}/menu_items`,
        menuItem
      );
      uploaded++;
    }

    res.json({
      success: true,
      uploaded,
      tenant: tenantId,
      message: `Successfully uploaded ${uploaded} menu items`
    });

  } catch (error) {
    console.error('[MenuUpload] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
