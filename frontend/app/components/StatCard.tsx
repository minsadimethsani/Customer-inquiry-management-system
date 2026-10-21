import React from "react";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: number | string;
  subtext?: string;
  icon: LucideIcon;
  variant?: "default" | "warning" | "success" | "danger" | "info";
  isActive?: boolean;
  onClick?: () => void;
}

export function StatCard({
  label,
  value,
  subtext,
  icon: Icon,
  variant = "default",
  isActive = false,
  onClick,
}: StatCardProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case "danger":
        return {
          bg: "bg-red-50 hover:bg-red-100/80 border-red-200 text-red-900",
          iconBg: "bg-red-500 text-white shadow-sm shadow-red-200",
          activeRing: "ring-2 ring-red-500 shadow-md",
          subtextColor: "text-red-700",
        };
      case "warning":
        return {
          bg: "bg-amber-50 hover:bg-amber-100/80 border-amber-200 text-amber-900",
          iconBg: "bg-amber-500 text-white shadow-sm shadow-amber-200",
          activeRing: "ring-2 ring-amber-500 shadow-md",
          subtextColor: "text-amber-700",
        };
      case "success":
        return {
          bg: "bg-emerald-50 hover:bg-emerald-100/80 border-emerald-200 text-emerald-900",
          iconBg: "bg-emerald-500 text-white shadow-sm shadow-emerald-200",
          activeRing: "ring-2 ring-emerald-500 shadow-md",
          subtextColor: "text-emerald-700",
        };
      case "info":
        return {
          bg: "bg-blue-50 hover:bg-blue-100/80 border-blue-200 text-blue-900",
          iconBg: "bg-blue-600 text-white shadow-sm shadow-blue-200",
          activeRing: "ring-2 ring-blue-500 shadow-md",
          subtextColor: "text-blue-700",
        };
      default:
        return {
          bg: "bg-white hover:bg-slate-50 border-slate-200 text-slate-800",
          iconBg: "bg-slate-800 text-white shadow-sm",
          activeRing: "ring-2 ring-slate-800 shadow-md",
          subtextColor: "text-slate-500",
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      className={`relative flex items-center justify-between p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
        styles.bg
      } ${isActive ? styles.activeRing : "shadow-xs"}`}
    >
      <div className="flex flex-col">
        <span className="text-xs font-semibold uppercase tracking-wider opacity-75">
          {label}
        </span>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-2xl font-bold tracking-tight">{value}</span>
          {subtext && (
            <span className={`text-xs font-medium ${styles.subtextColor}`}>
              {subtext}
            </span>
          )}
        </div>
      </div>
      <div className={`p-2.5 rounded-lg flex items-center justify-center ${styles.iconBg}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  );
}
