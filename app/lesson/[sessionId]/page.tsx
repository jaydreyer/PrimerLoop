type LessonPageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function LessonPage({ params }: LessonPageProps) {
  const { sessionId } = await params;

  return (
    <main>
      <h1>Lesson</h1>
      <p>Session: {sessionId}</p>
    </main>
  );
}
