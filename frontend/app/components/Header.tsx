"use client";

import React from "react";
import Link from "next/link";
import { User } from "../types";
import {
  LifeBuoy,
  Plus,
  Table,
  LogOut,
  Shield,
} from "lucide-react";

interface HeaderProps {
  currentUser: User;
  canCreateInquiry: boolean;
  onOpenNewModal: () => void;
  onOpenStaffModal?: () => void;
  onLogout: () => void;
  onResetData?: () => void;
}

export function Header({
  currentUser,
  canCreateInquiry,
  onOpenNewModal,
  onOpenStaffModal,
  onLogout,
}: HeaderProps) {
  const isAdmin = currentUser.role === "ADMIN";

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand & Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <LifeBuoy className="w-5 h-5 animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold tracking-tight text-slate-900">
                PulseDesk
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                Service Hub
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block">
              Inquiry Dispatch & Handover Platform
            </p>
          </div>
        </Link>

        {/* Navigation & Authenticated User Section */}
        <div className="flex items-center gap-3">
          {/* Admin Staff Management Trigger (ADMIN only) */}
          {isAdmin && onOpenStaffModal && (
            <button
              type="button"
              onClick={onOpenStaffModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 shadow-2xs transition-all hover:scale-105 cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5 text-indigo-600" />
              <span>Manage Staff</span>
            </button>
          )}

          {/* Inquiries Table Directory Link */}
          <Link
            href="/dashboard/inquiries"
            title="Open Inquiries Table View"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors"
          >
            <Table className="w-3.5 h-3.5 text-slate-500" />
            <span>Table View</span>
          </Link>

          {/* Logged-In User Profile Display */}
          <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl shadow-2xs">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-slate-700 to-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
              {currentUser.name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </div>
            <div className="text-left hidden md:block">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-900 leading-tight">
                  {currentUser.name}
                </span>
                <span
                  className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded ${
                    isAdmin
                      ? "bg-purple-100 text-purple-700 border border-purple-200"
                      : "bg-blue-100 text-blue-700 border border-blue-200"
                  }`}
                >
                  {currentUser.role}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 leading-tight">
                {currentUser.department || "Operations"}
              </p>
            </div>
          </div>

          {/* New Inquiry Action (Requires 'inquiries:create' permission) */}
          {canCreateInquiry && (
            <button
              type="button"
              onClick={onOpenNewModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-600/30 transition-all hover:shadow-md hover:scale-[1.02] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Inquiry</span>
            </button>
          )}

          {/* Log Out Button */}
          <button
            type="button"
            onClick={onLogout}
            title="Log Out of PulseDesk"
            className="inline-flex items-center gap-1.5 p-2 sm:px-2.5 sm:py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-xl transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Log Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
