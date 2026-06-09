import { CATEGORY_COLORS, CATEGORY_LABELS, type CategoryBarDatum, type IhmrefCategory } from "@/pages/ihmref/types/ihmref";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from "recharts";


export const CategoryBarChart = ({
  data,
}: {
  data: CategoryBarDatum[];
}) => (
  <div className="h-[300px] w-full">
    <ResponsiveContainer>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f14444cc" />
        <XAxis
          dataKey="category"
          tick={{ fill: "#cbd5f5", fontSize: 12 }}
          tickFormatter={(value: IhmrefCategory) =>
                CATEGORY_LABELS[value]
            }
        />
        <YAxis
          tick={{ fill: "#cbd5f5", fontSize: 12 }}
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          labelFormatter={(label: IhmrefCategory) =>
                CATEGORY_LABELS[label] ?? label
            }
          contentStyle={{
            backgroundColor: "#560d0d", // slate-950
            border: "1px solid #ef4444",
            borderRadius: 8,
            }}
            labelStyle={{
            color: "#fff",
            fontSize: 12,
            }}
            itemStyle={{
            color: "#fff",
            fontSize: 12,
            }}
        />
        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
          {data.map(d => (
            <Cell
              key={d.category}
              fill={CATEGORY_COLORS[d.category]}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
);
