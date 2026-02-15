import Image from "next/image";
import LocalNetCDFMeta from "@/components/loading/LocalNetCDFMeta";
import TopNav from "@/components/loading/TopNav";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 font-sans dark:bg-black">
      <TopNav />
      <main className="flex flex-1 w-full max-w-8xl flex-col items-center justify-center py-24 px-8 bg-white dark:bg-black mx-auto">
        {/* Images side by side */}
        <div className="flex items-center gap-4 mb-8">
          <Image
            src="./logo.svg"
            alt="netcdf4-wasm logo"
            width={100}
            height={20}
            priority
          />
          <span className="text-2xl font-bold">
            netcdf4 - <span className="text-[#644FF0]">wasm</span>
          </span>
        </div>
        <LocalNetCDFMeta />
      </main>
      <footer className="py-6 text-center text-sm bg-[color:var(--card)] text-[color:var(--muted-foreground)] dark:bg-[color:var(--card)] dark:text-[color:var(--muted-foreground)]">
  <p>
    Released under the{" "}
    <a
      href="https://github.com/EarthyScience/netcdf4-wasm?tab=MIT-1-ov-file#readme"
      target="_blank"
      rel="noopener noreferrer"
      className="text-[color:var(--accent-foreground)] hover:text-[#644FF0] transition-colors"
    >
      MIT License
    </a>
    .
  </p>
  <p>
    Copyright © {new Date().getFullYear()}{" "}
    <a
      href="https://lazarusa.github.io/"
      target="_blank"
      rel="noopener noreferrer"
      className="text-[color:var(--accent-foreground)] hover:text-[#644FF0] transition-colors"
    >
      Lazaro Alonso
    </a>
  </p>
</footer>

    </div>
  );
}