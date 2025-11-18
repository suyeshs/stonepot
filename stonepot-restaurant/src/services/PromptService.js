/**
 * Prompt Service for Stonepot Restaurant
 * Handles prompt construction and response parsing for restaurant ordering
 */

class PromptService {
  constructor(multiLanguageService = null, conversationFlowService = null) {
    this.multiLanguageService = multiLanguageService;
    this.conversationFlowService = conversationFlowService;
  }

  buildPrompt(query, ragContext, conversationContext) {
    const { history, facts, currentLanguage } = conversationContext;
    const { content: context, sources } = ragContext;

    // Build facts context
    const factsContext = this.buildFactsContext(facts);

    // Build conversation history
    const fullHistory = history.map(msg => `${msg.role}: ${msg.content}`).join('\n');

    // Get language-specific instructions
    const languageInstructions = this.getLanguageInstructions(currentLanguage);

    // Build category-specific instructions
    const categoryInstruction = this.buildCategoryInstruction(facts.selectedCategory);

    // Construct the full prompt
    const prompt = `You are a helpful, friendly restaurant ordering assistant for Stonepot Restaurant. Use this context: ${context}${factsContext}

History: ${fullHistory}

Query: ${query}

Instructions:
${languageInstructions}
- Keep your responses brief, conversational, and natural for voice interaction.
- Translate numbers and prices into words in the spoken language (e.g., "twenty dollars" not "$20").
- Be enthusiastic about menu items and provide helpful recommendations.
- CRITICAL: When discussing dietary restrictions or allergies, ALWAYS remind customers to inform the staff for safe food preparation.
- Ask clarifying questions about preferences, dietary needs, or portion sizes when needed.
- Don't assume dish preferences unless explicitly mentioned - ask what they're in the mood for.
- Confirm orders clearly before finalizing.
- Be specific about prices and portion sizes when discussing menu items.
${categoryInstruction}

Response:`;

    return prompt;
  }

  extractResponseMetadata(response) {
    // Extract metadata from response if it contains structured information
    try {
      // Look for confidence indicators
      const confidenceMatch = response.match(/confidence[:\s]+(\d+\.?\d*)/i);
      const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.8;

      // Look for topic indicators
      const topicMatches = response.match(/topics?[:\s]+\[([^\]]+)\]/i);
      const topics = topicMatches ?
        topicMatches[1].split(',').map(t => t.trim().replace(/['"]/g, '')) :
        ['general'];

      // Determine tone from response style
      const tone = this.detectTone(response);

      // Determine length
      const length = this.detectLength(response);

      return {
        confidence,
        topics,
        tone,
        length,
        language: 'en',
        metadata: {
          provider: 'unknown',
          model: 'unknown',
          tokens: 0,
          latency: 0,
          timestamp: new Date().toISOString(),
          jsonParseSuccess: false,
          fallbackUsed: true
        }
      };
    } catch (error) {
      console.warn('[PromptService] Failed to extract metadata:', error);
      return {
        confidence: 0.6,
        topics: ['general'],
        tone: 'friendly',
        length: 'short',
        language: 'en',
        metadata: {
          provider: 'unknown',
          model: 'unknown',
          tokens: 0,
          latency: 0,
          timestamp: new Date().toISOString(),
          jsonParseSuccess: false,
          fallbackUsed: true
        }
      };
    }
  }

  /**
   * Enhance response with leading questions using ConversationFlowService
   */
  enhanceResponseWithLeadingQuestion(response, query, conversationContext) {
    if (!this.conversationFlowService) {
      return response;
    }

    try {
      // Analyze conversation context
      const flowContext = this.conversationFlowService.analyzeConversationContext(
        query,
        conversationContext.history || []
      );

      // Generate leading question
      const enhancedResponse = this.conversationFlowService.generateLeadingQuestion(
        flowContext,
        response
      );

      return enhancedResponse;
    } catch (error) {
      console.warn('[PromptService] Failed to enhance response with leading question:', error);
      return response;
    }
  }

  buildFactsContext(facts) {
    if (!facts || Object.keys(facts).length === 0) {
      return '';
    }

    const parts = [];
    if (facts.lastDishOrdered) {
      parts.push(`Last dish ordered: ${facts.lastDishOrdered}`);
    }
    if (facts.selectedCategory) {
      parts.push(`Menu category: ${facts.selectedCategory}`);
    }
    if (facts.dietaryPreferences) {
      parts.push(`Dietary preferences: ${facts.dietaryPreferences}`);
    }
    if (facts.orderContext) {
      parts.push(`Order context: ${facts.orderContext}`);
    }

    return parts.length > 0 ? `\nFACTS: ${parts.join(' | ')}` : '';
  }

  getLanguageInstructions(language) {
    if (language === 'en') {
      return '- Respond in English with clear, friendly language suitable for conversation.';
    }

    const languageConfig = this.multiLanguageService?.getLanguageConfig(language);
    const languageName = languageConfig?.name || language;

    return `- Respond in ${languageName} with clear, friendly language suitable for conversation.`;
  }

  buildCategoryInstruction(category) {
    if (!category) return '';

    switch (category) {
      case 'appetizers':
        return '\n- Focus on light starters and appetizers. Suggest portion sizes and sharing options.';
      case 'main_course':
      case 'mains':
        return '\n- Focus on main dishes. Describe flavors, cooking styles, and portion sizes. Ask about spice preferences.';
      case 'desserts':
        return '\n- Focus on sweet treats and desserts. Describe flavors and sweetness levels.';
      case 'beverages':
      case 'drinks':
        return '\n- Focus on drinks and beverages. Suggest pairings with food if relevant.';
      case 'dietary_special':
      case 'vegan':
      case 'vegetarian':
      case 'gluten_free':
        return '\n- Focus on dishes that meet specific dietary requirements. ALWAYS remind customers to inform staff about allergies.';
      default:
        return '';
    }
  }

  detectTone(response) {
    const lower = response.toLowerCase();

    if (lower.includes('i recommend') || lower.includes('you should try') || lower.includes('popular choice')) {
      return 'professional';
    }

    if (lower.includes('delicious!') || lower.includes('sounds great') || lower.includes('perfect choice')) {
      return 'friendly';
    }

    if (lower.includes('let me explain') || lower.includes('here\'s what') || lower.includes('this dish features')) {
      return 'educational';
    }

    return 'conversational';
  }

  detectLength(response) {
    const wordCount = response.split(/\s+/).length;

    if (wordCount <= 10) return 'ultra-short';
    if (wordCount <= 25) return 'short';
    if (wordCount <= 50) return 'moderate';
    return 'long';
  }
}

export { PromptService };
export default PromptService;
