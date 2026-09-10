/* Holding page. Real composition belongs to a later phase — this exists so the token layer has a
   rendered surface to be verified against, not as a draft of the invitation. */

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-space-md px-space-md py-space-3xl text-center">
      <p className="type-eyebrow text-accent-gold">Save the date</p>
      <h1 className="type-display-name text-ink">Flemy &amp; Sebastian</h1>
      <p className="type-body max-w-text text-ink">
        The invitation is still being built.
      </p>
    </main>
  );
}
