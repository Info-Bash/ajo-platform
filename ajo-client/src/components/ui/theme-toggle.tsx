"use client";

import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const themes = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="flex items-center gap-1 rounded-full border border-border bg-transparent p-1 shadow-[0_2px_12px_var(--accent-glow)]">
      {themes.map(({ value, label, icon: Icon }) => {
        const isActive = theme === value;
        return (
          <button
            key={value}
            onClick={() => setTheme(value)}
            aria-label={`Switch to ${label} theme`}
            aria-pressed={isActive}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full transition-all duration-150 cursor-pointer",
              isActive
                ? "bg-card text-primary shadow-sm"
                : "text-text-muted hover:text-text-secondary"
            )}
          >
            <Icon size={14} />
          </button>
        );
      })}
    </div>
  );
}