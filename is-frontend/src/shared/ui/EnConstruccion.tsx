// Marcador para las páginas que todavía no se implementaron.
// Quien toma la tarea reemplaza el contenido de la página entera.
export function EnConstruccion({ tarea, titulo }: { tarea: string; titulo: string }) {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold">{titulo}</h1>
      <p className="opacity-70">
        En construcción · tarea <code className="font-mono">{tarea}</code> de TAREAS.md
      </p>
    </div>
  )
}
