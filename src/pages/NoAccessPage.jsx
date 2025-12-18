import ShieldAlert from 'lucide-react/dist/esm/icons/shield-alert.js'
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left.js'
import { Link, useLocation } from 'react-router-dom'
import { usePermissions } from '../context/PermissionsContext.jsx'

export function NoAccessPage() {
  const location = useLocation()
  const { allowedPaths, credentialLabel } = usePermissions()
  const fallback =
    allowedPaths.find((path) => path !== '/sem-acesso') ||
    '/'

  return (
    <div className="stack">
      <div className="card">
        <header className="card__header">
          <div className="page-header__heading">
            <ShieldAlert size={28} />
            <div>
              <h2>Sem permissao</h2>
              <p className="config-page__description">
                Sua credencial ({credentialLabel}) nao permite acessar esta pagina.
              </p>
            </div>
          </div>
        </header>

        <p>
          Pagina solicitada: <strong>{location.pathname}</strong>
        </p>
        <p>Use o atalho abaixo para voltar para uma area permitida.</p>

        <div className="form__actions">
          <Link className="button button--primary" to={fallback}>
            <ArrowLeft size={16} /> Voltar
          </Link>
        </div>
      </div>
    </div>
  )
}
