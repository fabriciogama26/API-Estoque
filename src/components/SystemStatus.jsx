import { useCallback, useEffect, useMemo, useState } from 'react'
import { LogOut, Settings, UserCircle2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase, isSupabaseConfigured } from '../services/supabaseClient.js'
import { dataClient as api } from '../services/dataClient.js'
import { isLocalMode } from '../config/runtime.js'
import appInfo from '../../package.json?json'
import '../styles/SystemStatus.css'

const CHECK_INTERVAL = 3 * 60 * 1000 // 3 minutos

function useSystemHealth() {
  const [status, setStatus] = useState({
    state: 'unknown',
    message: 'Verificando...',
    timestamp: null,
  })

  const check = useCallback(async () => {
    try {
      await api.health()
    } catch (err) {
      console.warn('Falha ao verificar status da API', err)
      setStatus({
        state: 'offline',
        message: err.message || 'API indisponivel',
        timestamp: new Date(),
      })
      return
    }

    let message = isLocalMode ? 'Modo local ativo (dados no navegador)' : 'API online'

    if (!isLocalMode && isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase
          .from('materiais')
          .select('id', { count: 'exact', head: true })
          .limit(1)
        if (error) {
          throw error
        }
        message = 'API e Supabase online'
      } catch (err) {
        console.warn('Falha ao verificar status do Supabase', err)
        message = `API online; Supabase indisponivel: ${err.message || 'Offline'}`
      }
    }

    setStatus({
      state: 'online',
      message,
      timestamp: new Date(),
    })
  }, [])

  useEffect(() => {
    check()
    const id = window.setInterval(check, CHECK_INTERVAL)
    return () => window.clearInterval(id)
  }, [check])

  return { ...status, refresh: check }
}

export function SystemStatus({ className = '' }) {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const health = useSystemHealth()
  const { state, message } = health

  const version = useMemo(() => {
    const value = import.meta.env.VITE_APP_VERSION || appInfo.version || '0.0.0'
    return value.startsWith('v') ? value : `v${value}`
  }, [])

  const indicatorClass =
    state === 'online'
      ? 'system-status__dot--online'
      : state === 'offline'
        ? 'system-status__dot--offline'
        : 'system-status__dot--unknown'
  const statusLabel =
    state === 'online' ? 'Online' : state === 'offline' ? 'Offline' : 'Desconhecido'
  const indicatorTitle = message ? `${statusLabel} - ${message}` : statusLabel

  const displayName = user?.name || user?.metadata?.nome || user?.email || 'Usuario'
  const roleLabel = user?.role || user?.metadata?.cargo || 'Admin'

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const handleOpenSettings = () => {
    navigate('/configuracoes')
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
          <div className="system-status__identity">
            <p className="system-status__user-name" title={displayName}>
              {displayName}
            </p>
            <p className="system-status__user-role" title={roleLabel}>
              {roleLabel}
            </p>
          </div>
        </div>
        <div className="system-status__actions" role="group" aria-label="Acoes rapidas">
          <button
            type="button"
            className="system-status__icon-button"
            onClick={handleOpenSettings}
            aria-label="Abrir configuracoes"
          >
            <Settings size={18} />
          </button>
          <button
            type="button"
            className="system-status__icon-button system-status__icon-button--logout"
            onClick={handleLogout}
            aria-label="Sair"
          >
            <LogOut size={18} />
          </button>
        </div>
      </section>
    </div>
  )
}
