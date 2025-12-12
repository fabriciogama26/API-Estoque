import { useCallback, useEffect, useMemo, useState } from 'react'
import { Settings as SettingsIcon, ShieldCheck, Shield, History as HistoryIcon, X } from 'lucide-react'
import { PageHeader } from '../components/PageHeader.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase, isSupabaseConfigured } from '../services/supabaseClient.js'
import { HelpButton } from '../components/Help/HelpButton.jsx'
import { usePermissions } from '../context/PermissionsContext.jsx'
import { CREDENTIAL_OPTIONS, PAGE_CATALOG, resolveAllowedPageIds, describeCredential } from '../config/permissions.js'
import { isLocalMode } from '../config/runtime.js'
import { useErrorLogger } from '../hooks/useErrorLogger.js'
import '../styles/ConfiguracoesPage.css'

// Sincroniza o status (ativo/inativo) com o auth.users via RPC (security definer no Supabase)
async function syncAuthUserBan(userId, isActive) {
  if (!userId || !supabase) {
    return
  }
  const { error } = await supabase.rpc('sync_user_ban_with_status', {
    p_user_id: userId,
    p_active: isActive,
  })
  if (error) {
    throw error
  }
}

export function ConfiguracoesPage() {
  const { user } = useAuth()

  return (
    <div className="stack config-page">
      <PageHeader
        icon={<SettingsIcon size={28} />}
        title="Configurações"
        subtitle="Gerencie sua conta e ajustes pessoais."
        actions={<HelpButton topic="configuracoes" />}
      />

      <PermissionsSection currentUser={user} />
      <AdminResetPasswordSection />
    </div>
  )
}

