"use client";

import React, { useState, useEffect } from "react";
import { User, SYSTEM_PERMISSIONS, PermissionDefinition } from "../types";
import { fetchStaffApi, createStaffApi, updateStaffApi } from "../api";
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  Check,
  X,
  Search,
  Lock,
  Mail,
  User as UserIcon,
  Building,
  CheckCircle2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Filter,
  Sparkles,
} from "lucide-react";

interface StaffManagementModalProps {
  currentUser: User;
  onClose: () => void;
  onStaffUpdated?: () => void;
  toastSuccess: (title: string, message: string) => void;
  toastError: (title: string, message: string) => void;
}

const COMMON_DEPARTMENTS = [
  "Customer Success & Triage",
  "Technical & Field Services",
  "Billing & Invoicing Team",
  "Operations Lead & Dispatch",
  "Executive Management",
];

const PRESETS = [
  {
    name: "Full Access",
    permissions: SYSTEM_PERMISSIONS.map((p) => p.id),
  },
  {
    name: "Standard Agent",
    permissions: [
      "inquiries:create",
      "inquiries:update_status",
      "inquiries:assign",
      "inquiries:update_priority",
      "inquiries:add_notes",
      "inquiries:close",
      "inquiries:view_all",
    ],
  },
  {
    name: "Triage & Intake",
    permissions: ["inquiries:create", "inquiries:assign", "inquiries:view_all"],
  },
  {
    name: "Read & Respond",
    permissions: ["inquiries:add_notes", "inquiries:view_all"],
  },
];

