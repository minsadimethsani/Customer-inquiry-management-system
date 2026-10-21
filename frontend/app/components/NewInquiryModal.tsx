"use client";

import React, { useState } from "react";
import { Category, Inquiry, InquiryChannel, Priority, User } from "../types";
import { X, Plus, AlertCircle } from "lucide-react";

interface NewInquiryModalProps {
  categories: Category[];
  staffUsers: User[];
  currentUser: User;
  onClose: () => void;
  onCreate: (newInquiry: Inquiry) => void;
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !customerName.trim() || !customerEmail.trim()) {
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

    onCreate(createdInquiry);
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
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
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
                  placeholder="e.g. Alice Cooper"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Customer Email *
                </label>
                <input
                  type="email"
                  required
                  placeholder="alice@company.com"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Company / Organization
                </label>
                <input
                  type="text"
                  placeholder="e.g. ACME Corp"
                  value={customerCompany}
                  onChange={(e) => setCustomerCompany(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
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
                  onChange={(e) => setChannel(e.target.value as InquiryChannel)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
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
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
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
                  onChange={(e) => setPriority(e.target.value as Priority)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
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
                  onChange={(e) => setAssignedToId(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
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
                placeholder="e.g. Broken water heater line in master restroom"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Inquiry Details / Message Body *
              </label>
              <textarea
                rows={4}
                required
                placeholder="Detailed description of customer's request, address, or initial conversation notes..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create & Log Inquiry
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
