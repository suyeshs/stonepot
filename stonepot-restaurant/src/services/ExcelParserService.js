/**
 * Excel Parser Service
 * Parses Excel/CSV files to extract menu items
 */

import XLSX from 'xlsx';

export class ExcelParserService {
  /**
   * Parse menu from Excel file buffer
   * @param {Buffer} fileBuffer - Excel file buffer
   * @returns {Array} Array of menu items
   */
  async parseMenuExcel(fileBuffer) {
    try {
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Convert to JSON
      const rawData = XLSX.utils.sheet_to_json(worksheet);

      console.log('[ExcelParserService] Parsed Excel file', {
        sheets: workbook.SheetNames.length,
        rows: rawData.length
      });

      // Transform each row to menu item format
      const menuItems = rawData.map((row, index) => {
        try {
          return this.transformRow(row);
        } catch (error) {
          console.error(`[ExcelParserService] Failed to parse row ${index + 2}:`, error.message);
          return null;
        }
      }).filter(Boolean); // Remove null entries

      return menuItems;
    } catch (error) {
      console.error('[ExcelParserService] Parse error:', error);
      throw new Error(`Failed to parse Excel file: ${error.message}`);
    }
  }

  /**
   * Transform Excel row to menu item object
   * Supports flexible column names + GLOBAL FIELDS
   */
  transformRow(row) {
    // Helper functions for flexible column name matching
    const getName = () => {
      return row['Dish Name'] || row['Item Name'] || row['Name'] || row.name;
    };

    const getNameLocal = () => {
      return row['Name (Local Script)'] || row['Name Local'] || row.nameLocal || null;
    };

    const getDescription = () => {
      return row['Description'] || row.description || row['Dish Description'] || '';
    };

    const getDescriptionLocal = () => {
      return row['Description (Local)'] || row['Description Local'] || row.descriptionLocal || null;
    };

    const getPrice = () => {
      const price = row['Price'] || row.price || row['Cost'] || 0;
      return parseFloat(price);
    };

    const getCurrency = () => {
      return row['Currency'] || row.currency || 'INR';
    };

    const getCategory = () => {
      const category = row['Category'] || row.category || 'other';
      return category.toLowerCase().trim().replace(/\s+/g, '_');
    };

    const getSubcategory = () => {
      return row['Subcategory'] || row['Sub Category'] || row.subcategory || null;
    };

    // Dietary flags (global fields)
    const getIsVeg = () => {
      const veg = row['Veg'] || row['Is Veg'] || row.isVeg || '';
      return veg === 'Yes' || veg === 'yes' || veg === true || veg === 'TRUE';
    };

    const getIsVegan = () => {
      const vegan = row['Vegan'] || row['Is Vegan'] || row.isVegan || '';
      return vegan === 'Yes' || vegan === 'yes' || vegan === true || vegan === 'TRUE';
    };

    const getIsHalal = () => {
      const halal = row['Halal'] || row['Is Halal'] || row.isHalal || '';
      return halal === 'Yes' || halal === 'yes' || halal === true || halal === 'TRUE';
    };

    const getIsKosher = () => {
      const kosher = row['Kosher'] || row['Is Kosher'] || row.isKosher || '';
      return kosher === 'Yes' || kosher === 'yes' || kosher === true || kosher === 'TRUE';
    };

    const getContainsGluten = () => {
      const gluten = row['Contains Gluten'] || row['Gluten Free'] || row.containsGluten || '';
      if (String(gluten).toLowerCase() === 'no' || String(gluten).toLowerCase() === 'false') return false;
      return gluten === 'Yes' || gluten === 'yes' || gluten === true || gluten === 'TRUE';
    };

    const getContainsDairy = () => {
      const dairy = row['Contains Dairy'] || row['Dairy'] || row.containsDairy || '';
      return dairy === 'Yes' || dairy === 'yes' || dairy === true || dairy === 'TRUE';
    };

    const getContainsNuts = () => {
      const nuts = row['Contains Nuts'] || row['Nuts'] || row.containsNuts || '';
      return nuts === 'Yes' || nuts === 'yes' || nuts === true || nuts === 'TRUE';
    };

    const getContainsShellfish = () => {
      const shellfish = row['Contains Shellfish'] || row['Shellfish'] || row.containsShellfish || '';
      return shellfish === 'Yes' || shellfish === 'yes' || shellfish === true || shellfish === 'TRUE';
    };

    const getAllergens = () => {
      return this.parseArray(row['Allergens'] || row.allergens || row['Allergen Info']);
    };

    const getDietaryTags = () => {
      return this.parseArray(
        row['Dietary Tags'] || row['Dietary'] || row.dietary ||
        row['Diet Type'] || row['Dietary Info']
      );
    };

    const getSpiceLevel = () => {
      const spice = row['Spice Level'] || row.spiceLevel || row['Spice'] || 0;
      const level = parseInt(spice) || 0;
      return Math.min(Math.max(level, 0), 5); // 0-5 range
    };

    const getPreparationTime = () => {
      return row['Preparation Time'] || row.preparationTime ||
             row['Prep Time'] || row['Cook Time'] || '15-20 minutes';
    };

    const getServingSize = () => {
      return row['Serving Size'] || row['Portion Size'] || row.servingSize || row.portionSize || 'Serves 1';
    };

    const getCalories = () => {
      const cal = row['Calories'] || row.calories || 0;
      return parseInt(cal) || 0;
    };

    const getVariants = () => {
      const variants = row['Variants'] || row.variants || '';
      if (!variants) return [];
      try {
        // Try JSON parse first
        if (typeof variants === 'string' && variants.startsWith('[')) {
          return JSON.parse(variants);
        }
        // Otherwise parse as "Name:Price, Name:Price"
        return variants.split(',').map(v => {
          const [name, priceAdj] = v.split(':');
          return { name: name?.trim(), priceAdjustment: parseFloat(priceAdj) || 0 };
        }).filter(v => v.name);
      } catch (e) {
        return [];
      }
    };

    const getAddons = () => {
      const addons = row['Addons'] || row['Add-ons'] || row.addons || '';
      if (!addons) return [];
      try {
        if (typeof addons === 'string' && addons.startsWith('[')) {
          return JSON.parse(addons);
        }
        return addons.split(',').map(a => {
          const [name, price] = a.split(':');
          return { name: name?.trim(), price: parseFloat(price) || 0 };
        }).filter(a => a.name);
      } catch (e) {
        return [];
      }
    };

    const getIsPopular = () => {
      const popular = row['Popular'] || row['Is Popular'] || row.isPopular || '';
      return popular === 'Yes' || popular === 'yes' || popular === true || popular === 'TRUE';
    };

    const getIsChefSpecial = () => {
      const special = row['Chef Special'] || row['Is Chef Special'] || row.isChefSpecial || '';
      return special === 'Yes' || special === 'yes' || special === true || special === 'TRUE';
    };

    const getAvailable = () => {
      const available = row['Available'] || row.available || 'Yes';
      return available !== 'No' && available !== false && available !== '0';
    };

    const getImageUrl = () => {
      return row['Image URL'] || row.imageUrl || row['Image'] || null;
    };

    // Validate required fields
    const name = getName();
    const price = getPrice();

    if (!name) {
      throw new Error('Missing required field: Dish Name/Name');
    }

    if (isNaN(price) || price < 0) {
      throw new Error(`Invalid price for ${name}: ${price}`);
    }

    // Build menu item object with GLOBAL FIELDS
    return {
      // Core fields
      name: name.trim(),
      nameLocal: getNameLocal(),
      description: getDescription().trim(),
      descriptionLocal: getDescriptionLocal(),
      price: price,
      currency: getCurrency(),
      category: getCategory(),
      subcategory: getSubcategory(),

      // Dietary flags
      isVeg: getIsVeg(),
      isVegan: getIsVegan(),
      isHalal: getIsHalal(),
      isKosher: getIsKosher(),
      containsGluten: getContainsGluten(),
      containsDairy: getContainsDairy(),
      containsNuts: getContainsNuts(),
      containsShellfish: getContainsShellfish(),
      allergens: getAllergens(),
      dietaryTags: getDietaryTags(),

      // Additional metadata
      spiceLevel: getSpiceLevel(),
      preparationTime: getPreparationTime(),
      servingSize: getServingSize(),
      calories: getCalories(),
      variants: getVariants(),
      addons: getAddons(),
      isPopular: getIsPopular(),
      isChefSpecial: getIsChefSpecial(),

      // Availability
      available: getAvailable(),
      imageUrl: getImageUrl()
    };
  }

