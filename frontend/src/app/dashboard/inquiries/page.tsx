"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Inquiry,
  InquiryStatus,
  Priority,
  User,
} from "@/app/types";
import { INITIAL_INQUIRIES, STAFF_USERS } from "@/app/mockData";
import {
  getStatusBadge,
  getPriorityBadge,
  formatDateTime,
  formatRelativeTime,
  canTransitionStatus,
  getAllowedTransitions,
} from "@/app/utils";
import { InquiryDetailModal } from "@/app/components/InquiryDetailModal";
import { useToast, ToastContainer } from "@/app/components/Toast";
import {
  fetchInquiriesFromApi,
  updateInquiryStatusApi,
  updateInquiryPriorityApi,
  assignInquiryApi,
  addInquiryMessageApi,
} from "@/app/api";
import {
  Search,
  Filter,
  ArrowUpDown,
  LifeBuoy,
  ChevronRight,
  RefreshCw,
  ExternalLink,
  SlidersHorizontal,
  X,
  AlertCircle,
  Inbox,
  User as UserIcon,
  ShieldCheck,
  Building2,
  Clock,
  ArrowLeft,
} from "lucide-react";

const STORAGE_KEY = "pulsedesk_inquiries_v1";
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export default function InquiriesDashboardPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState<"api" | "local">("local");

  // Filtering states
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modal inspection
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [currentUser] = useState<User>(STAFF_USERS[0]);

  // Usability Toast Notifications
  const {
    toasts,
    removeToast,
    toastSuccess,
    toastError,
    toastWarning,
    toastInfo,
  } = useToast();

  // Fetch inquiries from Backend API with local fallback
  const loadInquiries = async () => {
    setLoading(true);

    // Try fetching from backend API
    try {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("pulsedesk_jwt_token") ||
            localStorage.getItem("token")
          : null;

      const queryParams = new URLSearchParams();
      if (statusFilter && statusFilter !== "ALL") {
        queryParams.append("status", statusFilter);
      }
      if (priorityFilter && priorityFilter !== "ALL") {
        queryParams.append("priority", priorityFilter);
      }
      if (searchQuery.trim()) {
        queryParams.append("search", searchQuery.trim());
      }
      queryParams.append("limit", "100");

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_BASE_URL}/inquiries?${queryParams.toString()}`, {
        headers,
      });

      if (res.ok) {
        const json = await res.json();
        const data: any[] = json.data || json;
        const normalized: Inquiry[] = data.map((item) => ({
          ...item,
          customer: item.customer || {
            name: item.customerName || "Customer",
            email: item.customerEmail || "",
            phone: item.customerPhone || "",
            company: item.customerCompany || "",
          },
          lastActivity: item.lastActivity || {
            text: `Inquiry recorded in system`,
            actorName: item.createdBy?.name || "Staff",
            timestamp: item.updatedAt || item.createdAt,
          },
          messages: item.messages || [],
          activityLogs: item.activityLogs || [],
        }));

        setInquiries(normalized);
        setDataSource("api");
        setLoading(false);
        return;
      }
    } catch {
      // Backend unreachable or offline — gracefully fall back to local storage
    }

    // Local fallback: load from localStorage or mock data
    try {
      const saved =
        typeof window !== "undefined"
          ? localStorage.getItem(STORAGE_KEY)
          : null;
      if (saved) {
        setInquiries(JSON.parse(saved));
      } else {
        setInquiries(INITIAL_INQUIRIES);
      }
    } catch {
      setInquiries(INITIAL_INQUIRIES);
    }
    setDataSource("local");
    setLoading(false);
  };

  useEffect(() => {
    loadInquiries();
  }, [statusFilter, priorityFilter]);

  // Client-side filtering (acts instantly on search and local data)
  const filteredInquiries = useMemo(() => {
    return inquiries.filter((inq) => {
      // Status filter
      if (statusFilter !== "ALL" && inq.status !== statusFilter) {
        return false;
      }
      // Priority filter
      if (priorityFilter !== "ALL" && inq.priority !== priorityFilter) {
        return false;
      }
      // Search query filter (matches title, ticketNumber, customer name, email, company)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchSubject = inq.subject?.toLowerCase().includes(query);
        const matchTicket = inq.ticketNumber?.toLowerCase().includes(query);
        const matchCustomerName = inq.customer?.name
          ?.toLowerCase()
          .includes(query);
        const matchCustomerEmail = inq.customer?.email
          ?.toLowerCase()
          .includes(query);
        const matchCompany = inq.customer?.company
          ?.toLowerCase()
          .includes(query);

        if (
          !matchSubject &&
          !matchTicket &&
          !matchCustomerName &&
          !matchCustomerEmail &&
          !matchCompany
        ) {
          return false;
        }
      }
      return true;
    });
  }, [inquiries, statusFilter, priorityFilter, searchQuery]);

  // Clear all filters
  const resetFilters = () => {
    setStatusFilter("ALL");
    setPriorityFilter("ALL");
    setSearchQuery("");
  };

  const hasActiveFilters =
    statusFilter !== "ALL" || priorityFilter !== "ALL" || searchQuery.trim() !== "";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 hover:opacity-90 transition-opacity"
              title="Return to PulseDesk Main Hub"
            >
              <LifeBuoy className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold tracking-tight text-slate-900">
                  PulseDesk
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                  Staff Directory
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Inquiry Management & Real-Time Status Tracking
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Hub</span>
            </Link>

            <button
              onClick={loadInquiries}
              title="Refresh Inquiries"
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 cursor-pointer"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin text-blue-600" : ""}`}
              />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
        {/* Page Title & Status Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1">
              <span>Dashboard</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-blue-600 font-semibold">Inquiries Directory</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Customer Inquiries
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Review existing inquiries, monitor response status, and filter tickets.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white border border-slate-200 shadow-2xs">
              <span className="text-slate-500">Total Inquiries:</span>
              <span className="font-bold text-slate-900">{inquiries.length}</span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-800">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                {dataSource === "api" ? "Live API Connected" : "Local Data Store"}
              </span>
            </div>
          </div>
        </div>

        {/* Real-Time Filter & Search Toolbar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs mb-6">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, ticket number, customer name, email..."
                className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="flex items-center flex-wrap gap-2.5">
              {/* Status Filter Dropdown */}
              <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs font-semibold text-slate-600">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-800 border-none focus:outline-hidden cursor-pointer"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="OPEN">Open / Unresolved</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="PENDING_CUSTOMER">Waiting on Customer</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>

              {/* Priority Filter Dropdown */}
              <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs font-semibold text-slate-600">Priority:</span>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-800 border-none focus:outline-hidden cursor-pointer"
                >
                  <option value="ALL">All Priorities</option>
                  <option value="URGENT">Urgent</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>

              {/* Reset Filters */}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Clear Filters</span>
                </button>
              )}
            </div>
          </div>

          {/* Active Filter Summary Bar */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
            <div>
              Showing{" "}
              <span className="font-bold text-slate-800">
                {filteredInquiries.length}
              </span>{" "}
              of <span className="font-bold text-slate-800">{inquiries.length}</span>{" "}
              inquiries
              {hasActiveFilters && " (Filtered)"}
            </div>

            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> Open
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-600" /> In Progress
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-purple-500" /> Pending
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Resolved
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-400" /> Closed
              </span>
            </div>
          </div>
        </div>

        {/* Inquiries Data Table */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-bold text-[11px]">
                  <th scope="col" className="py-3.5 px-4 w-40">
                    Ticket #
                  </th>
                  <th scope="col" className="py-3.5 px-4 min-w-[280px]">
                    Title & Subject
                  </th>
                  <th scope="col" className="py-3.5 px-4 min-w-[200px]">
                    Customer
                  </th>
                  <th scope="col" className="py-3.5 px-4 w-32">
                    Priority
                  </th>
                  <th scope="col" className="py-3.5 px-4 w-44">
                    Status
                  </th>
                  <th scope="col" className="py-3.5 px-4 w-36">
                    Assignee
                  </th>
                  <th scope="col" className="py-3.5 px-4 w-28 text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 5 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td className="py-4 px-4">
                        <div className="h-5 w-20 bg-slate-200 rounded" />
                      </td>
                      <td className="py-4 px-4 space-y-1.5">
                        <div className="h-4 w-48 bg-slate-200 rounded" />
                        <div className="h-3 w-32 bg-slate-100 rounded" />
                      </td>
                      <td className="py-4 px-4 space-y-1.5">
                        <div className="h-4 w-28 bg-slate-200 rounded" />
                        <div className="h-3 w-36 bg-slate-100 rounded" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-6 w-16 bg-slate-100 rounded-lg" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-6 w-24 bg-slate-100 rounded-full" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-5 w-20 bg-slate-100 rounded" />
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="h-7 w-16 bg-slate-100 rounded-lg ml-auto" />
                      </td>
                    </tr>
                  ))
                ) : filteredInquiries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Inbox className="w-8 h-8 text-slate-300" />
                        <span className="text-sm font-bold text-slate-700">
                          {hasActiveFilters
                            ? "No inquiries found matching your filters"
                            : "No inquiries recorded yet"}
                        </span>
                        <p className="text-xs text-slate-400 max-w-sm">
                          {hasActiveFilters
                            ? "Try adjusting your search keywords or resetting status and priority filters."
                            : "Customer inquiries will appear here once submitted."}
                        </p>
                        {hasActiveFilters && (
                          <button
                            onClick={resetFilters}
                            className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                          >
                            Reset all filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredInquiries.map((inquiry) => {
                    const statusBadge = getStatusBadge(inquiry.status);
                    const priorityBadge = getPriorityBadge(inquiry.priority);

                    return (
                      <tr
                        key={inquiry.id}
                        onClick={() => setSelectedInquiry(inquiry)}
                        className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                      >
                        {/* Ticket Number */}
                        <td className="py-3.5 px-4 align-top font-mono">
                          <span className="font-bold text-blue-700 bg-blue-50/80 px-2.5 py-1 rounded-md border border-blue-200/60 inline-block text-[11px]">
                            {inquiry.ticketNumber}
                          </span>
                        </td>

                        {/* Title & Category */}
                        <td className="py-3.5 px-4 align-top">
                          <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors text-xs line-clamp-2">
                            {inquiry.subject}
                          </div>
                          {inquiry.description && (
                            <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                              {inquiry.description}
                            </p>
                          )}
                          {inquiry.category && (
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{
                                  backgroundColor: inquiry.category.color || "#3B82F6",
                                }}
                              />
                              <span className="text-[10px] font-medium text-slate-500">
                                {inquiry.category.name}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Customer */}
                        <td className="py-3.5 px-4 align-top">
                          <div className="font-bold text-slate-800 text-xs">
                            {inquiry.customer?.name || "Anonymous Customer"}
                          </div>
                          {inquiry.customer?.email && (
                            <div className="text-[11px] text-slate-500 truncate max-w-[180px]">
                              {inquiry.customer.email}
                            </div>
                          )}
                          {inquiry.customer?.company && (
                            <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                              <Building2 className="w-3 h-3 shrink-0" />
                              <span className="truncate max-w-[170px]">
                                {inquiry.customer.company}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Priority Badge */}
                        <td className="py-3.5 px-4 align-top">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${priorityBadge.bg}`}
                          >
                            {inquiry.priority === "URGENT" && (
                              <AlertCircle className="w-3 h-3 text-red-600 shrink-0" />
                            )}
                            <span>{priorityBadge.label}</span>
                          </span>
                        </td>

                        {/* Visual Status Badge */}
                        <td className="py-3.5 px-4 align-top">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${statusBadge.bg}`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${statusBadge.dot}`}
                            />
                            <span>{statusBadge.label}</span>
                          </span>
                        </td>

                        {/* Assignee */}
                        <td className="py-3.5 px-4 align-top">
                          {inquiry.assignedTo ? (
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold">
                                {inquiry.assignedTo.name.charAt(0)}
                              </div>
                              <span className="font-medium text-slate-700 truncate max-w-[100px]">
                                {inquiry.assignedTo.name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              Unassigned
                            </span>
                          )}
                        </td>

                        {/* Action View Button */}
                        <td className="py-3.5 px-4 align-top text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedInquiry(inquiry);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
                          >
                            <span>Inspect</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing {filteredInquiries.length} of {inquiries.length} records
            </span>
            <div className="text-[11px] text-slate-400">
              Click any row to inspect complete timeline, customer messages, and internal notes.
            </div>
          </div>
        </div>
      </main>

      {/* Inquiry Detail Modal */}
      {selectedInquiry && (
        <InquiryDetailModal
          inquiry={selectedInquiry}
          currentUser={currentUser}
          staffUsers={STAFF_USERS}
          onClose={() => setSelectedInquiry(null)}
          onAssign={async (inqId: string, staff: User | null) => {
            if (selectedInquiry.status === "CLOSED") {
              toastError("Action Prohibited", "Closed records cannot be reassigned.");
              return { success: false, message: "Inquiry is CLOSED." };
            }

            // Persist to PostgreSQL via Node.js API
            const res = await assignInquiryApi(inqId, staff?.id || null, currentUser.email);
            if (res && res.success === false) {
              toastError("Assignment Failed", res.message || "Server rejected assignment.");
              return res;
            }

            const now = new Date().toISOString();
            setInquiries((prev) =>
              prev.map((i) =>
                i.id === inqId
                  ? {
                      ...i,
                      assignedTo: staff,
                      updatedAt: now,
                      lastActivity: {
                        text: staff
                          ? `Reassigned to ${staff.name}`
                          : "Returned to Unassigned queue",
                        actorName: currentUser.name,
                        timestamp: now,
                      },
                    }
                  : i
              )
            );
            if (selectedInquiry.id === inqId) {
              setSelectedInquiry((prev) =>
                prev ? { ...prev, assignedTo: staff } : null
              );
            }
            toastSuccess(
              "Assigned Successfully",
              staff ? `Assigned to ${staff.name}` : "Unassigned ticket."
            );
            return { success: true };
          }}
          onUpdateStatus={async (inqId: string, newStatus: InquiryStatus) => {
            if (selectedInquiry.status === "CLOSED") {
              const err = "Inquiry is CLOSED. Closed records are final and cannot be modified.";
              toastError("Workflow Violation", err);
              return { success: false, message: err };
            }

            if (!canTransitionStatus(selectedInquiry.status, newStatus)) {
              const allowed = getAllowedTransitions(selectedInquiry.status).join(", ") || "None";
              const err = `Cannot transition status from '${selectedInquiry.status}' to '${newStatus}'. Allowed: ${allowed}`;
              toastError("Workflow Transition Violation", err);
              return { success: false, message: err };
            }

            // Persist to PostgreSQL via Node.js API
            const res = await updateInquiryStatusApi(inqId, newStatus, currentUser.email);
            if (res && res.success === false) {
              toastError("Status Update Failed", res.message || "Server rejected status change.");
              return res;
            }

            const now = new Date().toISOString();
            setInquiries((prev) =>
              prev.map((i) =>
                i.id === inqId
                  ? {
                      ...i,
                      status: newStatus,
                      updatedAt: now,
                      lastActivity: {
                        text: `Status updated to ${newStatus}`,
                        actorName: currentUser.name,
                        timestamp: now,
                      },
                    }
                  : i
              )
            );
            if (selectedInquiry.id === inqId) {
              setSelectedInquiry((prev) =>
                prev ? { ...prev, status: newStatus } : null
              );
            }
            toastSuccess(
              "Status Updated",
              `Ticket #${selectedInquiry.ticketNumber} transitioned to ${newStatus}.`
            );
            return { success: true };
          }}
          onUpdatePriority={async (inqId: string, newPriority: Priority) => {
            if (selectedInquiry.status === "CLOSED") {
              const err = "Inquiry is CLOSED. Closed records cannot be modified.";
              toastError("Workflow Violation", err);
              return { success: false, message: err };
            }

            // Persist to PostgreSQL via Node.js API
            const res = await updateInquiryPriorityApi(inqId, newPriority, currentUser.email);
            if (res && res.success === false) {
              toastError("Priority Update Failed", res.message || "Server rejected priority change.");
              return res;
            }

            const now = new Date().toISOString();
            setInquiries((prev) =>
              prev.map((i) =>
                i.id === inqId
                  ? {
                      ...i,
                      priority: newPriority,
                      updatedAt: now,
                      lastActivity: {
                        text: `Priority updated to ${newPriority}`,
                        actorName: currentUser.name,
                        timestamp: now,
                      },
                    }
                  : i
              )
            );
            if (selectedInquiry.id === inqId) {
              setSelectedInquiry((prev) =>
                prev ? { ...prev, priority: newPriority } : null
              );
            }
            toastSuccess(
              "Priority Updated",
              `Ticket #${selectedInquiry.ticketNumber} set to ${newPriority}.`
            );
            return { success: true };
          }}
          onAddMessage={async (inqId: string, text: string, isInternal: boolean) => {
            if (selectedInquiry.status === "CLOSED") {
              const err = "Inquiry is CLOSED. Discussion is locked.";
              toastError("Action Prohibited", err);
              return { success: false, message: err };
            }

            // Persist to PostgreSQL via Node.js API
            const res = await addInquiryMessageApi(inqId, text, isInternal, currentUser.email);
            if (res && res.success === false) {
              toastError("Message Failed", res.message || "Failed to record message.");
              return res;
            }

            const now = new Date().toISOString();
            const newMsg = {
              id: `msg-${Date.now()}`,
              inquiryId: inqId,
              senderName: currentUser.name,
              sender: currentUser,
              body: text,
              isInternalNote: isInternal,
              createdAt: now,
            };
            setInquiries((prev) =>
              prev.map((i) =>
                i.id === inqId
                  ? {
                      ...i,
                      messages: [...i.messages, newMsg],
                      updatedAt: now,
                      lastActivity: {
                        text: isInternal
                          ? `Internal note logged by ${currentUser.name}`
                          : `Response dispatched by ${currentUser.name}`,
                        actorName: currentUser.name,
                        timestamp: now,
                      },
                    }
                  : i
              )
            );
            toastSuccess(
              isInternal ? "Staff Note Logged" : "Response Sent",
              isInternal ? "Internal note recorded." : "Reply sent to customer."
            );
            return { success: true };
          }}
        />
      )}

      {/* Usability Toast Container */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
