"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Inquiry,
  InquiryStatus,
  Priority,
  User,
} from "./types";
import {
  CATEGORIES,
  INITIAL_INQUIRIES,
  STAFF_USERS,
} from "./mockData";
import { Header } from "./components/Header";
import { StatCard } from "./components/StatCard";
import { InquiryCard } from "./components/InquiryCard";
import { InquiryDetailModal } from "./components/InquiryDetailModal";
import { NewInquiryModal } from "./components/NewInquiryModal";
import {
  Inbox,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Search,
  Filter,
  UserCheck,
  UserX,
  PlusCircle,
  RefreshCw,
  Sparkles,
} from "lucide-react";

const STORAGE_KEY = "pulsedesk_inquiries_v1";
const USER_KEY = "pulsedesk_current_user_v1";

export default function Home() {
  const [inquiries, setInquiries] = useState<Inquiry[]>(INITIAL_INQUIRIES);
  const [currentUser, setCurrentUser] = useState<User>(STAFF_USERS[0]);

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<
    "ALL" | "UNASSIGNED" | "ASSIGNED_TO_ME" | "IN_PROGRESS" | "RESOLVED"
  >("ALL");
  const [selectedPriority, setSelectedPriority] = useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedChannel, setSelectedChannel] = useState<string>("ALL");

  // Modal States
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  // Sync with localStorage on client mount
  useEffect(() => {
    try {
      const savedInquiries = localStorage.getItem(STORAGE_KEY);
      if (savedInquiries) {
        setInquiries(JSON.parse(savedInquiries));
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_INQUIRIES));
      }

      const savedUser = localStorage.getItem(USER_KEY);
      if (savedUser) {
        setCurrentUser(JSON.parse(savedUser));
      }
    } catch {
      // fallback to initial
    }
  }, []);

  // Save to localStorage whenever inquiries change
  const saveInquiries = (updated: Inquiry[]) => {
    setInquiries(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Storage error:", e);
    }
  };

  const handleSelectUser = (user: User) => {
    setCurrentUser(user);
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (e) {
      console.error("User storage error:", e);
    }
  };

  const handleResetData = () => {
    if (confirm("Reset all inquiries to sample demonstration data?")) {
      saveInquiries(INITIAL_INQUIRIES);
      setSelectedInquiry(null);
    }
  };

  // Quick 1-Click Handlers for Core Problem Solving
  const handleQuickAssign = (inquiryId: string, user: User) => {
    const now = new Date().toISOString();
    const updated = inquiries.map((inq) => {
      if (inq.id === inquiryId) {
        const isSelf = user.id === currentUser.id;
        const newLog = {
          id: `log-${Date.now()}`,
          inquiryId,
          actor: currentUser,
          action: "ASSIGNED" as const,
          description: isSelf
            ? `${currentUser.name} claimed this ticket`
            : `Assigned to ${user.name}`,
          timestamp: now,
        };
        const updatedInq: Inquiry = {
          ...inq,
          assignedTo: user,
          status: inq.status === "OPEN" ? "IN_PROGRESS" : inq.status,
          updatedAt: now,
          lastActivity: {
            text: isSelf
              ? `Claimed by ${currentUser.name}`
              : `Assigned to ${user.name}`,
            actorName: currentUser.name,
            timestamp: now,
          },
          activityLogs: [newLog, ...inq.activityLogs],
        };
        if (selectedInquiry?.id === inquiryId) {
          setSelectedInquiry(updatedInq);
        }
        return updatedInq;
      }
      return inq;
    });
    saveInquiries(updated);
  };

  const handleUpdateStatus = (inquiryId: string, newStatus: InquiryStatus) => {
    const now = new Date().toISOString();
    const updated = inquiries.map((inq) => {
      if (inq.id === inquiryId) {
        const newLog = {
          id: `log-${Date.now()}`,
          inquiryId,
          actor: currentUser,
          action: "STATUS_CHANGED" as const,
          description: `Status changed from ${inq.status} to ${newStatus}`,
          timestamp: now,
        };
        const updatedInq: Inquiry = {
          ...inq,
          status: newStatus,
          updatedAt: now,
          lastActivity: {
            text: `Status changed to ${newStatus}`,
            actorName: currentUser.name,
            timestamp: now,
          },
          activityLogs: [newLog, ...inq.activityLogs],
        };
        if (selectedInquiry?.id === inquiryId) {
          setSelectedInquiry(updatedInq);
        }
        return updatedInq;
      }
      return inq;
    });
    saveInquiries(updated);
  };

  const handleUpdatePriority = (inquiryId: string, newPriority: Priority) => {
    const now = new Date().toISOString();
    const updated = inquiries.map((inq) => {
      if (inq.id === inquiryId) {
        const newLog = {
          id: `log-${Date.now()}`,
          inquiryId,
          actor: currentUser,
          action: "PRIORITY_CHANGED" as const,
          description: `Priority updated to ${newPriority}`,
          timestamp: now,
        };
        const updatedInq: Inquiry = {
          ...inq,
          priority: newPriority,
          updatedAt: now,
          lastActivity: {
            text: `Priority escalated to ${newPriority}`,
            actorName: currentUser.name,
            timestamp: now,
          },
          activityLogs: [newLog, ...inq.activityLogs],
        };
        if (selectedInquiry?.id === inquiryId) {
          setSelectedInquiry(updatedInq);
        }
        return updatedInq;
      }
      return inq;
    });
    saveInquiries(updated);
  };

  const handleAssign = (inquiryId: string, assignedTo: User | null) => {
    const now = new Date().toISOString();
    const updated = inquiries.map((inq) => {
      if (inq.id === inquiryId) {
        const newLog = {
          id: `log-${Date.now()}`,
          inquiryId,
          actor: currentUser,
          action: "ASSIGNED" as const,
          description: assignedTo
            ? `Assigned to ${assignedTo.name}`
            : `Unassigned ticket (returned to triage queue)`,
          timestamp: now,
        };
        const updatedInq: Inquiry = {
          ...inq,
          assignedTo,
          updatedAt: now,
          lastActivity: {
            text: assignedTo
              ? `Assigned to ${assignedTo.name}`
              : "Returned to Unassigned queue",
            actorName: currentUser.name,
            timestamp: now,
          },
          activityLogs: [newLog, ...inq.activityLogs],
        };
        if (selectedInquiry?.id === inquiryId) {
          setSelectedInquiry(updatedInq);
        }
        return updatedInq;
      }
      return inq;
    });
    saveInquiries(updated);
  };

  const handleAddMessage = (
    inquiryId: string,
    body: string,
    isInternalNote: boolean
  ) => {
    const now = new Date().toISOString();
    const newMessage = {
      id: `msg-${Date.now()}`,
      inquiryId,
      senderName: currentUser.name,
      sender: currentUser,
      body,
      isInternalNote,
      createdAt: now,
    };
    const newLog = {
      id: `log-${Date.now()}`,
      inquiryId,
      actor: currentUser,
      action: (isInternalNote ? "NOTE_ADDED" : "MESSAGE_SENT") as
        | "NOTE_ADDED"
        | "MESSAGE_SENT",
      description: isInternalNote
        ? "Added internal staff note"
        : "Sent response to customer",
      timestamp: now,
    };

    const updated = inquiries.map((inq) => {
      if (inq.id === inquiryId) {
        const updatedInq: Inquiry = {
          ...inq,
          status:
            !isInternalNote && inq.status === "OPEN"
              ? "IN_PROGRESS"
              : inq.status,
          updatedAt: now,
          lastActivity: {
            text: isInternalNote
              ? `Internal note: "${body.slice(0, 35)}..."`
              : `Replied to customer`,
            actorName: currentUser.name,
            timestamp: now,
          },
          messages: [...inq.messages, newMessage],
          activityLogs: [newLog, ...inq.activityLogs],
        };
        if (selectedInquiry?.id === inquiryId) {
          setSelectedInquiry(updatedInq);
        }
        return updatedInq;
      }
      return inq;
    });
    saveInquiries(updated);
  };

  const handleCreateInquiry = (newInquiry: Inquiry) => {
    const updated = [newInquiry, ...inquiries];
    saveInquiries(updated);
    setIsNewModalOpen(false);
    setSelectedInquiry(newInquiry);
  };

  // Computed Metrics
  const metrics = useMemo(() => {
    const total = inquiries.length;
    const unassigned = inquiries.filter((i) => !i.assignedTo).length;
    const inProgress = inquiries.filter((i) => i.status === "IN_PROGRESS").length;
    const resolved = inquiries.filter(
      (i) => i.status === "RESOLVED" || i.status === "CLOSED"
    ).length;
    const urgent = inquiries.filter(
      (i) => i.priority === "URGENT" && i.status !== "RESOLVED" && i.status !== "CLOSED"
    ).length;

    return { total, unassigned, inProgress, resolved, urgent };
  }, [inquiries]);

  // Filtered List
  const filteredInquiries = useMemo(() => {
    return inquiries.filter((inq) => {
      // Search match
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesQuery =
          inq.ticketNumber.toLowerCase().includes(query) ||
          inq.subject.toLowerCase().includes(query) ||
          inq.description.toLowerCase().includes(query) ||
          inq.customer.name.toLowerCase().includes(query) ||
          inq.customer.email.toLowerCase().includes(query) ||
          (inq.customer.company &&
            inq.customer.company.toLowerCase().includes(query));
        if (!matchesQuery) return false;
      }

      // Tab filter
      if (activeTab === "UNASSIGNED" && inq.assignedTo) return false;
      if (activeTab === "ASSIGNED_TO_ME" && inq.assignedTo?.id !== currentUser.id)
        return false;
      if (activeTab === "IN_PROGRESS" && inq.status !== "IN_PROGRESS")
        return false;
      if (
        activeTab === "RESOLVED" &&
        inq.status !== "RESOLVED" &&
        inq.status !== "CLOSED"
      )
        return false;

      // Priority filter
      if (selectedPriority !== "ALL" && inq.priority !== selectedPriority)
        return false;

      // Category filter
      if (selectedCategory !== "ALL" && inq.category.id !== selectedCategory)
        return false;

      // Channel filter
      if (selectedChannel !== "ALL" && inq.channel !== selectedChannel)
        return false;

      return true;
    });
  }, [
    inquiries,
    searchQuery,
    activeTab,
    selectedPriority,
    selectedCategory,
    selectedChannel,
    currentUser.id,
  ]);



  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navigation */}
      <Header
        staffUsers={STAFF_USERS}
        currentUser={currentUser}
        onSelectUser={handleSelectUser}
        onOpenNewModal={() => setIsNewModalOpen(true)}
        onResetData={handleResetData}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Hero Banner explaining the solution */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 p-6 sm:p-8 text-white shadow-lg">
          <div className="relative z-10 max-w-3xl space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-blue-200 border border-white/20">
              <Sparkles className="w-3.5 h-3.5 text-blue-300" />
              <span>Never Lose Track of Customer Inquiries</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Customer Inquiry & Service Dispatch System
            </h1>
            <p className="text-sm sm:text-base text-blue-100 leading-relaxed">
              Eliminate lost requests from chat apps and spreadsheets. Easily view <strong>who is handling each request</strong>, <strong>whether it has been addressed</strong>, and <strong>what happened last</strong> in real-time.
            </p>
          </div>
          {/* Subtle background glow */}
          <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* Problem 1 & 2: Real-Time Stats Overview Ribbon */}
        <section aria-label="Inquiry Metrics Overview" className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            label="Total Inquiries"
            value={metrics.total}
            subtext="All records"
            icon={Inbox}
            variant="default"
            isActive={activeTab === "ALL"}
            onClick={() => setActiveTab("ALL")}
          />
          <StatCard
            label="Needs Owner"
            value={metrics.unassigned}
            subtext={metrics.unassigned > 0 ? "⚠️ Immediate triage" : "Zero unassigned"}
            icon={UserX}
            variant={metrics.unassigned > 0 ? "danger" : "default"}
            isActive={activeTab === "UNASSIGNED"}
            onClick={() => setActiveTab("UNASSIGNED")}
          />
          <StatCard
            label="In Progress"
            value={metrics.inProgress}
            subtext="Being worked on"
            icon={Clock}
            variant="info"
            isActive={activeTab === "IN_PROGRESS"}
            onClick={() => setActiveTab("IN_PROGRESS")}
          />
          <StatCard
            label="Urgent Priority"
            value={metrics.urgent}
            subtext="Needs quick resolution"
            icon={AlertTriangle}
            variant="warning"
          />
          <StatCard
            label="Resolved / Done"
            value={metrics.resolved}
            subtext="Closed tickets"
            icon={CheckCircle2}
            variant="success"
            isActive={activeTab === "RESOLVED"}
            onClick={() => setActiveTab("RESOLVED")}
          />
        </section>

        {/* Search, Tabs, and Filter Controls Section */}
        <section aria-label="Filters and Inquiries" className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            {/* Primary Tab Navigation */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/90 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab("ALL")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "ALL"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All ({metrics.total})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("UNASSIGNED")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "UNASSIGNED"
                    ? "bg-red-600 text-white shadow-xs"
                    : "text-red-700 hover:bg-red-50"
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Needs Owner ({metrics.unassigned})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("ASSIGNED_TO_ME")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "ASSIGNED_TO_ME"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                Assigned to Me
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("IN_PROGRESS")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "IN_PROGRESS"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                In Progress ({metrics.inProgress})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("RESOLVED")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "RESOLVED"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Resolved ({metrics.resolved})
              </button>
            </div>

            {/* Live Search Input */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search ticket #, customer, company, subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Secondary Filtering Bar (Priority, Category, Channel) */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-1.5 font-bold text-slate-400 uppercase tracking-wider text-[11px]">
              <Filter className="w-3.5 h-3.5" />
              <span>Filters:</span>
            </div>

            {/* Priority Filter */}
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Priorities</option>
              <option value="URGENT">🔥 Urgent</option>
              <option value="HIGH">⚡ High</option>
              <option value="MEDIUM">⚖️ Medium</option>
              <option value="LOW">🌱 Low</option>
            </select>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Categories</option>
              {CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>

            {/* Channel Filter */}
            <select
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Channels</option>
              <option value="PHONE">📞 Phone</option>
              <option value="CHAT">💬 Chat</option>
              <option value="EMAIL">✉️ Email</option>
              <option value="WEB_PORTAL">🌐 Web Portal</option>
            </select>

            {(selectedPriority !== "ALL" ||
              selectedCategory !== "ALL" ||
              selectedChannel !== "ALL" ||
              searchQuery !== "") && (
              <button
                type="button"
                onClick={() => {
                  setSelectedPriority("ALL");
                  setSelectedCategory("ALL");
                  setSelectedChannel("ALL");
                  setSearchQuery("");
                }}
                className="text-blue-600 hover:underline font-semibold ml-auto"
              >
                Clear all filters
              </button>
            )}
          </div>

          {/* Inquiries Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span>
                Showing <strong>{filteredInquiries.length}</strong> inquiries
              </span>
              <span className="text-[11px] text-slate-400">
                Click any inquiry to view conversation, private staff notes, and audit timeline
              </span>
            </div>

            {filteredInquiries.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-dashed border-slate-300 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <Inbox className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-800">
                  No inquiries found
                </h3>
                <p className="text-xs text-slate-500 max-w-sm">
                  No inquiries match the current search filters. Try clearing your filters or create a new inquiry.
                </p>
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-2xs"
                >
                  <PlusCircle className="w-4 h-4" />
                  Log New Inquiry
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3.5">
                {filteredInquiries.map((inquiry) => (
                  <InquiryCard
                    key={inquiry.id}
                    inquiry={inquiry}
                    currentUser={currentUser}
                    onSelect={(inq) => setSelectedInquiry(inq)}
                    onQuickAssign={handleQuickAssign}
                    onQuickStatusChange={handleUpdateStatus}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Detail & Handover Drawer Modal */}
      {selectedInquiry && (
        <InquiryDetailModal
          inquiry={selectedInquiry}
          staffUsers={STAFF_USERS}
          currentUser={currentUser}
          onClose={() => setSelectedInquiry(null)}
          onUpdateStatus={handleUpdateStatus}
          onUpdatePriority={handleUpdatePriority}
          onAssign={handleAssign}
          onAddMessage={handleAddMessage}
        />
      )}

      {/* New Inquiry Intake Modal */}
      {isNewModalOpen && (
        <NewInquiryModal
          categories={CATEGORIES}
          staffUsers={STAFF_USERS}
          currentUser={currentUser}
          onClose={() => setIsNewModalOpen(false)}
          onCreate={handleCreateInquiry}
        />
      )}
    </div>
  );
}
