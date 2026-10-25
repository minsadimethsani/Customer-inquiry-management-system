"use client";

import React, { useState } from "react";
import { Category, Inquiry, InquiryChannel, Priority, User } from "../types";
import { X, Plus, AlertCircle, AlertTriangle, RefreshCw, CheckCircle2 } from "lucide-react";

interface NewInquiryModalProps {
  categories: Category[];
  staffUsers: User[];
  currentUser: User;
  onClose: () => void;
  onCreate: (newInquiry: Inquiry) => Promise<any> | void;
}

export function NewInquiryModal({
  categories,
  staffUsers,
  currentUser,
  onClose,
  onCreate,
}: NewInquiryModalProps) {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerCompany, setCustomerCompany] = useState("");
  const [channel, setChannel] = useState<InquiryChannel>("PHONE");
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [assignedToId, setAssignedToId] = useState("");

  // Usability & Error States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmissionError(null);
    setIsDuplicate(false);

    // Required field validation with friendly messages
    if (!customerName.trim()) {
      setSubmissionError("Please enter the customer's full name.");
      return;
    }
    if (!customerEmail.trim()) {
      setSubmissionError("Please enter the customer's email address.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail.trim())) {
      setSubmissionError("Please enter a valid email address (e.g. name@company.com).");
      return;
    }
    if (!subject.trim()) {
      setSubmissionError("Please provide a brief subject or topic for this inquiry.");
      return;
    }
    if (!description.trim()) {
      setSubmissionError("Please provide a description of the customer's issue or request.");
      return;
    }

    const selectedCategory =
      categories.find((c) => c.id === categoryId) || categories[0];
    const selectedAssignee =
      staffUsers.find((u) => u.id === assignedToId) || null;

    const ticketNumber = `INQ-${Math.floor(1050 + Math.random() * 900)}`;
    const now = new Date().toISOString();

    const createdInquiry: Inquiry = {
      id: `inq-${Date.now()}`,
      ticketNumber,
      subject: subject.trim(),
      description: description.trim(),
      status: "OPEN",
      priority,
      channel,
      category: selectedCategory,
      customer: {
        name: customerName.trim(),
        email: customerEmail.trim(),
        phone: customerPhone.trim() || undefined,
        company: customerCompany.trim() || undefined,
      },
      createdBy: currentUser,
      assignedTo: selectedAssignee,
      createdAt: now,
      updatedAt: now,
      lastActivity: {
        text: selectedAssignee
          ? `Inquiry logged and assigned to ${selectedAssignee.name}`
          : `Inquiry logged via ${channel} - Needs Owner`,
        actorName: currentUser.name,
        timestamp: now,
      },
      messages: [
        {
          id: `msg-${Date.now()}-1`,
          inquiryId: `inq-${Date.now()}`,
          senderName: customerName.trim(),
          sender: null,
          body: description.trim() || subject.trim(),
          isInternalNote: false,
          createdAt: now,
        },
      ],
      activityLogs: [
        {
          id: `log-${Date.now()}-1`,
          inquiryId: `inq-${Date.now()}`,
          actor: currentUser,
          action: "INQUIRY_CREATED",
          description: `Logged via ${channel} channel with ${priority} priority`,
          timestamp: now,
        },
        ...(selectedAssignee
          ? [
              {
                id: `log-${Date.now()}-2`,
                inquiryId: `inq-${Date.now()}`,
                actor: currentUser,
                action: "ASSIGNED" as const,
                description: `Assigned directly to ${selectedAssignee.name}`,
                timestamp: now,
              },
            ]
          : []),
      ],
    };

    setIsSubmitting(true);
    try {
      const result = await onCreate(createdInquiry);
      if (result && result.success === false) {
        setIsSubmitting(false);
        const isConflict =
          result.status === 409 ||
          result.error === "DuplicateInquiry" ||
          result.error === "Conflict";
        setIsDuplicate(isConflict);
        setSubmissionError(
          result.message ||
            (isConflict
              ? `A similar inquiry with subject '${subject.trim()}' was already received from this customer within the last 5 minutes.`
              : "Unable to save this inquiry. Please check the details and try again.")
        );
        return;
      }
      setIsSubmitting(false);
      onClose();
    } catch (err: any) {
      setIsSubmitting(false);
      setSubmissionError(
        "Could not save inquiry. Please check your internet connection and try again."
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Log New Customer Inquiry
            </h2>
            <p className="text-xs text-slate-500">
              Capture customer requests received through chat, phone calls, or emails.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Validation / Error Banner */}
        {submissionError && (
          <div
            className={`mx-6 mt-4 p-3.5 rounded-xl border flex items-start gap-3 ${
              isDuplicate
                ? "bg-amber-50 border-amber-300 text-amber-900"
                : "bg-rose-50 border-rose-300 text-rose-900"
            }`}
          >
            {isDuplicate ? (
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-xs">
              <span className="font-bold block mb-0.5">
                {isDuplicate ? "Duplicate Inquiry Detected" : "Submission Failed"}
              </span>
              <p className="leading-relaxed">{submissionError}</p>
              {isDuplicate && (
                <p className="mt-1 text-[11px] text-amber-700 font-medium">
                  Tip: Inquiries submitted within 5 minutes with identical subjects are deduplicated to protect against double-submission.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSubmissionError(null)}
              className="text-slate-400 hover:text-slate-600 text-xs font-bold px-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Customer Details Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Customer Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  required
                  disabled={isSubmitting}
                  placeholder="e.g. Alice Cooper"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Customer Email *
                </label>
                <input
                  type="email"
                  required
                  disabled={isSubmitting}
                  placeholder="alice@company.com"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  disabled={isSubmitting}
                  placeholder="+1 (555) 000-0000"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Company / Organization
                </label>
                <input
                  type="text"
                  disabled={isSubmitting}
                  placeholder="e.g. ACME Corp"
                  value={customerCompany}
                  onChange={(e) => setCustomerCompany(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                />
              </div>
            </div>
          </div>

          {/* Classification & Ownership */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Inquiry Classification & Assignment
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Channel
                </label>
                <select
                  value={channel}
                  disabled={isSubmitting}
                  onChange={(e) => setChannel(e.target.value as InquiryChannel)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                >
                  <option value="PHONE">📞 Phone Call</option>
                  <option value="CHAT">💬 Live Chat</option>
                  <option value="EMAIL">✉️ Email</option>
                  <option value="WEB_PORTAL">🌐 Web Portal</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Category
                </label>
                <select
                  value={categoryId}
                  disabled={isSubmitting}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Priority
                </label>
                <select
                  value={priority}
                  disabled={isSubmitting}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">🔥 Urgent</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Assign Staff
                </label>
                <select
                  value={assignedToId}
                  disabled={isSubmitting}
                  onChange={(e) => setAssignedToId(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                >
                  <option value="">⚠️ Leave Unassigned</option>
                  {staffUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Subject & Description */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Subject / Issue Summary *
              </label>
              <input
                type="text"
                required
                disabled={isSubmitting}
                placeholder="e.g. Broken water heater line in master restroom"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Inquiry Details / Message Body *
              </label>
              <textarea
                rows={4}
                required
                disabled={isSubmitting}
                placeholder="Detailed description of customer's request, address, or initial conversation notes..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 resize-none disabled:bg-slate-100"
              />
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Create & Log Inquiry</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
