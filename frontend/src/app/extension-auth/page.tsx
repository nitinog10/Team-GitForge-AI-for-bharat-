'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

/**
 * Extension Auth Bridge Page
 * 
 * This page is used by the DocuVerse VS Code extension to authenticate.
 * Flow: Extension opens this page → user logs in via normal GitHub OAuth →
 * this page displays the JWT token → user copies it into VS Code.
 */
export default function ExtensionAuthPage() {
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Check if user already has a token in localStorage
    const existingToken = localStorage.getItem('token');
    if (existingToken) {
      setToken(existingToken);
      setIsLoggedIn(true);
    }

    // Listen for storage changes (token set after OAuth callback)
    const handleStorage = () => {
      const t = localStorage.getItem('token');
      if (t) {
        setToken(t);
        setIsLoggedIn(true);
      }
    };

    window.addEventListener('storage', handleStorage);

    // Also poll for token (in case storage event doesn't fire in same tab)
    const interval = setInterval(() => {
      const t = localStorage.getItem('token');
      if (t && !token) {
        setToken(t);
        setIsLoggedIn(true);
      }
    }, 1000);

    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, [token]);

  const handleCopy = async () => {
    if (token) {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleLogin = () => {
    // Redirect to the normal auth page
    window.location.href = '/auth';
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0d1117 0%, #161b22 50%, #0d1117 100%)',
      fontFamily: "'DM Sans', -apple-system, sans-serif",
      padding: '20px',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          background: 'rgba(22, 27, 34, 0.8)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '40px',
          maxWidth: '520px',
          width: '100%',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🚀</div>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 700,
            color: '#ffffff',
            margin: '0 0 8px 0',
          }}>
            DocuVerse for VS Code
          </h1>
          <p style={{
            fontSize: '14px',
            color: 'rgba(255, 255, 255, 0.5)',
            margin: 0,
          }}>
            Connect your VS Code extension to DocuVerse AI
          </p>
        </div>

        {!isLoggedIn ? (
          /* Not logged in — show login button */
          <div style={{ textAlign: 'center' }}>
            <p style={{
              fontSize: '14px',
              color: 'rgba(255, 255, 255, 0.6)',
              marginBottom: '24px',
              lineHeight: 1.6,
            }}>
              Sign in with GitHub to generate your authentication token for the VS Code extension.
            </p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleLogin}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                width: '100%',
                padding: '14px 24px',
                background: '#238636',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              Sign in with GitHub
            </motion.button>
          </div>
        ) : (
          /* Logged in — show token */
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '20px',
              padding: '10px 14px',
              background: 'rgba(35, 134, 54, 0.15)',
              border: '1px solid rgba(35, 134, 54, 0.3)',
              borderRadius: '8px',
            }}>
              <span style={{ fontSize: '16px' }}>✅</span>
              <span style={{ fontSize: '13px', color: '#3fb950', fontWeight: 500 }}>
                Authenticated successfully
              </span>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                fontSize: '12px',
                color: 'rgba(255, 255, 255, 0.4)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                fontWeight: 600,
                display: 'block',
                marginBottom: '8px',
              }}>
                Your Auth Token
              </label>
              <div style={{
                position: 'relative',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                padding: '14px',
              }}>
                <code style={{
                  fontSize: '12px',
                  color: 'rgba(255, 255, 255, 0.7)',
                  wordBreak: 'break-all',
                  fontFamily: "'JetBrains Mono', monospace",
                  display: 'block',
                  maxHeight: '80px',
                  overflow: 'hidden',
                }}>
                  {token ? `${token.substring(0, 20)}${'•'.repeat(30)}${token.substring(token.length - 10)}` : ''}
                </code>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleCopy}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: '100%',
                padding: '14px 24px',
                background: copied ? '#238636' : '#ffd54f',
                color: copied ? '#ffffff' : '#000000',
                border: 'none',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'background 0.3s, color 0.3s',
              }}
            >
              {copied ? '✅ Copied! Paste in VS Code' : '📋 Copy Token to Clipboard'}
            </motion.button>

            <div style={{
              marginTop: '24px',
              padding: '16px',
              background: 'rgba(255, 213, 79, 0.08)',
              border: '1px solid rgba(255, 213, 79, 0.15)',
              borderRadius: '8px',
            }}>
              <p style={{
                fontSize: '13px',
                color: 'rgba(255, 255, 255, 0.6)',
                margin: 0,
                lineHeight: 1.6,
              }}>
                <strong style={{ color: '#ffd54f' }}>Next step:</strong> Go back to VS Code and paste this token into the input box. The extension will automatically verify and connect.
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{
          marginTop: '28px',
          paddingTop: '20px',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          textAlign: 'center',
        }}>
          <p style={{
            fontSize: '11px',
            color: 'rgba(255, 255, 255, 0.3)',
            margin: 0,
          }}>
            DocuVerse AI • Your token is stored securely in VS Code&apos;s SecretStorage
          </p>
        </div>
      </motion.div>
    </div>
  );
}
