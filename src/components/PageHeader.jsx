export function PageHeader({ title, subtitle, actions, icon }) {
  return (
    <header className="page-header">
      <div className="page-header__content">
        <h1 className="page-header__heading">
          {icon ? (
            <span className="page-header__icon" aria-hidden="true">
              {icon}
            </span>
          ) : null}
          <span>{title}</span>
        </h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  )
}
