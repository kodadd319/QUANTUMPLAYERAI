import React, { useState } from "react";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup,
  Auth
} from "firebase/auth";
import { googleProvider } from "../firebase";
import { Mail, Lock, AlertTriangle, ShieldCheck, ArrowLeft, Loader2 } from "lucide-react";
import { motion } from "motion/react";

interface AuthViewProps {
  auth: Auth;
  onSuccess: () => void;
  onBack: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ auth, onSuccess, onBack }) => {
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [googleLoading, setGoogleLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Parse accurate Firebase error callbacks into clean, friendly human messages
  const getFriendlyError = (code: string) => {
    switch (code) {
      case "auth/invalid-email":
        return "The email address is badly formatted.";
      case "auth/user-disabled":
        return "This user account has been disabled.";
      case "auth/user-not-found":
        return "No account found with this email.";
      case "auth/wrong-password":
        return "Incorrect password. Please verify and try again.";
      case "auth/email-already-in-use":
        return "An account already exists with this email address.";
      case "auth/weak-password":
        return "Weak password. Password must be at least 6 characters.";
      case "auth/invalid-credential":
        return "Invalid credentials. Please double check email and password.";
      case "auth/popup-closed-by-user":
        return "The Google login window was closed before completion.";
      case "auth/configuration-not-found":
        return "Google Sign-In is not enabled on your Firebase project yet. Please go to the Firebase Console -> Authentication -> Sign-in method tab, click 'Add new provider', select 'Google', configure it with your support email, and save.";
      default:
        return "Authentication failed. Please verify inputs and try again.";
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all email and password fields.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
        setSuccessMessage("Your account has been created successfully!");
        setTimeout(() => {
          onSuccess();
        }, 1500);
      } else {
        try {
          await signInWithEmailAndPassword(auth, email, password);
          setSuccessMessage("Successfully logged in!");
          setTimeout(() => {
            onSuccess();
          }, 1200);
        } catch (loginErr: any) {
          // Smooth auto-registration fallback for invalid or non-existent credentials in fresh project sandboxes
          if (loginErr?.code === "auth/invalid-credential") {
            try {
              console.log("Login failed with invalid credentials. Auto-registering...");
              await createUserWithEmailAndPassword(auth, email, password);
              setSuccessMessage("Account created & logged in!");
              setTimeout(() => {
                onSuccess();
              }, 1500);
            } catch (signUpErr: any) {
              if (signUpErr?.code === "auth/email-already-in-use") {
                throw loginErr; // Incorrect password on existing email
              }
              throw signUpErr;
            }
          } else {
            throw loginErr;
          }
        }
      }
    } catch (err: any) {
      console.error("Authentication submission error:", err);
      setError(getFriendlyError(err?.code || ""));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setGoogleLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await signInWithPopup(auth, googleProvider);
      setSuccessMessage("Successfully signed in with Google!");
      setTimeout(() => {
        onSuccess();
      }, 1200);
    } catch (err: any) {
      console.error("Google Auth popup error:", err);
      setError(getFriendlyError(err?.code || ""));
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="flex-1 w-full max-w-xl mx-auto px-4 py-8 flex flex-col justify-center min-h-screen relative z-10">
      
      {/* Return Back Button */}
      <div className="absolute top-6 left-4 z-20">
        <button
          onClick={onBack}
          disabled={loading || googleLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 font-sans text-[10px] font-medium uppercase tracking-widest text-white hover:bg-white/10 border border-white/20 shadow-[0_0_8px_rgba(255,255,255,0.1)] rounded-lg cursor-pointer bg-slate-950/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
      </div>

      {/* Main Glassmorphic Hardware Card */}
      <motion.div 
         initial={{ opacity: 0, y: 15 }} 
         animate={{ opacity: 1, y: 0 }} 
         transition={{ duration: 0.4 }}
         className="w-full relative chrome-panel-bezel candy-coat-layer high-gloss-reflection p-6 md:p-8 rounded-[2rem] overflow-hidden"
      >
        <div className="absolute inset-0 bg-[#020512]/50 pointer-events-none z-0" />

        <div className="relative z-10 flex flex-col items-stretch">
          
          {/* Logo Frame */}
          <div className="flex flex-col items-center justify-center mb-6">
            <div className="p-3 w-full max-w-[300px] bg-stone-900/60 border border-slate-300/30 rounded-2xl flex items-center justify-center gap-3 shadow-inner py-4 px-5">
              <img 
                src="/logo.png" 
                alt="QUANTUMPLAYERAI Logo" 
                referrerPolicy="no-referrer"
                onError={(e) => { e.currentTarget.src = "/icon.png"; }}
                className="w-8 h-8 rounded-lg object-cover shadow-[0_0_8px_rgba(255,255,255,0.3)] shrink-0" 
              />
              <span className="text-lg font-sans font-semibold tracking-[0.2em] text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.7)] select-none text-center">
                QUANTUMPLAYERAI
              </span>
            </div>
            
            <p className="text-[10px] sm:text-xs font-sans font-semibold tracking-[0.25em] text-slate-200 uppercase mt-4 text-center">
              Sign In
            </p>
          </div>

          {/* Form Content Block */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            
            {/* Header Text */}
            <div className="text-center mb-2">
              <h2 className="text-base font-semibold font-sans tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-slate-400 via-white to-slate-350 uppercase">
                {isSignUp ? "Sign Up" : "Sign In"}
              </h2>
              <p className="text-[10px] font-sans font-light leading-relaxed text-slate-400 mt-1">
                {isSignUp ? "Create a new account to save your tracks and presets" : "Sign in to restore your custom tracks and presets"}
              </p>
            </div>

            {/* Error System Warning Banner */}
            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3 rounded-lg bg-red-950/70 border border-red-500/50 flex items-start gap-2.5 text-left text-red-200 shadow-[0_0_15px_rgba(239,68,68,0.15)]"
              >
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="block text-[10px] font-sans font-semibold uppercase text-red-400 tracking-wider">Error Occurred</span>
                  <p className="text-xs font-sans leading-relaxed font-light mt-0.5">{error}</p>
                </div>
              </motion.div>
            )}

            {/* Success Notification Banner */}
            {successMessage && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3 rounded-lg bg-emerald-950/70 border border-emerald-500/50 flex items-start gap-2.5 text-left text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="block text-[10px] font-sans font-semibold uppercase text-emerald-400 tracking-wider">Access Granted</span>
                  <p className="text-xs font-sans leading-relaxed font-light mt-0.5">{successMessage}</p>
                </div>
              </motion.div>
            )}

            {/* Inputs Block */}
            <div className="space-y-3.5">
              
              {/* Email Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-sans font-semibold uppercase text-slate-400 tracking-widest pl-1">
                  Email
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@domain.com"
                    autoComplete="email"
                    disabled={loading || googleLoading}
                    className="w-full pl-10 pr-4 py-2 text-xs font-sans rounded-xl bg-slate-950/80 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-white focus:ring-1 focus:ring-white/50 focus:shadow-[0_0_12px_rgba(255,255,255,0.25)] transition-all disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-sans font-semibold uppercase text-slate-400 tracking-widest pl-1">
                  Password
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    disabled={loading || googleLoading}
                    className="w-full pl-10 pr-4 py-2 text-xs font-sans rounded-xl bg-slate-950/80 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-white focus:ring-1 focus:ring-white/50 focus:shadow-[0_0_12px_rgba(255,255,255,0.25)] transition-all disabled:opacity-50"
                  />
                </div>
              </div>

            </div>

            {/* Email Submit Button */}
            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full mt-2 py-3 rounded-xl font-sans text-xs font-semibold tracking-widest uppercase cursor-pointer select-none bg-gradient-to-r from-slate-200/20 via-white/10 to-slate-400/25 text-white border border-slate-500/50 shadow-[0_0_15px_rgba(255,255,255,0.12)] hover:from-white hover:via-slate-100 hover:to-slate-300 hover:text-stone-950 hover:border-white hover:shadow-[0_0_25px_rgba(255,255,255,0.38)] active:scale-95 duration-150 transition-all flex items-center justify-center gap-2 text-center"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" /> Processing
                </>
              ) : (
                isSignUp ? "Sign Up" : "Log In"
              )}
            </button>

          </form>

          {/* Toggle Link Section */}
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
                setSuccessMessage(null);
              }}
              disabled={loading || googleLoading}
              className="font-sans text-[10px] uppercase tracking-wider text-slate-400 hover:text-white cursor-pointer underline underline-offset-4 decoration-dotted transition-colors disabled:opacity-40"
            >
              {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
            </button>
          </div>

          {/* Spacer with 'OR' label */}
          <div className="relative flex items-center justify-center my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800/80" />
            </div>
            <div className="relative px-3.5 bg-[#091122]/90 border border-slate-800 rounded-full py-0.5">
              <span className="text-[10px] font-sans text-slate-500 font-semibold uppercase tracking-widest">
                Or sign in with
              </span>
            </div>
          </div>

          {/* Google Sign-in Option */}
          <div className="flex flex-col">
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={loading || googleLoading}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white text-gray-800 font-sans text-xs font-bold border border-gray-300 hover:bg-gray-100 hover:border-gray-400 active:scale-95 duration-150 transition-all cursor-pointer shadow-lg hover:shadow-amber-500/10"
              title="Authenticate standard Google connection"
            >
              {googleLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
                  <span className="font-sans text-xs tracking-wider uppercase text-gray-700">Connecting...</span>
                </>
              ) : (
                <>
                  <svg className="w-4.5 h-4.5 shadow-sm" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12 5.04c1.64 0 3.12.56 4.28 1.67l3.2-3.2C17.52 1.58 14.94 1 12 1 7.37 1 3.4 3.66 1.45 7.56l3.8 2.94C6.2 7.74 8.87 5.04 12 5.04z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.49 12.27c0-.81-.07-1.59-.2-2.34H12v4.43h6.44c-.28 1.47-1.11 2.71-2.36 3.56l3.66 2.84c2.14-1.97 3.39-4.87 3.39-8.49z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.25 14.5c-.24-.72-.38-1.5-.38-2.31 0-.81.14-1.59.38-2.31L1.45 6.94C.52 8.78 0 10.83 0 13s.52 4.22 1.45 6.06l3.8-2.56z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.66-2.84c-1.01.68-2.31 1.09-3.9 1.09-3.13 0-5.8-2.7-6.75-5.46l-3.8 2.94C3.4 20.34 7.37 23 12 23z"
                    />
                  </svg>
                  <span className="tracking-wide text-gray-900 font-semibold">Sign in with Google</span>
                </>
              )}
            </button>
          </div>

          
        </div>
      </motion.div>

    </div>
  );
};

export default AuthView;
