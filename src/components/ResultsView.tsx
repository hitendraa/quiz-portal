import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Trophy, CheckCircle, XCircle, ArrowLeft, Calendar, Clock, AlertCircle, Crown, Medal, Award } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';

// --- No changes needed in these interfaces ---
interface Question {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer';
  question: string;
  options?: string[];
  correctAnswer: string;
  points: number;
}
interface Quiz {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  timeLimit: number;
  questions: Question[];
  createdAt: Date;
}
interface QuizResult {
  id: string;
  quizId: string;
  studentName: string;
  score: number;
  totalPoints: number;
  answers: Record<string, string>;
  completedAt: Date;
  timeTaken: number;
}
interface LeaderboardEntry {
  studentName: string;
  score: number;
  totalPoints: number;
  percentage: number;
  percentile: string;
  completedAt: Date;
  timeTaken: number | null; // Can be null if data is missing
}
interface ResultsViewProps {
  result: QuizResult;
  quiz: Quiz;
  onBack: () => void;
}

const ResultsView = ({ result, quiz, onBack }: ResultsViewProps) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);
  const [currentUserRank, setCurrentUserRank] = useState<number | null>(null);

  // FIX: Make the formatTime function robust against null or undefined values.
  const formatTime = (totalSeconds: number | null | undefined) => {
    // If totalSeconds is null, undefined, or not a valid number, return null.
    if (totalSeconds == null || isNaN(totalSeconds) || totalSeconds < 0) {
      return null;
    }
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const calculatePercentile = (percentage: number) => {
    if (percentage >= 90) return 'Top 10%';
    if (percentage >= 75) return 'Top 25%';
    if (percentage >= 50) return 'Top 50%';
    return 'Bottom 50%';
  };

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const { data: resultsData, error } = await supabase
          .from('quiz_results')
          .select('*, profiles:student_id(full_name), time_taken')
          .eq('quiz_id', quiz.id)
          .order('score', { ascending: false })
          .order('time_taken', { ascending: true, nullsFirst: false }); // Handle nulls in sorting

        if (error) {
          console.error('Error fetching leaderboard:', error);
          return;
        }

        const entries: LeaderboardEntry[] = resultsData.map((r: any) => {
          const percentage = Math.round((r.score / r.total_points) * 100);
          return {
            studentName: r.profiles?.full_name || 'Anonymous',
            score: r.score,
            totalPoints: r.total_points,
            percentage: percentage,
            percentile: calculatePercentile(percentage),
            completedAt: new Date(r.completed_at),
            // FIX: Use the nullish coalescing operator to handle missing data.
            timeTaken: r.time_taken ?? null,
          };
        });
        
        const userIndex = entries.findIndex(entry => 
          entry.studentName === result.studentName && 
          entry.score === result.score &&
          entry.completedAt.getTime() === result.completedAt.getTime()
        );

        setCurrentUserRank(userIndex !== -1 ? userIndex + 1 : null);
        setLeaderboard(entries);
      } catch (error) {
        console.error('Error processing leaderboard:', error);
      } finally {
        setLoadingLeaderboard(false);
      }
    };

    fetchLeaderboard();
  }, [quiz.id, result]);

  // --- No changes needed in the functions below ---
  const percentage = Math.round((result.score / result.totalPoints) * 100);
  const getScoreColor = (p:number) => p >= 80 ? 'text-green-600' : p >= 60 ? 'text-yellow-600' : 'text-red-600';
  const getScoreBadge = (p:number) => {
    if (p >= 80) return { text: 'Excellent!', class: 'bg-green-100 text-green-800 border-green-200' };
    if (p >= 60) return { text: 'Good Job!', class: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
    return { text: 'Keep Practicing!', class: 'bg-red-100 text-red-800 border-red-200' };
  };
  const scoreBadge = getScoreBadge(percentage);
  const compareAnswers = (userAnswer: string | undefined, correctAnswer: string, options?: string[]): boolean => {
    if (!userAnswer) return false;
    const normalizedUser = userAnswer.trim().toLowerCase();
    const normalizedCorrect = correctAnswer.trim().toLowerCase();
    if (normalizedUser === normalizedCorrect) return true;
    if (normalizedCorrect === 'true' || normalizedCorrect === 'false') {
      if ((normalizedUser === 't' || normalizedUser === '1') && normalizedCorrect === 'true') return true;
      if ((normalizedUser === 'f' || normalizedUser === '0') && normalizedCorrect === 'false') return true;
    }
    if (options && normalizedUser.match(/^[a-d]$/)) {
      const optionIndex = normalizedUser.charCodeAt(0) - 'a'.charCodeAt(0);
      if (optionIndex >= 0 && optionIndex < options.length) {
        if (options[optionIndex].trim().toLowerCase() === normalizedCorrect) return true;
      }
    }
    return false;
  };

  const renderLeaderboard = () => {
    if (loadingLeaderboard) return <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;
    if (leaderboard.length === 0) return <div className="text-center py-8 text-gray-500"><p>No one else has taken this quiz yet.</p></div>;

    return (
      <div className="space-y-4">
        {leaderboard.map((entry, index) => {
          const rank = index + 1;
          const isCurrentUser = entry.studentName === result.studentName && entry.score === result.score && entry.completedAt.getTime() === result.completedAt.getTime();
          let rankIcon;
          if (rank === 1) rankIcon = '🥇'; else if (rank === 2) rankIcon = '🥈'; else if (rank === 3) rankIcon = '🥉';
          
          // FIX: Format the time and only display it if it's valid.
          const timeDisplay = formatTime(entry.timeTaken);

          return (
            <div key={index} className={`flex items-center justify-between p-3 rounded-lg border ${isCurrentUser ? 'bg-blue-50 border-blue-300 shadow-md' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center gap-3">
                <div className="text-lg font-bold w-8 text-center text-gray-500">{rankIcon || rank}</div>
                <div>
                  <h4 className={`font-medium ${isCurrentUser ? 'text-blue-700' : 'text-gray-800'}`}>{entry.studentName}</h4>
                  <div className="text-xs text-gray-500">{entry.percentile}</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="font-bold text-gray-800">{entry.percentage}%</div>
                  {/* FIX: Conditionally render the time display */}
                  {timeDisplay && (
                    <div className="flex items-center justify-end gap-1 text-xs text-gray-500">
                      <Clock className="h-3 w-3" />
                      {timeDisplay}
                    </div>
                  )}
                </div>
                {isCurrentUser && <Award className="h-5 w-5 text-blue-500" />}
              </div>
            </div>
          );
        })}
      </div>
    );
  };
  
  // FIX: Format the current user's time for display
  const currentUserTime = formatTime(result.timeTaken);

  // --- Main JSX Return Block ---
  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-6"><Button variant="ghost" onClick={onBack} className="flex items-center text-gray-600 hover:text-gray-800"><ArrowLeft className="h-4 w-4 mr-2" />Back to Dashboard</Button></div>
        <Card className="mb-8 bg-white/80 backdrop-blur-sm border-0 shadow-lg rounded-xl text-center">
          <CardHeader>
            <div className="mx-auto mb-4 p-4 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full w-fit"><Trophy className={`h-12 w-12 ${getScoreColor(percentage)}`} /></div>
            <CardTitle className="text-2xl sm:text-3xl text-gray-800">{quiz.title}</CardTitle>
            <Badge className={`mx-auto mt-2 text-base px-4 py-1 rounded-full ${scoreBadge.class}`}>{scoreBadge.text}</Badge>
          </CardHeader>
          <CardContent className="p-6">
            <div className={`text-6xl sm:text-7xl font-bold ${getScoreColor(percentage)} mb-2`}>{percentage}%</div>
            <div className="text-lg text-gray-600 mb-4">{result.score} out of {result.totalPoints} points</div>
            <Progress value={percentage} className="max-w-md mx-auto h-2.5 rounded-full" />
            <div className="mt-6 flex flex-col sm:flex-row justify-center items-center gap-x-6 gap-y-2 text-gray-700">
              {currentUserRank !== null && <div className="text-lg">Your Rank: <strong className="text-blue-600">#{currentUserRank}</strong> of {leaderboard.length}</div>}
              {/* FIX: Conditionally render the user's time */}
              {currentUserTime && (
                <div className="flex items-center gap-2 text-lg">
                  <Clock className="h-5 w-5 text-gray-500" />
                  Time Taken: <strong className="text-blue-600">{currentUserTime}</strong>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3">
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg rounded-xl">
              <CardHeader><CardTitle className="text-2xl text-gray-800">Answer Review</CardTitle><p className="text-gray-600">Check your answers below.</p></CardHeader>
              <CardContent className="space-y-4">
                {quiz.questions.map((q, index) => {
                  const userAnswer = result.answers[q.id];
                  const isCorrect = compareAnswers(userAnswer, q.correctAnswer, q.options);
                  return (
                    <div key={q.id} className={`p-4 rounded-lg border-l-4 ${isCorrect ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
                      <p className="font-semibold text-gray-800 mb-2">Q{index + 1}: {q.question}</p>
                      <div className="text-sm space-y-1">
                        <p>Your answer: <strong className={isCorrect ? 'text-green-700' : 'text-red-700'}>{userAnswer || 'Not answered'}</strong></p>
                        {!isCorrect && <p>Correct answer: <strong className="text-green-700">{q.correctAnswer}</strong></p>}
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </div>
          <div className="lg:col-span-2">
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg rounded-xl">
              <CardHeader><CardTitle className="text-2xl text-gray-800">Leaderboard</CardTitle><p className="text-gray-600">See how you stack up!</p></CardHeader>
              <CardContent className="px-2 sm:px-6">{renderLeaderboard()}</CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultsView;