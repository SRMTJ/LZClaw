import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  CommandLineIcon,
  CpuChipIcon,
  RocketLaunchIcon,
  SparklesIcon,
  UserCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import React, { useState } from 'react';

import { i18nService } from '@/services/i18n';

import OnboardingOrbitScene from './onboarding/OnboardingOrbitScene';

interface WelcomeDialogProps {
  onStart: () => void;
  onClose: () => void;
  requireLogin?: boolean;
}

type WelcomeStep = {
  icon: React.ComponentType<{ className?: string }>;
  titleKey: string;
  subtitleKey: string;
  highlightKey: string;
  label: string;
  shortTitle: string;
  eyebrow: string;
};

const welcomeSteps: WelcomeStep[] = [
  {
    icon: SparklesIcon,
    titleKey: 'onboardingStepWelcomeTitle',
    subtitleKey: 'onboardingStepWelcomeSubtitle',
    highlightKey: 'onboardingStepWelcomeDetail1',
    label: '欢迎',
    shortTitle: '认识 LZClaw',
    eyebrow: '01',
  },
  {
    icon: UserCircleIcon,
    titleKey: 'onboardingStepLoginTitle',
    subtitleKey: 'onboardingStepLoginSubtitle',
    highlightKey: 'onboardingStepLoginDetail1',
    label: '登录',
    shortTitle: '身份认证',
    eyebrow: '02',
  },
  {
    icon: CommandLineIcon,
    titleKey: 'onboardingStepWorkspaceTitle',
    subtitleKey: 'onboardingStepWorkspaceSubtitle',
    highlightKey: 'onboardingStepWorkspaceDetail1',
    label: '项目',
    shortTitle: '项目工作',
    eyebrow: '03',
  },
  {
    icon: CpuChipIcon,
    titleKey: 'onboardingStepStartTitle',
    subtitleKey: 'onboardingStepStartSubtitle',
    highlightKey: 'onboardingStepStartDetail1',
    label: '工作台',
    shortTitle: '进入工作台',
    eyebrow: '04',
  },
];

