"use client";

import { JsonStats } from "@/types/json";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileText,
  Hash,
  Layers,
  HardDrive,
  Braces,
  Brackets,
  Type,
  Binary,
  ToggleLeft,
  Minus,
  Activity,
  AlertTriangle,
  CheckCircle,
  Info,
} from "lucide-react";

type StatsPanelProps = {
  stats: JsonStats | null;
  className?: string;
};

export function StatsPanel({ stats, className }: StatsPanelProps) {
  if (!stats) {
    return (
      <Card className={`${className}`}>
        <CardContent className="flex flex-col items-center justify-center p-8">
          <div className="p-4 bg-muted rounded-full mb-4">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-center">
            No data loaded yet
          </p>
        </CardContent>
      </Card>
    );
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const StatItem = ({
    icon: Icon,
    label,
    value,
    color = "text-foreground",
    bgColor = "bg-muted/50",
  }: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string | number;
    color?: string;
    bgColor?: string;
  }) => (
    <div
      className={`flex items-center justify-between p-3 ${bgColor} rounded-lg border border-border/50 transition-colors hover:bg-muted/80`}
    >
      <div className="flex items-center gap-2.5">
        <div
          className={`p-1.5 rounded-md bg-background border border-border/50`}
        >
          <Icon className={`h-3.5 w-3.5 ${color}`} />
        </div>
        <span className="text-xs font-medium text-foreground">{label}</span>
      </div>
      <span className="text-xs font-bold text-foreground tabular-nums">
        {value}
      </span>
    </div>
  );

  const getPerformanceStatus = () => {
    const alerts = [];

    if (stats.totalValues > 50000) {
      alerts.push({
        type: "warning",
        icon: AlertTriangle,
        message: "Large dataset - using web workers for processing",
        color: "text-amber-600 dark:text-amber-400",
        bgColor: "bg-amber-50 dark:bg-amber-900/20",
        borderColor: "border-amber-200 dark:border-amber-800",
      });
    }

    if (stats.depth > 10) {
      alerts.push({
        type: "info",
        icon: Info,
        message: "Deep nesting detected - consider collapsing levels",
        color: "text-blue-600 dark:text-blue-400",
        bgColor: "bg-blue-50 dark:bg-blue-900/20",
        borderColor: "border-blue-200 dark:border-blue-800",
      });
    }

    if (stats.totalValues < 1000) {
      alerts.push({
        type: "success",
        icon: CheckCircle,
        message: "Optimal size for fast rendering",
        color: "text-emerald-600 dark:text-emerald-400",
        bgColor: "bg-emerald-50 dark:bg-emerald-900/20",
        borderColor: "border-emerald-200 dark:border-emerald-800",
      });
    }

    return alerts;
  };

  const performanceAlerts = getPerformanceStatus();

  return (
    <Card className={`h-full flex flex-col ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="p-1.5 bg-primary/10 rounded-lg">
            <Activity className="h-4 w-4 text-primary" />
          </div>
          JSON Statistics
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto space-y-4 pr-2">
          {/* Overview Stats */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">
              Overview
            </h4>
            <div className="grid gap-2">
              <StatItem
                icon={Hash}
                label="Total Keys"
                value={stats.totalKeys.toLocaleString()}
                color="text-blue-600 dark:text-blue-400"
              />

              <StatItem
                icon={FileText}
                label="Total Values"
                value={stats.totalValues.toLocaleString()}
                color="text-emerald-600 dark:text-emerald-400"
              />

              <StatItem
                icon={Layers}
                label="Max Depth"
                value={stats.depth}
                color="text-purple-600 dark:text-purple-400"
              />

              <StatItem
                icon={HardDrive}
                label="Estimated Size"
                value={formatFileSize(stats.size)}
                color="text-orange-600 dark:text-orange-400"
              />
            </div>
          </div>

          {/* Data Types */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">
              Data Types
            </h4>
            <div className="grid gap-1.5">
              <StatItem
                icon={Braces}
                label="Objects"
                value={stats.objectCount.toLocaleString()}
                color="text-orange-500 dark:text-orange-400"
              />

              <StatItem
                icon={Brackets}
                label="Arrays"
                value={stats.arrayCount.toLocaleString()}
                color="text-indigo-500 dark:text-indigo-400"
              />

              <StatItem
                icon={Type}
                label="Strings"
                value={stats.stringCount.toLocaleString()}
                color="text-emerald-500 dark:text-emerald-400"
              />

              <StatItem
                icon={Binary}
                label="Numbers"
                value={stats.numberCount.toLocaleString()}
                color="text-blue-500 dark:text-blue-400"
              />

              <StatItem
                icon={ToggleLeft}
                label="Booleans"
                value={stats.booleanCount.toLocaleString()}
                color="text-purple-500 dark:text-purple-400"
              />

              <StatItem
                icon={Minus}
                label="Nulls"
                value={stats.nullCount.toLocaleString()}
                color="text-muted-foreground"
              />
            </div>
          </div>

          {/* Performance Indicators */}
          {performanceAlerts.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">
                Performance
              </h4>
              <div className="space-y-1.5">
                {performanceAlerts.map((alert, index) => (
                  <div
                    key={index}
                    className={`
                      flex items-center gap-2.5 p-2.5 rounded-lg border
                      ${alert.bgColor} ${alert.borderColor}
                    `}
                  >
                    <alert.icon
                      className={`h-3.5 w-3.5 ${alert.color} flex-shrink-0`}
                    />
                    <span className="text-xs text-foreground leading-relaxed">
                      {alert.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
