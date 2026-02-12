import NotebookConceptClient from "./NotebookConceptClient";

type NotebookConceptPageProps = {
  params: Promise<{ conceptId: string }>;
};

export default async function NotebookConceptPage({ params }: NotebookConceptPageProps) {
  const { conceptId } = await params;
  return <NotebookConceptClient conceptId={conceptId} />;
}
