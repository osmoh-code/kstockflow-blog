import { CATEGORIES } from "@/lib/constants";

interface CategoryBadgeProps {
  readonly category: string;
  readonly size?: "sm" | "md";
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  "featured-stocks": { bg: "bg-red-50 border-red-200", text: "text-red-700" },
  "hot-issues": { bg: "bg-orange-50 border-orange-200", text: "text-orange-700" },
  "investment-strategy": { bg: "bg-blue-50 border-blue-200", text: "text-blue-700" },
  "market-analysis": { bg: "bg-violet-50 border-violet-200", text: "text-violet-700" },
  "economic-news": { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700" },
};

const SIZE_CLASSES: Record<string, string> = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-3 py-1 text-xs",
};

export default function CategoryBadge({
  category,
  size = "sm",
}: CategoryBadgeProps) {
  const categoryData = CATEGORIES.find((c) => c.slug === category);
  const colors = CATEGORY_COLORS[category] ?? {
    bg: "bg-gray-50 border-gray-200",
    text: "text-gray-700",
  };

  const label = categoryData?.name ?? category;

  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold uppercase tracking-wide ${colors.bg} ${colors.text} ${SIZE_CLASSES[size]}`}
    >
      {label}
    </span>
  );
}
