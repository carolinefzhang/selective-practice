// filepath: frontend/src/components/QuestionDisplay.tsx
import React from 'react';

interface QuestionProps {
    question: {
        id: number;
        question: string;
        options: string[];
        answer: string;
        options_images?: { text: string; supabase_urls: string[] }[];
        question_images?: string[];
        answer_images?: string[];
    };
    selectedOption: string | null;
    setSelectedOption: (option: string) => void;
}

const QuestionDisplay: React.FC<QuestionProps> = ({ question, selectedOption, setSelectedOption }) => {
    const isCorrect = selectedOption === question.answer;

    // Helper to find option images
    const getOptionImages = (optionText: string) => {
        if (!question.options_images) return [];
        const optionData = question.options_images.find(optImg => optImg.text === optionText);
        return optionData ? optionData.supabase_urls : [];
    };

    return (
        <div style={{ marginTop: '20px', border: '1px solid #ccc', padding: '15px' }}>
            <h3>Question {question.id}</h3>
            <p>{question.question}</p>
            {/* Display question_images */}
            {question.question_images && question.question_images.length > 0 && (
                <div style={{ marginTop: '10px' }}>
                    {question.question_images.map((imgUrl, idx) => (
                        <img key={`qimg-${idx}`} src={imgUrl} alt={`Question image ${idx + 1}`} style={{ maxWidth: '300px', maxHeight: '300px', marginRight: '10px', display: 'block', marginBottom: '10px' }} />
                    ))}
                </div>
            )}

            <div style={{ marginTop: '10px' }}>
                {question.options.map((option, index) => {
                    const optionImages = getOptionImages(option);
                    return (
                        <div key={index} style={{ marginBottom: '10px' }}>
                            <button
                                onClick={() => setSelectedOption(option)}
                                style={{
                                    backgroundColor: selectedOption === option ? (isCorrect ? 'lightgreen' : 'salmon') : 'white',
                                    marginRight: '10px',
                                    verticalAlign: 'top'
                                }}
                            >
                                {option}
                            </button>
                            {/* Display option_images here */}
                            {optionImages && optionImages.length > 0 && (
                                <div style={{ display: 'inline-block', verticalAlign: 'top' }}>
                                    {optionImages.map((imgUrl, idx) => (
                                        <img key={`optimg-${index}-${idx}`} src={imgUrl} alt={`Option ${index + 1} image ${idx + 1}`} style={{ maxWidth: '150px', maxHeight: '150px', marginRight: '5px', marginLeft: '5px', display: 'block', marginBottom: '5px' }} />
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {selectedOption && (
                <div style={{ marginTop: '15px', fontWeight: 'bold' }}>
                    {isCorrect ? 'Correct!' : `Incorrect. The correct answer is: ${question.answer}`}
                    {/* Display answer_images here */}
                    {question.answer_images && question.answer_images.length > 0 && (
                         // Show answer images only if an option has been selected
                        <div style={{ marginTop: '10px' }}>
                            <p style={{fontWeight: 'normal', marginBottom: '5px'}}>Correct answer images:</p>
                            {question.answer_images.map((imgUrl, idx) => (
                                <img key={`ansimg-${idx}`} src={imgUrl} alt={`Answer image ${idx + 1}`} style={{ maxWidth: '200px', maxHeight: '200px', marginRight: '10px', display: 'block', marginBottom: '10px' }} />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default QuestionDisplay;