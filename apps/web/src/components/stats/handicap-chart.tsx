"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui";
import type { HandicapHistoryEntry } from "@/lib/api";

interface HandicapChartProps {
  history: HandicapHistoryEntry[];
}

export function HandicapChart({ history }: HandicapChartProps) {
  // Sort history by date (oldest first) and limit to last 12 entries for display
  const sortedHistory = useMemo(() => {
    return [...history]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(-12);
  }, [history]);

  if (sortedHistory.length < 2) {
    // Need at least 2 points for a chart
    const single = sortedHistory[0];
    return (
      <Card className="glass-card">
        <CardContent className="p-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted">Current Handicap</p>
              <p className="text-2xl font-bold text-foreground">
                {single?.handicapIndex.toFixed(1) ?? "—"}
              </p>
            </div>
            <p className="text-xs text-muted">
              {single ? formatDate(single.createdAt) : "No history"}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Chart dimensions
  const width = 300;
  const height = 120;
  const padding = { top: 20, right: 40, bottom: 30, left: 10 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate min/max for scaling
  const values = sortedHistory.map(h => h.handicapIndex);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1; // Prevent division by zero

  // Scale functions
  const scaleX = (index: number) =>
    padding.left + (index / (sortedHistory.length - 1)) * chartWidth;
  const scaleY = (value: number) =>
    padding.top + chartHeight - ((value - minValue) / range) * chartHeight;

  // Generate path
  const pathData = sortedHistory
    .map((entry, index) => {
      const x = scaleX(index);
      const y = scaleY(entry.handicapIndex);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  // Current vs oldest comparison
  const current = sortedHistory[sortedHistory.length - 1];
  const oldest = sortedHistory[0];
  const change = current.handicapIndex - oldest.handicapIndex;
  const changeText = change > 0 ? `+${change.toFixed(1)}` : change.toFixed(1);
  const isImproved = change < 0; // Lower handicap is better

  return (
    <Card className="glass-card">
      <CardContent className="p-md">
        <div className="flex items-center justify-between mb-md">
          <div>
            <p className="text-sm text-muted">Current</p>
            <p className="text-2xl font-bold text-foreground">
              {current.handicapIndex.toFixed(1)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted">Change</p>
            <p className={`text-lg font-semibold ${isImproved ? "text-brand" : "text-error"}`}>
              {changeText}
            </p>
          </div>
        </div>

        {/* SVG Chart */}
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
          style={{ maxHeight: "120px" }}
        >
          {/* Grid lines */}
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={padding.top + chartHeight}
            stroke="currentColor"
            strokeOpacity={0.1}
          />
          <line
            x1={padding.left}
            y1={padding.top + chartHeight}
            x2={width - padding.right}
            y2={padding.top + chartHeight}
            stroke="currentColor"
            strokeOpacity={0.1}
          />

          {/* Area fill */}
          <path
            d={`${pathData} L ${scaleX(sortedHistory.length - 1)} ${padding.top + chartHeight} L ${scaleX(0)} ${padding.top + chartHeight} Z`}
            fill="url(#chartGradient)"
            opacity={0.3}
          />

          {/* Line */}
          <path
            d={pathData}
            fill="none"
            stroke="#22c55e"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Points */}
          {sortedHistory.map((entry, index) => (
            <circle
              key={entry.id}
              cx={scaleX(index)}
              cy={scaleY(entry.handicapIndex)}
              r={3}
              fill="#22c55e"
            />
          ))}

          {/* Y-axis labels */}
          <text
            x={width - padding.right + 5}
            y={padding.top + 4}
            fontSize={10}
            fill="currentColor"
            fillOpacity={0.5}
          >
            {maxValue.toFixed(1)}
          </text>
          <text
            x={width - padding.right + 5}
            y={padding.top + chartHeight + 4}
            fontSize={10}
            fill="currentColor"
            fillOpacity={0.5}
          >
            {minValue.toFixed(1)}
          </text>

          {/* X-axis labels (first and last) */}
          <text
            x={padding.left}
            y={height - 5}
            fontSize={9}
            fill="currentColor"
            fillOpacity={0.5}
            textAnchor="start"
          >
            {formatShortDate(oldest.createdAt)}
          </text>
          <text
            x={width - padding.right}
            y={height - 5}
            fontSize={9}
            fill="currentColor"
            fillOpacity={0.5}
            textAnchor="end"
          >
            {formatShortDate(current.createdAt)}
          </text>

          {/* Gradient definition */}
          <defs>
            <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
          </defs>
        </svg>
      </CardContent>
    </Card>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatShortDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
}
