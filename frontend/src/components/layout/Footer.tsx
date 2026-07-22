// ===========================================
// Footer Component
// ===========================================

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-primary-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <h3 className="text-lg font-bold mb-2">Juegos Evita Formosa</h3>
            <p className="text-primary-200 text-sm leading-relaxed">
              Plataforma integral de gestión deportiva.
              Secretaría de Deportes de la Provincia de Formosa.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-primary-300 mb-3">
              Enlaces
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="/disciplinas" className="text-primary-200 hover:text-white transition-colors">
                  Disciplinas
                </a>
              </li>
              <li>
                <a href="/noticias" className="text-primary-200 hover:text-white transition-colors">
                  Noticias
                </a>
              </li>
              <li>
                <a href="/calendario" className="text-primary-200 hover:text-white transition-colors">
                  Calendario
                </a>
              </li>
              <li>
                <a href="/sedes" className="text-primary-200 hover:text-white transition-colors">
                  Sedes
                </a>
              </li>
              <li>
                <a href="/rankings" className="text-primary-200 hover:text-white transition-colors">
                  Rankings
                </a>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-primary-300 mb-3">
              Contacto
            </h4>
            <p className="text-primary-200 text-sm">Secretaría de Deportes</p>
            <p className="text-primary-200 text-sm">Provincia de Formosa</p>
            <p className="text-primary-200 text-sm">República Argentina</p>
          </div>
        </div>

        <div className="border-t border-primary-700 mt-8 pt-6 text-center">
          <p className="text-primary-300 text-xs">
            © {currentYear} Juegos Evita Formosa — Secretaría de Deportes. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
