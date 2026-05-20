"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { parseTokensFromUrl, cleanUrl, storeTokens } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";

export default function CallbackPage() {
  const router = useRouter();
  const { refreshToken } = useAuth();

  useEffect(() => {
    const handleCallback = async () => {
      const tokens = parseTokensFromUrl();
      
      if (tokens) {
        storeTokens(tokens);
        cleanUrl();
        
        try {
          await refreshToken();
        } catch (e) {
          console.error("Token refresh failed:", e);
        }
      }
      
      router.push("/analytics");
    };

    handleCallback();
  }, [router, refreshToken]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-foreground font-medium">Authenticating...</p>
        <p className="text-muted-foreground text-sm mt-2">Please wait while we log you in.</p>
      </div>
    </div>
  );
}