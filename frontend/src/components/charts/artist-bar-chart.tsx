"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { cn } from "@/lib/utils";
import { getChartColors, getRechartsTooltipStyle, getAxisTickColor } from "@/lib/theme";

interface ArtistBarChartProps {
  data: {
    name: string;
    plays: number;
  }[];
  className?: string;
}

export function ArtistBarChart({ data, className }: ArtistBarChartProps) {
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
        <BarChart
          data={data.slice(0, 10)}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <XAxis
            dataKey="name"
            tick={{ fill: tickColor, fontSize: 12 }}
            tickFormatter={(value) => value.length > 10 ? value.substring(0, 10) + "..." : value}
          />
          <YAxis tick={{ fill: tickColor, fontSize: 12 }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="plays" radius={[4, 4, 0, 0]}>
            {data.slice(0, 10).map((_, index) => (
              <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}