const WelcomeDialog: React.FC<WelcomeDialogProps> = ({ onStart, onClose, requireLogin = false }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [motionDirection, setMotionDirection] = useState(1);
  const step = welcomeSteps[stepIndex] ?? welcomeSteps[0];
  const StepIcon = step.icon;
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === welcomeSteps.length - 1;
  const primaryActionLabel = requireLogin ? i18nService.t('onboardingGoToLogin') : i18nService.t('onboardingStart');
  const highlight = i18nService.t(step.highlightKey);

  const setActiveStep = (nextIndex: number) => {
    if (nextIndex === stepIndex) return;
    setMotionDirection(nextIndex > stepIndex ? 1 : -1);
    setStepIndex(nextIndex);
  };

  const goNext = () => {
    if (isLastStep) {
      void onStart();
      return;
    }
    setMotionDirection(1);
    setStepIndex((current) => Math.min(current + 1, welcomeSteps.length - 1));
  };

  const goBack = () => {
    setMotionDirection(-1);
    setStepIndex((current) => Math.max(current - 1, 0));
  };

  return (
    <div className="fixed inset-0 z-[10060] overflow-hidden bg-[#020714] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_42%,rgba(8,145,178,0.22),transparent_34%),radial-gradient(circle_at_78%_48%,rgba(2,6,23,0.76),transparent_42%),linear-gradient(180deg,#010612_0%,#031326_50%,#01040c_100%)]" />
      <OnboardingOrbitScene activeStep={stepIndex} />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(1,7,19,0.18)_0%,transparent_34%,rgba(1,7,19,0.58)_72%,rgba(1,7,19,0.84)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-[linear-gradient(180deg,transparent,rgba(1,5,13,0.88))]" />

      <header className="draggable relative z-20 flex h-20 items-center justify-between px-4 sm:px-8">
        <div className="remove-app-drag flex items-center gap-4">
          <img
            src="logo.png"
            alt="LZClaw"
            width={54}
            height={54}
            className="h-11 w-11 rounded-lg shadow-[0_16px_44px_rgba(239,68,68,0.38)] sm:h-[54px] sm:w-[54px]"
            draggable={false}
          />
          <div>
            <div className="text-xl font-bold leading-6 tracking-normal text-white sm:text-[22px]">LZClaw</div>
            <div className="mt-1 text-sm font-medium text-[#94a3b8]">AI 企业工作站</div>
          </div>
        </div>

        {!requireLogin && (
          <button
            onClick={onClose}
            className="remove-app-drag inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-[#9fb0c6] transition-colors hover:bg-white/8 hover:text-white"
            aria-label={i18nService.t('onboardingClose')}
          >
            <span className="hidden sm:inline">跳过引导</span>
            <span className="sm:hidden">跳过</span>
            <XMarkIcon className="h-4 w-4" />
          </button>
        )}
      </header>

      <main
        className="relative z-10 grid h-[calc(100vh-80px)] min-h-0 grid-rows-[minmax(0,1fr)_auto] px-4 pb-4 text-white sm:min-h-[620px] sm:px-8 sm:pb-8"
        style={{ backgroundColor: 'transparent' }}
      >
        <section className="relative grid min-h-0 items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,448px)]">
          <div className="pointer-events-none hidden max-w-[380px] self-end pb-20 lg:block">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#4bdcff]/18 bg-[#02172b]/38 px-4 py-2 text-xs font-bold uppercase text-[#8cecff] shadow-[0_0_32px_rgba(34,211,238,0.12)] backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-[#5ce7ff] shadow-[0_0_16px_rgba(92,231,255,0.9)]" />
              Cyber-Ocean AI Workspace
            </div>
            <div
              key={`${step.titleKey}-stage`}
              className={`mt-7 ${motionDirection >= 0 ? 'animate-fade-in-up' : 'animate-fade-in-down'}`}
            >
              <div className="text-[74px] font-semibold leading-none text-[#66e8ff]/56">{step.eyebrow}</div>
              <div className="mt-4 flex items-center gap-4">
                <span className="h-px w-20 bg-gradient-to-r from-[#5ce7ff] to-transparent" />
                <span className="text-sm font-bold text-[#baf6ff]">{step.label}</span>
              </div>
              <p className="mt-5 text-sm font-medium leading-6 text-[#88a9c0]">{step.shortTitle}</p>
            </div>
          </div>

          <article
            key={step.titleKey}
            className={`remove-app-drag relative ml-auto w-full max-w-[448px] rounded-lg border border-[#45dbff]/28 bg-[#04172a]/58 p-5 shadow-[0_28px_90px_rgba(0,0,0,0.46),0_0_0_1px_rgba(122,236,255,0.06)] backdrop-blur-xl sm:p-6 ${
              motionDirection >= 0 ? 'animate-fade-in-up' : 'animate-fade-in-down'
            }`}
          >
            <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#5ce7ff]/70 to-transparent" />
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-[#5ce7ff]/18 bg-[#062c46]/82 text-[#baf6ff] shadow-[0_0_26px_rgba(34,211,238,0.18)]">
                  <StepIcon className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold uppercase text-[#5ce7ff]">
                    {i18nService.t('onboardingStepLabel')
                      .replace('{current}', String(stepIndex + 1))
                      .replace('{total}', String(welcomeSteps.length))}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-[#8ba4bb]">{step.label}</div>
                </div>
              </div>
              <div className="text-5xl font-semibold leading-none text-[#5ce7ff]/34 sm:text-6xl">{step.eyebrow}</div>
            </div>

            <h1 className="mt-6 text-[28px] font-bold leading-tight text-white sm:text-[34px]">
              {i18nService.t(step.titleKey)}
            </h1>
            <p className="mt-3 max-w-[390px] text-sm font-medium leading-6 text-[#c6d8ea] sm:text-[15px]">
              {i18nService.t(step.subtitleKey)}
            </p>

            <div className="mt-6 flex items-start gap-3 rounded-lg border border-[#69e6ff]/18 bg-[#03111f]/58 px-4 py-3 text-[#f2f8ff] shadow-[inset_0_1px_0_rgba(125,233,255,0.08)]">
              <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#083550] text-[#a8f1ff]">
                <CheckCircleIcon className="h-[18px] w-[18px]" />
              </div>
              <p className="text-sm font-semibold leading-6">{highlight}</p>
            </div>
          </article>
        </section>

        <section className="relative z-20 mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-4 pt-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-6">
          <div className="order-2 flex justify-center sm:order-none sm:justify-start">
            <button
              onClick={goBack}
              disabled={isFirstStep}
              className="remove-app-drag inline-flex h-[52px] items-center gap-3 rounded-lg border border-white/12 bg-white/8 px-5 text-sm font-semibold text-[#dce9fb] shadow-[0_18px_42px_rgba(0,0,0,0.22)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/12 disabled:pointer-events-none disabled:opacity-35"
            >
              <ArrowLeftIcon className="h-5 w-5" />
              {i18nService.t('onboardingBack')}
            </button>
          </div>

          <div className="order-1 min-w-0 sm:order-none">
            <div className="mx-auto grid max-w-[620px] grid-cols-4 gap-1 rounded-lg border border-white/10 bg-[#03111f]/52 p-1.5 shadow-[0_18px_60px_rgba(0,0,0,0.32)] backdrop-blur-xl">
              {welcomeSteps.map((item, index) => {
                const active = index === stepIndex;
                const completed = index < stepIndex;
                const ItemIcon = item.icon;
                return (
                  <button
                    key={item.titleKey}
                    type="button"
                    onClick={() => setActiveStep(index)}
                    className={`remove-app-drag group flex min-w-0 items-center justify-center gap-2 rounded-lg px-2 py-2 text-left transition-all duration-300 sm:justify-start sm:px-3 ${
                      active ? 'bg-[#0a3855] text-white shadow-[inset_0_0_0_1px_rgba(92,231,255,0.26)]' : 'text-[#8497aa] hover:bg-white/8 hover:text-[#dcefff]'
                    }`}
                  >
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition-all duration-300 ${
                        active
                          ? 'border-[#5ce7ff]/60 bg-[#0e7490] text-white shadow-[0_0_24px_rgba(34,211,238,0.38)]'
                          : completed
                            ? 'border-[#65e6ff]/40 bg-[#07324b] text-[#b9f4ff]'
                            : 'border-white/12 bg-[#071325] text-[#8ea0b8] group-hover:border-[#7dd3fc]/40'
                      }`}
                    >
                      <ItemIcon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="hidden min-w-0 sm:block">
                      <span className="block text-[11px] font-bold leading-4 text-[#5ce7ff]/90">{item.eyebrow}</span>
                      <span className="block truncate text-sm font-semibold">{item.label}</span>
                    </span>
                    <span className="text-xs font-bold sm:hidden">
                      {index + 1}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="order-3 flex justify-center sm:order-none sm:justify-start">
            <button
              onClick={goNext}
              className="remove-app-drag inline-flex h-[52px] items-center gap-4 rounded-full bg-[#ef4438] px-5 pl-6 text-sm font-semibold text-white shadow-[0_18px_48px_rgba(239,68,56,0.36)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#ff513f]"
            >
              {isLastStep ? primaryActionLabel : i18nService.t('onboardingNext')}
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white/14">
                {isLastStep ? <RocketLaunchIcon className="h-5 w-5" /> : <ArrowRightIcon className="h-5 w-5" />}
              </span>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default WelcomeDialog;
