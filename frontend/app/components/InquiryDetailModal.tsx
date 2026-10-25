"use client";

import React, { useState } from "react";
import { Inquiry, InquiryStatus, Priority, User } from "../types";
import {
  formatDateTime,
  getPriorityBadge,
  getStatusBadge,
  ALLOWED_STATUS_TRANSITIONS,
  canTransitionStatus,
} from "../utils";
import { RelativeTime } from "./RelativeTime";
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
  AlertCircle,
  RefreshCw,
  User as UserIcon,
} from "lucide-react";

interface InquiryDetailModalProps {
  inquiry: Inquiry;
  staffUsers: User[];
  currentUser: User;
  onClose: () => void;
  onUpdateStatus: (inquiryId: string, status: InquiryStatus) => Promise<any> | void;
  onUpdatePriority: (inquiryId: string, priority: Priority) => Promise<any> | void;
  onAssign: (inquiryId: string, assignedTo: User | null) => Promise<any> | void;
  onAddMessage: (
    inquiryId: string,
    body: string,
    isInternalNote: boolean
  ) => Promise<any> | void;
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

  // Usability & Async Action Feedback States
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isUpdatingPriority, setIsUpdatingPriority] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const statusInfo = getStatusBadge(inquiry.status);
  const priorityInfo = getPriorityBadge(inquiry.priority);
  const isClosed = inquiry.status === "CLOSED";

  // Allowed Transitions from current status
  const nextAllowed = ALLOWED_STATUS_TRANSITIONS[inquiry.status] || [];

  const handleStatusChange = async (newStatus: InquiryStatus) => {
    if (newStatus === inquiry.status) return;
    setActionError(null);

    if (isClosed) {
      setActionError(
        "Inquiry is CLOSED. Closed records are final and cannot be modified or reopened."
      );
      return;
    }

    if (!canTransitionStatus(inquiry.status, newStatus)) {
      setActionError(
        `Invalid status transition: Cannot transition from '${inquiry.status}' to '${newStatus}'. Allowed: ${nextAllowed.join(", ") || "None"}`
      );
      return;
    }

    setIsUpdatingStatus(true);
    try {
      const res = await onUpdateStatus(inquiry.id, newStatus);
      if (res && res.success === false) {
        setActionError(res.message || "Failed to update status on server.");
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to update status.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handlePriorityChange = async (newPriority: Priority) => {
    if (newPriority === inquiry.priority) return;
    setActionError(null);

    if (isClosed) {
      setActionError("Inquiry is CLOSED. Closed records cannot be modified.");
      return;
    }

    setIsUpdatingPriority(true);
    try {
      const res = await onUpdatePriority(inquiry.id, newPriority);
      if (res && res.success === false) {
        setActionError(res.message || "Failed to update priority.");
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to update priority.");
    } finally {
      setIsUpdatingPriority(false);
    }
  };

  const handleAssignChange = async (targetUser: User | null) => {
    setActionError(null);
    if (isClosed) {
      setActionError("Inquiry is CLOSED. Closed records cannot be modified.");
      return;
    }

    setIsAssigning(true);
    try {
      const res = await onAssign(inquiry.id, targetUser);
      if (res && res.success === false) {
        setActionError(res.message || "Failed to update assignee.");
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to assign inquiry.");
    } finally {
      setIsAssigning(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    setActionError(null);

    if (isClosed) {
      setActionError("Cannot add messages: Inquiry is CLOSED.");
      return;
    }

    setIsSendingMessage(true);
    try {
      const res = await onAddMessage(inquiry.id, replyText.trim(), isInternalNote);
      if (res && res.success === false) {
        setActionError(res.message || "Failed to dispatch message.");
      } else {
        setReplyText("");
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to send message.");
    } finally {
      setIsSendingMessage(false);
    }
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
            <span suppressHydrationWarning className="text-xs text-slate-500 font-mono">
              Created {formatDateTime(inquiry.createdAt)}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Closed Record Banner */}
        {isClosed && (
          <div className="px-6 py-2.5 bg-slate-800 text-slate-100 flex items-center justify-between text-xs border-b border-slate-900">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Archived Record:</strong> This inquiry is CLOSED. Closed records are terminal and immutable (no status changes or updates permitted).
              </span>
            </div>
            <span className="px-2 py-0.5 rounded bg-slate-700 text-[10px] font-bold tracking-wider uppercase text-slate-300">
              Read-Only
            </span>
          </div>
        )}

        {/* Action Error Banner */}
        {actionError && (
          <div className="px-6 py-2.5 bg-rose-50 border-b border-rose-200 text-rose-900 flex items-center justify-between text-xs animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button
              onClick={() => setActionError(null)}
              className="text-slate-400 hover:text-slate-700 text-xs font-bold px-1.5 py-0.5 rounded"
            >
              ✕
            </button>
          </div>
        )}

        {/* Action Controls Ribbon: Status, Priority, Assignee */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3 border-b border-slate-200 bg-white shadow-2xs">
          {/* Status and Priority Selectors */}
          <div className="flex items-center gap-4">
            {/* Status Selector with Workflow Rules */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Status:
              </span>
              <div className="relative flex items-center">
                <select
                  value={inquiry.status}
                  disabled={isClosed || isUpdatingStatus}
                  onChange={(e) => handleStatusChange(e.target.value as InquiryStatus)}
                  className={`text-xs font-medium border rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${statusInfo.bg}`}
                >
                  {/* Current Status */}
                  <option value={inquiry.status}>
                    Current: {statusInfo.label}
                  </option>

                  {/* Allowed Next Transitions */}
                  {nextAllowed.map((st) => {
                    const badge = getStatusBadge(st);
                    const label =
                      st === "CLOSED"
                        ? "Close Ticket (Final)"
                        : st === "IN_PROGRESS" && inquiry.status === "RESOLVED"
                        ? "Reopen Ticket (Back to In Progress)"
                        : `Advance to ${badge.label}`;
                    return (
                      <option key={st} value={st}>
                        ➜ {label}
                      </option>
                    );
                  })}
                </select>
                {isUpdatingStatus && (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600 ml-2" />
                )}
              </div>
            </div>

            {/* Priority Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Priority:
              </span>
              <div className="relative flex items-center">
                <select
                  value={inquiry.priority}
                  disabled={isClosed || isUpdatingPriority}
                  onChange={(e) => handlePriorityChange(e.target.value as Priority)}
                  className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer text-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="URGENT">🔥 Urgent</option>
                  <option value="HIGH">⚡ High</option>
                  <option value="MEDIUM">⚖️ Medium</option>
                  <option value="LOW">🌱 Low</option>
                </select>
                {isUpdatingPriority && (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600 ml-2" />
                )}
              </div>
            </div>
          </div>

          {/* Assignee Management */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Handling Staff:
            </span>
            <div className="relative flex items-center gap-2">
              <select
                value={inquiry.assignedTo?.id || ""}
                disabled={isClosed || isAssigning}
                onChange={(e) => {
                  const selected =
                    staffUsers.find((u) => u.id === e.target.value) || null;
                  handleAssignChange(selected);
                }}
                className={`text-xs font-medium border rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
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
              {!isClosed && inquiry.assignedTo?.id !== currentUser.id && (
                <button
                  type="button"
                  disabled={isAssigning}
                  onClick={() => handleAssignChange(currentUser)}
                  className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-2xs disabled:opacity-60"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  Assign to Me
                </button>
              )}

              {isAssigning && (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
              )}
            </div>
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

            {/* Summary of Last Event */}
            <div className="p-3.5 bg-blue-50/80 rounded-xl border border-blue-200 text-xs">
              <div className="flex items-center gap-1.5 text-blue-900 font-bold mb-1">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>Last Handled Action</span>
              </div>
              <p className="text-blue-800">{inquiry.lastActivity.text}</p>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-blue-200/60 text-blue-600 text-[11px]">
                <span>By {inquiry.lastActivity.actorName}</span>
                <RelativeTime
                  dateString={inquiry.lastActivity.timestamp}
                  className="font-medium"
                />
              </div>
            </div>
          </div>

          {/* Right Column: Interaction Thread, Internal Notes, Timeline */}
          <div className="md:col-span-2 flex flex-col h-full bg-white overflow-hidden">
            {/* View Switcher Tabs */}
            <div className="flex items-center justify-between px-6 pt-3 border-b border-slate-200 bg-slate-50/30">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setActiveTab("thread")}
                  className={`flex items-center gap-1.5 pb-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                    activeTab === "thread"
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Customer Conversation</span>
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
                    {inquiry.messages.filter((m) => !m.isInternalNote).length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("internal")}
                  className={`flex items-center gap-1.5 pb-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                    activeTab === "internal"
                      ? "border-amber-500 text-amber-700"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Staff Notes</span>
                  {internalNotesCount > 0 && (
                    <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full font-bold">
                      {internalNotesCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("timeline")}
                  className={`flex items-center gap-1.5 pb-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                    activeTab === "timeline"
                      ? "border-indigo-600 text-indigo-600"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Audit Timeline</span>
                </button>
              </div>
            </div>

            {/* Conversation Messages Container */}
            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              {/* Tab 1: Customer Conversation */}
              {activeTab === "thread" && (
                <div className="space-y-4">
                  {inquiry.messages
                    .filter((m) => !m.isInternalNote)
                    .map((msg) => {
                      const isStaff = !!msg.sender;
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${
                            isStaff ? "items-end" : "items-start"
                          }`}
                        >
                          <div
                            className={`flex items-center gap-2 mb-1 text-[11px] text-slate-400 ${
                              isStaff ? "flex-row-reverse" : "flex-row"
                            }`}
                          >
                            <span className="font-semibold text-slate-700">
                              {isStaff
                                ? `🛡️ ${msg.senderName} (Staff)`
                                : `👤 ${msg.senderName} (Customer)`}
                            </span>
                            <span suppressHydrationWarning className="font-mono">
                              {formatDateTime(msg.createdAt)}
                            </span>
                          </div>
                          <div
                            className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                              isStaff
                                ? "bg-blue-600 text-white rounded-tr-xs shadow-xs"
                                : "bg-slate-100 text-slate-800 rounded-tl-xs border border-slate-200"
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{msg.body}</p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

              {/* Tab 2: Internal Staff Notes */}
              {activeTab === "internal" && (
                <div className="space-y-3">
                  {inquiry.messages.filter((m) => m.isInternalNote).length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      No internal notes recorded yet.
                    </div>
                  ) : (
                    inquiry.messages
                      .filter((m) => m.isInternalNote)
                      .map((note) => (
                        <div
                          key={note.id}
                          className="p-3.5 bg-amber-50/80 rounded-xl border border-amber-200 shadow-2xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-[11px] text-amber-800 font-medium">
                            <span className="flex items-center gap-1.5">
                              <Lock className="w-3.5 h-3.5 text-amber-600" />
                              <strong className="text-amber-950">
                                {note.senderName}
                              </strong>{" "}
                              (Internal Staff Note)
                            </span>
                            <RelativeTime
                              dateString={note.createdAt}
                              className="text-amber-700/80"
                            />
                          </div>
                          <p className="text-xs text-amber-900 leading-relaxed whitespace-pre-wrap pl-5">
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
                          <span suppressHydrationWarning className="text-[11px] text-slate-400 font-mono">
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
            {isClosed ? (
              <div className="p-4 border-t border-slate-200 bg-slate-100 text-center text-xs text-slate-500 font-medium">
                🔒 This inquiry is CLOSED. Comments and responses are locked.
              </div>
            ) : (
              <form
                onSubmit={handleSendMessage}
                className="p-4 border-t border-slate-200 bg-slate-50/60"
              >
                {/* Mode Toggle: Public Reply vs Internal Note */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isSendingMessage}
                      onClick={() => setIsInternalNote(false)}
                      className={`text-xs font-semibold px-3 py-1 rounded-md transition-all cursor-pointer ${
                        !isInternalNote
                          ? "bg-blue-600 text-white shadow-xs"
                          : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                      }`}
                    >
                      Public Reply to Customer
                    </button>
                    <button
                      type="button"
                      disabled={isSendingMessage}
                      onClick={() => setIsInternalNote(true)}
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-md transition-all cursor-pointer ${
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
                    disabled={isSendingMessage}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      isInternalNote
                        ? "Write internal handover notes, phone summary, or technician instructions..."
                        : `Write a customer response to ${inquiry.customer.name}...`
                    }
                    className={`w-full p-3 text-xs rounded-xl border focus:outline-hidden focus:ring-2 resize-none transition-colors disabled:bg-slate-100 ${
                      isInternalNote
                        ? "border-amber-300 focus:ring-amber-500 bg-amber-50/30"
                        : "border-slate-300 focus:ring-blue-500 bg-white"
                    }`}
                  />
                  <button
                    type="submit"
                    disabled={!replyText.trim() || isSendingMessage}
                    className={`absolute right-3 bottom-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
                      isInternalNote
                        ? "bg-amber-600 hover:bg-amber-700"
                        : "bg-blue-600 hover:bg-blue-700"
                    }`}
                  >
                    {isSendingMessage ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>{isInternalNote ? "Save Staff Note" : "Send Reply"}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
