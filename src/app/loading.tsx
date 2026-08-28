"use client";

import { motion } from "framer-motion";

export default function GlobalLoading() {
  return (
    <div className="flex h-64 w-full items-center justify-center">
      <motion.div
        className="flex flex-col items-center gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-indigo-600 dark:border-zinc-800 dark:border-t-indigo-500" />
        <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Loading...</span>
      </motion.div>
    </div>
  );
}
