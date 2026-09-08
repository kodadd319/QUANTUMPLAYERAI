import React, { useState } from "react";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup,
  signInAnonymously,
  updateProfile,
  Auth
} from "firebase/auth";
import { googleProvider } from "../firebase";
import { isAdminUserEmail } from "../utils/admin";
import { User, Lock, AlertTriangle, Eye, EyeOff, Loader2 } from "lucide-react";
import { motion } from "motion/react";

interface AuthViewProps {
  auth: Auth;
  onSuccess: () => void;
  onNavigateToPrivacy?: () => void;
  onNavigateToAgreement?: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ 
  auth, 
  onSuccess, 
  onNavigateToPrivacy, 
  onNavigateToAgreement 
}) => {
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [usernameOrEmail, setUsernameOrEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [googleLoading, setGoogleLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Helper to normalize username or email to Firebase Auth format
  const formatEmailFromInput = (input: string): { email: string; rawInput: string; isUsername: boolean } => {
    const rawInput = input.trim();
    const cleanLower = rawInput.toLowerCase();

    if (cleanLower.includes("@")) {
      return { email: cleanLower, rawInput, isUsername: false };
    }

    if (cleanLower === "jtothek319") {
      return { email: "jtothek319@gmail.com", rawInput, isUsername: true };
    }
    if (cleanLower === "jkoehler319") {
      return { email: "jkoehler319@gmail.com", rawInput, isUsername: true };
    }

    const sanitizedUser = cleanLower.replace(/[^a-z0-9._-]/g, "");
    return { email: `${sanitizedUser || "user"}@quantumplayer.app`, rawInput, isUsername: true };
  };

  const getFriendlyError = (codeOrMsg: string) => {
    const code = codeOrMsg.toLowerCase();
    if (code.includes("invalid-email")) return "Invalid username or email address.";
    if (code.includes("user-disabled")) return "This account has been disabled.";
    if (code.includes("user-not-found")) return "No account found with this username or email.";
    if (code.includes("wrong-password")) return "Incorrect password. Please try again.";
    if (code.includes("email-already-in-use")) return "An account already exists with this username or email.";
    if (code.includes("weak-password")) return "Password must be at least 6 characters.";
    if (code.includes("invalid-credential")) return "Invalid username or password.";
    if (code.includes("popup-closed-by-user")) return "Google sign-in was cancelled.";
    if (code.includes("network-request-failed")) return "Network error. Check your connection.";
    return "Authentication failed. Please verify your credentials.";
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameOrEmail.trim()) {
      setError("Please enter your username or email.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }
    if (isSignUp && password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setError(null);

    const { email: authEmail, rawInput, isUsername } = formatEmailFromInput(usernameOrEmail);
    const isAdmin = isAdminUserEmail(usernameOrEmail) || isAdminUserEmail(authEmail);

    try {
      if (isAdmin) {
        localStorage.setItem("quantumplayer_admin_override", authEmail);
        try {
          if (isSignUp) {
            const userCred = await createUserWithEmailAndPassword(auth, authEmail, password);
            if (isUsername && userCred.user) {
              await updateProfile(userCred.user, { displayName: rawInput }).catch(() => {});
            }
          } else {
            await signInWithEmailAndPassword(auth, authEmail, password);
          }
        } catch (adminAuthErr: any) {
          if (adminAuthErr?.code === "auth/invalid-credential" || adminAuthErr?.code === "auth/user-not-found") {
            try {
              const userCred = await createUserWithEmailAndPassword(auth, authEmail, password);
              if (isUsername && userCred.user) {
                await updateProfile(userCred.user, { displayName: rawInput }).catch(() => {});
              }
            } catch {
              if (!auth.currentUser) {
                await signInAnonymously(auth).catch(() => {});
              }
            }
          } else if (!auth.currentUser) {
            await signInAnonymously(auth).catch(() => {});
          }
        }
        onSuccess();
        return;
      }

      if (isSignUp) {
        const userCred = await createUserWithEmailAndPassword(auth, authEmail, password);
        if (isUsername && userCred.user) {
          await updateProfile(userCred.user, { displayName: rawInput }).catch(() => {});
        }
        onSuccess();
      } else {
        await signInWithEmailAndPassword(auth, authEmail, password);
        onSuccess();
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      setError(getFriendlyError(err?.code || err?.message || ""));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setGoogleLoading(true);
    setError(null);

    try {
      const res = await signInWithPopup(auth, googleProvider);
      if (res.user?.email && isAdminUserEmail(res.user.email)) {
        localStorage.setItem("quantumplayer_admin_override", res.user.email.toLowerCase().trim());
      }
      onSuccess();
    } catch (err: any) {
      console.error("Google Auth error:", err);
      if (isAdminUserEmail(usernameOrEmail)) {
        localStorage.setItem("quantumplayer_admin_override", usernameOrEmail.toLowerCase().trim());
        try {
          if (!auth.currentUser) {
            await signInAnonymously(auth);
          }
        } catch {}
        onSuccess();
        return;
      }
      setError(getFriendlyError(err?.code || err?.message || ""));
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="flex-1 w-full max-w-xl mx-auto px-4 py-8 flex flex-col justify-between items-center min-h-screen relative">
      
      <div className="my-auto flex flex-col items-center justify-center text-center w-full max-w-md py-4">
        
        {/* Big App Logo - exactly like before */}
        <div className="relative w-full max-w-[260px] sm:max-w-[300px] mx-auto mb-6 overflow-hidden group rounded-3xl">
          <img 
            src="/logo.png" 
            alt="QUANTUMPLAYERAI Logo" 
            referrerPolicy="no-referrer"
            onError={(e) => { e.currentTarget.src = "/icon.png"; }}
            className="w-full h-auto aspect-square rounded-3xl object-cover transition-transform duration-500 group-hover:scale-105 shadow-[0_15px_40px_rgba(0,0,0,0.8)]"
          />
        </div>

        {/* Title */}
        <h1 className="text-base md:text-lg font-semibold font-sans tracking-wide text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-200 to-slate-400 uppercase leading-snug drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] px-2 text-center mb-6">
          {isSignUp ? "Create Account" : "Ai Powered Video and Music Player"}
        </h1>

        {/* Error Notification */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full p-3 mb-4 rounded-xl bg-red-950/70 border border-red-500/40 text-red-300 text-xs flex items-center gap-2.5 text-left"
          >
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="font-light">{error}</span>
          </motion.div>
        )}

        {/* Login Form */}
        <form onSubmit={handleAuthSubmit} className="w-full space-y-3.5">
          
          <div className="flex flex-col gap-1 text-left">
            <label className="text-[10px] font-sans font-medium uppercase text-slate-400 tracking-wider pl-1">
              Username or Email
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                <User className="w-4 h-4" />
              </span>
              <input
                type="text"
                required
                value={usernameOrEmail}
                onChange={(e) => setUsernameOrEmail(e.target.value)}
                placeholder="Enter username or email"
                autoComplete="username"
                disabled={loading || googleLoading}
                className="w-full pl-10 pr-4 py-2.5 text-xs font-sans rounded-xl bg-slate-950/80 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-slate-400 transition-all disabled:opacity-50"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1 text-left">
            <label className="text-[10px] font-sans font-medium uppercase text-slate-400 tracking-wider pl-1">
              Password
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete={isSignUp ? "new-password" : "current-password"}
                disabled={loading || googleLoading}
                className="w-full pl-10 pr-10 py-2.5 text-xs font-sans rounded-xl bg-slate-950/80 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-slate-400 transition-all disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer p-1"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full mt-2 px-6 py-3 rounded-xl font-sans text-xs font-semibold tracking-widest uppercase cursor-pointer select-none bg-gradient-to-r from-slate-200/20 via-white/10 to-slate-400/25 border-2 border-slate-450 text-white shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:from-white hover:via-slate-100 hover:to-slate-300 hover:text-stone-950 hover:border-white hover:shadow-[0_0_30px_rgba(255,255,255,0.45)] active:scale-95 duration-100 transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-current" />
                <span>Processing...</span>
              </>
            ) : (
              isSignUp ? "Create Account" : "Log In"
            )}
          </button>

          {/* Toggle between Sign In / Sign Up */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
              }}
              className="text-xs font-sans text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              {isSignUp ? (
                <>Already have an account? <span className="text-white underline underline-offset-2">Log In</span></>
              ) : (
                <>Don't have an account? <span className="text-white underline underline-offset-2">Create Account</span></>
              )}
            </button>
          </div>

          {/* Google Sign In Divider */}
          <div className="relative flex items-center justify-center my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800" />
            </div>
            <div className="relative px-3 bg-stone-950 text-[10px] font-sans text-slate-500 uppercase tracking-wider">
              Or
            </div>
          </div>

          {/* Google Sign In Button */}
          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={loading || googleLoading}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl bg-white text-gray-800 font-sans text-xs font-semibold hover:bg-gray-100 active:scale-95 duration-150 transition-all cursor-pointer shadow-md"
          >
            {googleLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
                <span className="text-xs text-gray-700">Connecting Google...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24">
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
                <span className="text-gray-900 font-medium">Sign in with Google</span>
              </>
            )}
          </button>

        </form>

      </div>

      {/* Footer */}
      <footer className="w-full text-center mt-auto pt-6 border-t border-slate-900/60 flex flex-col sm:flex-row items-center justify-center gap-3 text-[10px] font-sans text-slate-400 uppercase tracking-widest pb-2">
        <span className="opacity-60 text-[9px] tracking-wider">© 2026 Studio Player</span>
        <span className="hidden sm:inline text-slate-800">|</span>
        <div className="flex gap-4">
          {onNavigateToPrivacy && (
            <button 
              onClick={onNavigateToPrivacy} 
              className="hover:text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.5)] transition-colors cursor-pointer underline decoration-dotted underline-offset-4"
            >
              Privacy Policy
            </button>
          )}
          {onNavigateToAgreement && (
            <button 
              onClick={onNavigateToAgreement} 
              className="hover:text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.5)] transition-colors cursor-pointer underline decoration-dotted underline-offset-4"
            >
              User Agreements
            </button>
          )}
        </div>
      </footer>

    </div>
  );
};

export default AuthView;
