"use client";

import React, { useState } from "react";
import { Inquiry, InquiryStatus, Priority, User } from "../types";
import {
  formatDateTime,
  formatRelativeTime,
  getPriorityBadge,
  getStatusBadge,
} from "../utils";
import {
  X,
  UserCheck,
  UserX,
  Lock,
  Send,
  MessageSquare,
  History,
  Phone,
  Mail,
  Building,
  CheckCircle2,
  Clock,
  AlertTriangle,
  User as UserIcon,
} from "lucide-react";

interface InquiryDetailModalProps {
  inquiry: Inquiry;
  staffUsers: User[];
  currentUser: User;
  onClose: () => void;
  onUpdateStatus: (inquiryId: string, status: InquiryStatus) => void;
  onUpdatePriority: (inquiryId: string, priority: Priority) => void;
  onAssign: (inquiryId: string, assignedTo: User | null) => void;
  onAddMessage: (
    inquiryId: string,
    body: string,
    isInternalNote: boolean
  ) => void;
}

export function InquiryDetailModal({
  inquiry,
  staffUsers,
  currentUser,
  onClose,
  onUpdateStatus,
  onUpdatePriority,
  onAssign,
  onAddMessage,
}: InquiryDetailModalProps) {
  const [activeTab, setActiveTab] = useState<"thread" | "internal" | "timeline">(
    "thread"
  );
  const [replyText, setReplyText] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);

  const statusInfo = getStatusBadge(inquiry.status);
  const priorityInfo = getPriorityBadge(inquiry.priority);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    onAddMessage(inquiry.id, replyText.trim(), isInternalNote);
    setReplyText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      handleSendMessage(e);
    }
  };

  const internalNotesCount = inquiry.messages.filter(
    (m) => m.isInternalNote
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative flex flex-col w-full max-w-4xl h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm font-bold text-slate-800 bg-white border border-slate-200 px-2.5 py-1 rounded-md shadow-2xs">
              {inquiry.ticketNumber}
            </span>
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full border"
              style={{
                backgroundColor: `${inquiry.category.color}15`,
                color: inquiry.category.color,
                borderColor: `${inquiry.category.color}40`,
              }}
            >
              {inquiry.category.name}
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Created {formatDateTime(inquiry.createdAt)}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Controls Ribbon: Status, Priority, Assignee */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3 border-b border-slate-200 bg-white shadow-2xs">
          {/* Status and Priority Selectors */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Status:
              </span>
              <select
                value={inquiry.status}
                onChange={(e) =>
                  onUpdateStatus(inquiry.id, e.target.value as InquiryStatus)
                }
                className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer text-slate-800"
              >
                <option value="OPEN">🔴 Open / Unaddressed</option>
                <option value="IN_PROGRESS">🔵 In Progress</option>
                <option value="PENDING_CUSTOMER">🟣 Waiting on Customer</option>
                <option value="RESOLVED">🟢 Resolved</option>
                <option value="CLOSED">⚪ Closed</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Priority:
              </span>
              <select
                value={inquiry.priority}
                onChange={(e) =>
                  onUpdatePriority(inquiry.id, e.target.value as Priority)
                }
                className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer text-slate-800"
              >
                <option value="URGENT">🔥 Urgent</option>
                <option value="HIGH">⚡ High</option>
                <option value="MEDIUM">⚖️ Medium</option>
                <option value="LOW">🌱 Low</option>
              </select>
            </div>
          </div>

          {/* CRITICAL PROBLEM 1: Assignee Management */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Handling Staff:
            </span>
            <select
              value={inquiry.assignedTo?.id || ""}
              onChange={(e) => {
                const selected =
                  staffUsers.find((u) => u.id === e.target.value) || null;
                onAssign(inquiry.id, selected);
              }}
              className={`text-xs font-medium border rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer ${
                !inquiry.assignedTo
                  ? "bg-red-50 text-red-800 border-red-300 font-bold"
                  : "bg-slate-50 text-slate-800 border-slate-200"
              }`}
            >
              <option value="">⚠️ Unassigned (Needs Owner)</option>
              {staffUsers.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  👤 {staff.name} ({staff.department || staff.role})
                </option>
              ))}
            </select>

            {/* Quick Claim Button if unassigned or assigned to someone else */}
            {inquiry.assignedTo?.id !== currentUser.id && (
              <button
                type="button"
                onClick={() => onAssign(inquiry.id, currentUser)}
                className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-2xs"
              >
                <UserCheck className="w-3.5 h-3.5" />
                Assign to Me
              </button>
            )}
          </div>
        </div>

        {/* Modal Main Body Grid: Left (Customer & Details) | Right (Conversation & History) */}
        <div className="grid grid-cols-1 md:grid-cols-3 flex-1 overflow-hidden">
          {/* Left Column: Customer Card & Ticket Context */}
          <div className="p-5 border-r border-slate-200 bg-slate-50/50 overflow-y-auto space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-snug">
                {inquiry.subject}
              </h2>
              <p className="text-xs text-slate-600 mt-2 bg-white p-3 rounded-lg border border-slate-200 leading-relaxed whitespace-pre-wrap">
                {inquiry.description}
              </p>
            </div>

            {/* Customer Details Box */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Customer Information
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2 text-slate-800 font-semibold">
                  <UserIcon className="w-4 h-4 text-slate-400" />
                  <span>{inquiry.customer.name}</span>
                </div>
                {inquiry.customer.company && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Building className="w-4 h-4 text-slate-400" />
                    <span>{inquiry.customer.company}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-slate-600">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <a
                    href={`mailto:${inquiry.customer.email}`}
                    className="text-blue-600 hover:underline"
                  >
                    {inquiry.customer.email}
                  </a>
                </div>
                {inquiry.customer.phone && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <span>{inquiry.customer.phone}</span>
                  </div>
                )}
              </div>
            </div>

            {/* CRITICAL PROBLEM 3: Summary of Last Event */}
            <div className="p-3.5 bg-blue-50/80 rounded-xl border border-blue-200 text-xs">
              <div className="flex items-center gap-1.5 text-blue-900 font-bold mb-1">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>Last Handled Action</span>
              </div>
              <p className="text-blue-800">{inquiry.lastActivity.text}</p>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-blue-200/60 text-blue-600 text-[11px]">
                <span>By {inquiry.lastActivity.actorName}</span>
                <span className="font-mono">
                  {formatRelativeTime(inquiry.lastActivity.timestamp)}
                </span>
              </div>
            </div>
          </div>

          {/* Right 2 Columns: Tabs (Thread, Internal Notes, Audit Timeline) & Reply Box */}
          <div className="md:col-span-2 flex flex-col h-full bg-white overflow-hidden">
            {/* Tab Navigation */}
            <div className="flex items-center gap-4 px-6 pt-3 border-b border-slate-200 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setActiveTab("thread")}
                className={`flex items-center gap-1.5 pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
                  activeTab === "thread"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                All Conversation ({inquiry.messages.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("internal")}
                className={`flex items-center gap-1.5 pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
                  activeTab === "internal"
                    ? "border-amber-500 text-amber-700"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                Staff Internal Notes ({internalNotesCount})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("timeline")}
                className={`flex items-center gap-1.5 pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
                  activeTab === "timeline"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <History className="w-4 h-4" />
                Audit Trail ({inquiry.activityLogs.length})
              </button>
            </div>

            {/* Tab Content Display Area */}
            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              {/* Tab 1: Conversation & Notes */}
              {activeTab === "thread" && (
                <div className="space-y-4">
                  {inquiry.messages.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs">
                      No replies logged yet. Start the conversation below.
                    </div>
                  ) : (
                    inquiry.messages.map((msg) => {
                      const isStaff = !!msg.sender;
                      const displayName = msg.sender?.name || msg.senderName;
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col rounded-xl p-4 border transition-all ${
                            msg.isInternalNote
                              ? "bg-amber-50/70 border-amber-200"
                              : isStaff
                              ? "bg-blue-50/40 border-blue-100 ml-4"
                              : "bg-white border-slate-200 mr-4 shadow-2xs"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-6 h-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center ${
                                  msg.isInternalNote
                                    ? "bg-amber-600"
                                    : isStaff
                                    ? "bg-blue-600"
                                    : "bg-slate-700"
                                }`}
                              >
                                {displayName
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")}
                              </div>
                              <span className="text-xs font-bold text-slate-900">
                                {displayName}
                              </span>
                              {msg.isInternalNote ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300">
                                  <Lock className="w-2.5 h-2.5" />
                                  Internal Staff Note
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400">
                                  {isStaff ? "Staff Support" : "Customer (Logged)"}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {formatRelativeTime(msg.createdAt)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap pl-8">
                            {msg.body}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Tab 2: Internal Staff Notes Only */}
              {activeTab === "internal" && (
                <div className="space-y-4">
                  {internalNotesCount === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs">
                      No internal notes recorded. Use internal notes to leave
                      handover instructions, phone discussion memos, or field
                      updates.
                    </div>
                  ) : (
                    inquiry.messages
                      .filter((m) => m.isInternalNote)
                      .map((note) => (
                        <div
                          key={note.id}
                          className="bg-amber-50/80 border border-amber-300 rounded-xl p-4 shadow-2xs"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Lock className="w-4 h-4 text-amber-600" />
                              <span className="text-xs font-bold text-amber-950">
                                {note.sender?.name || note.senderName}
                              </span>
                              <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                                Handover / Staff Memo
                              </span>
                            </div>
                            <span className="text-[11px] text-amber-700 font-mono">
                              {formatRelativeTime(note.createdAt)}
                            </span>
                          </div>
                          <p className="text-xs text-amber-900 leading-relaxed whitespace-pre-wrap pl-6">
                            {note.body}
                          </p>
                        </div>
                      ))
                  )}
                </div>
              )}

              {/* Tab 3: Full Audit Trail (Timeline) */}
              {activeTab === "timeline" && (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {inquiry.activityLogs.map((log) => (
                    <div key={log.id} className="relative flex items-start gap-3">
                      <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-white border-2 border-indigo-600 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                      </div>
                      <div className="flex-1 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-slate-900">
                            {log.actor?.name || "System"}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {formatDateTime(log.timestamp)}
                          </span>
                        </div>
                        <p className="text-slate-600">{log.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Interactive Composer Form */}
            <form
              onSubmit={handleSendMessage}
              className="p-4 border-t border-slate-200 bg-slate-50/60"
            >
              {/* Mode Toggle: Public Reply vs Internal Note */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsInternalNote(false)}
                    className={`text-xs font-semibold px-3 py-1 rounded-md transition-all ${
                      !isInternalNote
                        ? "bg-blue-600 text-white shadow-xs"
                        : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                    }`}
                  >
                    Public Reply to Customer
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsInternalNote(true)}
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-md transition-all ${
                      isInternalNote
                        ? "bg-amber-500 text-white shadow-xs"
                        : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                    }`}
                  >
                    <Lock className="w-3 h-3" />
                    Internal Staff Note
                  </button>
                </div>

                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  Press <kbd className="px-1 py-0.5 bg-slate-200 rounded font-mono text-[10px]">Ctrl+Enter</kbd> to send
                </span>
              </div>

              {isInternalNote && (
                <div className="flex items-center gap-1.5 text-xs text-amber-800 bg-amber-100/70 px-3 py-1.5 rounded-lg border border-amber-200 mb-2">
                  <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>
                    Staff-only note: Visible only to internal team members (hidden from customer).
                  </span>
                </div>
              )}

              <div className="relative">
                <textarea
                  rows={3}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    isInternalNote
                      ? "Write internal handover notes, phone summary, or technician instructions..."
                      : `Write a customer response to ${inquiry.customer.name}...`
                  }
                  className={`w-full p-3 text-xs rounded-xl border focus:outline-hidden focus:ring-2 resize-none transition-colors ${
                    isInternalNote
                      ? "border-amber-300 focus:ring-amber-500 bg-amber-50/30"
                      : "border-slate-300 focus:ring-blue-500 bg-white"
                  }`}
                />
                <button
                  type="submit"
                  disabled={!replyText.trim()}
                  className={`absolute right-3 bottom-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed ${
                    isInternalNote
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  {isInternalNote ? "Save Staff Note" : "Send Reply"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
