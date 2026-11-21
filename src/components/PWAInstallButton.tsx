import React, { useState } from 'react';
import { Download, Smartphone, X, ExternalLink } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  const isInIframe =
    typeof window !== 'undefined' && window.self !== window.top;

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors whitespace-nowrap"
      >
        <Download className="w-4 h-4" />
        Install Mismu App
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowGuide(true)}
        className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-sm font-semibold transition-colors whitespace-nowrap"
      >
        <Smartphone className="w-4 h-4 text-orange-600" />
        Install App
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4"
          onClick={() => setShowGuide(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Install Mismu App"
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-slate-900">
                Add Mismu to Home Screen
              </h3>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Close install instructions"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isInIframe && (
              <div className="p-3.5 rounded-xl bg-orange-50 border border-orange-200 text-xs text-slate-800 space-y-2.5">
                <p>
                  Abhi app AI Studio preview frame ke andar khuli hai, isliye browser direct install button hide rakhta hai. Pehle Mismu ko alag tab mein kholein:
                </p>
                <a
                  href={typeof window !== 'undefined' ? window.location.href : '/'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-semibold transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open Mismu in Full Tab
                </a>
              </div>
            )}

            {isIOS ? (
              <ol className="space-y-2 text-sm text-slate-600 list-decimal list-inside">
                <li>
                  Safari ke neeche <strong>Share</strong> icon par tap karein.
                </li>
                <li>
                  Neeche scroll karke <strong>Add to Home Screen</strong> select karein.
                </li>
                <li>
                  <strong>Add</strong> dabayein — Mismu icon home screen par aa jayega.
                </li>
              </ol>
            ) : (
              <ol className="space-y-2 text-sm text-slate-600 list-decimal list-inside">
                <li>
                  Mismu link ko seedha <strong>Chrome</strong> browser tab mein open karein.
                </li>
                <li>
                  Upar <strong>⋮ (3 dots)</strong> menu kholein aur <strong>Add to Home screen</strong> / <strong>Install app</strong> par tap karein.
                </li>
                <li>
                  <strong>Install</strong> confirm karein — Mismu app home screen par show ho jayegi.
                </li>
              </ol>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full py-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-sm font-semibold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};
