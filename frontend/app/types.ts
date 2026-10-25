export type Role = "ADMIN" | "AGENT";

export type InquiryStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "PENDING_CUSTOMER"
  | "RESOLVED"
  | "CLOSED";

export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type InquiryChannel = "WEB_PORTAL" | "EMAIL" | "CHAT" | "PHONE";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string;
  department?: string;
  permissions?: string[];
  isActive?: boolean;
  createdAt?: string;
}

export interface PermissionDefinition {
  id: string;
  label: string;
  description: string;
  group: "intake" | "workflow" | "communication" | "admin";
}

export const SYSTEM_PERMISSIONS: PermissionDefinition[] = [
  {
    id: "inquiries:create",
    label: "Create Inquiries",
    description: "Record new customer inquiries and support requests",
    group: "intake",
  },
  {
    id: "inquiries:update_status",
    label: "Update Status",
    description: "Move inquiries between Open, In Progress, and Pending",
    group: "workflow",
  },
  {
    id: "inquiries:assign",
    label: "Assign Team Members",
    description: "Assign inquiries to specific team members or leave unassigned",
    group: "workflow",
  },
  {
    id: "inquiries:update_priority",
    label: "Change Priority",
    description: "Adjust priority levels (Low, Medium, High, Urgent)",
    group: "workflow",
  },
  {
    id: "inquiries:add_notes",
    label: "Reply & Add Notes",
    description: "Send messages to customers and add private internal notes",
    group: "communication",
  },
  {
    id: "inquiries:close",
    label: "Resolve & Close",
    description: "Mark inquiries as resolved or completed",
    group: "workflow",
  },
  {
    id: "inquiries:view_all",
    label: "View All Tickets",
    description: "View all customer inquiries across the entire company",
    group: "workflow",
  },
  {
    id: "inquiries:delete",
    label: "Remove Inquiries",
    description: "Permanently delete customer inquiry records",
    group: "admin",
  },
  {
    id: "staff:manage",
    label: "Manage Team Accounts",
    description: "Add team accounts and manage what each person can access",
    group: "admin",
  },
];

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface Message {
  id: string;
  inquiryId: string;
  senderName: string;
  sender?: User | null;
  body: string;
  isInternalNote: boolean;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  inquiryId: string;
  actor: User;
  action:
    | "INQUIRY_CREATED"
    | "ASSIGNED"
    | "STATUS_CHANGED"
    | "PRIORITY_CHANGED"
    | "NOTE_ADDED"
    | "MESSAGE_SENT";
  description: string;
  timestamp: string;
}

export interface Inquiry {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  status: InquiryStatus;
  priority: Priority;
  channel: InquiryChannel;
  category: Category;
  customer: {
    name: string;
    email: string;
    phone?: string;
    company?: string;
  };
  createdBy?: User | null;
  assignedTo?: User | null;
  createdAt: string;
  updatedAt: string;
  lastActivity: {
    text: string;
    actorName: string;
    timestamp: string;
  };
  messages: Message[];
  activityLogs: ActivityLog[];
}
