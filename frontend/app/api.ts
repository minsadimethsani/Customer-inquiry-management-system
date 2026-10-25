import { Inquiry, InquiryStatus, Priority, User, Category } from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const TOKEN_KEY = "pulsedesk_jwt_token";

/**
 * Get the current JWT token from localStorage
 */
export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Store the JWT token
 */
export function setStoredToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

/**
 * Remove the stored JWT token on logout
 */
export function removeStoredToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("pulsedesk_current_user_v1");
  }
}

/**
 * Log in to the backend API with provided credentials
 */
export async function loginUserApi(
  email: string,
  password: string
): Promise<{ success: boolean; token?: string; user?: User; message?: string }> {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        success: false,
        message:
          data.message ||
          "Authentication failed: The email or password entered does not match our records.",
      };
    }

    if (data.token) {
      setStoredToken(data.token);
      if (typeof window !== "undefined" && data.user) {
        localStorage.setItem("pulsedesk_current_user_v1", JSON.stringify(data.user));
      }
      return {
        success: true,
        token: data.token,
        user: data.user,
        message:
          data.message ||
          `Welcome, ${data.user?.name || "Staff Member"}! Authentication verified successfully.`,
      };
    }

    return {
      success: false,
      message: "Sign-in could not be completed. Please try again.",
    };
  } catch (err: any) {
    return {
      success: false,
      message:
        "Unable to connect to PulseDesk. Please check your internet connection or try again shortly.",
    };
  }
}

/**
 * Fetch profile of currently authenticated user from /api/auth/me
 */
export async function fetchCurrentUserApi(): Promise<User | null> {
  try {
    const token = getStoredToken();
    if (!token) return null;

    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.user || null;
  } catch {
    return null;
  }
}

/**
 * Helper to make authenticated requests with Bearer token
 */
async function authFetch(
  endpoint: string,
  options: RequestInit = {},
  _userEmail?: string
): Promise<Response> {
  const token = getStoredToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });
}

/**
 * Fetch all inquiries with optional status, priority, and search filtering
 */
export async function fetchInquiriesFromApi(filters?: {
  status?: string;
  priority?: string;
  search?: string;
}): Promise<Inquiry[] | null> {
  try {
    const query = new URLSearchParams();
    if (filters?.status && filters.status !== "ALL") {
      query.append("status", filters.status);
    }
    if (filters?.priority && filters.priority !== "ALL") {
      query.append("priority", filters.priority);
    }
    if (filters?.search && filters.search.trim()) {
      query.append("search", filters.search.trim());
    }
    query.append("limit", "100");

    const res = await authFetch(`/inquiries?${query.toString()}`);
    if (!res.ok) return null;

    const json = await res.json();
    const data: any[] = json.data || json;

    return data.map((item) => ({
      id: item.id,
      ticketNumber: item.ticketNumber,
      subject: item.subject,
      description: item.description,
      status: item.status as InquiryStatus,
      priority: item.priority as Priority,
      channel: item.channel,
      category: item.category || {
        id: "cat-default",
        name: "General Inquiries",
        color: "#3B82F6",
      },
      customer: {
        name: item.customerName || "Customer",
        email: item.customerEmail || "",
        phone: item.customerPhone || undefined,
        company: item.customerCompany || undefined,
      },
      createdBy: item.createdBy || null,
      assignedTo: item.assignedTo || null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      lastActivity: {
        text: `Status: ${item.status}`,
        actorName: item.assignedTo?.name || item.createdBy?.name || "Staff",
        timestamp: item.updatedAt || item.createdAt,
      },
      messages: item.messages || [],
      activityLogs: item.activityLogs || [],
    }));
  } catch {
    return null;
  }
}

export interface ApiMutationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  details?: Record<string, string>;
  status?: number;
}

/**
 * Create a new inquiry in PostgreSQL via Node.js API
 */
export async function createInquiryApi(
  payload: {
    subject: string;
    description: string;
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    customerCompany?: string;
    priority?: Priority;
    channel?: string;
    categoryId?: string;
    assignedToId?: string;
    initialMessage?: string;
  },
  currentUserEmail?: string
): Promise<ApiMutationResult<Inquiry>> {
  try {
    const res = await authFetch(
      "/inquiries",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      currentUserEmail
    );

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        success: false,
        status: res.status,
        error: json.error || "SaveError",
        message:
          json.message ||
          `Unable to register inquiry for customer '${payload.customerName}'. Please review required fields.`,
        details: json.details,
      };
    }

    const item = json.data || json;
    const inquiry: Inquiry = {
      id: item.id,
      ticketNumber: item.ticketNumber,
      subject: item.subject,
      description: item.description,
      status: item.status as InquiryStatus,
      priority: item.priority as Priority,
      channel: item.channel,
      category: item.category || {
        id: "cat-1",
        name: "General",
        color: "#3B82F6",
      },
      customer: {
        name: item.customerName,
        email: item.customerEmail,
        phone: item.customerPhone,
        company: item.customerCompany,
      },
      createdBy: item.createdBy,
      assignedTo: item.assignedTo,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      lastActivity: {
        text: "Inquiry opened",
        actorName: item.createdBy?.name || "Staff",
        timestamp: item.createdAt,
      },
      messages: item.messages || [],
      activityLogs: item.activityLogs || [],
    };

    return {
      success: true,
      status: 201,
      message:
        json.message ||
        `Inquiry ticket #${inquiry.ticketNumber} created successfully for ${inquiry.customer.name}.`,
      data: inquiry,
    };
  } catch (err: any) {
    return {
      success: false,
      error: "NetworkError",
      message: "Could not submit inquiry. Please check your internet connection.",
    };
  }
}

