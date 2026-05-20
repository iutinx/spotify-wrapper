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

interface ArtistBarChartProps {
  data: {
    name: string;
    plays: number;
  }[];
  className?: string;
}

const COLORS = ["#d97706", "#f59e0b", "#fbbf24", "#fcd34d", "#fb923c"];

export function ArtistBarChart({ data, className }: ArtistBarChartProps) {
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
            tick={{ fill: "#a8a29e", fontSize: 12 }}
            tickFormatter={(value) => value.length > 10 ? value.substring(0, 10) + "..." : value}
          />
          <YAxis tick={{ fill: "#a8a29e", fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#171717",
              border: "1px solid #2a2a2a",
              borderRadius: "8px",
              color: "#faf9f7",
            }}
            formatter={(value) => [`${value} plays`]}
            labelFormatter={(label) => `Artist: ${label}`}
          />
          <Bar dataKey="plays" radius={[4, 4, 0, 0]}>
            {data.slice(0, 10).map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}