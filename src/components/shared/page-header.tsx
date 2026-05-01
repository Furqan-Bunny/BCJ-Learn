"use client";

import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  const reduced = useReducedMotion();
  const variants = {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0 },
  };
  return (
    <motion.div
      initial={reduced ? false : "hidden"}
      animate="visible"
      transition={{ staggerChildren: 0.06, delayChildren: 0.05 }}
      className={cn("mb-8 flex items-start justify-between gap-4 flex-wrap", className)}
    >
      <div className="min-w-0">
        {eyebrow && (
          <motion.div
            variants={variants}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2"
          >
            {eyebrow}
          </motion.div>
        )}
        <motion.h1
          variants={variants}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="text-3xl md:text-[2rem] font-bold tracking-tight text-foreground"
        >
          {title}
        </motion.h1>
        {description && (
          <motion.p
            variants={variants}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="mt-2 text-muted-foreground max-w-2xl"
          >
            {description}
          </motion.p>
        )}
      </div>
      {actions && (
        <motion.div
          variants={variants}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-2 shrink-0"
        >
          {actions}
        </motion.div>
      )}
    </motion.div>
  );
}