/**
 * Update an inquiry's status (OPEN, IN_PROGRESS, RESOLVED, CLOSED) in PostgreSQL via Node.js API
 */
export async function updateInquiryStatusApi(
  inquiryId: string,
  newStatus: InquiryStatus,
  currentUserEmail?: string
): Promise<ApiMutationResult> {
  try {
    const res = await authFetch(
      `/inquiries/${inquiryId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      },
      currentUserEmail
    );

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        status: res.status,
        error: json.error || "UpdateError",
        message:
          json.message ||
          `Could not update inquiry status to '${newStatus}'. Please try again.`,
      };
    }

    return {
      success: true,
      status: 200,
      message:
        json.message ||
        `Inquiry status updated to ${newStatus}.`,
      data: json.data || json,
    };
  } catch (err: any) {
    return {
      success: false,
      error: "NetworkError",
      message: "Could not update inquiry status. Please check your connection.",
    };
  }
}

/**
 * Update an inquiry's priority in PostgreSQL via Node.js API
 */
export async function updateInquiryPriorityApi(
  inquiryId: string,
  newPriority: Priority,
  currentUserEmail?: string
): Promise<ApiMutationResult> {
  try {
    const res = await authFetch(
      `/inquiries/${inquiryId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ priority: newPriority }),
      },
      currentUserEmail
    );

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        status: res.status,
        error: json.error || "UpdateError",
        message:
          json.message ||
          `Could not update inquiry priority to '${newPriority}'. Please try again.`,
      };
    }

    return {
      success: true,
      status: 200,
      message:
        json.message ||
        `Inquiry priority updated to ${newPriority}.`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: "NetworkError",
      message: "Could not update priority. Please check your connection.",
    };
  }
}

/**
 * Assign an inquiry to a staff member in PostgreSQL via Node.js API
 */
export async function assignInquiryApi(
  inquiryId: string,
  assignedToId: string | null,
  currentUserEmail?: string
): Promise<ApiMutationResult> {
  try {
    const res = await authFetch(
      `/inquiries/${inquiryId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ assignedToId }),
      },
      currentUserEmail
    );

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        status: res.status,
        error: json.error || "UpdateError",
        message:
          json.message ||
          (assignedToId
            ? "Could not assign inquiry to selected team member. Please try again."
            : "Could not unassign inquiry. Please try again."),
      };
    }

    return {
      success: true,
      status: 200,
      message:
        json.message ||
        (assignedToId
          ? "Inquiry assignment updated successfully."
          : "Inquiry returned to waiting queue."),
    };
  } catch (err: any) {
    return {
      success: false,
      error: "NetworkError",
      message: "Could not update assignment. Please check your connection.",
    };
  }
}

/**
 * Add a message or internal note to an inquiry in PostgreSQL via Node.js API
 */
export async function addInquiryMessageApi(
  inquiryId: string,
  body: string,
  isInternalNote: boolean,
  currentUserEmail?: string
): Promise<ApiMutationResult> {
  try {
    const res = await authFetch(
      `/inquiries/${inquiryId}/messages`,
      {
        method: "POST",
        body: JSON.stringify({ body, isInternalNote }),
      },
      currentUserEmail
    );

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        status: res.status,
        error: json.error || "MessageError",
        message:
          json.message ||
          (isInternalNote
            ? "Could not save internal note. Please try again."
            : "Could not send reply to customer. Please try again."),
      };
    }

    return {
      success: true,
      status: 201,
      message:
        json.message ||
        (isInternalNote
          ? "Internal staff note saved."
          : "Customer message sent successfully."),
      data: json.data || json,
    };
  } catch (err: any) {
    return {
      success: false,
      error: "NetworkError",
      message:
        isInternalNote
          ? "Could not save note. Please check your connection."
          : "Could not send message. Please check your connection.",
    };
  }
}

/**
 * Fetch staff accounts (Admin gets all staff with permissions; Agent gets active staff)
 */
export async function fetchStaffApi(): Promise<User[]> {
  try {
    const res = await authFetch("/staff");
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch {
    return [];
  }
}

/**
 * Create a new staff account with specific access permissions (ADMIN only)
 */
export async function createStaffApi(payload: {
  name: string;
  email: string;
  password: string;
  role?: string;
  department?: string;
  permissions?: string[];
}): Promise<ApiMutationResult<User>> {
  try {
    const res = await authFetch("/staff", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        success: false,
        status: res.status,
        error: json.error || "CreateStaffError",
        message:
          json.message ||
          `Could not create staff account for '${payload.name}'. Please check the details.`,
        details: json.details,
      };
    }

    return {
      success: true,
      status: 201,
      message:
        json.message ||
        `Staff account for '${payload.name}' created successfully.`,
      data: json.data,
    };
  } catch (err: any) {
    return {
      success: false,
      error: "NetworkError",
      message: "Could not create staff account. Please check your connection.",
    };
  }
}

/**
 * Update staff account details, active status, or permissions (ADMIN only)
 */
export async function updateStaffApi(
  staffId: string,
  payload: {
    name?: string;
    department?: string;
    role?: string;
    isActive?: boolean;
    permissions?: string[];
  }
): Promise<ApiMutationResult<User>> {
  try {
    const res = await authFetch(`/staff/${staffId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        success: false,
        status: res.status,
        error: json.error || "UpdateStaffError",
        message:
          json.message ||
          "Could not update staff account. Please try again.",
      };
    }

    return {
      success: true,
      status: 200,
      message:
        json.message ||
        "Staff account updated successfully.",
      data: json.data,
    };
  } catch (err: any) {
    return {
      success: false,
      error: "NetworkError",
      message: "Could not update staff account. Please check your connection.",
    };
  }
}
