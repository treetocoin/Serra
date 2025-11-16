/**
 * ChartErrorBoundary Component
 *
 * Error boundary that catches rendering errors in chart components to prevent
 * full page crash. Displays friendly error message with retry button.
 *
 * @feature 005-lavoriamo-alla-pagina T036
 * @see ../../../specs/005-lavoriamo-alla-pagina/tasks.md T036
 */

import React from 'react';

// ============================================================================
// Component Props & State
// ============================================================================

interface ChartErrorBoundaryProps {
  children: React.ReactNode;
}

interface ChartErrorBoundaryState {
  hasError: boolean;
}

// ============================================================================
// Component
// ============================================================================

export class ChartErrorBoundary extends React.Component<
  ChartErrorBoundaryProps,
  ChartErrorBoundaryState
> {
  constructor(props: ChartErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_error: Error): ChartErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error to console for debugging
    console.error('[ChartErrorBoundary] Chart rendering error:', error, errorInfo);
  }

  handleRetry = (): void => {
    // Reset error state to retry rendering
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-[300px] flex flex-col items-center justify-center text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-center space-y-4">
            <p className="text-lg">⚠️ Impossibile caricare il grafico</p>
            <p className="text-sm text-gray-400">
              Si è verificato un errore durante il rendering
            </p>
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium"
            >
              Riprova
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
