import Image from "next/image";
import LocalNetCDFMeta from "@/components/loading/LocalNetCDFMeta";
import GithubButton from "@/components/loading/GitHubButton";
export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-8xl flex-col items-center justify-center py-16 px-8 bg-white dark:bg-black">
        {/* Images side by side with + */}
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

        <div className="fixed top-2 right-4 z-50 flex items-center gap-2">
          <GithubButton />
        </div>
      </main>
    </div>
  );
}