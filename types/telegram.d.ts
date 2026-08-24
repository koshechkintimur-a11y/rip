/**
 * Типы Telegram WebApp (мини-версия официальных).
 * Полная типизация: @types/telegram-web-app
 */
export type TelegramWebApp = {
  initData: string;
  initDataUnsafe: any;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: Record<string, string>;
  ready: () => void;
  expand: () => void;
  close: () => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  requestWriteAccess: (callback?: (ok: boolean) => void) => void;
  openTelegramLink: (url: string) => void;
  showAlert: (msg: string) => void;
  MainButton: {
    text: string;
    isVisible: boolean;
    isActive: boolean;
    show: () => void;
    hide: () => void;
    setText: (t: string) => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

export {};
