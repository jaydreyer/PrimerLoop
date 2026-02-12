type ResultsPageProps = {
  params: { sessionId: string };
};

export default function ResultsPage({ params }: ResultsPageProps) {
  return (
    <main>
      <h1>Results</h1>
      <p>Session: {params.sessionId}</p>
    </main>
  );
}
