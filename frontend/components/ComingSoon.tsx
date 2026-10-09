export default function ComingSoon({ title, sprint, children }: { title: string; sprint: number; children: React.ReactNode }) {
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-3 text-ink-soft">{children}</p>
      <p className="mt-6 border-l-2 border-line pl-3 text-sm text-ink-faint">Arrives in Sprint {sprint} of the build plan.</p>
    </div>
  );
}
