interface Step {
  name: string;
  status: 'complete' | 'current' | 'upcoming';
}

interface StepIndicatorProps {
  steps: Step[];
}

export function StepIndicator({ steps }: StepIndicatorProps) {
  return (
    <nav aria-label="Progress" className="mb-8">
      <ol className="flex items-center">
        {steps.map((step, index) => (
          <li key={step.name} className={index !== steps.length - 1 ? 'flex-1' : ''}>
            <div className="flex items-center">
              <div className="flex flex-col items-start">
                <span
                  className={`text-xs font-medium ${
                    step.status === 'complete'
                      ? 'text-primary'
                      : step.status === 'current'
                      ? 'text-primary'
                      : 'text-text-muted'
                  }`}
                >
                  Step {index + 1}
                </span>
                <span
                  className={`text-sm font-medium ${
                    step.status === 'current' ? 'text-text' : 'text-text-muted'
                  }`}
                >
                  {step.name}
                </span>
              </div>
              {index !== steps.length - 1 && (
                <div className="ml-4 flex-1 h-0.5 bg-border">
                  <div
                    className={`h-full transition-all ${
                      step.status === 'complete' ? 'bg-primary w-full' : 'w-0'
                    }`}
                  />
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </nav>
  );
}