function PermissionsSection({ currentUser }) {
  const { isAdmin, credential, allowedPageIds, refresh } = usePermissions()
  const { reportError } = useErrorLogger('configuracoes_permissoes')
  const [users, setUsers] = useState([])
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [draftCredential, setDraftCredential] = useState('')
  const [draftPages, setDraftPages] = useState([])
  const [isActive, setIsActive] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState(null)
  const [historyItems, setHistoryItems] = useState([])

  const pageOptions = useMemo(
    () => PAGE_CATALOG.filter((page) => !['no-access', 'configuracoes'].includes(page.id)),
    []
  )
  const selectedUser = useMemo(
    () => users.find((item) => item.id === selectedUserId) || null,
    [selectedUserId, users]
  )

  const appliedPages = draftPages.length
    ? draftPages
    : resolveAllowedPageIds(draftCredential || selectedUser?.credential || credential)

  const loadUsers = useCallback(async () => {
    if (!isAdmin) {
      setUsers([])
      setSelectedUserId(null)
      return
    }

    const addFallbackUser = (lista, allowMaster = false) => {
      if (currentUser?.id) {
        const cred = (currentUser.metadata?.credential || currentUser.role || 'admin').toLowerCase()
        if (cred === 'master' && !allowMaster) {
          return
        }
        lista.push({
          id: currentUser.id,
          display_name: currentUser.name || currentUser.metadata?.nome || currentUser.metadata?.username,
          username: currentUser.metadata?.username || currentUser.email || currentUser.id,
          email: currentUser.email || '',
          credential: cred,
          page_permissions: currentUser.metadata?.page_permissions || [],
          ativo: true,
        })
      }
    }

    // Se Supabase nao estiver configurado ou estamos em modo local, usa fallback do usuario atual
    if (isLocalMode || !isSupabaseConfigured() || !supabase) {
      const listaFallback = []
      // Em modo local ou sem Supabase, permite master apenas para nao travar a tela
      addFallbackUser(listaFallback, true)
      setUsers(listaFallback)
      if (!selectedUserId && listaFallback.length) {
        setSelectedUserId(listaFallback[0].id)
      }
      return
    }

    setIsLoading(true)
    setFeedback(null)
    try {
      const { data, error } = await supabase
        .from('app_users')
        .select('id, display_name, username, email, credential, page_permissions, ativo')
        .order('display_name', { ascending: true })
      if (error) {
        throw error
      }
      const lista = (data || []).filter((usuario) => {
        const cred = (usuario.credential || '').toLowerCase()
        return cred !== 'master'
      })
      if (!lista.length) {
        addFallbackUser(lista, true)
      }
      setUsers(lista)
      if (!selectedUserId && lista.length) {
        setSelectedUserId(lista[0].id)
      }
    } catch (err) {
      const listaFallback = []
      addFallbackUser(listaFallback)
      setUsers(listaFallback)
      if (!selectedUserId && listaFallback.length) {
        setSelectedUserId(listaFallback[0].id)
      }
      setFeedback({ type: 'error', message: err.message || 'Falha ao carregar usuarios.' })
    } finally {
      setIsLoading(false)
    }
  }, [isAdmin, selectedUserId, currentUser])

  useEffect(() => {
    if (isAdmin) {
      loadUsers()
    }
  }, [isAdmin, loadUsers])

  useEffect(() => {
    if (!selectedUser) {
      return
    }
    const cred = selectedUser.credential || 'admin'
    const paginasSalvas = Array.isArray(selectedUser.page_permissions) ? selectedUser.page_permissions : []
    const paginasIniciais = paginasSalvas.length ? paginasSalvas : resolveAllowedPageIds(cred)
    setDraftCredential(cred)
    setDraftPages(paginasIniciais)
    setIsActive(selectedUser.ativo !== false)
  }, [selectedUser])

  const togglePage = (pageId) => {
    setDraftPages((prev) => {
      const next = new Set(prev)
      if (next.has(pageId)) {
        next.delete(pageId)
      } else {
        next.add(pageId)
      }
      return Array.from(next)
    })
  }

  const handleCredentialChange = (value) => {
    setDraftCredential(value)
    setDraftPages(resolveAllowedPageIds(value))
  }

  const handleSave = async () => {
    if (!selectedUser) {
      return
    }
    if (!isSupabaseConfigured() || !supabase) {
      setFeedback({ type: 'error', message: 'Supabase nao configurado.' })
      return
    }
    const beforeCredential = selectedUser.credential || 'admin'
    const beforePages = Array.isArray(selectedUser.page_permissions) ? selectedUser.page_permissions : []
    const beforeActive = selectedUser.ativo !== false
    setIsLoading(true)
    setFeedback(null)
    try {
      const { error } = await supabase
        .from('app_users')
        .update({
          credential: draftCredential || 'admin',
          page_permissions: appliedPages,
          ativo: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedUser.id)

      if (error) {
        throw error
      }

      try {
        await syncAuthUserBan(selectedUser.id, isActive)
      } catch (syncError) {
        reportError(syncError, { stage: 'sync_user_ban', userId: selectedUser.id })
      }

      try {
        await supabase.from('app_users_credential_history').insert({
          user_id: selectedUser.id,
          user_username:
            selectedUser.username ||
            selectedUser.display_name ||
            selectedUser.email ||
            selectedUser.id,
          changed_by: currentUser?.id || null,
          changed_by_username:
            currentUser?.metadata?.username ||
            currentUser?.name ||
            currentUser?.email ||
            'Sistema',
          action: 'update',
          before_credential: beforeCredential,
          after_credential: draftCredential || 'admin',
          before_pages: beforePages,
          after_pages: appliedPages,
          before_active: beforeActive,
          after_active: isActive,
        })
      } catch (historyError) {
        reportError(historyError, { stage: 'credential_history', userId: selectedUser.id })
      }

      setFeedback({ type: 'success', message: 'Credencial atualizada com sucesso.' })
      await loadUsers()
      if (selectedUser.id === currentUser?.id) {
        refresh?.()
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Nao foi possivel salvar as permissoes.' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    const cred = draftCredential || 'admin'
      setDraftPages(resolveAllowedPageIds(cred))
    }

  const resolvePageLabel = useCallback(
    (pageId) => pageOptions.find((page) => page.id === pageId)?.label || pageId,
    [pageOptions]
  )

  const loadHistory = useCallback(async () => {
    if (!selectedUserId) {
      setHistoryError('Selecione um usuario.')
      setHistoryItems([])
      return
    }
    if (!isSupabaseConfigured() || !supabase) {
      setHistoryError('Supabase nao configurado.')
      setHistoryItems([])
      return
    }
    setHistoryLoading(true)
    setHistoryError(null)
    try {
      const { data, error } = await supabase
        .from('app_users_credential_history')
        .select(
          'id, user_username, changed_by_username, action, before_credential, after_credential, before_pages, after_pages, before_active, after_active, created_at'
        )
        .eq('user_id', selectedUserId)
        .order('created_at', { ascending: false })
      if (error) {
        throw error
      }
      setHistoryItems(data || [])
    } catch (err) {
      setHistoryError(err.message || 'Falha ao carregar historico.')
      setHistoryItems([])
    } finally {
      setHistoryLoading(false)
    }
  }, [selectedUserId])

  const handleOpenHistory = () => {
    setHistoryOpen(true)
    loadHistory()
  }

  const allowedLabels = useMemo(
    () =>
      allowedPageIds
        .map((id) => pageOptions.find((page) => page.id === id)?.label)
        .filter(Boolean),
    [allowedPageIds, pageOptions]
  )

  if (isLocalMode) {
    return (
      <section className="card config-page__section" aria-labelledby="permissions-title">
        <header className="card__header">
          <div>
            <h2 id="permissions-title">Credencial e acesso</h2>
            <p className="config-page__description">Permissoes nao disponiveis no modo local.</p>
          </div>
        </header>
        <p>Execute conectado ao Supabase para gerenciar credenciais.</p>
      </section>
    )
  }

  if (!isAdmin) {
    return (
      <section className="card config-page__section" aria-labelledby="permissions-title">
        <header className="card__header">
          <div className="page-header__heading">
            <Shield size={24} />
            <div>
              <h2 id="permissions-title">Credencial</h2>
              <p className="config-page__description">Visibilidade baseada no seu perfil.</p>
            </div>
          </div>
        </header>
        <p>
          Credencial atual: <strong>{describeCredential(credential)}</strong>
        </p>
        <p>
          Paginas habilitadas: {allowedLabels.length ? allowedLabels.join(', ') : 'Todas'}
        </p>
      </section>
    )
  }

  return (
    <section className="card config-page__section" aria-labelledby="permissions-title">
      <header className="card__header">
        <div className="page-header__heading">
          <ShieldCheck size={24} />
          <div>
            <h2 id="permissions-title">Credenciais e paginas</h2>
            <p className="config-page__description">
              Defina a credencial do usuario e quais paginas ele pode acessar.
            </p>
          </div>
        </div>
      </header>

      <div className="form form--inline">
        <label className="field">
          <span>Usuario</span>
          <select value={selectedUserId || ''} onChange={(e) => setSelectedUserId(e.target.value)} disabled={isLoading || !users.length}>
            {!users.length ? <option>Sem usuarios</option> : null}
            {users.map((usuario) => (
              <option key={usuario.id} value={usuario.id}>
                {usuario.username ||
                  usuario.display_name ||
                  usuario.email ||
                  usuario.id}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Credencial</span>
          <select
            value={draftCredential || 'admin'}
            onChange={(e) => handleCredentialChange(e.target.value)}
            disabled={isLoading || !selectedUser}
          >
            {CREDENTIAL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field switch">
          <span>Status</span>
          <div className="switch__control">
            <input
              id="user-status-toggle"
              type="checkbox"
              className="switch__input"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              disabled={isLoading || !selectedUser}
            />
            <label htmlFor="user-status-toggle" className="switch__label">
              <span className="switch__thumb" aria-hidden="true" />
              <span className="switch__text">{isActive ? 'Ativo' : 'Inativo'}</span>
            </label>
          </div>
        </label>

        <button
          type="button"
          className="history-icon-button history-icon-button--inline"
          onClick={handleOpenHistory}
          disabled={!selectedUserId}
          aria-label="Historico de credenciais"
          title="Historico de credenciais"
        >
          <HistoryIcon size={18} />
        </button>
      </div>

      <div className="permission-pill-group" role="group" aria-label="Paginas permitidas">
        {pageOptions.map((page) => {
          const active = appliedPages.includes(page.id)
          const inputId = `page-toggle-${page.id}`
          return (
            <div key={page.id} className={`permission-switch${active ? ' permission-switch--active' : ''}`}>
              <span className="permission-switch__label">{page.label}</span>
              <div className="switch__control">
                <input
                  id={inputId}
                  type="checkbox"
                  className="switch__input"
                  checked={active}
                  onChange={() => togglePage(page.id)}
                  disabled={isLoading || !selectedUser}
                />
                <label htmlFor={inputId} className="switch__label">
                  <span className="switch__thumb" aria-hidden="true" />
                  <span className="switch__text">{active ? 'Liberado' : 'Bloqueado'}</span>
                </label>
              </div>
            </div>
          )
        })}
      </div>

      {feedback ? <p className={`feedback feedback--${feedback.type}`}>{feedback.message}</p> : null}

      <div className="form__actions">
        <button type="button" className="button button--ghost" onClick={handleReset} disabled={isLoading || !selectedUser}>
          Restaurar padrao
        </button>
        <button type="button" className="button button--primary" onClick={handleSave} disabled={isLoading || !selectedUser}>
          {isLoading ? 'Salvando...' : 'Salvar credencial'}
        </button>
      </div>

      <CredentialsHistoryModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        isLoading={historyLoading}
        error={historyError}
        items={historyItems}
        resolvePageLabel={resolvePageLabel}
      />
    </section>
  )
}

function AdminResetPasswordSection() {
  const { isAdmin } = usePermissions()
  const { user: currentUser } = useAuth()
  const { reportError } = useErrorLogger('configuracoes_reset')
  const [users, setUsers] = useState([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [feedback, setFeedback] = useState(null)

 const loadUsers = useCallback(async () => {
    const addFallbackUser = (lista) => {
      if (currentUser?.id) {
        lista.push({
          id: currentUser.id,
          username: currentUser.metadata?.username || currentUser.email || currentUser.id,
          display_name: currentUser.name || currentUser.metadata?.nome || currentUser.metadata?.username,
          email: currentUser.email || '',
          credential: (currentUser.metadata?.credential || currentUser.role || 'admin').toLowerCase(),
          page_permissions: currentUser.metadata?.page_permissions || [],
          ativo: true,
        })
      }
    }

    if (!isSupabaseConfigured() || !supabase || isLocalMode) {
      const lista = []
      // No modo local ou sem Supabase, so temos o usuario atual
      addFallbackUser(lista)
      setUsers(lista)
      if (!selectedUserId && lista.length) {
        setSelectedUserId(lista[0].id)
      }
      return
    }

    try {
      const { data, error } = await supabase
        .from('app_users')
        .select('id, username, display_name, email, credential, page_permissions, ativo')
        .order('display_name', { ascending: true })
      if (error) {
        throw error
      }
      const lista = (data || []).filter((usuario) => (usuario.credential || '').toLowerCase() !== 'master')
      setUsers(lista)
      if (!selectedUserId && lista.length) {
        setSelectedUserId(lista[0].id)
      }
    } catch (err) {
      reportError(err, { stage: 'load_users_reset' })
      const lista = []
      addFallbackUser(lista)
      setUsers(lista)
      if (!selectedUserId && lista.length) {
        setSelectedUserId(lista[0].id)
      }
    }
  }, [currentUser, selectedUserId])

  useEffect(() => {
    if (isAdmin) {
      loadUsers()
    }
  }, [isAdmin, loadUsers])

  const selectedUser = useMemo(
    () => users.find((item) => item.id === selectedUserId) || null,
    [users, selectedUserId]
  )

  const handleSend = async () => {
    setFeedback(null)
    if (!isAdmin) {
      setFeedback({ type: 'error', message: 'Apenas administradores podem enviar reset de senha.' })
      return
    }
    if (isLocalMode) {
      setFeedback({ type: 'error', message: 'Reset de senha indisponivel no modo local.' })
      return
    }
    if (!isSupabaseConfigured() || !supabase) {
      setFeedback({ type: 'error', message: 'Supabase nao configurado.' })
      return
    }
    if (!selectedUser?.email) {
      setFeedback({ type: 'error', message: 'Usuario sem email cadastrado para reset.' })
      return
    }

    setIsSending(true)
    try {
      const rawRedirect = import.meta?.env?.VITE_SUPABASE_PASSWORD_REDIRECT ?? ''
      const redirectTo =
        typeof rawRedirect === 'string' && rawRedirect.trim().length > 0 ? rawRedirect.trim() : undefined

      const { error } = await supabase.auth.resetPasswordForEmail(
        selectedUser.email,
        redirectTo ? { redirectTo } : undefined
      )
      if (error) {
        throw error
      }
      setFeedback({ type: 'success', message: `Email de redefinicao enviado para ${selectedUser.email}` })

      // Historico de reset
      try {
        await supabase.from('app_users_credential_history').insert({
          user_id: selectedUser.id,
          user_username:
            selectedUser.username || selectedUser.display_name || selectedUser.email || selectedUser.id,
          changed_by: null,
          changed_by_username: 'Sistema (reset)',
          action: 'password_reset',
          before_credential: selectedUser.credential || 'admin',
          after_credential: selectedUser.credential || 'admin',
          before_pages: Array.isArray(selectedUser.page_permissions) ? selectedUser.page_permissions : [],
          after_pages: Array.isArray(selectedUser.page_permissions) ? selectedUser.page_permissions : [],
          before_active: selectedUser.ativo !== false,
          after_active: selectedUser.ativo !== false,
        })
      } catch (historyErr) {
        reportError(historyErr, { stage: 'history_reset', userId: selectedUser.id })
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Falha ao enviar reset de senha.' })
    } finally {
      setIsSending(false)
    }
  }

  if (isLocalMode) {
    return (
      <section className="card config-page__section" aria-labelledby="reset-admin-title">
        <header className="card__header">
          <div>
            <h2 id="reset-admin-title">Reset de senha</h2>
            <p className="config-page__description">Indisponivel no modo local.</p>
          </div>
        </header>
        <p>Ative o modo Supabase para enviar emails de reset.</p>
      </section>
    )
  }

  if (!isAdmin) {
    return null
  }

  return (
    <section className="card config-page__section" aria-labelledby="reset-admin-title">
      <header className="card__header">
        <div>
          <h2 id="reset-admin-title">Reset de senha (admin)</h2>
          <p className="config-page__description">Selecione um usuario e envie o email de redefinicao.</p>
        </div>
      </header>

      <div className="form form--inline">
        <label className="field">
          <span>Usuario</span>
          <select
            value={selectedUserId || ''}
            onChange={(e) => setSelectedUserId(e.target.value)}
            disabled={isSending || !users.length}
          >
            {!users.length ? <option>Sem usuarios</option> : null}
            {users.map((usuario) => (
              <option key={usuario.id} value={usuario.id}>
                {usuario.username || usuario.display_name || usuario.email || usuario.id}
              </option>
            ))}
          </select>
        </label>
      </div>

      {feedback ? <p className={`feedback feedback--${feedback.type}`}>{feedback.message}</p> : null}

      <div className="form__actions">
        <button type="button" className="button button--primary" onClick={handleSend} disabled={isSending || !selectedUserId}>
          {isSending ? 'Enviando...' : 'Enviar reset de senha'}
        </button>
      </div>
    </section>
  )
}

function CredentialsHistoryModal({ open, onClose, isLoading, error, items, resolvePageLabel }) {
  if (!open) {
    return null
  }

  const statusLabel = (value) => (value === false ? 'Inativo' : 'Ativo')
  const actionLabel = (value) => {
    if ((value || '').toLowerCase() === 'password_reset') {
      return 'Reset de senha'
    }
    return 'Atualizacao'
  }

  return (
    <div className="cred-history__overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="cred-history__modal" onClick={(e) => e.stopPropagation()}>
        <header className="cred-history__header">
          <h3>Historico de credenciais</h3>
          <button type="button" className="cred-history__close" onClick={onClose} aria-label="Fechar historico">
            <X size={18} />
          </button>
        </header>

        {isLoading ? (
          <p className="feedback">Carregando historico...</p>
        ) : error ? (
          <p className="feedback feedback--error">{error}</p>
        ) : !items.length ? (
          <p className="feedback">Nenhum historico registrado.</p>
        ) : (
          <ul className="cred-history__list">
            {items.map((item) => (
              <li key={item.id} className="cred-history__item">
                <div className="cred-history__meta">
                  <span><strong>Quando:</strong> {new Date(item.created_at).toLocaleString('pt-BR')}</span>
                  <span><strong>Por:</strong> {item.changed_by_username || 'Sistema'}</span>
                  <span><strong>Usuario:</strong> {item.user_username || '-'}</span>
                  <span><strong>Acao:</strong> {actionLabel(item.action)}</span>
                </div>
                <p>
                  <strong>Credencial:</strong> {item.before_credential || 'admin'} → {item.after_credential || 'admin'}
                </p>
                <p>
                  <strong>Status:</strong> {statusLabel(item.before_active)} → {statusLabel(item.after_active)}
                </p>
                <div className="cred-history__badges">
                  <span className="cred-history__badge">
                    Paginas antes: {(item.before_pages || []).map(resolvePageLabel).join(', ') || 'Default'}
                  </span>
                  <span className="cred-history__badge">
                    Paginas depois: {(item.after_pages || []).map(resolvePageLabel).join(', ') || 'Default'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
