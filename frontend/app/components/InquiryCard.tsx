"use client";

import React from "react";
import { Inquiry, User } from "../types";
import {
  formatRelativeTime,
  getPriorityBadge,
  getStatusBadge,
} from "../utils";
import {
  Clock,
  UserCheck,
  UserX,
  Mail,
  Phone,
  MessageSquare,
  Globe,
  ArrowRight,
} from "lucide-react";

interface InquiryCardProps {
  inquiry: Inquiry;
  currentUser: User;
  onSelect: (inquiry: Inquiry) => void;
  onQuickAssign: (inquiryId: string, user: User) => void;
  onQuickStatusChange: (inquiryId: string, newStatus: Inquiry["status"]) => void;
}

export function InquiryCard({
  inquiry,
  currentUser,
  onSelect,
  onQuickAssign,
  onQuickStatusChange,
}: InquiryCardProps) {
  const statusInfo = getStatusBadge(inquiry.status);
  const priorityInfo = getPriorityBadge(inquiry.priority);

  const getChannelIcon = () => {
    switch (inquiry.channel) {
      case "PHONE":
        return <Phone className="w-3.5 h-3.5 text-emerald-600" />;
      case "CHAT":
        return <MessageSquare className="w-3.5 h-3.5 text-blue-600" />;
      case "EMAIL":
        return <Mail className="w-3.5 h-3.5 text-purple-600" />;
      default:
        return <Globe className="w-3.5 h-3.5 text-indigo-600" />;
    }
  };

  const isAssigned = !!inquiry.assignedTo;
  const isAssignedToMe = inquiry.assignedTo?.id === currentUser.id;

  return (
    <div
      onClick={() => onSelect(inquiry)}
      className={`group relative rounded-xl border bg-white p-5 transition-all duration-200 hover:shadow-md cursor-pointer ${
        !isAssigned
          ? "border-l-4 border-l-red-500 border-slate-200 bg-red-50/20"
          : inquiry.priority === "URGENT"
          ? "border-l-4 border-l-orange-500 border-slate-200"
          : "border-slate-200 hover:border-slate-300"
      }`}
    >
      {/* Top Header Row: ID, Category, Priority, Channel */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
            {inquiry.ticketNumber}
          </span>
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: `${inquiry.category.color}15`,
              color: inquiry.category.color,
              borderColor: `${inquiry.category.color}40`,
            }}
          >
            {inquiry.category.name}
          </span>
          <div className="flex items-center gap-1 text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
            {getChannelIcon()}
            <span className="capitalize">{inquiry.channel.toLowerCase().replace("_", " ")}</span>
          </div>
        </div>

        {/* Priority & Status Badges */}
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border ${priorityInfo.bg}`}
          >
            {priorityInfo.label}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full border font-medium ${statusInfo.bg}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
            {statusInfo.label}
          </span>
        </div>
      </div>

      {/* Main Subject & Customer Details */}
      <div className="mb-3">
        <h3 className="text-base font-semibold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
          {inquiry.subject}
        </h3>
        <p className="text-xs text-slate-600 line-clamp-2 mt-1 leading-relaxed">
          {inquiry.description}
        </p>
      </div>

      {/* Customer Info Line */}
      <div className="flex items-center gap-2 text-xs text-slate-500 mb-3.5">
        <span className="font-semibold text-slate-800">
          {inquiry.customer.name}
        </span>
        {inquiry.customer.company && (
          <>
            <span className="text-slate-300">•</span>
            <span className="text-slate-600">{inquiry.customer.company}</span>
          </>
        )}
        {inquiry.customer.phone && (
          <>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500">{inquiry.customer.phone}</span>
          </>
        )}
      </div>

      {/* Crucial Problem 1: Who is handling it? */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Owner:
          </span>
          {isAssigned ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200">
              <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                {inquiry.assignedTo?.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </div>
              <span className="text-xs font-medium text-slate-800">
                {inquiry.assignedTo?.name}
                {isAssignedToMe && " (You)"}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-800 border border-red-200">
                <UserX className="w-3.5 h-3.5" />
                Unassigned
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickAssign(inquiry.id, currentUser);
                }}
                className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
                title="Claim this ticket right now"
              >
                <UserCheck className="w-3 h-3" />
                Claim Ticket
              </button>
            </div>
          )}
        </div>

        {/* Message count & Open details trigger */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{inquiry.messages.length}</span>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 group-hover:translate-x-0.5 transition-transform">
            View Thread
            <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      </div>

      {/* Crucial Problem 3: What happened last? */}
      <div className="mt-2.5 pt-2 flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span className="font-semibold text-slate-700 shrink-0">
          Last Action:
        </span>
        <span className="truncate text-slate-600">
          {inquiry.lastActivity.text}
        </span>
        <span className="text-slate-400 ml-auto shrink-0 font-mono text-[11px]">
          {formatRelativeTime(inquiry.lastActivity.timestamp)}
        </span>
      </div>
    </div>
  );
}
