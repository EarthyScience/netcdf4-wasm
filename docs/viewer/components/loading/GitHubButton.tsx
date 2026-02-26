"use client";

import { FaGithub } from "react-icons/fa";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default function GithubButton() {
  return (
    <Tooltip delayDuration={500}>
      <TooltipTrigger asChild>
        <Link href="https://github.com/EarthyScience/netcdf4-wasm" aria-label="github" target="_blank" rel="noopener noreferrer">
          <Button
            variant="ghost"
            className="
              hover:scale-95 transition-transform duration-100 ease-out
              hover:bg-transparent active:bg-transparent
              focus:bg-transparent focus-visible:ring-0
              cursor-pointer
            "
          >
            <FaGithub className="size-6" />
            Give us a Star
          </Button>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="center">
        View on GitHub
      </TooltipContent>
    </Tooltip>
  );
}