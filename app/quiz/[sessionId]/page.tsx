type QuizPageProps = {
  params: { sessionId: string };
};

export default function QuizPage({ params }: QuizPageProps) {
  return (
    <main>
      <h1>Quiz</h1>
      <p>Session: {params.sessionId}</p>
    </main>
  );
}
