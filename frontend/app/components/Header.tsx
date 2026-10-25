"use client";

import React from "react";
import Link from "next/link";
import { User } from "../types";
import {
  LifeBuoy,
  Plus,
  RotateCcw,
  Database,
  Users,
  Table,
} from "lucide-react";

interface HeaderProps {
  staffUsers: User[];
  currentUser: User;
  onSelectUser: (user: User) => void;
  onOpenNewModal: () => void;
  onResetData: () => void;
}

export function Header({
  staffUsers,
  currentUser,
  onSelectUser,
  onOpenNewModal,
  onResetData,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand & Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
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
        </div>

        {/* Database & Active Staff Persona Switcher */}
        <div className="flex items-center gap-3">
          {/* PostgreSQL Status Indicator */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-800">
            <Database className="w-3.5 h-3.5 text-emerald-600" />
            <span>PostgreSQL & Prisma Ready</span>
          </div>

          {/* Current User Switcher */}
          <div className="flex items-center gap-2 bg-slate-100/80 p-1.5 rounded-xl border border-slate-200 text-xs">
            <Users className="w-3.5 h-3.5 text-slate-500 ml-1 hidden sm:block" />
            <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
              Viewing as:
            </span>
            <select
              value={currentUser.id}
              onChange={(e) => {
                const user = staffUsers.find((u) => u.id === e.target.value);
                if (user) onSelectUser(user);
              }}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
            >
              {staffUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.department || u.role})
                </option>
              ))}
            </select>
          </div>

          {/* Inquiries Table Directory Link */}
          <Link
            href="/dashboard/inquiries"
            title="Open Inquiries Table View"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors"
          >
            <Table className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Table View</span>
          </Link>

          {/* Reset Demo Data Button */}
          <button
            type="button"
            onClick={onResetData}
            title="Reset to default demo inquiries"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-slate-200"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* New Inquiry Action */}
          <button
            type="button"
            onClick={onOpenNewModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-600/30 transition-all hover:shadow-md hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            <span>New Inquiry</span>
          </button>
        </div>
      </div>
    </header>
  );
}