export function StaffManagementModal({
  currentUser,
  onClose,
  onStaffUpdated,
  toastSuccess,
  toastError,
}: StaffManagementModalProps) {
  const [activeTab, setActiveTab] = useState<"directory" | "create">("directory");
  const [staffList, setStaffList] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Create Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"AGENT" | "ADMIN">("AGENT");
  const [department, setDepartment] = useState(COMMON_DEPARTMENTS[0]);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([
    "inquiries:create",
    "inquiries:update_status",
    "inquiries:assign",
    "inquiries:update_priority",
    "inquiries:add_notes",
    "inquiries:close",
    "inquiries:view_all",
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Load staff list
  const loadStaff = async () => {
    setIsLoading(true);
    try {
      const data = await fetchStaffApi();
      setStaffList(data);
    } catch {
      toastError(
        "Unable to Load Staff",
        "Could not load team members. Please check your internet connection."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const handleTogglePermission = (permId: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  };

  const handleApplyPreset = (presetPerms: string[]) => {
    setSelectedPermissions(presetPerms);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError("Please enter the staff member's full name.");
      return;
    }
    if (!email.trim()) {
      setFormError("Please enter a valid work email address.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setFormError("Please enter a valid email format (e.g. name@company.com).");
      return;
    }
    if (!password || password.length < 6) {
      setFormError("Password must be at least 6 characters long.");
      return;
    }
    if (role === "AGENT" && selectedPermissions.length === 0) {
      setFormError("Please select at least one permission feature for this account.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createStaffApi({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
        department,
        permissions: role === "ADMIN" ? SYSTEM_PERMISSIONS.map((p) => p.id) : selectedPermissions,
      });

      if (!res.success) {
        setFormError(
          res.message ||
            `Could not create account for ${name}. Please check that the email is not already registered.`
        );
        return;
      }

      toastSuccess(
        role === "ADMIN" ? "Administrator Account Created" : "Staff Account Created",
        role === "ADMIN"
          ? `Full administrator access granted to ${name} (${email}).`
          : `Staff account created for ${name} with ${selectedPermissions.length} access feature(s) enabled.`
      );

      // Reset form
      setName("");
      setEmail("");
      setPassword("");
      setRole("AGENT");
      setDepartment(COMMON_DEPARTMENTS[0]);
      setSelectedPermissions(PRESETS[1].permissions);

      // Refresh staff list and switch to directory tab
      await loadStaff();
      if (onStaffUpdated) onStaffUpdated();
      setActiveTab("directory");
    } catch (err: any) {
      setFormError(
        "Could not create staff account. Please check your connection and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (staffMember: User) => {
    if (staffMember.id === currentUser.id) {
      toastError(
        "Action Not Allowed",
        "You cannot deactivate your own account while logged in."
      );
      return;
    }

    const nextState = !(staffMember.isActive !== false);
    const actionText = nextState ? "activate" : "deactivate";

    if (
      !confirm(
        `Are you sure you want to ${actionText} the account of ${staffMember.name}? ${
          nextState
            ? "They will be able to log in immediately."
            : "Their access will be paused immediately."
        }`
      )
    ) {
      return;
    }

    const res = await updateStaffApi(staffMember.id, { isActive: nextState });
    if (!res.success) {
      toastError(
        nextState ? "Activation Failed" : "Deactivation Failed",
        res.message ||
          (nextState
            ? `Could not activate ${staffMember.name}'s account.`
            : `Could not deactivate ${staffMember.name}'s account.`)
      );
      return;
    }

    toastSuccess(
      nextState ? "Account Activated" : "Account Deactivated",
      nextState
        ? `Account for ${staffMember.name} is now active and ready for login.`
        : `Account for ${staffMember.name} has been paused.`
    );

    await loadStaff();
    if (onStaffUpdated) onStaffUpdated();
  };

  const filteredStaff = staffList.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      (s.department && s.department.toLowerCase().includes(q)) ||
      s.role.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">Staff Accounts & Access Management</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold uppercase border border-blue-400/20">
                  Admin Control Panel
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Create new staff credentials and grant specific access permissions for inquiries and operations.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("directory")}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "directory"
                  ? "bg-white text-blue-700 shadow-xs border border-slate-200/80"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Staff Directory ({staffList.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("create")}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "create"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>Create Staff Account</span>
            </button>
          </div>

          {activeTab === "directory" && (
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search staff..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "directory" ? (
            /* Tab 1: Staff Directory */
            <div className="space-y-4">
              {isLoading ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-3">
                  <div className="w-8 h-8 border-3 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                  <p className="text-xs text-slate-500 font-medium">Loading staff accounts...</p>
                </div>
              ) : filteredStaff.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  No staff members match the search query.
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredStaff.map((staff) => {
                    const isSelf = staff.id === currentUser.id;
                    const isActive = staff.isActive !== false;
                    const perms = staff.permissions || [];

                    return (
                      <div
                        key={staff.id}
                        className={`p-4 rounded-2xl border transition-all ${
                          isActive
                            ? "bg-white border-slate-200 hover:border-blue-200 shadow-2xs"
                            : "bg-slate-50 border-slate-200/60 opacity-60"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          {/* Staff Identity */}
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 text-white font-bold text-sm flex items-center justify-center shadow-xs">
                              {staff.name
                                .split(" ")
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join("")
                                .toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-slate-900">
                                  {staff.name}
                                </span>
                                {isSelf && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                                    You
                                  </span>
                                )}
                                <span
                                  className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                                    staff.role === "ADMIN"
                                      ? "bg-purple-100 text-purple-700 border border-purple-200"
                                      : "bg-blue-100 text-blue-700 border border-blue-200"
                                  }`}
                                >
                                  {staff.role}
                                </span>
                                {!isActive && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                                    Deactivated
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {staff.email} • {staff.department || "General Operations"}
                              </p>
                            </div>
                          </div>

                          {/* Account Status Toggle */}
                          <div className="flex items-center gap-2 self-start sm:self-center">
                            <button
                              type="button"
                              onClick={() => handleToggleActive(staff)}
                              disabled={isSelf}
                              title={
                                isSelf
                                  ? "Cannot deactivate your own account"
                                  : isActive
                                  ? "Deactivate Account"
                                  : "Activate Account"
                              }
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                isSelf
                                  ? "opacity-40 cursor-not-allowed bg-slate-100 text-slate-400"
                                  : isActive
                                  ? "bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700"
                                  : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
                              }`}
                            >
                              {isActive ? (
                                <>
                                  <ToggleRight className="w-4 h-4 text-emerald-600" />
                                  <span>Active</span>
                                </>
                              ) : (
                                <>
                                  <ToggleLeft className="w-4 h-4 text-slate-400" />
                                  <span>Deactivated</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Granted Permissions Chips */}
                        <div className="mt-3 pt-3 border-t border-slate-100">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Granted Access Permissions:</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {staff.role === "ADMIN" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                                <Sparkles className="w-3 h-3 text-purple-600" />
                                Universal Administrator Access (All Permissions Granted)
                              </span>
                            ) : perms.length === 0 ? (
                              <span className="text-xs text-slate-400 italic">
                                No permissions assigned. Account is read-only.
                              </span>
                            ) : (
                              SYSTEM_PERMISSIONS.filter((p) => perms.includes(p.id)).map((p) => (
                                <span
                                  key={p.id}
                                  title={p.description}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200"
                                >
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  {p.label}
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Tab 2: Create Staff Account Form */
            <form onSubmit={handleCreateSubmit} className="space-y-6 max-w-2xl mx-auto">
              {formError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Core Account Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Staff Full Name *
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Alex Morgan"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Work Email *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      placeholder="e.g. alex.m@services.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Initial Password *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="Min 6 chars (e.g. Password123!)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Role *
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as "AGENT" | "ADMIN")}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="AGENT">Staff / Agent (Custom Permissions)</option>
                    <option value="ADMIN">System Administrator (Full Permissions)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Department / Team
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    list="department-suggestions"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Select or enter department"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                  <datalist id="department-suggestions">
                    {COMMON_DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Specific Access Permissions Section */}
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-blue-600" />
                      Specific Access Permissions
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Configure granular action privileges for this staff member.
                    </p>
                  </div>

                  {/* Preset Buttons */}
                  {role === "AGENT" && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-slate-400 font-bold uppercase mr-1">
                        Presets:
                      </span>
                      {PRESETS.map((preset) => (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => handleApplyPreset(preset.permissions)}
                          className="px-2 py-1 rounded-md text-[10px] font-semibold bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 transition-colors cursor-pointer border border-slate-200"
                        >
                          {preset.name}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setSelectedPermissions([])}
                        className="px-2 py-1 rounded-md text-[10px] font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                {role === "ADMIN" ? (
                  <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-xs">
                    <div className="font-bold flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      Administrator Full Access
                    </div>
                    <p className="text-[11px] text-purple-700 mt-1">
                      Administrator accounts inherently possess all operational, intake, triage, modification, and user management privileges.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {SYSTEM_PERMISSIONS.filter((p) => p.id !== "staff:manage").map((perm) => {
                      const isChecked = selectedPermissions.includes(perm.id);
                      return (
                        <label
                          key={perm.id}
                          className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                            isChecked
                              ? "bg-blue-50/50 border-blue-300 shadow-2xs"
                              : "bg-white border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleTogglePermission(perm.id)}
                            className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                          <div>
                            <div className="text-xs font-bold text-slate-900">
                              {perm.label}
                            </div>
                            <div className="text-[11px] text-slate-500 leading-tight mt-0.5">
                              {perm.description}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Form Submission */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab("directory")}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/30 transition-all cursor-pointer disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Create Staff Account</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
