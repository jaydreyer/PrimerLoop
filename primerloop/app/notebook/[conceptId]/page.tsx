type NotebookConceptPageProps = {
  params: { conceptId: string };
};

export default function NotebookConceptPage({ params }: NotebookConceptPageProps) {
  return (
    <main>
      <h1>Concept Note</h1>
      <p>Concept: {params.conceptId}</p>
    </main>
  );
}
