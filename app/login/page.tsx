'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { startAuthentication } from '@simplewebauthn/browser';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [faceIdAvailable, setFaceIdAvailable] = useState(false);
  const [faceIdLoading, setFaceIdLoading] = useState(false);
  const router = useRouter();
  const faceIdTriggered = useRef(false);

  async function handleFaceId() {
    setError('');
    setFaceIdLoading(true);

    const optRes = await fetch('/api/auth/webauthn/auth-options', { method: 'POST' });
    if (!optRes.ok) {
      setFaceIdLoading(false);
      return;
    }

    const { options, challengeId } = await optRes.json();
    let credential;
    try {
      credential = await startAuthentication({ optionsJSON: options });
    } catch {
      setFaceIdLoading(false);
      return;
    }

    const verifyRes = await fetch('/api/auth/webauthn/authenticate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId, credential }),
    });

    if (verifyRes.ok) {
      router.push('/');
    } else {
      setError('Face ID authentication failed');
    }
    setFaceIdLoading(false);
  }

  useEffect(() => {
    if (faceIdTriggered.current) return;
    faceIdTriggered.current = true;

    // Check if WebAuthn credentials exist, then auto-trigger Face ID
    fetch('/api/auth/webauthn/status')
      .then(r => r.json())
      .then(data => {
        if (data.available) {
          setFaceIdAvailable(true);
          handleFaceId();
        }
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (res.ok) {
      // Check if Face ID is already set up
      const statusRes = await fetch('/api/auth/webauthn/status');
      const statusData = await statusRes.json();

      if (!statusData.available && window.PublicKeyCredential) {
        // Offer to set up Face ID
        const platformAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (platformAvailable) {
          setLoading(false);
          const setup = confirm('Enable Face ID login so you stay signed in?');
          if (setup) {
            await setupFaceId();
          }
        }
      }

      router.push('/');
    } else {
      const data = await res.json();
      setError(data.error || 'Login failed');
      setLoading(false);
    }
  }

  async function setupFaceId() {
    const { startRegistration } = await import('@simplewebauthn/browser');

    // Initialize the WebAuthn tables
    await fetch('/api/auth/webauthn/init', { method: 'POST' });

    const optRes = await fetch('/api/auth/webauthn/register-options', { method: 'POST' });
    if (!optRes.ok) return;

    const { options, challengeId } = await optRes.json();
    let credential;
    try {
      credential = await startRegistration({ optionsJSON: options });
    } catch {
      return;
    }

    await fetch('/api/auth/webauthn/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId, credential }),
    });
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-background)',
    }}>
      <form onSubmit={handleSubmit} style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '12px',
        padding: '2rem',
        width: '100%',
        maxWidth: '360px',
        margin: '0 1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}>
        <h1 style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          color: 'var(--color-text)',
          textAlign: 'center',
          margin: 0,
        }}>
          Spanish Flashcards
        </h1>

        {error && (
          <div style={{
            background: 'var(--color-error-light)',
            color: 'var(--color-error)',
            padding: '0.75rem',
            borderRadius: '8px',
            fontSize: '0.875rem',
          }}>
            {error}
          </div>
        )}

        {faceIdAvailable && (
          <button
            type="button"
            onClick={handleFaceId}
            disabled={faceIdLoading}
            style={{
              padding: '0.75rem',
              borderRadius: '8px',
              border: '1px solid var(--color-border)',
              background: 'var(--color-background)',
              color: 'var(--color-text)',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: faceIdLoading ? 'not-allowed' : 'pointer',
              opacity: faceIdLoading ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="2"/>
              <rect x="14" y="3" width="7" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="2"/>
              <rect x="3" y="14" width="7" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="2"/>
              <rect x="14" y="14" width="7" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="2"/>
            </svg>
            {faceIdLoading ? 'Verifying...' : 'Sign in with Face ID'}
          </button>
        )}

        {faceIdAvailable && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            color: 'var(--color-text-secondary)',
            fontSize: '0.8rem',
          }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
            or
            <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
          </div>
        )}

        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          required
          autoFocus={!faceIdAvailable}
          style={{
            padding: '0.75rem',
            borderRadius: '8px',
            border: '1px solid var(--color-border)',
            background: 'var(--color-background)',
            color: 'var(--color-text)',
            fontSize: '1rem',
          }}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          style={{
            padding: '0.75rem',
            borderRadius: '8px',
            border: '1px solid var(--color-border)',
            background: 'var(--color-background)',
            color: 'var(--color-text)',
            fontSize: '1rem',
          }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '0.75rem',
            borderRadius: '8px',
            border: 'none',
            background: 'var(--color-primary)',
            color: 'white',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