  /**
   * Parse comma/semicolon separated values into array
   */
  parseArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;

    // Split by comma or semicolon and clean up
    return value
      .toString()
      .split(/[,;]/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  /**
   * Validate menu item
   */
  validateMenuItem(item) {
    const errors = [];

    // Required fields
    if (!item.name) errors.push('Missing dish name');
    if (typeof item.price !== 'number' || item.price < 0) {
      errors.push('Invalid price');
    }

    // Valid categories
    const validCategories = ['appetizer', 'main_course', 'dessert', 'beverage', 'other'];
    if (!validCategories.includes(item.category)) {
      errors.push(`Invalid category: ${item.category}`);
    }

    // Valid spice levels
    const validSpiceLevels = ['mild', 'medium', 'hot', 'extra-hot', 'none'];
    if (!validSpiceLevels.includes(item.spiceLevel)) {
      errors.push(`Invalid spice level: ${item.spiceLevel}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Parse CSV file (alternative to Excel)
   */
  async parseMenuCSV(csvContent) {
    try {
      const workbook = XLSX.read(csvContent, { type: 'string' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      const rawData = XLSX.utils.sheet_to_json(worksheet);

      const menuItems = rawData.map((row, index) => {
        try {
          return this.transformRow(row);
        } catch (error) {
          console.error(`[ExcelParserService] Failed to parse CSV row ${index + 2}:`, error.message);
          return null;
        }
      }).filter(Boolean);

      return menuItems;
    } catch (error) {
      console.error('[ExcelParserService] CSV parse error:', error);
      throw new Error(`Failed to parse CSV file: ${error.message}`);
    }
  }

  /**
   * Generate Excel template for menu import (GLOBAL VERSION)
   */
  generateTemplate() {
    const headers = [
      'Item Name',
      'Name (Local Script)',
      'Description',
      'Description (Local)',
      'Price',
      'Currency',
      'Category',
      'Sub Category',
      'Veg',
      'Vegan',
      'Halal',
      'Kosher',
      'Contains Gluten',
      'Contains Dairy',
      'Contains Nuts',
      'Contains Shellfish',
      'Allergens',
      'Dietary Tags',
      'Spice Level (0-5)',
      'Preparation Time',
      'Portion Size',
      'Calories',
      'Variants',
      'Addons',
      'Popular',
      'Chef Special',
      'Available'
    ];

    const sampleData = [
      [
        'Margherita Pizza',
        'مارغريتا',
        'Classic Italian pizza with tomato, mozzarella, basil',
        'بيتزا إيطالية كلاسيكية',
        12.99,
        'USD',
        'pizza',
        'vegetarian',
        'Yes',
        'No',
        'Yes',
        'No',
        'No',
        'Yes',
        'No',
        'No',
        'dairy',
        'vegetarian',
        1,
        '15-20 minutes',
        '12 inch',
        850,
        'Large:+3.00, Small:-2.00',
        'Extra Cheese:1.50',
        'Yes',
        'Yes',
        'Yes'
      ],
      [
        'Pandi Curry',
        'ಪಂದಿ ಕರಿ',
        'Traditional Coorgi pork curry with kachampuli',
        'ಕಚ್ಚಂಪುಳಿ ಜೊತೆ ಸಾಂಪ್ರದಾಯಿಕ ಕೊಡಗು ಹಂದಿ ಮಾಂಸ ಕರಿ',
        350,
        'INR',
        'main_course',
        'curry',
        'No',
        'No',
        'No',
        'No',
        'No',
        'No',
        'No',
        'No',
        '',
        'non-vegetarian, spicy',
        3,
        '25-30 minutes',
        'Serves 2',
        1100,
        'Half:-100',
        'Raita:50',
        'Yes',
        'Yes',
        'Yes'
      ],
      [
        'Tonkotsu Ramen',
        '豚骨ラーメン',
        'Rich pork bone broth ramen',
        '濃厚豚骨スープのラーメン',
        1400,
        'JPY',
        'ramen',
        '',
        'No',
        'No',
        'No',
        'No',
        'Yes',
        'No',
        'No',
        'No',
        'gluten, soy',
        'non-vegetarian',
        2,
        '20 minutes',
        'Full bowl',
        920,
        '',
        'Extra Noodles:+200, Chashu:+300',
        'Yes',
        'Yes',
        'Yes'
      ]
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Menu');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }
}

export default ExcelParserService;
