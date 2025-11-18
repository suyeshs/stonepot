interface ProgressOrbProps {
  currentStep: number;
  totalSteps: number;
  steps: string[];
}

export function ProgressOrb({ currentStep, totalSteps, steps }: ProgressOrbProps) {
  const progress = (currentStep / totalSteps) * 100;

  return (
    <div className="neu-progress-orb">
      <div className="text-center">
        <div className="text-2xl font-bold neu-text-accent mb-1">
          {currentStep}/{totalSteps}
        </div>
        <div className="text-xs neu-text-secondary font-medium">
          {steps[currentStep - 1]}
        </div>
      </div>

      {/* Progress Ring */}
      <svg
        className="absolute inset-0 w-full h-full"
        style={{ transform: 'rotate(-90deg)' }}
      >
        <circle
          cx="50%"
          cy="50%"
          r="48%"
          fill="none"
          stroke="rgba(0,0,0,0.1)"
          strokeWidth="4"
        />
        <circle
          cx="50%"
          cy="50%"
          r="48%"
          fill="none"
          stroke="var(--neu-accent)"
          strokeWidth="4"
          strokeDasharray={`${progress * 3} 300`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.3s ease' }}
        />
      </svg>
    </div>
  );
}
