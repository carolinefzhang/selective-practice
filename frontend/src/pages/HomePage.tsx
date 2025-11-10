// filepath: frontend/src/App.tsx
import React, { useState } from "react";
import QuestionDisplay from "../components/QuestionDisplay";
import { createClient } from "@supabase/supabase-js";
import PageLayout from "../components/PageLayout";
import LogoutButton from "../components/LogoutButton";
import { useAuth0 } from "@auth0/auth0-react";

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
  const { isAuthenticated, isLoading, getIdTokenClaims } = useAuth0();
  const [question, setQuestion] = useState<Question | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated) return <div>Please log in to access questions.</div>;

  const handleGetQuestion = async () => {
    try {
      const idTokenClaims = await getIdTokenClaims();
      const token = idTokenClaims?.__raw;
      console.log('Auth0 ID token:', token);
      
      // Create Supabase client with Auth0 token
      const authenticatedSupabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        {
          global: {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        }
      );
      
      const { data: allData, count, error } = await authenticatedSupabase
        .from('questions')
        .select('*', { count: 'exact' })
        .eq('note', 'term4'); // Filter by note 'term4'
      
      console.log('Raw response:', { allData, count, error });
      
      if (error) {
        console.error('Supabase error:', error);
        console.log('Error details:', error.message, error.code);
        return;
      }
      
      if (!allData || allData.length === 0) {
        console.log('No data returned - likely RLS policy blocking access');
        console.log('Check Supabase dashboard: Authentication > Policies');
        console.log('Either disable RLS or create a policy allowing SELECT');
        return;
      }
      
      console.log(`Found ${count} questions:`, allData);
      const randomIndex = Math.floor(Math.random() * allData.length);
      const randomQuestion = allData[randomIndex];
      setQuestion(randomQuestion);
      setSelectedOption(null);
    } catch (error) {
      console.error('Catch error:', error);
    }
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
