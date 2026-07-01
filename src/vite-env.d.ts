/// <reference types="vite/client" />

import type { Root } from "react-dom/client";

declare global {
  interface Window {
    __fundDcaRoot?: Root;
    desktopApp?: {
      runtime?: string;
      platform?: string;
      apiOrigin?: string | null;
      logDir?: string | null;
      versions?: {
        chrome?: string;
        electron?: string;
        node?: string;
      };
    };
  }
}

export {};
