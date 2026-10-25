"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
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
import { Sidebar } from "./components/Sidebar";
import { StatCard } from "./components/StatCard";
import { InquiryCard } from "./components/InquiryCard";
import { InquiryDetailModal } from "./components/InquiryDetailModal";
import { NewInquiryModal } from "./components/NewInquiryModal";
import { StaffManagementModal } from "./components/StaffManagementModal";
import { LoginPage } from "./components/LoginPage";
import { useToast, ToastContainer } from "./components/Toast";
import { AuthProvider, useAuth } from "./context/AuthContext";
import {
  canTransitionStatus,
  getAllowedTransitions,
} from "./utils";
import {
  fetchInquiriesFromApi,
  createInquiryApi,
  updateInquiryStatusApi,
  updateInquiryPriorityApi,
  assignInquiryApi,
  addInquiryMessageApi,
  fetchStaffApi,
  ApiMutationResult,
} from "./api";
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
  Shield,
  ShieldAlert,
} from "lucide-react";

const STORAGE_KEY = "pulsedesk_inquiries_v1";

function DashboardApp() {
  const {
    user: currentUser,
    isAuthenticated,
    isLoading: isAuthLoading,
    logout,
    hasPermission,
    isAdmin,
  } = useAuth();

  const [inquiries, setInquiries] = useState<Inquiry[]>(INITIAL_INQUIRIES);
  const [staffList, setStaffList] = useState<User[]>(STAFF_USERS);
  const [isLoading, setIsLoading] = useState(true);

  // Toast feedback notifications
  const {
    toasts,
    removeToast,
    toastSuccess,
    toastError,
    toastWarning,
    toastInfo,
  } = useToast();

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
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);

  // Granular Access Permissions
  const canCreateInquiry = hasPermission("inquiries:create");
  const canUpdateStatus = hasPermission("inquiries:update_status");
  const canAssign = hasPermission("inquiries:assign");
  const canUpdatePriority = hasPermission("inquiries:update_priority");
  const canAddNotes = hasPermission("inquiries:add_notes");
  const canClose = hasPermission("inquiries:close");
  const canViewAll = hasPermission("inquiries:view_all");

  // Fetch inquiries & staff members from backend API
  const refreshInquiries = useCallback(async () => {
    try {
      const apiData = await fetchInquiriesFromApi();
      if (apiData && apiData.length > 0) {
        setInquiries(apiData);
      }
    } catch {
      // Fall back gracefully to local cache
    }
  }, []);

  const refreshStaff = useCallback(async () => {
    try {
      const data = await fetchStaffApi();
      if (data && data.length > 0) {
        setStaffList(data);
      }
    } catch {
      // Keep existing staff list
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    try {
      const savedInquiries = localStorage.getItem(STORAGE_KEY);
      if (savedInquiries) {
        setInquiries(JSON.parse(savedInquiries));
      }
    } catch {
      // Ignore parse error
    }

    Promise.all([refreshInquiries(), refreshStaff()]).finally(() => {
      setIsLoading(false);
    });
  }, [isAuthenticated, refreshInquiries, refreshStaff]);

  // Save to localStorage whenever inquiries change
  const saveInquiries = (updated: Inquiry[]) => {
    setInquiries(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Storage error:", e);
    }
  };

  const handleResetData = () => {
    if (confirm("Reset all inquiries to sample demonstration data?")) {
      saveInquiries(INITIAL_INQUIRIES);
      setSelectedInquiry(null);
      toastInfo(
        "Sample Inquiries Restored",
        "The inquiries list has been reset to the demonstration baseline."
      );
    }
  };

  // Quick Handlers for Inquiry Operations
  const handleQuickAssign = async (inquiryId: string, user: User) => {
    if (!canAssign) {
      toastError(
        "Action Not Allowed",
        "You do not have permission to assign or claim tickets. Please contact an administrator."
      );
      return;
    }

    const targetInq = inquiries.find((i) => i.id === inquiryId);
    if (targetInq?.status === "CLOSED") {
      toastError(
        "Ticket Already Closed",
        `Ticket #${targetInq?.ticketNumber || inquiryId} is closed and cannot be reassigned.`
      );
      return;
    }

    // Persist to database via API
    const res = await assignInquiryApi(inquiryId, user.id);
    if (res && res.success === false) {
      toastError(
        "Assignment Failed",
        res.message || `Could not assign ticket #${targetInq?.ticketNumber || inquiryId} to ${user.name}. Please try again.`
      );
      return;
    }

    const now = new Date().toISOString();
    const isSelf = currentUser ? user.id === currentUser.id : false;
    const actorName = currentUser?.name || "Staff";

    const updated = inquiries.map((inq) => {
      if (inq.id === inquiryId) {
        const newLog = {
          id: `log-${Date.now()}`,
          inquiryId,
          actor: currentUser!,
          action: "ASSIGNED" as const,
          description: isSelf
            ? `${actorName} claimed this ticket`
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
              ? `Claimed by ${actorName}`
              : `Assigned to ${user.name}`,
            actorName,
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
    toastSuccess(
      isSelf ? "Ticket Claimed" : "Ticket Assigned",
      isSelf
        ? `You have claimed ownership of ticket #${targetInq?.ticketNumber || inquiryId}.`
        : `Ticket #${targetInq?.ticketNumber || inquiryId} assigned to ${user.name} (${user.department || "Staff"}).`
    );
  };

  const handleUpdateStatus = async (
    inquiryId: string,
    newStatus: InquiryStatus
  ): Promise<ApiMutationResult> => {
    if (!canUpdateStatus) {
      const err = "You do not have permission to update inquiry status.";
      toastError("Action Not Allowed", err);
      return { success: false, message: err };
    }

    if ((newStatus === "RESOLVED" || newStatus === "CLOSED") && !canClose) {
      const err = "You do not have permission to resolve or close inquiries.";
      toastError("Action Not Allowed", err);
      return { success: false, message: err };
    }

    const targetInq = inquiries.find((i) => i.id === inquiryId);
    if (!targetInq) {
      const err = `Inquiry #${inquiryId} could not be found.`;
      toastError("Inquiry Not Found", err);
      return { success: false, message: err };
    }

    // Closed records cannot be modified
    if (targetInq.status === "CLOSED") {
      const err = `Ticket #${targetInq.ticketNumber} is closed. Completed tickets cannot be modified.`;
      toastError("Ticket Already Closed", err);
      return { success: false, message: err };
    }

    // Valid transitions only
    if (!canTransitionStatus(targetInq.status, newStatus)) {
      const allowed = getAllowedTransitions(targetInq.status).join(", ") || "None";
      const err = `Cannot change ticket #${targetInq.ticketNumber} directly from ${targetInq.status} to ${newStatus}. Permitted next steps: ${allowed}.`;
      toastError("Status Change Not Allowed", err);
      return { success: false, message: err };
    }

    // Persist to database via API
    const res = await updateInquiryStatusApi(inquiryId, newStatus);
    if (res && res.success === false) {
      toastError(
        "Status Update Failed",
        res.message || `Could not update ticket #${targetInq.ticketNumber} to ${newStatus}. Please try again.`
      );
      return res;
    }

    const now = new Date().toISOString();
    const actorName = currentUser?.name || "Staff";
    const updated = inquiries.map((inq) => {
      if (inq.id === inquiryId) {
        const newLog = {
          id: `log-${Date.now()}`,
          inquiryId,
          actor: currentUser!,
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
            actorName,
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
    toastSuccess(
      newStatus === "RESOLVED"
        ? "Ticket Resolved"
        : newStatus === "CLOSED"
        ? "Ticket Closed"
        : "Status Updated",
      newStatus === "RESOLVED"
        ? `Ticket #${targetInq.ticketNumber} successfully marked as resolved.`
        : newStatus === "CLOSED"
        ? `Ticket #${targetInq.ticketNumber} closed and archived.`
        : `Ticket #${targetInq.ticketNumber} status changed to ${newStatus}.`
    );
    return { success: true, message: `Status updated to ${newStatus}` };
  };

  const handleUpdatePriority = async (
    inquiryId: string,
    newPriority: Priority
  ): Promise<ApiMutationResult> => {
    if (!canUpdatePriority) {
      const err = "You do not have permission to modify inquiry priority.";
      toastError("Action Not Allowed", err);
      return { success: false, message: err };
    }

    const targetInq = inquiries.find((i) => i.id === inquiryId);
    if (targetInq?.status === "CLOSED") {
      const err = `Ticket #${targetInq?.ticketNumber || inquiryId} is closed. Priority cannot be changed on closed tickets.`;
      toastError("Ticket Already Closed", err);
      return { success: false, message: err };
    }

    // Persist to database via API
    const res = await updateInquiryPriorityApi(inquiryId, newPriority);
    if (res && res.success === false) {
      toastError(
        "Priority Change Failed",
        res.message || `Could not change priority for ticket #${targetInq?.ticketNumber || inquiryId}. Please try again.`
      );
      return res;
    }

    const now = new Date().toISOString();
    const actorName = currentUser?.name || "Staff";
    const updated = inquiries.map((inq) => {
      if (inq.id === inquiryId) {
        const newLog = {
          id: `log-${Date.now()}`,
          inquiryId,
          actor: currentUser!,
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
            actorName,
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
    toastSuccess(
      newPriority === "URGENT" ? "Urgent Priority Set" : "Priority Updated",
      newPriority === "URGENT"
        ? `Ticket #${targetInq?.ticketNumber || inquiryId} marked as URGENT priority.`
        : `Ticket #${targetInq?.ticketNumber || inquiryId} priority set to ${newPriority}.`
    );
    return { success: true, message: `Priority set to ${newPriority}` };
  };

  const handleAssign = async (
    inquiryId: string,
    assignedTo: User | null
  ): Promise<ApiMutationResult> => {
    if (!canAssign) {
      const err = "You do not have permission to assign or delegate tickets.";
      toastError("Action Not Allowed", err);
      return { success: false, message: err };
    }

    const targetInq = inquiries.find((i) => i.id === inquiryId);
    if (targetInq?.status === "CLOSED") {
      const err = `Ticket #${targetInq?.ticketNumber || inquiryId} is closed and cannot be reassigned.`;
      toastError("Ticket Already Closed", err);
      return { success: false, message: err };
    }

    // Persist to database via API
    const res = await assignInquiryApi(inquiryId, assignedTo?.id || null);
    if (res && res.success === false) {
      toastError(
        "Assignment Failed",
        res.message ||
          (assignedTo
            ? `Could not assign ticket #${targetInq?.ticketNumber || inquiryId} to ${assignedTo.name}. Please try again.`
            : "Could not unassign ticket. Please try again.")
      );
      return res;
    }

    const now = new Date().toISOString();
    const actorName = currentUser?.name || "Staff";
    const updated = inquiries.map((inq) => {
      if (inq.id === inquiryId) {
        const newLog = {
          id: `log-${Date.now()}`,
          inquiryId,
          actor: currentUser!,
          action: "ASSIGNED" as const,
          description: assignedTo
            ? `Assigned to ${assignedTo.name}`
            : `Unassigned ticket (returned to waiting queue)`,
          timestamp: now,
        };
        const updatedInq: Inquiry = {
          ...inq,
          assignedTo,
          updatedAt: now,
          lastActivity: {
            text: assignedTo
              ? `Assigned to ${assignedTo.name}`
              : "Returned to waiting queue",
            actorName,
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
    toastSuccess(
      assignedTo ? "Ticket Assigned" : "Ticket Returned to Queue",
      assignedTo
        ? `Ticket #${targetInq?.ticketNumber || inquiryId} assigned to ${assignedTo.name} (${assignedTo.department || "Staff"}).`
        : `Ticket #${targetInq?.ticketNumber || inquiryId} unassigned and returned to the waiting queue.`
    );
    return { success: true };
  };

  const handleAddMessage = async (
    inquiryId: string,
    body: string,
    isInternalNote: boolean
  ): Promise<ApiMutationResult> => {
    if (!canAddNotes) {
      const err = "You do not have permission to post messages or internal notes.";
      toastError("Action Not Allowed", err);
      return { success: false, message: err };
    }

    const targetInq = inquiries.find((i) => i.id === inquiryId);
    if (targetInq?.status === "CLOSED") {
      const err = `Ticket #${targetInq?.ticketNumber || inquiryId} is closed. Adding replies or notes to closed tickets is disabled.`;
      toastError("Ticket Already Closed", err);
      return { success: false, message: err };
    }

    // Persist to database via API
    const res = await addInquiryMessageApi(inquiryId, body, isInternalNote);
    if (res && res.success === false) {
      toastError(
        isInternalNote ? "Note Failed" : "Reply Failed",
        res.message ||
          (isInternalNote
            ? `Could not save internal note on ticket #${targetInq?.ticketNumber || inquiryId}. Please try again.`
            : `Could not send reply to customer for ticket #${targetInq?.ticketNumber || inquiryId}. Please try again.`)
      );
      return res;
    }

    const now = new Date().toISOString();
    const actorName = currentUser?.name || "Staff";
    const newMessage = {
      id: `msg-${Date.now()}`,
      inquiryId,
      senderName: actorName,
      sender: currentUser,
      body,
      isInternalNote,
      createdAt: now,
    };
    const newLog = {
      id: `log-${Date.now()}`,
      inquiryId,
      actor: currentUser!,
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
            actorName,
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
    toastSuccess(
      isInternalNote ? "Note Saved" : "Reply Sent",
      isInternalNote
        ? `Internal note added to ticket #${targetInq?.ticketNumber || inquiryId}.`
        : `Customer reply sent for ticket #${targetInq?.ticketNumber || inquiryId}.`
    );
    return { success: true };
  };

  const handleCreateInquiry = async (
    newInquiry: Inquiry
  ): Promise<ApiMutationResult<Inquiry>> => {
    if (!canCreateInquiry) {
      const msg = "You do not have permission to create new customer inquiries.";
      toastError("Action Not Allowed", msg);
      return { success: false, message: msg };
    }

    // 5-minute duplicate submission check
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const localDuplicate = inquiries.find(
      (i) =>
        i.customer.email.toLowerCase() ===
          newInquiry.customer.email.toLowerCase() &&
        i.subject.trim().toLowerCase() ===
          newInquiry.subject.trim().toLowerCase() &&
        new Date(i.createdAt).getTime() >= fiveMinutesAgo
    );

    if (localDuplicate) {
      const msg = `An inquiry with subject '${newInquiry.subject}' from '${newInquiry.customer.email}' was already submitted within the last 5 minutes.`;
      toastWarning("Duplicate Inquiry Prevented", msg);
      return {
        success: false,
        status: 409,
        error: "DuplicateInquiry",
        message: msg,
      };
    }

    // Persist to database via API
    const res = await createInquiryApi({
      subject: newInquiry.subject,
      description: newInquiry.description,
      customerName: newInquiry.customer.name,
      customerEmail: newInquiry.customer.email,
      customerPhone: newInquiry.customer.phone,
      customerCompany: newInquiry.customer.company,
      priority: newInquiry.priority,
      channel: newInquiry.channel,
      categoryId: newInquiry.category?.id,
      assignedToId: newInquiry.assignedTo?.id,
    });

    if (res && res.success === false) {
      if (
        res.status === 409 ||
        res.error === "DuplicateInquiry" ||
        res.error === "Conflict"
      ) {
        toastWarning(
          "Duplicate Inquiry Detected",
          res.message ||
            `An inquiry with subject '${newInquiry.subject}' was already received from ${newInquiry.customer.email} in the last 5 minutes.`
        );
      } else {
        toastError(
          "Inquiry Not Saved",
          res.message ||
            `Please check all required fields for ${newInquiry.customer.name} and try again.`
        );
      }
      return res;
    }

    const createdRecord = (res && res.data) ? res.data : newInquiry;
    const updated = [createdRecord, ...inquiries.filter((i) => i.id !== createdRecord.id)];
    saveInquiries(updated);
    setSelectedInquiry(createdRecord);
    toastSuccess(
      "Inquiry Created",
      `Ticket #${createdRecord.ticketNumber} opened for ${createdRecord.customer.name}.`
    );
    return { success: true, data: createdRecord };
  };

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
      if (activeTab === "ASSIGNED_TO_ME" && inq.assignedTo?.id !== currentUser?.id)
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
    currentUser?.id,
  ]);

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

  const hasActiveFilters =
    searchQuery !== "" ||
    activeTab !== "ALL" ||
    selectedPriority !== "ALL" ||
    selectedCategory !== "ALL" ||
    selectedChannel !== "ALL";

  const clearAllFilters = () => {
    setSearchQuery("");
    setActiveTab("ALL");
    setSelectedPriority("ALL");
    setSelectedCategory("ALL");
    setSelectedChannel("ALL");
  };

  // 1. Mandatory Login Gate: While checking session
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/30 animate-pulse">
          <RefreshCw className="w-6 h-6 animate-spin" />
        </div>
        <div className="text-white text-sm font-semibold tracking-wide">
          Authenticating PulseDesk Session...
        </div>
      </div>
    );
  }

  // 1. Mandatory Login Gate: When opening the website every user must first login using their credentials
  if (!isAuthenticated || !currentUser) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Left Navigation Sidebar */}
      <Sidebar
        currentUser={currentUser}
        canCreateInquiry={canCreateInquiry}
        unassignedCount={metrics.unassigned}
        totalCount={metrics.total}
        activeFilterTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        onOpenNewModal={() => setIsNewModalOpen(true)}
        onOpenStaffModal={() => setIsStaffModalOpen(true)}
        onLogout={logout}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Scoped Access Notice if Staff has restricted access */}
        {!canViewAll && !isAdmin && (
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-3">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Assigned View:</strong> You are viewing inquiries assigned directly to you and unassigned tickets waiting for an owner.
            </span>
          </div>
        )}

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
          </div>
          {/* Subtle background glow */}
          <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* Real-Time Stats Overview Ribbon */}
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
            subtext={metrics.unassigned > 0 ? "⚠️ Needs attention" : "All assigned"}
            icon={UserX}
            variant={metrics.unassigned > 0 ? "danger" : "default"}
            isActive={activeTab === "UNASSIGNED"}
            onClick={() => setActiveTab("UNASSIGNED")}
          />
          <StatCard
            label="In Progress"
            value={metrics.inProgress}
            subtext="Under active review"
            icon={Clock}
            variant="info"
            isActive={activeTab === "IN_PROGRESS"}
            onClick={() => setActiveTab("IN_PROGRESS")}
          />
          <StatCard
            label="Resolved"
            value={metrics.resolved}
            subtext="Completed tickets"
            icon={CheckCircle2}
            variant="success"
            isActive={activeTab === "RESOLVED"}
            onClick={() => setActiveTab("RESOLVED")}
          />
          <StatCard
            label="Urgent Priority"
            value={metrics.urgent}
            subtext={metrics.urgent > 0 ? "🔥 Requires attention" : "No urgent issues"}
            icon={AlertTriangle}
            variant={metrics.urgent > 0 ? "danger" : "default"}
            isActive={selectedPriority === "URGENT"}
            onClick={() =>
              setSelectedPriority(selectedPriority === "URGENT" ? "ALL" : "URGENT")
            }
          />
        </section>

        {/* Core Workspace: Filters, Search & Triage List */}
        <section aria-label="Customer Inquiry Queue" className="space-y-4">
          {/* Filtering Ribbon */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            {/* Quick Status Tabs */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab("ALL")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
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
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === "UNASSIGNED"
                    ? "bg-red-50 text-red-700 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Needs Owner ({metrics.unassigned})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("ASSIGNED_TO_ME")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === "ASSIGNED_TO_ME"
                    ? "bg-white text-blue-700 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Assigned to Me
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("IN_PROGRESS")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
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
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
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
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold p-1 cursor-pointer"
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

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-rose-600 hover:text-rose-700 font-semibold ml-auto text-xs cursor-pointer flex items-center gap-1"
              >
                <span>Clear all filters</span>
              </button>
            )}
          </div>

          {/* Inquiries Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span>
                Showing <strong>{filteredInquiries.length}</strong> inquiries
                {hasActiveFilters && " (Filtered)"}
              </span>
              <span className="text-[11px] text-slate-400">
                Click any inquiry to view conversation, private staff notes, and audit timeline
              </span>
            </div>

            {/* Usability Loading Skeletons */}
            {isLoading ? (
              <div className="grid grid-cols-1 gap-3.5">
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs animate-pulse space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="h-5 w-24 bg-slate-200 rounded-md" />
                      <div className="h-5 w-20 bg-slate-200 rounded-full" />
                    </div>
                    <div className="h-4 w-3/4 bg-slate-200 rounded" />
                    <div className="h-3 w-1/2 bg-slate-100 rounded" />
                    <div className="flex items-center gap-4 pt-2 border-t border-slate-100">
                      <div className="h-4 w-28 bg-slate-100 rounded" />
                      <div className="h-4 w-28 bg-slate-100 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredInquiries.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-dashed border-slate-300 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <Inbox className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-800">
                  {hasActiveFilters
                    ? "No inquiries found matching your filters"
                    : "No customer inquiries yet"}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm">
                  {hasActiveFilters
                    ? "No inquiries match the current search or tab criteria. Reset your filters to see all tickets."
                    : "Get started by recording your first customer inquiry received via phone, email, or chat."}
                </p>
                <div className="flex items-center gap-3 pt-1">
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                      Clear Filters
                    </button>
                  )}
                  {canCreateInquiry && (
                    <button
                      type="button"
                      onClick={() => setIsNewModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-2xs cursor-pointer"
                    >
                      <PlusCircle className="w-4 h-4" />
                      Log New Inquiry
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3.5">
                {filteredInquiries.map((inquiry) => (
                  <InquiryCard
                    key={inquiry.id}
                    inquiry={inquiry}
                    currentUser={currentUser}
                    canAssign={canAssign}
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
      </div>

      {/* Detail & Handover Drawer Modal */}
      {selectedInquiry && (
        <InquiryDetailModal
          inquiry={selectedInquiry}
          staffUsers={staffList}
          currentUser={currentUser}
          canUpdateStatus={canUpdateStatus}
          canUpdatePriority={canUpdatePriority}
          canAssign={canAssign}
          canAddNotes={canAddNotes}
          canClose={canClose}
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
          staffUsers={staffList}
          currentUser={currentUser}
          onClose={() => setIsNewModalOpen(false)}
          onCreate={handleCreateInquiry}
        />
      )}

      {/* Admin Staff Account & Access Management Modal */}
      {isStaffModalOpen && isAdmin && (
        <StaffManagementModal
          currentUser={currentUser}
          onClose={() => setIsStaffModalOpen(false)}
          onStaffUpdated={refreshStaff}
          toastSuccess={toastSuccess}
          toastError={toastError}
        />
      )}

      {/* Toast Feedback Notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}

export default function Home() {
  return (
    <AuthProvider>
      <DashboardApp />
    </AuthProvider>
  );
}
