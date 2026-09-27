"use client";

import { ReactNode, useEffect } from "react";
import { AuthProvider } from "../context/AuthContext";
import { captureReferral } from "../lib/referral";

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    captureReferral();
  }, []);
  return <AuthProvider>{children}</AuthProvider>;
}
