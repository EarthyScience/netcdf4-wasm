"use client";

import GithubButton from "@/components/loading/GitHubButton";
import BrowzarrCTA from "@/components/loading/BrowzarrCTA";

export default function TopNav() {
  return (
    <div
      className="fixed top-0 inset-x-0 z-50 flex items-center justify-between
             px-4 pr-4 h-14
             bg-white/40 dark:bg-black/40
             backdrop-blur-md"
    >
      <BrowzarrCTA />
      <GithubButton />
    </div>
  );
}
