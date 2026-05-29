import Link from "next/link";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">

      {/* Background Effects */}
      <div className="absolute inset-0 -z-10">

        {/* Glow Orbs */}
        <div className="absolute left-[-10%] top-[-10%] h-[500px] w-[500px] rounded-full bg-purple-500/20 blur-3xl" />

        <div className="absolute bottom-[-20%] right-[-10%] h-[500px] w-[500px] rounded-full bg-cyan-500/20 blur-3xl" />

        <div className="absolute left-[30%] top-[40%] h-[300px] w-[300px] rounded-full bg-pink-500/10 blur-3xl" />

        {/* Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:70px_70px]" />

        {/* Dark Overlay */}
        <div className="absolute inset-0 bg-black/60" />
      </div>

      {/* Sticky Navbar */}
      <nav className="fixed left-0 right-0 top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">

          {/* Logo */}
          <h1 className="bg-gradient-to-r from-white via-gray-300 to-gray-500 bg-clip-text text-3xl font-black tracking-[0.2em] text-transparent">
            MAKT
          </h1>

          {/* Buttons */}
          <div className="flex items-center gap-4">

            <Link
              href="/login"
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium backdrop-blur-xl transition duration-300 hover:border-white/30 hover:bg-white hover:text-black"
            >
              Login
            </Link>

            <Link
              href="/register"
              className="rounded-2xl bg-white px-5 py-2.5 text-sm font-semibold text-black shadow-[0_0_35px_rgba(255,255,255,0.35)] transition duration-300 hover:scale-105 hover:opacity-90"
            >
              Request Access
            </Link>

          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative mx-auto flex max-w-7xl flex-col items-center px-6 pb-32 pt-44 text-center">

        {/* Badge */}
        <div className="mb-8 rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm tracking-wide text-gray-300 backdrop-blur-xl">
          Intelligent Business Infrastructure
        </div>

        {/* Heading */}
        <h2 className="max-w-6xl bg-gradient-to-b from-white via-gray-200 to-gray-500 bg-clip-text text-6xl font-black leading-[0.95] tracking-tight text-transparent md:text-8xl">
          The Future Of
          <br />
          Business Operations
        </h2>

        {/* Subtitle */}
        <p className="mt-10 max-w-3xl text-lg leading-8 text-gray-400 md:text-xl">
          MAKT empowers modern businesses with intelligent client management,
          communication systems, operational workflows, and scalable digital infrastructure.
        </p>

        {/* CTA */}
        <div className="mt-14 flex flex-wrap items-center justify-center gap-5">

          <Link
            href="/register"
            className="rounded-2xl bg-white px-8 py-4 text-lg font-semibold text-black shadow-[0_0_40px_rgba(255,255,255,0.35)] transition duration-300 hover:scale-105"
          >
            Request Access
          </Link>

          <Link
            href="/login"
            className="rounded-2xl border border-white/10 bg-white/5 px-8 py-4 text-lg backdrop-blur-xl transition duration-300 hover:border-white/30 hover:bg-white hover:text-black"
          >
            Explore System
          </Link>

        </div>

      </section>

      {/* Features */}
      <section className="mx-auto grid max-w-7xl gap-8 px-6 pb-32 md:grid-cols-3">

        {[
          {
            title: "Client Intelligence",
            desc: "Track relationships, customer activity, sales movement, and operational growth from one unified control center.",
          },
          {
            title: "Smart Communication",
            desc: "Deliver real-time customer engagement through advanced messaging and connected communication systems.",
          },
          {
            title: "Growth Infrastructure",
            desc: "Scale workflows, analytics, operations, and digital performance with enterprise-grade architecture.",
          },
        ].map((item, index) => (
          <div
            key={index}
            className="group relative overflow-hidden rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur-2xl transition duration-500 hover:-translate-y-3 hover:border-white/20"
          >

            {/* Hover Glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 transition duration-500 group-hover:opacity-100" />

            {/* Number */}
            <div className="relative text-sm font-semibold tracking-[0.2em] text-gray-500">
              0{index + 1}
            </div>

            {/* Title */}
            <h3 className="relative mt-5 text-3xl font-black">
              {item.title}
            </h3>

            {/* Description */}
            <p className="relative mt-5 leading-8 text-gray-400">
              {item.desc}
            </p>

          </div>
        ))}
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 md:flex-row">

          <h4 className="bg-gradient-to-r from-white to-gray-500 bg-clip-text text-2xl font-black tracking-[0.2em] text-transparent">
            MAKT
          </h4>

          <p className="text-sm text-gray-500">
            (c) 2026 MAKT. Built for the future.
          </p>

        </div>
      </footer>

    </main>
  );
}
