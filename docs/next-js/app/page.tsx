import Image from "next/image";

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
          <span className="text-2xl font-bold text-[#644FF0]">+</span>
          <Image
            className="dark:invert"
            src="./next.svg"
            alt="Next.js logo"
            width={100}
            height={20}
            priority
          />
        </div>

        <div className="flex flex-col items-center gap-6 text-center">
          <h1 className="max-w-full text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            Let&apos;s get started!
          </h1>
        </div>
      </main>
    </div>
  );
}