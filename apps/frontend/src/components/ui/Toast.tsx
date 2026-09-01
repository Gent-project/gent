"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastProps extends Toast {
  onClose: (id: string) => void;
}

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const colors = {
  success: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-200 dark:border-green-800',
    icon: 'text-green-600 dark:text-green-400',
    title: 'text-green-900 dark:text-green-100',
    message: 'text-green-700 dark:text-green-200',
  },
  error: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    icon: 'text-red-600 dark:text-red-400',
    title: 'text-red-900 dark:text-red-100',
    message: 'text-red-700 dark:text-red-200',
  },
  warning: {
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    border: 'border-yellow-200 dark:border-yellow-800',
    icon: 'text-yellow-600 dark:text-yellow-400',
    title: 'text-yellow-900 dark:text-yellow-100',
    message: 'text-yellow-700 dark:text-yellow-200',
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    icon: 'text-blue-600 dark:text-blue-400',
    title: 'text-blue-900 dark:text-blue-100',
    message: 'text-blue-700 dark:text-blue-200',
  },
};

export function ToastComponent({ id, type, title, message, duration = 5000, action, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);
  const Icon = icons[type];
  const color = colors[type];

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onClose(id), 300);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, id, onClose]);

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      className={`
        max-w-sm w-full shadow-lg rounded-lg border pointer-events-auto
        ${color.bg} ${color.border}
      `}
    >
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <Icon className={`h-5 w-5 ${color.icon}`} />
          </div>
          <div className="ml-3 w-0 flex-1">
            <p className={`text-sm font-medium ${color.title}`}>
              {title}
            </p>
            {message && (
              <p className={`mt-1 text-sm ${color.message}`}>
                {message}
              </p>
            )}
            {action && (
              <div className="mt-3">
                <button
                  onClick={action.onClick}
                  className={`text-sm font-medium ${color.icon} hover:opacity-80`}
                >
                  {action.label}
                </button>
              </div>
            )}
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            <button
              onClick={() => {
                setIsVisible(false);
                setTimeout(() => onClose(id), 300);
              }}
              className={`rounded-md inline-flex ${color.message} hover:opacity-80 focus:outline-none`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onClose: (id: string) => void;
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-4 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastComponent key={toast.id} {...toast} onClose={onClose} />
        ))}
      </AnimatePresence>
    </div>
  );
}

// Toast store
let toastId = 0;
const toastListeners: ((toasts: Toast[]) => void)[] = [];
let toasts: Toast[] = [];

function updateToasts(newToasts: Toast[]) {
  toasts = newToasts;
  toastListeners.forEach(listener => listener(toasts));
}

export function addToast(toast: Omit<Toast, 'id'>) {
  const newToast = { ...toast, id: String(++toastId) };
  updateToasts([...toasts, newToast]);
  return newToast.id;
}

export function removeToast(id: string) {
  updateToasts(toasts.filter(toast => toast.id !== id));
}

export function useToasts() {
  const [toastList, setToastList] = useState<Toast[]>(toasts);

  useEffect(() => {
    toastListeners.push(setToastList);
    return () => {
      const index = toastListeners.indexOf(setToastList);
      if (index > -1) {
        toastListeners.splice(index, 1);
      }
    };
  }, []);

  return {
    toasts: toastList,
    addToast,
    removeToast,
  };
}