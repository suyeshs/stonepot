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
   * Supports flexible column names
   */
  transformRow(row) {
    // Helper functions for flexible column name matching
    const getName = () => {
      return row['Dish Name'] || row['Name'] || row.name || row['Item Name'];
    };

    const getDescription = () => {
      return row['Description'] || row.description || row['Dish Description'] || '';
    };

    const getPrice = () => {
      const price = row['Price'] || row.price || row['Cost'] || 0;
      return parseFloat(price);
    };

    const getCategory = () => {
      const category = row['Category'] || row.category || 'other';
      return category.toLowerCase().trim().replace(/\s+/g, '_');
    };

    const getSubcategory = () => {
      return row['Subcategory'] || row.subcategory || row['Sub Category'] || null;
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
      const spice = row['Spice Level'] || row.spiceLevel || row['Spice'] || 'medium';
      return spice.toLowerCase();
    };

    const getPreparationTime = () => {
      return row['Preparation Time'] || row.preparationTime ||
             row['Prep Time'] || row['Cook Time'] || '15-20 minutes';
    };

    const getServingSize = () => {
      return row['Serving Size'] || row.servingSize || row['Serves'] || 'Serves 1';
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

    // Build menu item object
    return {
      name: name.trim(),
      description: getDescription().trim(),
      price: price,
      category: getCategory(),
      subcategory: getSubcategory(),
      allergens: getAllergens(),
      dietaryTags: getDietaryTags(),
      spiceLevel: getSpiceLevel(),
      preparationTime: getPreparationTime(),
      servingSize: getServingSize(),
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
   * Generate Excel template for menu import
   */
  generateTemplate() {
    const headers = [
      'Dish Name',
      'Description',
      'Price',
      'Category',
      'Subcategory',
      'Allergens',
      'Dietary Tags',
      'Spice Level',
      'Preparation Time',
      'Serving Size',
      'Available',
      'Image URL'
    ];

    const sampleData = [
      [
        'Butter Chicken',
        'Creamy tomato curry with tender chicken pieces',
        450,
        'main_course',
        'curry',
        'dairy, nuts',
        'non-vegetarian, gluten-free',
        'medium',
        '20-25 minutes',
        'Serves 1',
        'Yes',
        ''
      ],
      [
        'Paneer Tikka',
        'Grilled cottage cheese marinated in spices',
        350,
        'appetizer',
        'tandoor',
        'dairy',
        'vegetarian',
        'mild',
        '15-20 minutes',
        'Serves 1-2',
        'Yes',
        ''
      ]
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Menu');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }
}

export default ExcelParserService;
