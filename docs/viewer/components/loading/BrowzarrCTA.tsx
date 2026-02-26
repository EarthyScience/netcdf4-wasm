import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface BrowzarrCTAProps {
  message?: string;
  buttonText?: string;
}

export default function BrowzarrCTA({
  message = "Reading is just the beginning. Explore your data!",
  buttonText = "Try browzarr.io",
}: BrowzarrCTAProps) {
  return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              aria-label="browzarr.io"
              href="https://browzarr.io/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                size="sm"
                className="bg-gradient-to-tr from-pink-500 to-yellow-500 text-white shadow-lg hover:shadow-xl transition-shadow hover:scale-95 transition-transform duration-100 ease-out cursor-pointer"
              >
                {buttonText}
              </Button>
            </Link>
          </TooltipTrigger>

          <TooltipContent className="max-w-xs" align="end">
            {message}
          </TooltipContent>
        </Tooltip>
  );
}