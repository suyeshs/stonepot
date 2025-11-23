/**
 * Smart Menu Parser Service
 * Uses Gemini AI to intelligently parse menu documents in any format
 * Supports: PDF, Excel, Word, Images (no template required)
 */

import { GoogleGenerativeAI, GoogleAIFileManager } from '@google/generative-ai';
import { getFirebaseService } from './FirebaseService.js';

export class SmartMenuParserService {
  constructor(config) {
    this.apiKey = config?.vertexAi?.apiKey || process.env.GEMINI_API_KEY;

    if (!this.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    this.genAI = new GoogleGenerativeAI(this.apiKey);
    this.fileManager = new GoogleAIFileManager(this.apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.2, // Low temperature for consistent extraction
        responseMimeType: 'application/json'
      }
    });
  }

  /**
   * Parse any menu document using Gemini AI
   * @param {Buffer} fileBuffer - File buffer
   * @param {string} fileName - Original filename
   * @param {string} mimeType - MIME type
   * @returns {Promise<{items: Array, confidence: number, metadata: Object}>}
   */
  async parseDocument(fileBuffer, fileName, mimeType) {
    try {
      console.log('[SmartMenuParser] Parsing document:', {
        fileName,
        mimeType,
        size: fileBuffer.length
      });

      // Upload file to Gemini File API
      const uploadedFile = await this.uploadToGemini(fileBuffer, fileName, mimeType);

      console.log('[SmartMenuParser] File uploaded to Gemini:', {
        uri: uploadedFile.uri,
        state: uploadedFile.state
      });

      // Wait for file to be processed
      await this.waitForFileProcessing(uploadedFile.name);

      // Extract menu data using structured prompting
      const extractedData = await this.extractMenuData(uploadedFile);

      console.log('[SmartMenuParser] Extraction complete:', {
        itemCount: extractedData.items?.length || 0,
        confidence: extractedData.confidence
      });

      // Clean up uploaded file
      await this.fileManager.deleteFile(uploadedFile.name);

      return extractedData;

    } catch (error) {
      console.error('[SmartMenuParser] Parsing error:', error);
      throw new Error(`Failed to parse document: ${error.message}`);
    }
  }

  /**
   * Upload file to Gemini File API
   */
  async uploadToGemini(fileBuffer, fileName, mimeType) {
    // Create temporary file
    const tempPath = `/tmp/${Date.now()}-${fileName}`;
    const fs = await import('fs/promises');
    await fs.writeFile(tempPath, fileBuffer);

    try {
      const uploadResponse = await this.fileManager.uploadFile(tempPath, {
        mimeType,
        displayName: fileName
      });

      // Clean up temp file
      await fs.unlink(tempPath);

      return uploadResponse.file;
    } catch (error) {
      // Clean up temp file on error
      await fs.unlink(tempPath).catch(() => {});
      throw error;
    }
  }

  /**
   * Wait for file processing to complete
   */
  async waitForFileProcessing(fileName) {
    let file = await this.fileManager.getFile(fileName);
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max

    while (file.state === 'PROCESSING' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      file = await this.fileManager.getFile(fileName);
      attempts++;
    }

    if (file.state === 'FAILED') {
      throw new Error('File processing failed');
    }

    if (attempts >= maxAttempts) {
      throw new Error('File processing timeout');
    }

    return file;
  }

  /**
   * Extract menu data using Gemini with structured output
   */
  async extractMenuData(uploadedFile) {
    const prompt = this.buildExtractionPrompt();

    const result = await this.model.generateContent([
      {
        fileData: {
          mimeType: uploadedFile.mimeType,
          fileUri: uploadedFile.uri
        }
      },
      { text: prompt }
    ]);

    const response = result.response.text();
    const parsedData = JSON.parse(response);

    // Calculate overall confidence
    const confidence = this.calculateConfidence(parsedData);

    return {
      items: parsedData.menuItems || [],
      confidence,
      metadata: {
        extractedAt: new Date().toISOString(),
        source: uploadedFile.displayName,
        modelUsed: 'gemini-2.0-flash-exp'
      }
    };
  }

  /**
   * Build extraction prompt with schema definition
   */
  buildExtractionPrompt() {
    return `You are an expert at extracting structured menu data from various document formats (PDFs, Excel sheets, images, etc.).

Extract ALL menu items from the provided document and return them in the following JSON format:

{
  "menuItems": [
    {
      "name": "Item name in English",
      "nameLocal": "Item name in local script (if available)",
      "description": "Item description",
      "descriptionLocal": "Description in local script (if available)",
      "price": 12.99,
      "currency": "USD",
      "category": "Main course/Appetizer/Dessert/etc",
      "subcategory": "Specific category if mentioned",
      "isVeg": true|false,
      "isVegan": true|false,
      "isHalal": true|false,
      "isKosher": true|false,
      "containsGluten": true|false,
      "containsDairy": true|false,
      "containsNuts": true|false,
      "containsShellfish": true|false,
      "allergens": ["Gluten", "Nuts", "Dairy"],
      "dietaryTags": ["Vegan", "Gluten-Free"],
      "spiceLevel": 0-5,
      "preparationTime": "15 mins",
      "servingSize": "Serves 2",
      "calories": 450,
      "isPopular": true|false,
      "isChefSpecial": true|false,
      "available": true,
      "confidence": 0.0-1.0
    }
  ]
}

IMPORTANT INSTRUCTIONS:
1. Extract ALL visible menu items - don't skip any
2. Infer dietary information based on ingredients if not explicitly stated
3. Detect allergens from ingredient lists
4. Use appropriate currency codes (USD, EUR, INR, JPY, etc.)
5. Categorize items logically (Appetizers, Mains, Desserts, Drinks, etc.)
6. For each field, provide a "confidence" score (0.0-1.0) based on how certain you are
7. If a field is not available in the document, use null or reasonable defaults:
   - isVeg/isVegan/etc: false if unknown
   - allergens/dietaryTags: empty arrays if unknown
   - spiceLevel: 0 if unknown
   - available: true by default
8. Preserve original formatting and spelling
9. Handle multi-language menus by extracting both English and local names
10. Detect price patterns even if formatting varies ($12, 12.00, ₹500, etc.)

Return ONLY the JSON object, no additional text.`;
  }

  /**
   * Calculate overall confidence score
   */
  calculateConfidence(parsedData) {
    if (!parsedData.menuItems || parsedData.menuItems.length === 0) {
      return 0;
    }

    const confidenceScores = parsedData.menuItems
      .map(item => item.confidence || 0.8)
      .filter(score => score > 0);

    if (confidenceScores.length === 0) {
      return 0.5; // Default confidence
    }

    return confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length;
  }

  /**
   * Validate and clean extracted data
   */
  validateAndClean(items) {
    return items.map(item => {
      // Ensure required fields
      if (!item.name || !item.price) {
        return null;
      }

      // Clean and normalize
      return {
        name: item.name.trim(),
        nameLocal: item.nameLocal?.trim() || null,
        description: item.description?.trim() || '',
        descriptionLocal: item.descriptionLocal?.trim() || null,
        price: parseFloat(item.price) || 0,
        currency: item.currency || 'USD',
        category: item.category?.trim() || 'Uncategorized',
        subcategory: item.subcategory?.trim() || null,
        isVeg: Boolean(item.isVeg),
        isVegan: Boolean(item.isVegan),
        isHalal: Boolean(item.isHalal),
        isKosher: Boolean(item.isKosher),
        containsGluten: Boolean(item.containsGluten),
        containsDairy: Boolean(item.containsDairy),
        containsNuts: Boolean(item.containsNuts),
        containsShellfish: Boolean(item.containsShellfish),
        allergens: Array.isArray(item.allergens) ? item.allergens : [],
        dietaryTags: Array.isArray(item.dietaryTags) ? item.dietaryTags : [],
        spiceLevel: Math.min(Math.max(parseInt(item.spiceLevel) || 0, 0), 5),
        preparationTime: item.preparationTime || null,
        servingSize: item.servingSize || null,
        calories: parseInt(item.calories) || null,
        variants: item.variants || [],
        addons: item.addons || [],
        isPopular: Boolean(item.isPopular),
        isChefSpecial: Boolean(item.isChefSpecial),
        available: item.available !== false,
        confidence: parseFloat(item.confidence) || 0.8
      };
    }).filter(item => item !== null);
  }
}

export default SmartMenuParserService;
