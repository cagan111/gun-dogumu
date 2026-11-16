import { brand } from "@/config/brand";

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-3xl font-bold">{brand.name}</h1>
      <p className="mt-2 text-slate-600">{brand.tagline.tr}</p>
    </main>
  );
}
