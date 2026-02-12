import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1>PrimerLoop</h1>
      <p>
        <Link href="/today">Go to today&apos;s session</Link>
      </p>
    </main>
  );
}
