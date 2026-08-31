import { useParams, useNavigate } from 'react-router';
import { Trophy, ArrowLeft, Loader2, Users, FileText } from 'lucide-react';
import { useDiscipline } from '@/hooks/useDisciplines';
import { useAllCategories } from '@/hooks/useCategories';
import { Button } from '@/components/ui/button';
import { PlainTextContent } from '@/components/shared/PlainTextContent';
import { Link } from 'react-router';

export function DisciplineDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: discipline, isLoading: isLoadingDiscipline } = useDiscipline(id || '');
  // El listado de categorías de la disciplina se recorre entero (S06): con el
  // hook paginado se cortaba en 20 sin decirlo.
  const { data: categoriesData, isLoading: isLoadingCategories } = useAllCategories({
    disciplineId: id,
    isActive: true,
  });

  if (isLoadingDiscipline) {
    return (
      <div className="flex justify-center items-center py-32">
        <Loader2 className="w-12 h-12 animate-spin text-primary-500" />
      </div>
    );
  }

  if (!discipline) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold text-primary-800 mb-4">Disciplina no encontrada</h2>
        <Button onClick={() => navigate('/disciplinas')}>Volver a Disciplinas</Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-fade-in">
      <Button variant="ghost" className="mb-6 -ml-4" onClick={() => navigate('/disciplinas')}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        Volver a Disciplinas
      </Button>

      <div className="card p-8 md:p-12 mb-8 bg-gradient-to-br from-primary-900 to-primary-700 text-white overflow-hidden relative">
        <div className="absolute -right-20 -top-20 opacity-10">
          <Trophy className="w-96 h-96" />
        </div>
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white text-sm font-medium mb-4 backdrop-blur-sm">
            <Trophy className="w-4 h-4" />
            {discipline.type}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{discipline.name}</h1>
          <p className="text-primary-100 text-lg max-w-2xl">
            Conocé el reglamento y las categorías disponibles para inscribirte y competir en esta disciplina.
          </p>
          <div className="mt-8 flex gap-4">
            <Link to={`/inscripcion`}>
              <Button size="lg" className="bg-white text-primary-900 hover:bg-primary-50">
                Inscribirme Ahora
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          <section className="card p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6 border-b border-primary-100 pb-4">
              <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary-600" />
              </div>
              <h2 className="text-2xl font-bold text-primary-900">Reglamento</h2>
            </div>
            <div className="prose prose-primary max-w-none text-primary-700">
              <PlainTextContent
                text={discipline.rules}
                fallback="El reglamento aún no ha sido cargado para esta disciplina."
              />
            </div>
          </section>

          <section className="card p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6 border-b border-primary-100 pb-4">
              <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary-600" />
              </div>
              <h2 className="text-2xl font-bold text-primary-900">Categorías Habilitadas</h2>
            </div>
            
            {isLoadingCategories ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>
            ) : categoriesData?.length === 0 ? (
              <p className="text-primary-500 italic">No hay categorías habilitadas para esta disciplina.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {categoriesData?.map((category) => (
                  <div key={category.id} className="p-4 border border-primary-200 rounded-xl bg-primary-50/50 hover:bg-primary-50 transition-colors">
                    <h3 className="font-bold text-primary-800 text-lg">{category.name}</h3>
                    <div className="mt-2 space-y-1 text-sm text-primary-600">
                      <p>Edades: {category.minAge} a {category.maxAge} años</p>
                      <p>Modalidad: {category.sex}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <div className="card p-6 bg-primary-50 border-primary-200">
            <h3 className="font-bold text-primary-900 mb-4">Información General</h3>
            <div className="space-y-4 text-sm">
              <div>
                <span className="block text-primary-500 mb-1">Tipo de Modalidad</span>
                <span className="font-medium text-primary-800">{discipline.type}</span>
              </div>
              <div>
                <span className="block text-primary-500 mb-1">Tipo de Resultado</span>
                <span className="font-medium text-primary-800">{discipline.resultType}</span>
              </div>
              <div>
                <span className="block text-primary-500 mb-1">Jugadores</span>
                <span className="font-medium text-primary-800">
                  {discipline.minPlayers === discipline.maxPlayers 
                    ? `${discipline.minPlayers} por equipo`
                    : `De ${discipline.minPlayers} a ${discipline.maxPlayers} por equipo`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
