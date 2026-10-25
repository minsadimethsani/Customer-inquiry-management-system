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
 * Log in to the backend API and store the token
 */
export async function loginStaff(
  email = "admin@example.com",
  password = "Password123!"
): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (data.token) {
      setStoredToken(data.token);
      return data.token;
    }
  } catch {
    // Network or server unreachable
  }
  return null;
}

/**
 * Ensure an authentication token is available
 */
async function ensureToken(userEmail?: string): Promise<string | null> {
  let token = getStoredToken();
  if (token) return token;

  const emailToUse = userEmail || "admin@example.com";
  token = await loginStaff(emailToUse, "Password123!");
  return token;
}

/**
 * Helper to make authenticated requests with token
 */
async function authFetch(
  endpoint: string,
  options: RequestInit = {},
  userEmail?: string
): Promise<Response> {
  const token = await ensureToken(userEmail);

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
        message: json.message || "Failed to create inquiry.",
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
      message: "Inquiry created successfully.",
      data: inquiry,
    };
  } catch (err: any) {
    return {
      success: false,
      error: "NetworkError",
      message: err.message || "Could not reach server. Saved locally in offline cache.",
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
        message: json.message || "Failed to update inquiry status.",
      };
    }

    return {
      success: true,
      status: 200,
      message: `Status updated to ${newStatus}.`,
      data: json.data || json,
    };
  } catch (err: any) {
    return {
      success: false,
      error: "NetworkError",
      message: err.message || "Could not reach server. Status updated in local cache.",
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
        message: json.message || "Failed to update priority.",
      };
    }

    return {
      success: true,
      status: 200,
      message: `Priority updated to ${newPriority}.`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: "NetworkError",
      message: err.message || "Could not reach server.",
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
        message: json.message || "Failed to reassign inquiry.",
      };
    }

    return {
      success: true,
      status: 200,
      message: "Assignment updated successfully.",
    };
  } catch (err: any) {
    return {
      success: false,
      error: "NetworkError",
      message: err.message || "Could not reach server.",
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
        message: json.message || "Failed to add message.",
      };
    }

    return {
      success: true,
      status: 201,
      message: isInternalNote ? "Internal note logged." : "Customer message dispatched.",
      data: json.data || json,
    };
  } catch (err: any) {
    return {
      success: false,
      error: "NetworkError",
      message: err.message || "Could not reach server.",
    };
  }
}
