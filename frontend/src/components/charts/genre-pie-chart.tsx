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

interface GenrePieChartProps {
  data: {
    name: string;
    value: number;
  }[];
  className?: string;
}

const COLORS = ["#d97706", "#f59e0b", "#fbbf24", "#fcd34d", "#fb923c", "#fb7185"];

export function GenrePieChart({ data, className }: GenrePieChartProps) {
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
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "#171717",
              border: "1px solid #2a2a2a",
              borderRadius: "8px",
              color: "#faf9f7",
            }}
            formatter={(value) => [`${value} plays`]}
          />
          <Legend
            formatter={(value) => <span style={{ color: "#a8a29e", fontSize: "12px" }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}