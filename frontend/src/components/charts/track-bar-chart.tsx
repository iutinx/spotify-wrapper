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

interface TrackBarChartProps {
  data: {
    name: string;
    artist: string;
    plays: number;
  }[];
  className?: string;
}

export function TrackBarChart({ data, className }: TrackBarChartProps) {
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
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
        >
          <XAxis type="number" tick={{ fill: tickColor, fontSize: 12 }} />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: tickColor, fontSize: 12 }}
            width={120}
            tickFormatter={(value) => value.length > 15 ? value.substring(0, 15) + "..." : value}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, name, props) => [
              `${value} plays`,
              props.payload.artist
            ]}
            labelFormatter={(label) => `${label}`}
          />
          <Bar dataKey="plays" radius={[0, 4, 4, 0]}>
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}