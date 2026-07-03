import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  Cog6ToothIcon,
  CommandLineIcon,
  RocketLaunchIcon,
  SparklesIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import React, { useState } from 'react';

import { i18nService } from '@/services/i18n';

interface WelcomeDialogProps {
  onStart: () => void;
  onClose: () => void;
  requireLogin?: boolean;
}

type WelcomeStep = {
  icon: React.ComponentType<{ className?: string }>;
  titleKey: string;
  subtitleKey: string;
  detailKeys: [string, string, string];
  kind?: 'details' | 'finish';
};

const welcomeSteps: WelcomeStep[] = [
  {
    icon: SparklesIcon,
    titleKey: 'onboardingStepWelcomeTitle',
    subtitleKey: 'onboardingStepWelcomeSubtitle',
    detailKeys: ['onboardingStepWelcomeDetail1', 'onboardingStepWelcomeDetail2', 'onboardingStepWelcomeDetail3'],
  },
  {
    icon: Cog6ToothIcon,
    titleKey: 'onboardingStepModelTitle',
    subtitleKey: 'onboardingStepModelSubtitle',
    detailKeys: ['onboardingStepModelDetail1', 'onboardingStepModelDetail2', 'onboardingStepModelDetail3'],
  },
  {
    icon: CommandLineIcon,
    titleKey: 'onboardingStepWorkspaceTitle',
    subtitleKey: 'onboardingStepWorkspaceSubtitle',
    detailKeys: ['onboardingStepWorkspaceDetail1', 'onboardingStepWorkspaceDetail2', 'onboardingStepWorkspaceDetail3'],
  },
  {
    icon: RocketLaunchIcon,
    titleKey: 'onboardingStepStartTitle',
    subtitleKey: 'onboardingStepStartSubtitle',
    detailKeys: ['onboardingStepStartDetail1', 'onboardingStepStartDetail2', 'onboardingStepStartDetail3'],
    kind: 'finish',
  },
];

