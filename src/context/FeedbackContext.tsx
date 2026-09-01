import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { FeedbackModal, ToastContainer, ModalConfig, ToastItem, FeedbackType } from '../components/common/FeedbackModal';
import { GlobalLoadingOverlay } from '../components/common/LoadingScreen';

interface ShowModalOptions {
  title: string;
  message: string;
  type?: FeedbackType;
  details?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface LoadingConfig {
  isOpen: boolean;
  message: string;
  subMessage?: string;
}

interface FeedbackContextValue {
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info', title?: string, durationMs?: number) => void;
  showAlert: (title: string, message: string, type?: FeedbackType, onConfirm?: () => void) => void;
  showConfirm: (
    title: string,
    message: string,
    onConfirm: () => void,
    options?: {
      type?: FeedbackType;
      confirmLabel?: string;
      cancelLabel?: string;
      onCancel?: () => void;
    }
  ) => void;
  closeModal: () => void;
  showLoading: (message?: string, subMessage?: string) => void;
  hideLoading: () => void;
  withLoading: <T>(asyncFn: () => Promise<T>, message?: string, subMessage?: string) => Promise<T>;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export const FeedbackProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [modalConfig, setModalConfig] = useState<ModalConfig | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [loadingConfig, setLoadingConfig] = useState<LoadingConfig>({
    isOpen: false,
    message: 'Memuat data...',
  });

  const closeModal = useCallback(() => {
    setModalConfig(null);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showLoading = useCallback((message = 'Memproses data...', subMessage?: string) => {
    setLoadingConfig({
      isOpen: true,
      message,
      subMessage,
    });
  }, []);

  const hideLoading = useCallback(() => {
    setLoadingConfig((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const withLoading = useCallback(
    async <T,>(asyncFn: () => Promise<T>, message = 'Memproses...', subMessage?: string): Promise<T> => {
      showLoading(message, subMessage);
      try {
        const res = await asyncFn();
        return res;
      } finally {
        hideLoading();
      }
    },
    [showLoading, hideLoading]
  );

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', title?: string, durationMs = 4000) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      setToasts((prev) => [...prev, { id, message, type, title }]);

      if (durationMs > 0) {
        setTimeout(() => {
          dismissToast(id);
        }, durationMs);
      }
    },
    [dismissToast]
  );

  const showAlert = useCallback((title: string, message: string, type: FeedbackType = 'info', onConfirm?: () => void) => {
    setModalConfig({
      isOpen: true,
      type,
      title,
      message,
      confirmLabel: 'Mengerti',
      onConfirm: () => {
        if (onConfirm) onConfirm();
        setModalConfig(null);
      },
      onCancel: () => {
        setModalConfig(null);
      },
    });
  }, []);

  const showConfirm = useCallback(
    (
      title: string,
      message: string,
      onConfirm: () => void,
      options?: {
        type?: FeedbackType;
        confirmLabel?: string;
        cancelLabel?: string;
        onCancel?: () => void;
      }
    ) => {
      setModalConfig({
        isOpen: true,
        type: options?.type || 'confirm',
        title,
        message,
        confirmLabel: options?.confirmLabel || 'Ya, Lanjutkan',
        cancelLabel: options?.cancelLabel || 'Batal',
        onConfirm: () => {
          onConfirm();
          setModalConfig(null);
        },
        onCancel: () => {
          if (options?.onCancel) options.onCancel();
          setModalConfig(null);
        },
      });
    },
    []
  );

  return (
    <FeedbackContext.Provider
      value={{
        showToast,
        showAlert,
        showConfirm,
        closeModal,
        showLoading,
        hideLoading,
        withLoading,
      }}
    >
      {children}
      <FeedbackModal config={modalConfig} onClose={closeModal} />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <GlobalLoadingOverlay
        isOpen={loadingConfig.isOpen}
        message={loadingConfig.message}
        subMessage={loadingConfig.subMessage}
      />
    </FeedbackContext.Provider>
  );
};

export const useFeedback = (): FeedbackContextValue => {
  const context = useContext(FeedbackContext);
  if (!context) {
    // Fallback in case used outside provider
    return {
      showToast: (msg) => console.log('Toast:', msg),
      showAlert: (title, msg) => {
        if (typeof window !== 'undefined') window.alert(`${title}\n\n${msg}`);
      },
      showConfirm: (title, msg, onConfirm) => {
        if (typeof window !== 'undefined') {
          if (window.confirm(`${title}\n\n${msg}`)) onConfirm();
        }
      },
      closeModal: () => {},
      showLoading: () => {},
      hideLoading: () => {},
      withLoading: async (fn) => fn(),
    };
  }
  return context;
};

