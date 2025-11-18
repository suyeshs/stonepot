'use client';

import { useState, useRef, useEffect } from 'react';
import { VertexAILiveService } from './services/VertexAILiveService';
import { DisplayWebSocketService } from './services/DisplayWebSocket';
import { MultimodalDisplay } from './components/MultimodalDisplay';
import { ProgressOrb } from './components/ProgressOrb';
import { Cart } from './components/Cart';
import { CartIsland } from './components/CartIsland';
import Menu from './components/Menu';
import { menuStore } from './stores/menuStore';
import { cartStore } from './stores/cartStore';
import { menuItems } from './data/menuData';
import { observer } from 'mobx-react-lite';

const RestaurantOrderingApp = observer(function RestaurantOrderingApp() {
  // Session state
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Display state
  const [displayService, setDisplayService] = useState<DisplayWebSocketService | null>(null);
  const [currentDisplay, setCurrentDisplay] = useState<any>(null);
  const [transcriptions, setTranscriptions] = useState<any[]>([]);

  // UI state
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [orderingStep, setOrderingStep] = useState(1);
  const [showCart, setShowCart] = useState(false);
  const lastScrollY = useRef(0);

  // Audio visualization
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(32).fill(0));
  const [conversationTime, setConversationTime] = useState(0);

  // Refs for voice service
  const vertexAILiveServiceRef = useRef<VertexAILiveService | null>(null);
  const recordingContextRef = useRef<AudioContext | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef(0);
  const isPlayingRef = useRef(false);
  const lastSpeechStartRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const idleAnimationRef = useRef<number | null>(null);
  const conversationStartTimeRef = useRef<number>(0);

  // Conversation timer
  useEffect(() => {
    if (isSessionActive) {
      conversationStartTimeRef.current = Date.now();
      setConversationTime(0);

      const timer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - conversationStartTimeRef.current) / 1000);
        setConversationTime(elapsed);
      }, 1000);

      return () => clearInterval(timer);
    } else {
      setConversationTime(0);
      conversationStartTimeRef.current = 0;
    }
  }, [isSessionActive]);

  // Auto-hide header on scroll
  useEffect(() => {
    if (!isSessionActive) return;

    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      const currentScrollY = target.scrollTop;

      if (currentScrollY > lastScrollY.current && currentScrollY > 50) {
        // Scrolling down - hide header
        setIsHeaderVisible(false);
      } else if (currentScrollY < lastScrollY.current) {
        // Scrolling up - show header
        setIsHeaderVisible(true);
      }

      lastScrollY.current = currentScrollY;
    };

    const mainElement = document.querySelector('main');
    mainElement?.addEventListener('scroll', handleScroll);

    return () => {
      mainElement?.removeEventListener('scroll', handleScroll);
    };
  }, [isSessionActive]);

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Idle animation
  const startIdleAnimation = () => {
    if (idleAnimationRef.current) return;

    let time = 0;
    const animate = () => {
      time += 0.05;
      const newLevels = Array.from({ length: 32 }, (_, i) => {
        const wave1 = Math.sin(time + i * 0.5) * 0.15;
        const wave2 = Math.sin(time * 1.3 - i * 0.3) * 0.1;
        return Math.abs(wave1 + wave2);
      });
      setAudioLevels(newLevels);
      idleAnimationRef.current = requestAnimationFrame(animate);
    };
    animate();
  };

  const stopIdleAnimation = () => {
    if (idleAnimationRef.current) {
      cancelAnimationFrame(idleAnimationRef.current);
      idleAnimationRef.current = null;
    }
  };

  const startSession = async () => {
    try {
      console.log('[Restaurant] Starting session...');
      setSessionStatus('listening');

      // Request microphone permission FIRST
      console.log('[Restaurant] Requesting microphone permission...');
      await startContinuousMicrophoneCapture();
      console.log('[Restaurant] Microphone access granted');

      // Create session with backend
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://stonepot-restaurant-334610188311.us-central1.run.app';
      const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL || 'https://stonepot-restaurant-display.suyesh.workers.dev';

      console.log('[Restaurant] Creating backend session...');
      const response = await fetch(`${apiUrl}/api/restaurant/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: 'demo-restaurant',
          userId: 'demo-user',
          language: 'en'
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create session: ${response.status}`);
      }

      const data = await response.json();
      console.log('[Restaurant] Session created:', data);
      setSessionInfo(data);

      // Initialize Vertex AI Live service
      const wsUrl = `${apiUrl.replace('https://', 'wss://').replace('http://', 'ws://')}${data.websocketUrl}`;
      vertexAILiveServiceRef.current = new VertexAILiveService(wsUrl);

      // Set up audio playback callback
      vertexAILiveServiceRef.current.onAudio(async (audioData: ArrayBuffer) => {
        console.log('[Restaurant] Audio response received');
        await playPCMAudio(audioData);
      });

      // Set up message callback
      vertexAILiveServiceRef.current.onMessage((message: any) => {
        console.log('[Restaurant] Message:', message.type);
        if (message.type === 'session_ready') {
          setSessionStatus('listening');
        }
      });

      // Connect to Vertex AI Live
      await vertexAILiveServiceRef.current.connect('en');
      console.log('[Restaurant] Connected to Vertex AI Live');

      // Initialize display service
      const service = new DisplayWebSocketService(workerUrl);
      setDisplayService(service);

      // Connect to display WebSocket
      await service.connect(data.sessionId);
      console.log('[Restaurant] Connected to display service');

      // Handle display updates
      service.on('initial_state', (state: any) => {
        console.log('[Restaurant] Initial state:', state);
        setTranscriptions(state.transcriptions || []);
        if (state.displayUpdates?.length > 0) {
          setCurrentDisplay(state.displayUpdates[state.displayUpdates.length - 1]);
        }
      });

      service.on('update', (update: any) => {
        console.log('[Restaurant] Display update:', update);
        if (update.type === 'transcription') {
          setTranscriptions((prev) => [...prev, update]);
        } else {
          setCurrentDisplay(update);

          // Update ordering step based on display type
          if (update.type === 'order_summary' || update.type === 'cart_updated') {
            setOrderingStep(2); // Cart step
          } else if (update.type === 'dish_card' || update.type === 'menu_item' || update.type === 'combo_item') {
            setOrderingStep(1); // Browse step
            // Highlight the menu item
            if (update.data?.name) {
              menuStore.highlightItem(update.data.name);
            }
          }

          // Handle cart updates from voice ordering
          if (update.type === 'cart_item_added' && update.data?.item) {
            const { dishName, quantity } = update.data.item;
            console.log('[Restaurant] Adding item to cart:', dishName, quantity);

            // Find the menu item to get full details
            const menuItem = menuItems.find(
              item => item.name.toLowerCase() === dishName.toLowerCase()
            );

            if (menuItem) {
              // Add multiple items based on quantity
              for (let i = 0; i < (quantity || 1); i++) {
                if ('choices' in menuItem) {
                  // It's a combo item - use default choice if available
                  const defaultChoice = menuItem.choices[0];
                  cartStore.addComboItem(menuItem, defaultChoice);
                } else {
                  cartStore.addMenuItem(menuItem);
                }
              }

              // Auto-show cart when item is added
              setShowCart(true);
              setTimeout(() => setShowCart(false), 3000); // Auto-hide after 3s
            }
          }
        }
      });

      service.on('error', (error: any) => {
        console.error('[Restaurant] Display service error:', error);
      });

      // Set session active
      setIsSessionActive(true);
      startIdleAnimation();

      console.log('[Restaurant] Session started successfully');
    } catch (error: any) {
      console.error('[Restaurant] Failed:', error);
      setError(error.message);
      setSessionStatus('idle');
      setIsSessionActive(false);
    }
  };

  const startContinuousMicrophoneCapture = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    const audioContext = new AudioContext({ sampleRate: 16000 });
    recordingContextRef.current = audioContext;

    // Load AudioWorklet processor
    await audioContext.audioWorklet.addModule('/audio-processor.js');

    const source = audioContext.createMediaStreamSource(stream);
    const workletNode = new AudioWorkletNode(audioContext, 'audio-stream-processor');

    // Handle messages from AudioWorklet
    workletNode.port.onmessage = (event) => {
      const { type, data, rms, duration } = event.data;

      if (type === 'speech-start') {
        // INTERRUPTION DETECTION: User started speaking
        if (sessionStatus === 'speaking') {
          console.log('[Audio] INTERRUPTION - User spoke while AI was speaking');

          // Stop current audio playback immediately
          if (playbackContextRef.current) {
            playbackContextRef.current.close().catch(() => {});
            playbackContextRef.current = null;
          }

          // Clear visualization
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
          }

          // Reset playback state
          nextPlayTimeRef.current = 0;
          isPlayingRef.current = false;

          // Send interruption signal to backend
          if (vertexAILiveServiceRef.current) {
            vertexAILiveServiceRef.current.interrupt();
          }
        }

        lastSpeechStartRef.current = performance.now();
        setSessionStatus('listening');
        stopIdleAnimation();
        console.log(`[Audio] Speech detected (RMS: ${rms.toFixed(4)})`);
      } else if (type === 'speech-end') {
        setSessionStatus('thinking');
        console.log(`[Audio] Speech ended after ${duration.toFixed(0)}ms`);
        setAudioLevels(new Array(32).fill(0));
      } else if (type === 'audio-data') {
        if (!vertexAILiveServiceRef.current?.isActive()) return;
        vertexAILiveServiceRef.current.sendAudio(data);
      }
    };

    // Connect audio pipeline
    source.connect(workletNode);
    workletNode.connect(audioContext.destination);

    setSessionStatus('listening');
    console.log('[Restaurant] AudioWorklet streaming started');
  };

  const startAudioVisualization = () => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const updateVisualization = () => {
      analyser.getByteFrequencyData(dataArray);

      const barCount = 32;
      const barWidth = Math.floor(bufferLength / barCount);
      const newLevels: number[] = [];

      for (let i = 0; i < barCount; i++) {
        const start = i * barWidth;
        const end = start + barWidth;
        let sum = 0;

        for (let j = start; j < end; j++) {
          sum += dataArray[j];
        }

        const average = sum / barWidth;
        const normalized = Math.min((average / 255) * 3.0, 1);
        newLevels.push(normalized);
      }

      setAudioLevels(newLevels);
      animationFrameRef.current = requestAnimationFrame(updateVisualization);
    };

    updateVisualization();
  };

  const playPCMAudio = async (audioData: ArrayBuffer) => {
    try {
      // Initialize playback audio context if needed
      if (!playbackContextRef.current) {
        playbackContextRef.current = new AudioContext({ sampleRate: 24000 });
        nextPlayTimeRef.current = playbackContextRef.current.currentTime;

        // Create analyser for visualization
        analyserRef.current = playbackContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        analyserRef.current.connect(playbackContextRef.current.destination);
      }

      const audioContext = playbackContextRef.current;
      const pcm16 = new Int16Array(audioData);

      // Convert Int16 PCM to Float32
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / (pcm16[i] < 0 ? 0x8000 : 0x7FFF);
      }

      // Create audio buffer
      const audioBuffer = audioContext.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      // Schedule audio chunk
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;

      // Connect to analyser for visualization
      if (analyserRef.current) {
        source.connect(analyserRef.current);
      } else {
        source.connect(audioContext.destination);
      }

      const currentTime = audioContext.currentTime;
      const startTime = Math.max(currentTime, nextPlayTimeRef.current);
      source.start(startTime);

      const duration = audioBuffer.duration;
      nextPlayTimeRef.current = startTime + duration;

      // Update UI on first chunk
      if (!isPlayingRef.current) {
        isPlayingRef.current = true;
        setSessionStatus('speaking');
        startAudioVisualization();
      }

      // Detect end of playback
      const timeUntilEnd = (startTime + duration - audioContext.currentTime) * 1000 + 200;
      setTimeout(() => {
        if (audioContext.currentTime >= nextPlayTimeRef.current - 0.05) {
          isPlayingRef.current = false;
          setSessionStatus('listening');

          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
          }

          startIdleAnimation();
        }
      }, Math.max(timeUntilEnd, 0));
    } catch (error) {
      console.error('[Restaurant] Audio playback error:', error);
    }
  };

  /**
   * Handle user actions from display (button clicks)
   */
  const handleDisplayAction = (action: string, data: any) => {
    console.log('[Restaurant] Display action:', action, data);

    if (displayService) {
      displayService.sendAction(action, data);
    } else {
      console.error('[Restaurant] Display service not available');
    }
  };

  const endSession = async () => {
    // Stop all animations
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    stopIdleAnimation();

    // Disconnect services
    if (vertexAILiveServiceRef.current) {
      vertexAILiveServiceRef.current.disconnect();
      vertexAILiveServiceRef.current = null;
    }

    if (displayService) {
      displayService.disconnect();
      setDisplayService(null);
    }

    // Close audio contexts
    if (recordingContextRef.current) {
      await recordingContextRef.current.close();
      recordingContextRef.current = null;
    }

    if (playbackContextRef.current) {
      await playbackContextRef.current.close();
      playbackContextRef.current = null;
    }

    analyserRef.current = null;
    nextPlayTimeRef.current = 0;
    isPlayingRef.current = false;
    setIsSessionActive(false);
    setSessionStatus('idle');
    setAudioLevels(new Array(32).fill(0));
    setTranscriptions([]);
    setCurrentDisplay(null);
  };

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-b from-[#f8f9fa] to-[#0a0a0a]">
        <div className="max-w-md w-full mx-4 p-6 bg-red-500/10 border border-red-500/30 rounded-xl">
          <h3 className="text-lg font-bold mb-2 text-red-400">Error</h3>
          <p className="text-sm text-red-300 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col neu-bg">
      {!isSessionActive ? (
        /* Landing Screen - Menu Display */
        <>
          {/* Compact Header */}
          <header className="neu-header">
            <div className="header-content">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-8 h-8 md:w-10 md:h-10 neu-card rounded-full flex items-center justify-center">
                  <span className="text-lg md:text-xl">🍽️</span>
                </div>
                <h1 className="text-sm md:text-base font-bold neu-text">The Coorg Food Company</h1>
              </div>
            </div>
          </header>

          {/* Menu Display */}
          <main className="flex-1 overflow-y-auto pt-16 md:pt-20 p-6">
            <div className="max-w-7xl mx-auto">
              <Menu />
            </div>
          </main>

          {/* Cart Island for browsing mode */}
          <CartIsland onClick={() => setShowCart(true)} />

          {/* Voice Order FAB - Pulsating Orb */}
          <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-40 flex flex-col items-center gap-3">
            <button
              onClick={startSession}
              className="relative w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 group"
              aria-label="Start voice conversation"
            >
              {/* Outer Glow Ring - Pulsating */}
              <div className="absolute inset-0 rounded-full bg-blue-500/30 animate-ping" />

              {/* Middle Glow Ring */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 opacity-80 blur-md group-hover:blur-lg transition-all" />

              {/* Inner Orb */}
              <div className="absolute inset-2 rounded-full bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-white/20 animate-pulse" />
              </div>
            </button>

            {/* Label */}
            <span className="text-sm font-semibold neu-text">
              Start Voice Order
            </span>
          </div>

          {/* Cart Modal */}
          {showCart && (
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fade-in"
              onClick={() => setShowCart(false)}
            >
              <div
                className="max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-scale-in"
                onClick={(e) => e.stopPropagation()}
              >
                <Cart />
              </div>
            </div>
          )}
        </>
      ) : (
        /* Active Session - Voice-First Layout */
        <>
          {/* Auto-hiding Mobile-Optimized Header */}
          <header className={`neu-header transition-transform duration-300 ${
            isHeaderVisible ? 'translate-y-0' : '-translate-y-full'
          }`}>
            <div className="header-content">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-8 h-8 md:w-10 md:h-10 neu-card rounded-full flex items-center justify-center">
                  <span className="text-lg md:text-xl">🍽️</span>
                </div>
                <h1 className="text-sm md:text-base font-bold neu-text">CFC</h1>
              </div>

              {/* Voice Status Indicator */}
              <div className="flex items-center gap-2 md:gap-3">
                <div className="neu-concave px-2 py-1 md:px-4 md:py-2 rounded-full flex items-center gap-1 md:gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    sessionStatus === 'listening' ? 'bg-blue-500 animate-pulse' :
                    sessionStatus === 'thinking' ? 'bg-yellow-500 animate-pulse' :
                    sessionStatus === 'speaking' ? 'bg-green-500 animate-pulse' :
                    'bg-gray-400'
                  }`} />
                  <span className="text-xs font-medium neu-text capitalize hidden md:inline">{sessionStatus}</span>
                </div>
                <button
                  onClick={endSession}
                  className="neu-button text-xs px-2 py-1 md:px-4 md:py-2 rounded-lg font-medium text-red-500"
                >
                  <span className="hidden md:inline">End Session</span>
                  <span className="md:hidden">End</span>
                </button>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto p-6 pb-32">
            <div className="max-w-7xl mx-auto">
              {/* Full Menu Display */}
              <Menu />

              {/* Voice-triggered Dish Card Modal */}
              {currentDisplay && (currentDisplay.type === 'dish_card' || currentDisplay.type === 'menu_item' || currentDisplay.type === 'combo_item') && (
                <div
                  className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fade-in"
                  onClick={() => setCurrentDisplay(null)}
                >
                  <div
                    className="max-w-md w-full animate-scale-in"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MultimodalDisplay
                      visualData={currentDisplay}
                      onAction={handleDisplayAction}
                    />
                  </div>
                </div>
              )}
            </div>
          </main>

          {/* Voice Mic FAB with Integrated Visualizer */}
          <div className={`neu-voice-mic ${sessionStatus === 'listening' ? 'animate-pulse' : ''}`}>
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Circular Audio Visualizer */}
              <svg
                className="w-full h-full"
                viewBox="0 0 100 100"
                style={{ willChange: 'transform' }}
              >
                {audioLevels.slice(0, 16).map((level, i) => {
                  const numBars = 16;
                  const angle = (i / numBars) * Math.PI * 2 - Math.PI / 2;
                  const baseRadius = 25;
                  const barLength = 5 + level * 15;
                  const innerRadius = baseRadius;
                  const outerRadius = baseRadius + barLength;

                  const x1 = 50 + Math.cos(angle) * innerRadius;
                  const y1 = 50 + Math.sin(angle) * innerRadius;
                  const x2 = 50 + Math.cos(angle) * outerRadius;
                  const y2 = 50 + Math.sin(angle) * outerRadius;

                  const color = sessionStatus === 'thinking'
                    ? `rgba(255, 149, 0, ${0.4 + level * 0.6})`
                    : sessionStatus === 'speaking'
                    ? `rgba(34, 197, 94, ${0.4 + level * 0.6})`
                    : `rgba(59, 130, 246, ${0.4 + level * 0.6})`;

                  return (
                    <line
                      key={i}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={color}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      style={{
                        filter: `drop-shadow(0 0 ${2 + level * 4}px ${color})`,
                        transition: 'all 75ms ease-out',
                      }}
                    />
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Progress Orb */}
          <ProgressOrb
            currentStep={orderingStep}
            totalSteps={3}
            steps={['Browse', 'Cart', 'Pay']}
          />

          {/* Cart Island - Floating cart indicator */}
          <CartIsland onClick={() => setShowCart(true)} />

          {/* Cart Modal */}
          {showCart && (
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fade-in"
              onClick={() => setShowCart(false)}
            >
              <div
                className="max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-scale-in"
                onClick={(e) => e.stopPropagation()}
              >
                <Cart />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
});

export default RestaurantOrderingApp;
