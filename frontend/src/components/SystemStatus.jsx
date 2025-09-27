import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Settings, UserCircle2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase, isSupabaseConfigured } from '../services/supabaseClient.js'
import { api } from '../services/api.js'
import appInfo from '../../package.json?json'
import '../styles/SystemStatus.css'

const CHECK_INTERVAL = 3 * 60 * 1000 // 3 minutos

function useSystemHealth() {
  const [status, setStatus] = useState({ state: 'unknown', message: 'Verificando...', timestamp: null })

  const check = useCallback(async () => {
    try {
      await api.health()
    } catch (err) {
      console.warn('Falha ao verificar status da API', err)
      setStatus({ state: 'offline', message: err.message || 'API indisponivel', timestamp: new Date() })
      return
    }

    let message = 'API online'

    if (isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.from('materiais').select('id', { count: 'exact', head: true }).limit(1)
        if (error) {
          throw error
        }
        message = 'API e Supabase online'
      } catch (err) {
        console.warn('Falha ao verificar status do Supabase', err)
        message = `API online; Supabase indisponivel: ${err.message || 'Offline'}`
      }
    }

    setStatus({ state: 'online', message, timestamp: new Date() })
  }, [])

  useEffect(() => {
    check()
    const id = window.setInterval(check, CHECK_INTERVAL)
    return () => window.clearInterval(id)
  }, [check])

  return { ...status, refresh: check }
}

function ChangePasswordModal({ open, onClose, user }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(null)

  useEffect(() => {
    if (!open) {
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setFeedback(null)
    }
  }, [open])

  if (!open) {
    return null
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFeedback(null)

    if (!isSupabaseConfigured() || !supabase) {
      setFeedback({ type: 'error', message: 'Supabase nao configurado.' })
      return
    }

    if (!form.newPassword || form.newPassword.length < 8) {
      setFeedback({ type: 'error', message: 'A nova senha deve ter pelo menos 8 caracteres.' })
      return
    }

    if (form.newPassword !== form.confirmPassword) {
      setFeedback({ type: 'error', message: 'A confirmacao precisa ser igual a nova senha.' })
      return
    }

    if (!user?.email) {
      setFeedback({ type: 'error', message: 'Email do usuario nao encontrado para validar senha.' })
      return
    }

    setIsSubmitting(true)
    try {
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: form.currentPassword,
      })

      if (reauthError) {
        throw new Error('Senha atual incorreta.')
      }

      const { error } = await supabase.auth.updateUser({ password: form.newPassword })
      if (error) {
        throw error
      }

      setFeedback({ type: 'success', message: 'Senha atualizada com sucesso.' })
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Nao foi possivel atualizar a senha.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="system-status__overlay" role="dialog" aria-modal="true" aria-labelledby="change-password-title">
      <div className="system-status__modal">
        <header className="system-status__modal-header">
          <h2 id="change-password-title">Trocar senha</h2>
          <button type="button" className="system-status__icon-button" onClick={onClose} aria-label="Fechar">
            x
          </button>
        </header>
        <form className="system-status__form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Senha atual</span>
            <input
              type="password"
              name="currentPassword"
              value={form.currentPassword}
              onChange={handleChange}
              required
              autoComplete="current-password"
            />
          </label>
          <label className="field">
            <span>Nova senha</span>
            <input
              type="password"
              name="newPassword"
              value={form.newPassword}
              onChange={handleChange}
              required
              autoComplete="new-password"
            />
          </label>
          <label className="field">
            <span>Confirmar nova senha</span>
            <input
              type="password"
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              required
              autoComplete="new-password"
            />
          </label>

          {feedback ? (
            <p className={`system-status__feedback system-status__feedback--${feedback.type}`}>
              {feedback.message}
            </p>
          ) : null}

          <div className="system-status__actions">
            <button type="button" className="button button--ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="button button--primary" disabled={isSubmitting}>
              {isSubmitting ? 'Atualizando...' : 'Salvar senha'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function SystemStatus({ className = '' }) {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const health = useSystemHealth()
  const { state, message } = health
  const [menuOpen, setMenuOpen] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const menuRef = useRef(null)

  const version = useMemo(() => {
    const value = import.meta.env.VITE_APP_VERSION || appInfo.version || '0.0.0'
    return value.startsWith('v') ? value : `v${value}`
  }, [])

  const indicatorClass = state === 'online' ? 'system-status__dot--online' : state === 'offline' ? 'system-status__dot--offline' : 'system-status__dot--unknown'
  const statusLabel = state === 'online' ? 'Online' : state === 'offline' ? 'Offline' : 'Desconhecido'
  const indicatorTitle = message ? `${statusLabel} - ${message}` : statusLabel

  const displayName = user?.name || user?.metadata?.nome || user?.email || 'Usuario'

  useEffect(() => {
    if (!menuOpen) {
      return () => {}
    }
    const handler = (event) => {
      if (!menuRef.current || menuRef.current.contains(event.target)) {
        return
      }
      setMenuOpen(false)
    }
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [menuOpen])

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const handleOpenPasswordModal = () => {
    setMenuOpen(false)
    setShowPasswordModal(true)
  }

  return (
    <div className={`system-status ${className}`}>
      <section className="system-status__section" aria-label="Status do sistema">
        <header className="system-status__header">Status do sistema</header>
        <dl>
          <div className="system-status__row">
            <dt>Sistema</dt>
            <dd title={indicatorTitle}>
              <span className={`system-status__dot ${indicatorClass}`} aria-hidden="true" />
              <span>{statusLabel}</span>
            </dd>
          </div>
          <div className="system-status__row">
            <dt>Versao</dt>
            <dd>{version}</dd>
          </div>
        </dl>
      </section>

      <section className="system-status__user" aria-label="Usuario logado">
        <div className="system-status__user-info">
          <div className="system-status__avatar" aria-hidden="true">
            <UserCircle2 size={32} />
          </div>
          <div>
            <p className="system-status__user-name">{displayName}</p>
            {user?.email ? <p className="system-status__user-meta">{user.email}</p> : null}
          </div>
        </div>
        <div className="system-status__user-actions" ref={menuRef}>
          <button
            type="button"
            className="system-status__icon-button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-haspopup="true"
            aria-expanded={menuOpen}
            aria-label="Abrir configuracoes"
          >
            <Settings size={18} />
          </button>
          {menuOpen ? (
            <div className="system-status__menu" role="menu">
              <button type="button" role="menuitem" onClick={handleOpenPasswordModal}>
                Trocar senha
              </button>
              <button type="button" role="menuitem" onClick={handleLogout}>
                Sair
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <ChangePasswordModal open={showPasswordModal} onClose={() => setShowPasswordModal(false)} user={user} />
    </div>
  )
}
