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
}

export const AdSenseUnit: React.FC<AdSenseUnitProps> = ({
  slot = "3726647075",
  format = "auto",
  responsive = "true",
  className = ""
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (err) {
        console.warn("AdSense component push warning:", err);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={`w-full max-w-5xl mx-auto my-4 overflow-hidden min-h-[90px] text-center ${className}`}>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client="ca-pub-5765882849864509"
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive}
      />
    </div>
  );
};

export default AdSenseUnit;
