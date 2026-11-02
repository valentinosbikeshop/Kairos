import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#070709] text-zinc-100 flex flex-col items-center justify-center p-6 text-center select-none">
      <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6 shadow-2xl">
        <span className="text-2xl font-black tracking-widest text-zinc-400">404</span>
      </div>

      <h1 className="text-xl font-bold tracking-tight uppercase text-zinc-200 mb-2 font-mono">
        Ruta No Encontrada
      </h1>
      <p className="text-xs text-zinc-400 max-w-xs mb-8 leading-relaxed">
        El protocolo solicitado no existe o ha sido reubicado en la bóveda del sistema KAIROS.
      </p>

      <Link
        href="/"
        className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 border border-zinc-700 text-xs font-semibold text-zinc-100 uppercase tracking-widest transition-all"
      >
        Regresar al Panel
      </Link>
    </main>
  );
}
