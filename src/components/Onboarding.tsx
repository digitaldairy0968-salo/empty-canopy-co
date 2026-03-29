import React, { useState } from 'react';
import { Milk, Users, FileText, Bell, ChevronRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface OnboardingProps {
  role: 'owner' | 'supplier';
  onComplete: () => void;
}

interface Step {
  icon: React.ElementType;
  titleHi: string;
  titleEn: string;
  descriptionHi: string;
  descriptionEn: string;
}

const ownerSteps: Step[] = [
  {
    icon: Milk,
    titleHi: 'दूध साथी में आपका स्वागत है',
    titleEn: 'Welcome to Doodh Saathi',
    descriptionHi: 'अपनी डेयरी को डिजिटल बनाएं और सप्लायर का हिसाब रखें।',
    descriptionEn: 'Digitize your dairy and manage supplier records easily.',
  },
  {
    icon: Users,
    titleHi: 'सप्लायर जोड़ें',
    titleEn: 'Add Suppliers',
    descriptionHi: 'अपने दूध सप्लायर का नाम, फोन और गाँव जोड़ें।',
    descriptionEn: 'Add supplier name, phone number, and village details.',
  },
  {
    icon: FileText,
    titleHi: 'दूध एंट्री करें',
    titleEn: 'Enter Milk Data',
    descriptionHi: 'सुबह-शाम दूध, फैट, SNF और LR दर्ज करें। सब कुछ ऑटो-सेव होगा।',
    descriptionEn: 'Record morning/evening milk, fat, SNF & LR. Everything auto-saves.',
  },
  {
    icon: Bell,
    titleHi: 'घोषणाएं भेजें',
    titleEn: 'Send Announcements',
    descriptionHi: 'सभी सप्लायर को एक साथ संदेश भेजें - दूध खरीद बंद, देरी आदि।',
    descriptionEn: 'Send messages to all suppliers - no milk purchase, delays, etc.',
  },
];

const supplierSteps: Step[] = [
  {
    icon: Milk,
    titleHi: 'दूध साथी में आपका स्वागत है',
    titleEn: 'Welcome to Doodh Saathi',
    descriptionHi: 'अपना दूध हिसाब-किताब देखें और डेयरी से जुड़े रहें।',
    descriptionEn: 'View your milk records and stay connected with your dairy.',
  },
  {
    icon: FileText,
    titleHi: 'अपना कार्ड देखें',
    titleEn: 'View Your Card',
    descriptionHi: 'पूरे महीने का दूध, फैट और पेमेंट एक जगह देखें।',
    descriptionEn: 'See your monthly milk, fat, and payment details in one place.',
  },
  {
    icon: Bell,
    titleHi: 'घोषणाएं पढ़ें',
    titleEn: 'Read Announcements',
    descriptionHi: 'डेयरी मालिक के संदेश यहाँ देखें।',
    descriptionEn: 'View messages from your dairy owner here.',
  },
];

const Onboarding: React.FC<OnboardingProps> = ({ role, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const { language } = useLanguage();
  
  const steps = role === 'owner' ? ownerSteps : supplierSteps;
  const isLastStep = currentStep === steps.length - 1;
  const CurrentIcon = steps[currentStep].icon;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Skip Button */}
      <div className="flex justify-end p-4">
        <Button variant="ghost" onClick={handleSkip} className="text-muted-foreground">
          {language === 'hi' ? 'छोड़ें' : 'Skip'}
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
        {/* Icon */}
        <div className="w-32 h-32 bg-primary/10 rounded-full flex items-center justify-center mb-8 animate-fade-in">
          <CurrentIcon className="w-16 h-16 text-primary" />
        </div>

        {/* Text */}
        <div className="text-center max-w-md animate-fade-in">
          <h1 className="text-2xl font-bold mb-4">
            {language === 'hi' ? steps[currentStep].titleHi : steps[currentStep].titleEn}
          </h1>
          <p className="text-muted-foreground text-lg">
            {language === 'hi' ? steps[currentStep].descriptionHi : steps[currentStep].descriptionEn}
          </p>
        </div>

        {/* Progress Dots */}
        <div className="flex gap-2 mt-12">
          {steps.map((_, index) => (
            <div
              key={index}
              className={cn(
                'w-3 h-3 rounded-full transition-all duration-300',
                index === currentStep
                  ? 'bg-primary w-8'
                  : index < currentStep
                  ? 'bg-primary'
                  : 'bg-border'
              )}
            />
          ))}
        </div>
      </div>

      {/* Bottom Button */}
      <div className="p-6">
        <Button
          variant="dairy"
          className="w-full h-14 text-lg gap-2"
          onClick={handleNext}
        >
          {isLastStep ? (
            <>
              {language === 'hi' ? 'शुरू करें' : 'Get Started'}
              <Check className="h-5 w-5" />
            </>
          ) : (
            <>
              {language === 'hi' ? 'आगे' : 'Next'}
              <ChevronRight className="h-5 w-5" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default Onboarding;
