export function formatRelativeTime(dateString: string): string {
  try {
    if (typeof window === "undefined") return "Recent";
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "Just now";
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
}

export function formatDateTime(dateString: string): string {
  try {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
}

export function getStatusBadge(status: string) {
  switch (status) {
    case "OPEN":
      return {
        label: "Open / Unresolved",
        bg: "bg-amber-50 text-amber-800 border-amber-300",
        dot: "bg-amber-500 animate-pulse",
      };
    case "IN_PROGRESS":
      return {
        label: "In Progress",
        bg: "bg-blue-50 text-blue-800 border-blue-300",
        dot: "bg-blue-600",
      };
    case "PENDING_CUSTOMER":
      return {
        label: "Waiting on Customer",
        bg: "bg-purple-50 text-purple-800 border-purple-300",
        dot: "bg-purple-500",
      };
    case "RESOLVED":
      return {
        label: "Resolved",
        bg: "bg-emerald-50 text-emerald-800 border-emerald-300",
        dot: "bg-emerald-500",
      };
    case "CLOSED":
      return {
        label: "Closed",
        bg: "bg-slate-100 text-slate-700 border-slate-300",
        dot: "bg-slate-400",
      };
    default:
      return {
        label: status,
        bg: "bg-slate-50 text-slate-700 border-slate-200",
        dot: "bg-slate-400",
      };
  }
}

export function getPriorityBadge(priority: string) {
  switch (priority) {
    case "URGENT":
      return {
        label: "Urgent",
        bg: "bg-red-100 text-red-800 border-red-300 font-semibold",
        badge: "bg-red-600 text-white",
      };
    case "HIGH":
      return {
        label: "High",
        bg: "bg-orange-100 text-orange-800 border-orange-300 font-medium",
        badge: "bg-orange-500 text-white",
      };
    case "MEDIUM":
      return {
        label: "Medium",
        bg: "bg-amber-100 text-amber-800 border-amber-200",
        badge: "bg-amber-500 text-white",
      };
    case "LOW":
      return {
        label: "Low",
        bg: "bg-slate-100 text-slate-700 border-slate-200",
        badge: "bg-slate-500 text-white",
      };
    default:
      return {
        label: priority,
        bg: "bg-slate-100 text-slate-700 border-slate-200",
        badge: "bg-slate-400 text-white",
      };
  }
}

export function getChannelIconName(channel: string): string {
  switch (channel) {
    case "PHONE":
      return "Phone";
    case "CHAT":
      return "MessageSquare";
    case "EMAIL":
      return "Mail";
    default:
      return "Globe";
  }
}
