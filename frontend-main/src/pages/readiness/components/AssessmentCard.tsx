
interface Prop {
    title: string;
    question: string;
    score: number;
    max_score: number;
}
export default function AssessmentCard({ title, question, score, max_score }: Prop) {
  const percent = max_score ? (score / max_score) * 100 : 0;

  return (
    <div className="bg-white/5 rounded-xl p-5 w-full">
      <div className="flex items-center justify-between mb-3">
        <span className="px-3 py-1 text-sm bg-neutral-800 border border-neutral-600 rounded-full">
          {title}
        </span>
      </div>

      <p className="text-neutral-300 text-sm mb-4">{question}</p>

      <div className="flex items-center gap-3">
        <span
          className={`px-3 py-1 rounded-full text-sm font-semibold ${
            percent === 100
              ? "bg-green-600 text-white"
              : percent >= 80
              ? "bg-green-500/30 text-green-400"
              : percent >= 60
              ? "bg-yellow-500/30 text-yellow-400"
              : "bg-red-500/30 text-red-400"
          }`}
        >
          {percent.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}
