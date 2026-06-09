const SuggestedQuestions = ({ onQuestionSelect }: { onQuestionSelect: (q: string) => void }) => {
    const questions = [
        "Write a short bio for LinkedIn.",
        "Explain the concept of quantum entanglement.",
        "Draft a cold email to a potential client.",
        "Help me debug a React component.",
    ];
    
    return (
        <div className="p-6 pt-2 pb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Popular Suggestions</h3>
            <div className="flex flex-wrap gap-3">
                {questions.map((question) => (
                    <button
                        key={question}
                        onClick={() => onQuestionSelect(question)}
                        className="
                            px-4 py-2 text-sm font-medium 
                            bg-white/80 text-indigo-700 border border-indigo-200 
                            rounded-full shadow-sm transition duration-300 ease-in-out
                            hover:bg-indigo-50 hover:shadow-lg active:scale-95
                            backdrop-blur-sm
                        "
                    >
                        {question}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default SuggestedQuestions;