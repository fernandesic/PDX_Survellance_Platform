import React from 'react';
import { FileText, BarChart3, Table } from 'lucide-react';

export type ResponseFormat = 'text' | 'chart' | 'table';

interface FormatOption {
    id: ResponseFormat;
    label: string;
    icon: React.ElementType;
    description: string;
}

const formatOptions: FormatOption[] = [
    { id: 'text', label: 'Text', icon: FileText, description: 'Detailed explanation' },
    { id: 'chart', label: 'Chart', icon: BarChart3, description: 'Visual graph' },
    { id: 'table', label: 'Table', icon: Table, description: 'Structured data' },
];

interface FormatSelectorProps {
    availableFormats: ResponseFormat[];
    onSelectFormat: (format: ResponseFormat) => void;
    disabled?: boolean;
    selectedFormat?: ResponseFormat;
}

export const FormatSelector: React.FC<FormatSelectorProps> = ({
    availableFormats,
    onSelectFormat,
    disabled = false,
    selectedFormat
}) => {
    return (
        <div className="flex flex-col gap-3 mt-3">
            <p className="text-sm text-gray-600">How would you like to see this data?</p>
            <div className="flex gap-2 flex-wrap">
                {formatOptions.map((option) => {
                    const isAvailable = availableFormats.includes(option.id);
                    const isSelected = selectedFormat === option.id;
                    const Icon = option.icon;

                    return (
                        <button
                            key={option.id}
                            onClick={() => isAvailable && !disabled && onSelectFormat(option.id)}
                            disabled={!isAvailable || disabled}
                            className={`
                                flex items-center gap-2 px-4 py-2.5 rounded-xl
                                border transition-all duration-200 text-sm font-medium
                                ${isSelected
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg'
                                    : isAvailable
                                        ? 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 hover:shadow-md'
                                        : 'bg-gray-100 text-gray-400 border-gray-100 cursor-not-allowed opacity-50'
                                }
                            `}
                        >
                            <Icon size={16} />
                            <span>{option.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export const detectAvailableFormats = (question: string): ResponseFormat[] => {
    const lowerQuestion = question.toLowerCase();

    const dataKeywords = [
        'hazard', 'risk', 'capacity', 'score', 'chw', 'worker',
        'country', 'countries', 'compare', 'list', 'how many',
        'statistics', 'data', 'numbers', 'trend', 'ihr', 'espar',
        'readiness', 'preparedness'
    ];

    const hasDataContext = dataKeywords.some(keyword => lowerQuestion.includes(keyword));

    if (hasDataContext) {
        return ['text', 'chart', 'table'];
    }

    return ['text'];
};
