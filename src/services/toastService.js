import { toast } from 'sonner';

/**
 * Centralized toast service using Sonner
 * Provides a clean API to replace react-toastify throughout the application
 */
const toastService = {
  // Success toast
  success: (message, options = {}) => {
    return toast.success(message, {
      duration: options.autoClose || 3000,
      ...options
    });
  },

  // Error toast
  error: (message, options = {}) => {
    return toast.error(message, {
      duration: options.autoClose || 4000,
      ...options
    });
  },

  // Info toast
  info: (message, options = {}) => {
    return toast.info(message, {
      duration: options.autoClose || 3000,
      ...options
    });
  },

  // Warning toast
  warning: (message, options = {}) => {
    return toast.warning(message, {
      duration: options.autoClose || 3000,
      ...options
    });
  },

  // Loading toast
  loading: (message, options = {}) => {
    return toast.loading(message, options);
  },

  // Promise toast (for async operations)
  promise: (promise, messages, options = {}) => {
    return toast.promise(promise, messages, options);
  },

  // Dismiss a specific toast
  dismiss: (toastId) => {
    return toast.dismiss(toastId);
  },

  // Dismiss all toasts
  dismissAll: () => {
    return toast.dismiss();
  }
};

export default toastService;
