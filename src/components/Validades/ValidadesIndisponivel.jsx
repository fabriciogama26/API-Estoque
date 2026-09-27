export function ValidadesIndisponivel() {
  return (
    <section className="card">
      <header className="card__header">
        <h2>Recurso indisponivel no modo local</h2>
      </header>
      <p className="feedback">
        Requisitos de Controle e Controle de Validades dependem das regras do banco (Supabase). Configure o modo remoto
        para usar esta tela.
      </p>
    </section>
  )
}
