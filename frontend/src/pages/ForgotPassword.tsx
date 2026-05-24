import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Diamond, ArrowLeft, Mail } from 'lucide-react'
import Starfield from '../components/Starfield'
import { forgotPassword } from '../services/password.service'
import { extractErrorMessage } from '../services/error'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await forgotPassword(email)
      setSubmitted(true)
    } catch (err: unknown) {
      setError(extractErrorMessage(err, 'Something went wrong. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center px-4 relative overflow-hidden">
      <Starfield />
      <Link to="/login"
        className="absolute top-4 left-4 z-20 flex items-center gap-1.5 nav-label text-[0.6rem] text-ice/40 hover:text-gold transition-colors">
        <ArrowLeft size={12} />
        BACK TO LOGIN
      </Link>

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(201,168,76,0.06) 0%, transparent 70%)' }} />

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }} className="relative z-10 w-full max-w-md">

        <div className="text-center mb-10">
          <div className="signal-badge inline-flex mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-signal animate-pulse-slow" />
            <Diamond size={8} className="text-gold" />
            <span className="nav-label text-[0.6rem] text-ice/60">PASSWORD RECOVERY</span>
          </div>
          <h1 className="font-display font-black text-4xl text-ice-gradient mb-2">URIS</h1>
          <div className="gold-rule w-20 mx-auto my-3" />
          <p className="nav-label text-[0.65rem] text-ice/40 tracking-widest">FORGOT YOUR PASSWORD</p>
        </div>

        <div className="glass-card rounded-sm p-8">
          {submitted ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="text-center py-4">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
                style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.3)' }}>
                <Mail size={22} className="text-gold" />
              </motion.div>
              <h2 className="font-display font-black text-xl text-ice-gradient mb-3">Check Your Email</h2>
              <div className="gold-rule w-12 mx-auto mb-4" />
              <p className="font-body text-sm text-ice/50 mb-6">
                If an account with that email exists, a reset link has been sent.
              </p>
              <Link to="/login">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  className="btn-outline px-8 py-3 rounded-sm text-sm">
                  BACK TO LOGIN
                </motion.button>
              </Link>
            </motion.div>
          ) : (
            <>
              <div className="mb-6">
                <p className="nav-label text-[0.65rem] text-ice/40 text-center tracking-widest">ENTER YOUR EMAIL ADDRESS</p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="nav-label text-[0.6rem] text-gold/60 block mb-2">EMAIL ADDRESS</label>
                  <input
                    type="email"
                    className="uris-input"
                    placeholder="you@company.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>

                {error && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="font-body text-sm text-red-400/80 text-center py-2 rounded-sm"
                    style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
                    {error}
                  </motion.p>
                )}

                <motion.button type="submit" disabled={loading}
                  whileHover={!loading ? { scale: 1.02, boxShadow: '0 8px 28px rgba(201,168,76,0.3)' } : {}}
                  whileTap={!loading ? { scale: 0.98 } : {}}
                  className="btn-gold w-full py-3 rounded-sm mt-2 disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                  {loading ? 'SENDING...' : 'SEND RESET LINK'}
                </motion.button>
              </form>

              <div className="mt-6 text-center">
                <p className="font-body text-sm text-ice/30">
                  Remember your password?{' '}
                  <Link to="/login" className="text-gold/70 hover:text-gold transition-colors no-underline">Sign in</Link>
                </p>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}
