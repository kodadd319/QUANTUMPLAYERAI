import React, { useEffect } from 'react';

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

interface AdSenseUnitProps {
  slot?: string;
  format?: string;
  responsive?: string;
  className?: string;
  label?: string;
}

export const AdSenseUnit: React.FC<AdSenseUnitProps> = ({
  slot = "3726647075",
  format = "auto",
  responsive = "true",
  className = "",
  label = "GOOGLE ADSENSE"
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (err) {
        console.warn("AdSense push warning:", err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [slot]);

  return (
    <div className={`w-full max-w-4xl mx-auto my-6 p-4 rounded-2xl bg-stone-900/80 border border-white/15 backdrop-blur-md text-center shadow-[0_4px_25px_rgba(0,0,0,0.5)] ${className}`}>
      <div className="text-[10px] font-sans font-bold text-slate-400 uppercase tracking-[0.2em] mb-2.5 flex items-center justify-center gap-3 opacity-90">
        <span className="w-10 h-[1px] bg-slate-700"></span>
        <span>{label}</span>
        <span className="w-10 h-[1px] bg-slate-700"></span>
      </div>
      <div className="w-full min-h-[100px] flex items-center justify-center overflow-hidden rounded-xl bg-black/60 border border-white/10 relative p-2">
        <ins
          className="adsbygoogle"
          style={{ display: "block", width: "100%", minWidth: "250px", minHeight: "90px" }}
          data-ad-client="ca-pub-5765882849864509"
          data-ad-slot={slot}
          data-ad-format={format}
          data-full-width-responsive={responsive}
        />
      </div>
    </div>
  );
};

export default AdSenseUnit;
