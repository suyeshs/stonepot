'use client';

import { Mic, Globe, Sparkles } from 'lucide-react';

interface LandingScreenProps {
  onStartConversation: () => void;
}

export function LandingScreen({ onStartConversation }: LandingScreenProps) {
  const languages = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
  ];

  const examplePrompts = [
    {
      icon: '🍛',
      text: 'What\'s your best dish?',
      category: 'Recommendations'
    },
    {
      icon: '🌶️',
      text: 'Show me spicy dishes',
      category: 'Browse'
    },
    {
      icon: '🥗',
      text: 'I need vegetarian options',
      category: 'Dietary'
    },
    {
      icon: '🎯',
      text: 'What\'s popular today?',
      category: 'Trending'
    },
    {
      icon: '💰',
      text: 'What combos do you have?',
      category: 'Value'
    },
    {
      icon: '⏱️',
      text: 'What can I get quickly?',
      category: 'Quick'
    }
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="max-w-2xl w-full text-center">
          {/* Logo & Title */}
          <div className="mb-8">
            <div className="w-20 h-20 mx-auto mb-4 neu-card rounded-3xl flex items-center justify-center">
              <span className="text-4xl">🍽️</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold neu-text mb-2">
              Welcome to The Coorg Food Company
            </h1>
            <p className="text-base md:text-lg neu-text-secondary">
              Order your favorite dishes with your voice
            </p>
          </div>

          {/* Languages Supported */}
          <div className="mb-8">
            <div className="neu-card rounded-2xl p-6">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Globe className="w-5 h-5 neu-text" />
                <h2 className="text-sm font-semibold neu-text uppercase tracking-wide">
                  Languages Supported
                </h2>
              </div>
              <div className="flex items-center justify-center gap-6">
                {languages.map((lang) => (
                  <div
                    key={lang.code}
                    className="flex items-center gap-2 neu-concave rounded-xl px-4 py-3"
                  >
                    <span className="text-2xl">{lang.flag}</span>
                    <span className="font-medium neu-text">{lang.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Example Prompts */}
          <div className="mb-8">
            <div className="neu-card rounded-2xl p-6">
              <div className="flex items-center justify-center gap-2 mb-6">
                <Sparkles className="w-5 h-5 neu-text" />
                <h2 className="text-sm font-semibold neu-text uppercase tracking-wide">
                  Try asking me...
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {examplePrompts.map((prompt, index) => (
                  <button
                    key={index}
                    onClick={onStartConversation}
                    className="neu-concave rounded-xl p-4 text-left hover:scale-[1.02] active:scale-[0.98] transition-all group"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl flex-shrink-0">{prompt.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium neu-text group-hover:text-blue-500 transition-colors">
                          "{prompt.text}"
                        </p>
                        <p className="text-xs neu-text-secondary mt-1">
                          {prompt.category}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="neu-concave rounded-xl p-4 text-center">
              <div className="text-2xl mb-2">🎤</div>
              <h3 className="text-sm font-semibold neu-text mb-1">Voice-First</h3>
              <p className="text-xs neu-text-secondary">
                Natural conversation, hands-free ordering
              </p>
            </div>
            <div className="neu-concave rounded-xl p-4 text-center">
              <div className="text-2xl mb-2">⚡</div>
              <h3 className="text-sm font-semibold neu-text mb-1">Real-Time</h3>
              <p className="text-xs neu-text-secondary">
                Instant responses, visual feedback
              </p>
            </div>
            <div className="neu-concave rounded-xl p-4 text-center">
              <div className="text-2xl mb-2">🎯</div>
              <h3 className="text-sm font-semibold neu-text mb-1">Smart</h3>
              <p className="text-xs neu-text-secondary">
                Personalized recommendations
              </p>
            </div>
          </div>

          {/* Instructions */}
          <div className="neu-card rounded-2xl p-6 bg-blue-500/5 border border-blue-500/20">
            <h3 className="text-sm font-semibold neu-text mb-3 flex items-center justify-center gap-2">
              <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs">ℹ️</span>
              How it works
            </h3>
            <ol className="text-sm neu-text-secondary text-left space-y-2">
              <li className="flex items-start gap-2">
                <span className="font-bold text-blue-500">1.</span>
                <span>Tap the microphone button below to start</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-blue-500">2.</span>
                <span>Allow microphone access when prompted</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-blue-500">3.</span>
                <span>Start talking naturally about what you want</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-blue-500">4.</span>
                <span>See dishes appear as you talk, add to cart with voice</span>
              </li>
            </ol>
          </div>
        </div>
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-8 right-8 z-40">
        <button
          onClick={onStartConversation}
          className="neu-fab group"
          aria-label="Start voice conversation"
        >
          <div className="relative">
            <Mic className="w-8 h-8 text-blue-500 group-hover:text-blue-600 transition-colors" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
          </div>
          <span className="ml-4 font-semibold text-blue-500 group-hover:text-blue-600 transition-colors">
            Start Ordering
          </span>
        </button>

        {/* Pulse Animation */}
        <div className="absolute inset-0 neu-fab-pulse" />
      </div>
    </div>
  );
}
