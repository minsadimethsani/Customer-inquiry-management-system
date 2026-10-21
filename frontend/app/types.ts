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
}

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
