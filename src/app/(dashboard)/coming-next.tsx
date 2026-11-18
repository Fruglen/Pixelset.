export function ComingNext({ name, phase, blurb }: { name: string; phase: string; blurb: string }) {
  return (
    <div className="max-w-xl">
      <h1 className="font-display text-2xl mb-2">{name}</h1>
      <div className="card p-8 text-center">
        <p className="text-sm text-neutral-600 mb-2">{blurb}</p>
        <p className="text-xs uppercase tracking-wide text-neutral-400">Arriving in {phase}</p>
      </div>
    </div>
  );
}
