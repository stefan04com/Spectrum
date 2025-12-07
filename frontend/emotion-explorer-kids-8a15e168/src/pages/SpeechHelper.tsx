import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Heart, Utensils, HelpCircle, MessageCircle } from "lucide-react";
import SpeechButton from "@/components/SpeechButton";
import { getStoredActiveChildId } from "@/lib/child";

const phrases = {
  basic: [
    { text: "I need help", spoken: "Hi there, I need some gentle help please.", label: "Help", icon: "🆘" },
    { text: "I am hungry", spoken: "My tummy feels empty, could I have a snack please?", label: "Hungry", icon: "🍽️" },
    { text: "I am thirsty", spoken: "I would like a calm sip of water please.", label: "Thirsty", icon: "🥤" },
    { text: "I need to go to the bathroom", spoken: "I need to visit the bathroom now, can you take me?", label: "Bathroom", icon: "🚽" },
    { text: "I am tired", spoken: "I'm feeling tired and need a quiet rest please.", label: "Tired", icon: "😴" },
    { text: "I don't feel well", spoken: "Something feels off and I don't feel well, please stay with me.", label: "Not Well", icon: "🤒" },
  ],
  feelings: [
    { text: "I am happy", spoken: "I'm feeling happy and light inside!", label: "Happy", icon: "😊" },
    { text: "I am sad", spoken: "I'm feeling sad and would love a gentle hug.", label: "Sad", icon: "😢" },
    { text: "I am scared", spoken: "I'm feeling scared; could you stay close to me?", label: "Scared", icon: "😨" },
    { text: "I am angry", spoken: "I'm feeling upset and need a calm moment, please.", label: "Angry", icon: "😠" },
    { text: "I am confused", spoken: "I'm feeling confused and need help understanding.", label: "Confused", icon: "😕" },
    { text: "I feel calm", spoken: "I'm feeling calm and steady right now.", label: "Calm", icon: "😌" },
  ],
  requests: [
    { text: "Can I have a break please?", spoken: "I would like a short break, please.", label: "Break", icon: "⏸️" },
    { text: "Can you repeat that please?", spoken: "Could you repeat that slowly for me?", label: "Repeat", icon: "🔁" },
    { text: "I need more time", spoken: "I need a little more time to finish, please.", label: "More Time", icon: "⏰" },
    { text: "Can I have a hug?", spoken: "May I have a comforting hug, please?", label: "Hug", icon: "🤗" },
    { text: "I want to play", spoken: "I'd like to play now, could we start?", label: "Play", icon: "🎮" },
    { text: "I want to go home", spoken: "I'm ready to go home now, please.", label: "Home", icon: "🏠" },
  ],
  responses: [
    { text: "Yes", spoken: "Yes, that works for me.", label: "Yes", icon: "✅" },
    { text: "No", spoken: "No thank you.", label: "No", icon: "❌" },
    { text: "Maybe", spoken: "Maybe, I'm still thinking.", label: "Maybe", icon: "🤔" },
    { text: "I don't know", spoken: "I'm not sure yet.", label: "Don't Know", icon: "❓" },
    { text: "Thank you", spoken: "Thank you so much.", label: "Thank You", icon: "🙏" },
    { text: "Sorry", spoken: "I'm sorry about that.", label: "Sorry", icon: "💙" },
  ],
};

const categories = [
  { key: 'basic', label: 'Basic Needs', icon: <Utensils className="w-6 h-6" /> },
  { key: 'feelings', label: 'Feelings', icon: <Heart className="w-6 h-6" /> },
  { key: 'requests', label: 'Requests', icon: <HelpCircle className="w-6 h-6" /> },
  { key: 'responses', label: 'Responses', icon: <MessageCircle className="w-6 h-6" /> },
];

const SpeechHelper = () => {
  const navigate = useNavigate();
  const [childId, setChildId] = useState<string | null>(null);

  useEffect(() => {
    setChildId(getStoredActiveChildId());
  }, []);

  return (
    <div className="min-h-screen bg-background p-4 pb-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/child')}
            className="p-3 rounded-full bg-card border-2 border-border hover:bg-accent transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-2xl font-bold text-foreground">Speech Helper</h1>
        </div>

        {/* Categories */}
        {categories.map((category) => (
          <div key={category.key} className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                {category.icon}
              </div>
              <h2 className="text-xl font-semibold text-foreground">
                {category.label}
              </h2>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {phrases[category.key as keyof typeof phrases].map((phrase) => (
                <SpeechButton
                  key={`${category.key}-${phrase.label}`}
                  text={phrase.text}
                  spokenText={phrase.spoken}
                  label={phrase.label}
                  icon={<span className="text-4xl">{phrase.icon}</span>}
                  childId={childId}
                  analyticsKey={`${category.key}:${phrase.label}`}
                  analyticsCategory={category.key}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SpeechHelper;
