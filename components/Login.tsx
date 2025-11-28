import React from 'react';
import { User } from 'lucide-react';
import { authService } from '../services/authService';

interface LoginProps {
  onGuestLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onGuestLogin }) => {

  const handleSsoLogin = () => {
    authService.initiateLoginPopup();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="bg-indigo-600 p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-4 overflow-hidden">
            <img src="/logo.png" alt="SendSecure AI" className="w-12 h-12 object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">SendSecure AI</h1>
          <p className="text-indigo-100 text-sm">Secure, ephemeral file sharing for teams.</p>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-slate-800">Welcome back</h2>
            <p className="text-sm text-slate-500 mt-1">Please sign in to your account</p>
          </div>

          <div className="space-y-3">
            <button 
              onClick={handleSsoLogin}
              className="w-full flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-xl font-medium transition-all shadow-md hover:shadow-lg"
            >
              <div className="bg-white p-1 rounded overflow-hidden">
                 <img src="/logo.png" alt="" className="w-4 h-4 object-contain" />
              </div>
              Sign in with HunyDev
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-400">Or</span>
              </div>
            </div>

            <button 
              onClick={onGuestLogin}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 p-3 rounded-xl font-medium transition-colors"
            >
              <User className="w-4 h-4 text-slate-400" />
              Continue as Guest
            </button>
          </div>

          <div className="text-center text-xs text-slate-400 mt-6">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;