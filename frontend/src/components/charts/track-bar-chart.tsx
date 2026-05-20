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

interface TrackBarChartProps {
  data: {
    name: string;
    artist: string;
    plays: number;
  }[];
  className?: string;
}

const COLORS = ["#d97706", "#f59e0b", "#fbbf24", "#fcd34d", "#fb923c"];

export function TrackBarChart({ data, className }: TrackBarChartProps) {
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
          <XAxis type="number" tick={{ fill: "#a8a29e", fontSize: 12 }} />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: "#faf9f7", fontSize: 12 }}
            width={120}
            tickFormatter={(value) => value.length > 15 ? value.substring(0, 15) + "..." : value}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#171717",
              border: "1px solid #2a2a2a",
              borderRadius: "8px",
              color: "#faf9f7",
            }}
            formatter={(value, name, props) => [
              `${value} plays`,
              props.payload.artist
            ]}
            labelFormatter={(label) => `${label}`}
          />
          <Bar dataKey="plays" radius={[0, 4, 4, 0]}>
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}