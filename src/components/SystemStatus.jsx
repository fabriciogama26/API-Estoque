import { useCallback, useEffect, useMemo, useState } from 'react'
import { LogOut, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase, isSupabaseConfigured } from '../services/supabaseClient.js'
import { dataClient as api } from '../services/dataClient.js'
import { isLocalMode } from '../config/runtime.js'
import { usePermissions } from '../context/PermissionsContext.jsx'
import { useErrorLogger } from '../hooks/useErrorLogger.js'
import appInfo from '../../package.json?json'
import '../styles/SystemStatus.css'

const CHECK_INTERVAL = 3 * 60 * 1000 // 3 minutos

function useSystemHealth(reportError) {
  const [status, setStatus] = useState({
    state: 'unknown',
    message: 'Verificando...',
    timestamp: null,
  })

  const check = useCallback(async () => {
    try {
      await api.health()
    } catch (err) {
      reportError?.(err, { stage: 'api_health' })
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
        reportError?.(err, { stage: 'supabase_health' })
        message = `API online; Supabase indisponivel: ${err.message || 'Offline'}`
      }
    }

    setStatus({
      state: 'online',
      message,
      timestamp: new Date(),
    })
  }, [reportError])

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
  const { credentialLabel, canAccessPath } = usePermissions()
  const [userProfile, setUserProfile] = useState(null)
  const { reportError } = useErrorLogger('system_status')
  const health = useSystemHealth(reportError)
  const { state, message } = health
  const settingsDisabled = !canAccessPath('/configuracoes')

  useEffect(() => {
    if (!user?.id || isLocalMode || !supabase) {
      setUserProfile(null)
      return
    }

    let active = true
    const loadProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('app_users')
          .select('display_name, username, email')
          .eq('id', user.id)
          .maybeSingle()

        if (!active) {
          return
        }

        if (error && error.code !== 'PGRST116') {
          throw error
        }

        let resolvedProfile = data || null

        if (!resolvedProfile) {
          const candidates = []
          if (user?.metadata?.username) {
            candidates.push(String(user.metadata.username).trim())
          }
          if (user?.email) {
            const email = String(user.email).trim()
            candidates.push(email)
            if (email.includes('@')) {
              candidates.push(email.split('@')[0])
            }
          }

          for (const candidate of candidates.filter(Boolean)) {
            const identifier = candidate.trim()
            if (!identifier) {
              continue
            }

            const fetchProfile = async (column) => {
              const { data: fallbackProfile, error: fallbackError } = await supabase
                .from('app_users')
                .select('display_name, username, email')
                .ilike(column, identifier)
                .maybeSingle()

              if (fallbackError && fallbackError.code !== 'PGRST116') {
                throw fallbackError
              }

              return fallbackProfile || null
            }

            resolvedProfile = (await fetchProfile('username')) || (await fetchProfile('email'))
            if (resolvedProfile) {
              break
            }
          }
        }

        setUserProfile(resolvedProfile)
      } catch (err) {
        reportError(err, { stage: 'load_user_profile', userId: user?.id })
        if (active) {
          setUserProfile(null)
        }
      }
    }

    loadProfile()

    return () => {
      active = false
    }
  }, [reportError, user?.id])

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

  const username = userProfile?.username || 'Usuario'

  const displayName = userProfile?.display_name || 'Usuario'


  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const handleOpenSettings = () => {
    if (!settingsDisabled) {
      navigate('/configuracoes')
    }
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
            <dt>Versão</dt>
            <dd>{version}</dd>
          </div>
        </dl>
      </section>

      <section className="system-status__user" aria-label="Usuário logado">
        <div className="system-status__identity">
          <p className="system-status__user-name" title={username}>
            {username}
          </p>
          <p className="system-status__user-role" title={displayName}>
            {displayName}
          </p>
        </div>
        <div className="system-status__actions" role="group" aria-label="Ações rápidas">
          <button
            type="button"
            className="system-status__icon-button"
            onClick={handleOpenSettings}
            aria-label="Abrir configurações"
            disabled={settingsDisabled}
            aria-disabled={settingsDisabled}
            title="Configurações desativadas"
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
