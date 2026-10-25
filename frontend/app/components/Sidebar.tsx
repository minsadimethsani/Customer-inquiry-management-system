"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { User } from "../types";
import {
  LifeBuoy,
  Inbox,
  Table,
  UserX,
  Clock,
  CheckCircle2,
  Shield,
  LogOut,
  Plus,
  Menu,
  X,
  LayoutDashboard,
  Filter,
} from "lucide-react";

interface SidebarProps {
  currentUser: User;
  canCreateInquiry?: boolean;
  unassignedCount?: number;
  totalCount?: number;
  activeFilterTab?: string;
  onSelectTab?: (tab: any) => void;
  onOpenNewModal?: () => void;
  onOpenStaffModal?: () => void;
  onLogout: () => void;
}

export function Sidebar({
  currentUser,
  canCreateInquiry = true,
  unassignedCount,
  totalCount,
  activeFilterTab,
  onSelectTab,
  onOpenNewModal,
  onOpenStaffModal,
  onLogout,
}: SidebarProps) {
  const pathname = usePathname();
  const isAdmin = currentUser.role === "ADMIN";
  const [mobileOpen, setMobileOpen] = useState(false);

  const isHome = pathname === "/";
  const isTableView = pathname === "/dashboard/inquiries";

  const closeMobile = () => setMobileOpen(false);

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200/90 shadow-xs">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <Link
          href="/"
          onClick={closeMobile}
          className="flex items-center gap-3 group"
        >
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/25 group-hover:scale-105 transition-transform shrink-0">
            <LifeBuoy className="w-5 h-5 animate-spin-slow" />
          </div>
          <div className="overflow-hidden">
            <div className="flex items-center gap-1.5">
              <span className="text-base font-extrabold tracking-tight text-slate-900">
                PulseDesk
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded border border-blue-200">
                Hub
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              Inquiry Management
            </p>
          </div>
        </Link>

        {/* Mobile Close Button */}
        <button
          type="button"
          onClick={closeMobile}
          className="lg:hidden p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Action Button: Log New Inquiry */}
      {canCreateInquiry && onOpenNewModal && (
        <div className="p-4 pb-2">
          <button
            type="button"
            onClick={() => {
              closeMobile();
              onOpenNewModal();
            }}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.99] shadow-sm shadow-blue-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Log New Inquiry</span>
          </button>
        </div>
      )}

      {/* Main Nav Items */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-6">
        {/* Core Views */}
        <div>
          <div className="px-3 mb-2 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
            Navigation
          </div>
          <nav className="space-y-1">
            <Link
              href="/"
              onClick={() => {
                closeMobile();
                if (onSelectTab && isHome) onSelectTab("ALL");
              }}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                isHome && (!activeFilterTab || activeFilterTab === "ALL")
                  ? "bg-blue-50 text-blue-700 border border-blue-200/70"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <LayoutDashboard className="w-4 h-4 text-blue-600" />
                <span>Inquiries Hub</span>
              </div>
              {totalCount !== undefined && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-700">
                  {totalCount}
                </span>
              )}
            </Link>

            <Link
              href="/dashboard/inquiries"
              onClick={closeMobile}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                isTableView
                  ? "bg-blue-50 text-blue-700 border border-blue-200/70"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
              }`}
            >
              <Table className="w-4 h-4 text-indigo-600" />
              <span>Table Directory</span>
            </Link>
          </nav>
        </div>

        {/* Triage & Workflow Filters (Available when on Home view) */}
        {isHome && onSelectTab && (
          <div>
            <div className="px-3 mb-2 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Queue Filters</span>
              <Filter className="w-3 h-3 text-slate-400" />
            </div>
            <nav className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  closeMobile();
                  onSelectTab("UNASSIGNED");
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeFilterTab === "UNASSIGNED"
                    ? "bg-red-50 text-red-700 font-bold border border-red-200/80"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <UserX className="w-4 h-4 text-red-500" />
                  <span>Needs Owner</span>
                </div>
                {unassignedCount !== undefined && unassignedCount > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
                    {unassignedCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  closeMobile();
                  onSelectTab("ASSIGNED_TO_ME");
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeFilterTab === "ASSIGNED_TO_ME"
                    ? "bg-blue-50 text-blue-700 font-bold border border-blue-200/80"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
                }`}
              >
                <Inbox className="w-4 h-4 text-blue-500" />
                <span>Assigned to Me</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  closeMobile();
                  onSelectTab("IN_PROGRESS");
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeFilterTab === "IN_PROGRESS"
                    ? "bg-blue-50 text-blue-700 font-bold border border-blue-200/80"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
                }`}
              >
                <Clock className="w-4 h-4 text-amber-500" />
                <span>In Progress</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  closeMobile();
                  onSelectTab("RESOLVED");
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeFilterTab === "RESOLVED"
                    ? "bg-emerald-50 text-emerald-800 font-bold border border-emerald-200/80"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Resolved</span>
              </button>
            </nav>
          </div>
        )}

        {/* Administration Section (Admin only) */}
        {isAdmin && onOpenStaffModal && (
          <div>
            <div className="px-3 mb-2 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
              Administration
            </div>
            <nav className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  closeMobile();
                  onOpenStaffModal();
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100/80 border border-indigo-200/60 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Shield className="w-4 h-4 text-indigo-600" />
                  <span>Manage Staff</span>
                </div>
                <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-indigo-200/70 text-indigo-800 font-extrabold">
                  Admin
                </span>
              </button>
            </nav>
          </div>
        )}
      </div>

      {/* Bottom Profile & Session Panel */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/70">
        <div className="p-2.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs mb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-slate-800 to-indigo-950 text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-xs">
              {currentUser.name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </div>
            <div className="overflow-hidden flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-bold text-slate-900 truncate">
                  {currentUser.name}
                </span>
                <span
                  className={`text-[8px] font-extrabold uppercase px-1.5 py-0.2 rounded shrink-0 ${
                    isAdmin
                      ? "bg-purple-100 text-purple-700 border border-purple-200"
                      : "bg-blue-100 text-blue-700 border border-blue-200"
                  }`}
                >
                  {currentUser.role}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 truncate mt-0.5">
                {currentUser.email}
              </p>
            </div>
          </div>
        </div>

        {/* Log Out Trigger */}
        <button
          type="button"
          onClick={() => {
            closeMobile();
            onLogout();
          }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Bar (Only visible on small screens < lg) */}
      <div className="lg:hidden sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 h-14 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
            aria-label="Open sidebar navigation"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white text-xs">
              <LifeBuoy className="w-4 h-4" />
            </div>
            <span className="font-extrabold text-sm text-slate-900">
              PulseDesk
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canCreateInquiry && onOpenNewModal && (
            <button
              type="button"
              onClick={onOpenNewModal}
              className="p-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold"
              title="Log New Inquiry"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onLogout}
            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg text-xs"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Desktop Fixed Left Sidebar */}
      <aside className="hidden lg:block w-64 h-screen sticky top-0 shrink-0 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
            onClick={closeMobile}
          />
          <div className="relative w-72 max-w-[80vw] h-full z-10 animate-slideRight">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
