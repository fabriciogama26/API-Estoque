
import { useCallback, useEffect, useMemo, useState } from 'react'
import SettingsIcon from 'lucide-react/dist/esm/icons/settings.js'
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check.js'
import Shield from 'lucide-react/dist/esm/icons/shield.js'
import HistoryIcon from 'lucide-react/dist/esm/icons/history.js'
import X from 'lucide-react/dist/esm/icons/x.js'
import { PageHeader } from '../components/PageHeader.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase, isSupabaseConfigured } from '../services/supabaseClient.js'
import { HelpButton } from '../components/Help/HelpButton.jsx'
import { usePermissions } from '../context/PermissionsContext.jsx'
import { isLocalMode } from '../config/runtime.js'
import { useErrorLogger } from '../hooks/useErrorLogger.js'
import '../styles/ConfiguracoesPage.css'
import { PERMISSION_LABELS, PERMISSION_GROUPS } from '../config/permissions.js'

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

async function searchAllUsers(term, { isMaster, currentUserId } = {}) {
  if (!isSupabaseConfigured() || !supabase) {
    return []
  }
  const q = (term || '').trim()
  if (q.length < 2) {
    return []
  }
  const filtros = [`username.ilike.%${q}%`, `display_name.ilike.%${q}%`, `email.ilike.%${q}%`]
  let query = supabase.from('app_users').select('id, display_name, username, email, ativo, parent_user_id').or(filtros.join(','))
  if (!isMaster && currentUserId) {
    query = query.or(`id.eq.${currentUserId},parent_user_id.eq.${currentUserId}`)
  }
  const { data, error } = await query
  if (error) {
    return []
  }
  const resultados = (data || []).map((u) => ({
    id: u.id,
    type: u.parent_user_id ? 'dependent' : 'owner',
    label: u.username || u.display_name || u.email || u.id,
    credential: null,
    credentialId: null,
    page_permissions: [],
    ativo: u.ativo,
    owner_app_user_id: u.parent_user_id || u.id,
    dependent_id: u.parent_user_id ? u.id : null,
    email: u.email || '',
    parent_user_id: u.parent_user_id,
  }))
  const dedup = new Map()
  resultados.forEach((item) => {
    if (!dedup.has(item.id)) dedup.set(item.id, item)
  })
  return Array.from(dedup.values())
}

