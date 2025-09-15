// filepath: frontend/src/App.tsx
import React, { useState } from "react";
import QuestionDisplay from "../components/question-display";
import { createClient } from "@supabase/supabase-js";
import { PageLayout } from "../components/page-layout";
import LogoutButton from "../components/logout-button";

const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
interface Question {
  id: number;
  question: string;
  options: string[];
  answer: string;
  question_images?: string[];
  options_images?: { text: string; supabase_urls: string[] }[];
  answer_images?: string[];
}

const HomePage: React.FC = () => {
  const [question, setQuestion] = useState<Question | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const handleGetQuestion = async () => {
    
    const { data, count } = await supabase.from('questions').select('*', { count: 'exact' });
    if (data) {
      console.log("Data fetched from Supabase:", data);
    } else {
      console.error("Error fetching data from Supabase");
    }
    const randomIndex = count ? Math.floor(Math.random() * count): 0;
    const randomQuestion = data?data[randomIndex]:null
    setQuestion(randomQuestion);
    setSelectedOption(null); // Reset selected option when fetching a new question
  };

  return (
    <PageLayout>
      <div className="content-layout">
        <button onClick={handleGetQuestion}>Get Random Question</button>
        <LogoutButton />
        {question && (
          <QuestionDisplay
            question={question}
            selectedOption={selectedOption}
            setSelectedOption={setSelectedOption}
          />
        )}
    </div>
    </PageLayout>
  );
};

export default HomePage;
