import { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { cn } from '../../utils/cn';

export type ToastType = 'success' | 'warning' | 'error' | 'info';

export interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
  duration?: number; // Auto-dismiss after duration (ms), default 5000
}

/**
 * Simple toast notification component
 *
 * A lightweight notification system that displays temporary messages
 * at the bottom-right of the screen.
 *
 * Features:
 * - Auto-dismisses after duration (default 5 seconds)
 * - Manual close button for user control
 * - Four types: success, warning, error, info
 * - Slide-in animation from bottom
 * - Color-coded styling based on type
 *
 * Usage:
 * ```tsx
 * {showToast && (
 *   <Toast
 *     message="Operation successful!"
 *     type="success"
 *     onClose={() => setShowToast(false)}
 *     duration={5000}
 *   />
 * )}
 * ```
 */
export function Toast({ message, type, onClose, duration = 5000 }: ToastProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const config = {
    success: {
      icon: CheckCircle,
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-800',
      iconColor: 'text-green-600',
    },
    warning: {
      icon: AlertCircle,
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      textColor: 'text-yellow-800',
      iconColor: 'text-yellow-600',
    },
    error: {
      icon: AlertCircle,
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-800',
      iconColor: 'text-red-600',
    },
    info: {
      icon: Info,
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-800',
      iconColor: 'text-blue-600',
    },
  };

  const style = config[type];
  const Icon = style.icon;

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-50 max-w-md shadow-lg rounded-lg border p-4',
        'animate-in slide-in-from-bottom-5 duration-300',
        style.bgColor,
        style.borderColor
      )}
    >
      <div className="flex items-start space-x-3">
        <Icon className={cn('h-5 w-5 flex-shrink-0 mt-0.5', style.iconColor)} />
        <p className={cn('flex-1 text-sm font-medium', style.textColor)}>{message}</p>
        <button
          onClick={onClose}
          className={cn('flex-shrink-0 hover:opacity-70 transition-opacity', style.textColor)}
          aria-label="Close notification"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