export function ConfiguracoesPage() {
  const { user } = useAuth()

  return (
    <div className="stack config-page">
      <PageHeader
        icon={<SettingsIcon size={28} />}
        title="Configuracoes"
        subtitle="Gerencie sua conta e ajustes pessoais."
        actions={<HelpButton topic="configuracoes" />}
      />

      <PermissionsSection currentUser={user} />
      <AdminResetPasswordSection />
    </div>
  )
}
function PermissionsSection({ currentUser }) {
  const { isAdmin, isMaster, permissions: currentPermissions, roles: currentRoles, refresh } = usePermissions()
  const { reportError } = useErrorLogger('configuracoes_permissoes')
  const [users, setUsers] = useState([])
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [draftRoleId, setDraftRoleId] = useState(null)
  const [draftPermissions, setDraftPermissions] = useState([])
  const [rolesCatalog, setRolesCatalog] = useState([])
  const [permissionsCatalog, setPermissionsCatalog] = useState([])
  const [rolePermissionsMap, setRolePermissionsMap] = useState(new Map())
  const [isActive, setIsActive] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState(null)
  const [historyItems, setHistoryItems] = useState([])
  const [userSearch, setUserSearch] = useState('')
  const [userSuggestions, setUserSuggestions] = useState([])
  const [userSearchError, setUserSearchError] = useState(null)

  const formatPerms = useCallback((perms) => {
    if (!Array.isArray(perms) || perms.length === 0) return 'Nenhuma'
    return perms.map((p) => PERMISSION_LABELS[p] || p).join(', ')
  }, [])

  const allPermissionKeys = useMemo(() => {
    const base = new Set(permissionsCatalog.map((p) => p.key))
    PERMISSION_GROUPS.forEach((g) => g.keys.forEach((k) => base.add(k)))
    return Array.from(base)
  }, [permissionsCatalog])

  const computeEffectivePermissions = useCallback(
    (roleId, overrides = []) => {
      if (isLocalMode) {
        return allPermissionKeys
      }
      const roleName = rolesCatalog.find((r) => r.id === roleId)?.name?.toLowerCase()
      if (roleName === 'master') {
        return allPermissionKeys
      }
      const roleDefault = rolePermissionsMap.get(roleId) || new Set()
      const result = new Set(roleDefault)
      overrides.forEach((ov) => {
        if (!ov?.permission_key) return
        if (ov.allowed === false) {
          result.delete(ov.permission_key)
        } else if (ov.allowed === true) {
          result.add(ov.permission_key)
        }
      })
      return Array.from(result)
    },
    [allPermissionKeys, isLocalMode, rolePermissionsMap, rolesCatalog]
  )

  const hasRbacManage = useMemo(() => isMaster || (currentPermissions || []).includes('rbac.manage'), [currentPermissions, isMaster])

  useEffect(() => {
    const loadCatalogs = async () => {
      if (isLocalMode || !isSupabaseConfigured() || !supabase) {
        return
      }
      try {
        const [rolesResult, permissionsResult, rolePermsResult] = await Promise.all([
          supabase.from('roles').select('id, name').order('name'),
          supabase.from('permissions').select('id, key, description').order('key'),
          supabase.from('role_permissions').select('role_id, permission_id'),
        ])
        if (rolesResult.error) throw rolesResult.error
        if (permissionsResult.error) throw permissionsResult.error
        if (rolePermsResult.error) throw rolePermsResult.error
        setRolesCatalog(rolesResult.data || [])
        setPermissionsCatalog(permissionsResult.data || [])
        const permById = new Map((permissionsResult.data || []).map((p) => [p.id, p.key]))
        const map = new Map()
        ;(rolePermsResult.data || []).forEach((rp) => {
          const key = permById.get(rp.permission_id)
          if (!key) return
          if (!map.has(rp.role_id)) {
            map.set(rp.role_id, new Set())
          }
          map.get(rp.role_id).add(key)
        })
        setRolePermissionsMap(map)
      } catch (err) {
        reportError(err, { stage: 'load_roles_permissions' })
      }
    }
    loadCatalogs()
  }, [reportError])

  const permissionGroups = useMemo(() => PERMISSION_GROUPS, [])
  const selectedUser = useMemo(
    () => users.find((item) => item.id === selectedUserId) || null,
    [selectedUserId, users]
  )

  const appliedPermissions = draftPermissions

  const roleOptions = useMemo(
    () =>
      rolesCatalog
        .filter((role) => ['master', 'admin', 'operador', 'estagiario', 'visitante'].includes(role.name.toLowerCase()))
        .map((role) => ({
          value: role.id,
          label: role.name,
        })),
    [rolesCatalog]
  )

  const allowedPermLabels = useMemo(() => (currentPermissions || []).join(', '), [currentPermissions])
  const loadUsers = useCallback(async () => {
    if (!isAdmin) {
      setUsers([])
      setSelectedUserId(null)
      return
    }

    const addFallbackUser = (lista, allowMaster = false) => {
      if (currentUser?.id) {
        const cred = (currentUser.metadata?.credential || currentUser.role || '').toLowerCase()
        if (!allowMaster && cred === 'master') {
          return
        }
        lista.push({
          id: currentUser.id,
          display_name: currentUser.name || currentUser.metadata?.nome || currentUser.metadata?.username,
          username: currentUser.metadata?.username || currentUser.email || currentUser.id,
          email: currentUser.email || '',
          credential: null,
          page_permissions: [],
          ativo: true,
          type: 'owner',
          owner_app_user_id: currentUser.id,
          dependent_id: null,
        })
      }
    }

    if (isLocalMode || !isSupabaseConfigured() || !supabase) {
      const listaFallback = []
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
      let query = supabase
        .from('app_users')
        .select('id, display_name, username, email, page_permissions, ativo, parent_user_id')
        .order('display_name', { ascending: true })
      if (!isMaster && currentUser?.id) {
        query = query.or(`id.eq.${currentUser.id},parent_user_id.eq.${currentUser.id}`)
      }
      const { data, error } = await query
      if (error) throw error
      const lista = (data || []).map((u) => ({
        id: u.id,
        display_name: u.display_name,
        username: u.username,
        email: u.email || '',
        credential: null,
        page_permissions: [],
        ativo: u.ativo,
        type: u.parent_user_id ? 'dependent' : 'owner',
        owner_app_user_id: u.parent_user_id || u.id,
        dependent_id: u.parent_user_id ? u.id : null,
      }))
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
  }, [isAdmin, selectedUserId, currentUser, isMaster])

  useEffect(() => {
    if (isAdmin) {
      loadUsers()
    }
  }, [isAdmin, loadUsers])

  useEffect(() => {
    const loadAccess = async () => {
      if (!selectedUser || !isSupabaseConfigured() || !supabase) {
        setDraftRoleId(null)
        setDraftPermissions([])
        return
      }
      try {
        const [userRoles, overrides] = await Promise.all([
          supabase.from('user_roles').select('role_id').eq('user_id', selectedUser.id),
          supabase.from('user_permission_overrides').select('permission_key, allowed').eq('user_id', selectedUser.id),
        ])
        if (userRoles.error) throw userRoles.error
        if (overrides.error) throw overrides.error
        const roleId = userRoles.data?.[0]?.role_id || null
        setDraftRoleId(roleId)
        setDraftPermissions(computeEffectivePermissions(roleId, overrides.data || []))
        setIsActive(selectedUser.ativo !== false)
      } catch (err) {
        reportError(err, { stage: 'load_user_access', userId: selectedUser.id })
        setDraftRoleId(null)
        setDraftPermissions([])
      }
    }
    loadAccess()
  }, [computeEffectivePermissions, reportError, selectedUser])

  const handleRoleChange = (value) => {
    setDraftRoleId(value)
    setDraftPermissions(computeEffectivePermissions(value, []))
  }

  const handleUserSearchChange = async (value) => {
    setUserSearch(value)
    setUserSearchError(null)
    try {
      const results = await searchAllUsers(value, { isMaster, currentUserId: currentUser?.id })
      setUserSuggestions(results)
    } catch (err) {
      setUserSearchError(err.message || 'Falha ao buscar usuarios.')
    }
  }

  const handleUserSelect = (userOption) => {
    setSelectedUserId(userOption.id)
    setUserSearch(userOption.label)
    setUserSuggestions([])
    setUsers((prev) => {
      const exists = prev.some((u) => u.id === userOption.id)
      if (exists) return prev
      return prev.concat({
        id: userOption.id,
        display_name: userOption.label,
        username: userOption.label,
        email: '',
        credential: userOption.credential,
        page_permissions: userOption.page_permissions,
        ativo: userOption.ativo,
        type: userOption.type || 'owner',
        owner_app_user_id: userOption.owner_app_user_id || userOption.id,
        dependent_id: userOption.dependent_id || null,
      })
    })
  }
  const handleSave = async () => {
    if (!selectedUser) {
      return
    }
    if (!isSupabaseConfigured() || !supabase) {
      setFeedback({ type: 'error', message: 'Supabase nao configurado.' })
      return
    }
    const beforePerms = appliedPermissions
    setIsLoading(true)
    setFeedback(null)
    try {
      const userId = selectedUser.id

      await supabase.from('user_roles').delete().eq('user_id', userId)
      if (draftRoleId) {
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role_id: draftRoleId })
        if (roleError) throw roleError
      }

      const defaultPerms = rolePermissionsMap.get(draftRoleId) || new Set()
      const desired = new Set(appliedPermissions)
      const overridesToSave = []
      permissionsCatalog.forEach((perm) => {
        const key = perm.key
        const inDefault = defaultPerms.has(key)
        const inDesired = desired.has(key)
        if (inDefault !== inDesired) {
          overridesToSave.push({ user_id: userId, permission_key: key, allowed: inDesired })
        }
      })

      await supabase.from('user_permission_overrides').delete().eq('user_id', userId)
      if (overridesToSave.length) {
        const { error: ovError } = await supabase.from('user_permission_overrides').insert(overridesToSave)
        if (ovError) throw ovError
      }

      const { error: updError } = await supabase
        .from('app_users')
        .update({ ativo: isActive, updated_at: new Date().toISOString() })
        .eq('id', selectedUser.id)
      if (updError) throw updError

      try {
        await syncAuthUserBan(selectedUser.id, isActive)
      } catch (syncError) {
        reportError(syncError, { stage: 'sync_user_ban', userId: selectedUser.id })
      }

      setFeedback({ type: 'success', message: 'Role/permissoes atualizadas.' })

      try {
        await supabase.from('app_users_credential_history').insert({
          user_id: selectedUser.owner_app_user_id || selectedUser.id,
          target_auth_user_id: selectedUser.id,
          owner_app_user_id: selectedUser.owner_app_user_id || null,
          target_dependent_id: selectedUser.dependent_id || null,
          user_username:
            selectedUser.username || selectedUser.display_name || selectedUser.email || selectedUser.id,
          changed_by: currentUser?.id || null,
          changed_by_username:
            currentUser?.metadata?.username || currentUser?.name || currentUser?.email || 'Sistema',
          action: 'role_update',
          before_credential: null,
          after_credential: null,
          before_pages: beforePerms,
          after_pages: appliedPermissions,
        })
      } catch (historyError) {
        reportError(historyError, { stage: 'credential_history', userId: selectedUser.id })
      }

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
    setDraftPermissions(computeEffectivePermissions(draftRoleId, []))
  }

  const loadHistory = useCallback(async () => {
    if (!selectedUser || !isSupabaseConfigured() || !supabase) {
      return
    }
    setHistoryLoading(true)
    setHistoryError(null)
    try {
      const { data, error } = await supabase
        .from('app_users_credential_history')
        .select(
          'id, created_at, action, before_pages, after_pages, changed_by_username, before_credential, after_credential'
        )
        .eq('target_auth_user_id', selectedUser.id)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      setHistoryItems(data || [])
      setHistoryOpen(true)
    } catch (err) {
      setHistoryError(err.message || 'Falha ao carregar historico.')
    } finally {
      setHistoryLoading(false)
    }
  }, [selectedUser])

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
          Roles: <strong>{(currentRoles || []).join(', ') || 'Nenhum'}</strong>
        </p>
        <p>Permissoes: {allowedPermLabels || 'Nenhuma'}</p>
      </section>
    )
  }
  return (
    <section className="card config-page__section" aria-labelledby="permissions-title">
      <header className="card__header">
        <div className="page-header__heading">
          <ShieldCheck size={24} />
          <div>
            <h2 id="permissions-title">Credenciais e Permissoes</h2>
            <p className="config-page__description">Defina a role e as permissoes do usuario.</p>
          </div>
        </div>
        <div className="card__actions">
          <button
            type="button"
            className="button button--ghost"
            onClick={loadHistory}
            disabled={!selectedUser || historyLoading}
          >
            <HistoryIcon size={16} />
            <span style={{ marginLeft: 6 }}>Historico</span>
          </button>
        </div>
      </header>

      <div className="form form--inline">
        <label className="field autocomplete">
          <span>Usuario</span>
          <div className="autocomplete__control">
            <input
              className="autocomplete__input"
              value={userSearch}
              onChange={(e) => handleUserSearchChange(e.target.value)}
              placeholder={isLoading ? 'Carregando...' : 'Digite nome/email/username'}
              disabled={isLoading}
            />
            {userSuggestions.length > 0 && (
              <ul className="autocomplete__list">
                {userSuggestions.map((option) => (
                  <li
                    key={option.id}
                    className="autocomplete__item"
                    onMouseDown={() => handleUserSelect(option)}
                  >
                    {option.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {userSearchError ? <span className="feedback feedback--error">{userSearchError}</span> : null}
        </label>

        <label className="field">
          <span>Role</span>
          <select
            value={draftRoleId || ''}
            onChange={(e) => handleRoleChange(e.target.value)}
            disabled={isLoading || !selectedUser || !hasRbacManage}
          >
            <option value="">Selecione</option>
            {roleOptions.map((option) => (
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
              disabled={isLoading || !selectedUser || !hasRbacManage}
            />
            <label htmlFor="user-status-toggle" className="switch__label">
              <span className="switch__thumb" aria-hidden="true" />
              <span className="switch__text">{isActive ? 'Ativo' : 'Inativo'}</span>
            </label>
          </div>
        </label>
      </div>

      {!hasRbacManage ? (
        <p className="feedback feedback--error">
          Você não tem permissão (rbac.manage) para editar credenciais/permissões. Fale com um administrador.
        </p>
      ) : null}

      <div className="permission-pill-group" role="group" aria-label="Permissoes">
        {permissionGroups.map((group) => {
          const allOn = group.keys.every((key) => appliedPermissions.includes(key))
          const inputId = `perm-group-${group.id}`
          return (
            <div key={group.id} className={`permission-switch${allOn ? ' permission-switch--active' : ''}`}>
              <span className="permission-switch__label">{group.label}</span>
              <div className="switch__control">
                <input
                  id={inputId}
                  type="checkbox"
                  className="switch__input"
                  checked={allOn}
                  onChange={() => {
                    setDraftPermissions((prev) => {
                      const set = new Set(prev)
                      if (allOn) {
                        group.keys.forEach((k) => set.delete(k))
                      } else {
                        group.keys.forEach((k) => set.add(k))
                      }
                      return Array.from(set)
                    })
                  }}
                  disabled={isLoading || !selectedUser || draftRoleId === null || !hasRbacManage}
                />
                <label htmlFor={inputId} className="switch__label">
                  <span className="switch__thumb" aria-hidden="true" />
                  <span className="switch__text">{allOn ? 'Liberado' : 'Bloqueado'}</span>
                </label>
              </div>
            </div>
          )
        })}
      </div>

      {feedback ? <p className={`feedback feedback--${feedback.type}`}>{feedback.message}</p> : null}

      <div className="form__actions">
        <button
          type="button"
          className="button button--primary"
          onClick={handleSave}
          disabled={isLoading || !selectedUser || !hasRbacManage}
        >
          {isLoading ? 'Salvando...' : 'Salvar credencial'}
        </button>
        <button
          type="button"
          className="button"
          onClick={() => setDraftPermissions(computeEffectivePermissions(draftRoleId, []))}
          disabled={isLoading || !selectedUser || !hasRbacManage}
        >
          Resetar overrides
        </button>
      </div>

      {historyOpen ? (
        <div className="entradas-history__overlay" role="dialog" aria-modal="true" onClick={() => setHistoryOpen(false)}>
          <div className="entradas-history__modal" onClick={(e) => e.stopPropagation()}>
            <header className="entradas-history__header">
              <div>
                <h3>Histórico de credencial</h3>
                <p className="entradas-history__subtitle">
                  {selectedUser ? selectedUser.username || selectedUser.display_name || selectedUser.email || selectedUser.id : ''}
                </p>
              </div>
              <button
                type="button"
                className="entradas-history__close"
                onClick={() => setHistoryOpen(false)}
                aria-label="Fechar histórico"
              >
                <X size={18} />
              </button>
            </header>
            <div className="entradas-history__body">
              {historyLoading ? (
                <p className="feedback">Carregando histórico...</p>
              ) : historyError ? (
                <p className="feedback feedback--error">{historyError}</p>
              ) : (historyItems || []).length === 0 ? (
                <p className="feedback">Nenhum histórico registrado.</p>
              ) : (
                <ul className="entradas-history__list">
                  {historyItems.map((item) => (
                    <li key={item.id} className="entradas-history__item">
                      <div className="entradas-history__item-header">
                        <div>
                          <strong>{item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : ''}</strong>
                          <p>{item.changed_by_username || 'Sistema'}</p>
                        </div>
                        <span className="history-item__action">{item.action || 'alteração'}</span>
                      </div>
                      <div className="entradas-history__item-body">
                        <p>
                          <strong>Antes:</strong> {formatPerms(item.before_pages)}
                        </p>
                        <p>
                          <strong>Depois:</strong> {formatPerms(item.after_pages)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
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
  const [userSearch, setUserSearch] = useState('')
  const [userSuggestions, setUserSuggestions] = useState([])
  const [userSearchError, setUserSearchError] = useState(null)

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
          type: 'owner',
          owner_app_user_id: currentUser.id,
          dependent_id: null,
        })
      }
    }

    if (!isSupabaseConfigured() || !supabase || isLocalMode) {
      const lista = []
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
        .select('id, username, display_name, email, ativo')
        .order('display_name', { ascending: true })
      if (error) {
        throw error
      }
      const lista = []
      for (const usuario of data || []) {
        lista.push({
          ...usuario,
          credential: null,
          type: 'owner',
          owner_app_user_id: usuario.id,
          dependent_id: null,
        })
      }
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

      try {
        const userIdForHistory = selectedUser.owner_app_user_id || selectedUser.id
        await supabase.from('app_users_credential_history').insert({
          user_id: userIdForHistory,
          target_auth_user_id: selectedUser.id,
          owner_app_user_id: selectedUser.owner_app_user_id || null,
          target_dependent_id: selectedUser.dependent_id || null,
          user_username:
            selectedUser.username || selectedUser.display_name || selectedUser.email || selectedUser.id,
          changed_by: null,
          changed_by_username: 'Sistema (reset)',
          action: 'password_reset',
          before_credential: selectedUser.credential || 'admin',
          after_credential: selectedUser.credential || 'admin',
          before_pages: Array.isArray(selectedUser.page_permissions) ? selectedUser.page_permissions : [],
          after_pages: Array.isArray(selectedUser.page_permissions) ? selectedUser.page_permissions : [],
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

  const handleUserSearchChange = async (value) => {
    setUserSearch(value)
    setUserSearchError(null)
    try {
      const results = await searchAllUsers(value, { isMaster: isAdmin, currentUserId: currentUser?.id })
      setUserSuggestions(results)
    } catch (err) {
      setUserSearchError(err.message || 'Falha ao buscar usuarios.')
    }
  }

  const handleUserSelect = (option) => {
    setSelectedUserId(option.id)
    setUserSearch(option.label)
    setUserSuggestions([])
    setUsers((prev) => {
      const exists = prev.some((u) => u.id === option.id)
      if (exists) return prev
      return prev.concat({
        id: option.id,
        username: option.label,
        display_name: option.label,
        email: option.email || '',
        credential: option.credential,
        page_permissions: option.page_permissions,
        ativo: option.ativo,
        type: option.type || 'owner',
        owner_app_user_id: option.owner_app_user_id || option.id,
        dependent_id: option.dependent_id || null,
      })
    })
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
        <label className="field autocomplete">
          <span>Usuario</span>
          <div className="autocomplete__control">
            <input
              className="autocomplete__input"
              value={userSearch}
              onChange={(e) => handleUserSearchChange(e.target.value)}
              placeholder={isSending ? 'Carregando...' : 'Digite nome/email/username'}
              disabled={isSending}
            />
            {userSuggestions.length > 0 && (
              <ul className="autocomplete__list">
                {userSuggestions.map((option) => (
                  <li
                    key={option.id}
                    className="autocomplete__item"
                    onMouseDown={() => handleUserSelect(option)}
                  >
                    {option.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {userSearchError ? <span className="feedback feedback--error">{userSearchError}</span> : null}
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
