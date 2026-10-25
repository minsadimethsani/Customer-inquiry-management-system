"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoginPage } from "../components/LoginPage";
import { useAuth, AuthProvider } from "../context/AuthContext";

function LoginContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return <LoginPage />;
}

export default function Page() {
  return (
    <AuthProvider>
      <LoginContent />
    </AuthProvider>
  );
}
