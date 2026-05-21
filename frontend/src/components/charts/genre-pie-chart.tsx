"use client";

import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import { getChartColors, getRechartsTooltipStyle, getAxisTickColor } from "@/lib/theme";

interface GenrePieChartProps {
  data: {
    name: string;
    value: number;
  }[];
  className?: string;
}

export function GenrePieChart({ data, className }: GenrePieChartProps) {
  const chartColors = getChartColors();
  const tooltipStyle = getRechartsTooltipStyle();
  const tickColor = getAxisTickColor();

  if (!data || data.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-64 text-muted-foreground", className)}>
        No data available
      </div>
    );
  }

  return (
    <div className={cn("w-full h-64", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data.slice(0, 6)}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
          >
            {data.slice(0, 6).map((_, index) => (
              <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
          <Legend
            formatter={(value) => <span style={{ color: tickColor, fontSize: "12px" }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}