const WelcomeDialog: React.FC<WelcomeDialogProps> = ({ onStart, onClose, requireLogin = false }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const step = welcomeSteps[stepIndex] ?? welcomeSteps[0];
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === welcomeSteps.length - 1;
  const isFinishStep = step.kind === 'finish';
  const StepIcon = step.icon;

  const visibleDetails = step.detailKeys.map((key) => i18nService.t(key));

  const goNext = () => {
    if (isLastStep) {
      void onStart();
      return;
    }
    setStepIndex((current) => Math.min(current + 1, welcomeSteps.length - 1));
  };

  const goBack = () => {
    setStepIndex((current) => Math.max(current - 1, 0));
  };

  return (
    <div className="fixed inset-0 z-[10060] bg-[#06101d] text-white">
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(135deg, rgba(55, 124, 240, 0.1) 0%, rgba(6, 16, 29, 0.98) 34%, rgba(5, 10, 18, 1) 100%)',
        }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:42px_42px] opacity-20" />
      <div className="absolute inset-0 bg-[#03070d]/55" />

      {!requireLogin && (
        <button
          onClick={onClose}
          className="absolute right-5 top-5 z-20 flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-[#111827]/90 text-[#e5eefc] shadow-lg transition-colors hover:bg-[#1a2435] hover:text-white"
          aria-label={i18nService.t('onboardingClose')}
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      )}

      <div className="relative z-10 flex h-full min-h-0 flex-col">
        <div className="draggable flex h-12 shrink-0 items-center justify-center">
          <div className="remove-app-drag flex items-center gap-1.5">
            {welcomeSteps.map((item, index) => (
              <button
                key={item.titleKey}
                type="button"
                onClick={() => setStepIndex(index)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  index === stepIndex
                    ? 'w-8 bg-[#64a3ff]'
                    : index < stepIndex
                      ? 'w-5 bg-[#64a3ff]/75'
                      : 'w-2.5 bg-white/[0.32] hover:bg-white/50'
                }`}
                aria-label={i18nService.t('onboardingStepIndicator').replace('{current}', String(index + 1))}
              />
            ))}
          </div>
        </div>

        <main className="flex min-h-0 flex-1 items-center justify-center px-8 pb-12">
          <div className="grid w-full max-w-5xl grid-cols-[minmax(0,0.95fr)_minmax(320px,1.05fr)] items-stretch gap-8">
            <section className="flex flex-col items-start justify-center rounded-lg border border-[#2c4262] bg-[#0c1728] p-7 shadow-[0_24px_72px_rgba(0,0,0,0.42)]">
              <img
                src="logo.png"
                alt="LZClaw"
                width={76}
                height={76}
                className="mb-7 rounded-lg shadow-[0_18px_60px_rgba(72,133,255,0.28)]"
                draggable={false}
              />
              <div className="mb-3 text-sm font-bold uppercase text-[#b8d7ff]">
                {i18nService.t('onboardingEyebrow')}
              </div>
              <h1 className="max-w-xl text-5xl font-bold leading-tight text-white drop-shadow-[0_2px_18px_rgba(0,0,0,0.55)]">
                {i18nService.t(step.titleKey)}
              </h1>
              <p className="mt-5 max-w-lg text-[17px] font-medium leading-8 text-[#f1f6ff] drop-shadow-[0_1px_8px_rgba(0,0,0,0.42)]">
                {i18nService.t(step.subtitleKey)}
              </p>

              <div className="mt-9 flex items-center gap-3">
                {!isFirstStep && (
                  <button
                    onClick={goBack}
                    className="flex h-11 items-center gap-2 rounded-lg border border-white/[0.18] bg-[#111827]/90 px-5 text-sm font-semibold text-[#e5eefc] shadow-lg transition-colors hover:bg-[#1a2435] hover:text-white"
                  >
                    <ArrowLeftIcon className="h-4 w-4" />
                    {i18nService.t('onboardingBack')}
                  </button>
                )}
                {!isFinishStep && (
                  <button
                    onClick={goNext}
                    className="flex h-11 items-center gap-2 rounded-lg bg-[#3f8cff] px-6 text-sm font-semibold text-white shadow-[0_16px_44px_rgba(72,133,255,0.42)] transition-colors hover:bg-[#2f7df3]"
                  >
                    {i18nService.t('onboardingNext')}
                    <ArrowRightIcon className="h-4 w-4" />
                  </button>
                )}
                {isFinishStep && (
                  <button
                    onClick={onStart}
                    className="flex h-11 items-center gap-2 rounded-lg bg-[#3f8cff] px-6 text-sm font-semibold text-white shadow-[0_16px_44px_rgba(72,133,255,0.42)] transition-colors hover:bg-[#2f7df3]"
                  >
                    {i18nService.t('onboardingStart')}
                    <RocketLaunchIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
            </section>

            <section className="relative min-h-[420px] overflow-hidden rounded-lg border border-[#d8e3f2] bg-[#f8fbff] p-6 text-[#101827] shadow-[0_28px_90px_rgba(0,0,0,0.5)]">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#2563eb] via-[#0891b2] to-[#7c3aed]" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-lg border border-[#b8cef0] bg-[#e8f1ff] text-[#1d4f91]">
                    <StepIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[#526176]">
                      {i18nService.t('onboardingStepLabel')
                        .replace('{current}', String(stepIndex + 1))
                        .replace('{total}', String(welcomeSteps.length))}
                    </div>
                    <div className="text-lg font-bold text-[#0b1628]">{i18nService.t(step.titleKey)}</div>
                  </div>
                </div>
              </div>

              {isFinishStep ? (
                <div className="mt-8">
                  <div className="rounded-lg border border-[#c9daf0] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
                    <div className="flex items-center gap-4">
                      <img
                        src="logo.png"
                        alt="LZClaw"
                        width={56}
                        height={56}
                        className="rounded-lg"
                        draggable={false}
                      />
                      <div>
                        <h2 className="text-2xl font-bold text-[#0b1628]">{i18nService.t('onboardingStartCardTitle')}</h2>
                        <p className="mt-1 text-sm font-medium leading-6 text-[#526176]">
                          {i18nService.t('onboardingStartCardSubtitle')}
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 space-y-3">
                      {visibleDetails.map((detail) => (
                        <div
                          key={detail}
                          className="flex items-start gap-3 rounded-lg border border-[#d7e0ec] bg-[#f8fbff] p-3"
                        >
                          <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-[#2563eb]" />
                          <p className="text-[15px] font-semibold leading-6 text-[#182439]">{detail}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-7 space-y-3">
                      <button
                        onClick={onStart}
                        className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#2563eb] px-5 text-base font-bold text-white shadow-[0_16px_34px_rgba(37,99,235,0.28)] transition-colors hover:bg-[#1d4ed8]"
                      >
                        <RocketLaunchIcon className="h-5 w-5" />
                        {i18nService.t('onboardingStart')}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mt-8 space-y-4">
                    {visibleDetails.map((detail, index) => (
                      <div
                        key={detail}
                        className="flex items-start gap-3 rounded-lg border border-[#d7e0ec] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
                        style={{ transitionDelay: `${index * 80}ms` }}
                      >
                        <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-[#e8f1ff] text-xs font-bold text-[#17467d]">
                          {index + 1}
                        </div>
                        <p className="text-[15px] font-medium leading-6 text-[#182439]">{detail}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 rounded-lg border border-[#bfd4f2] bg-[#eaf3ff] p-4">
                    <div className="mb-2 text-sm font-bold text-[#0b1628]">{i18nService.t('onboardingHintTitle')}</div>
                    <p className="text-sm font-medium leading-6 text-[#26364f]">{i18nService.t('onboardingHintBody')}</p>
                  </div>
                </>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
};

export default WelcomeDialog;
