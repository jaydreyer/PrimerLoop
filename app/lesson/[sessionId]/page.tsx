type LessonPageProps = {
  params: { sessionId: string };
};

export default function LessonPage({ params }: LessonPageProps) {
  return (
    <main>
      <h1>Lesson</h1>
      <p>Session: {params.sessionId}</p>
    </main>
  );
}
