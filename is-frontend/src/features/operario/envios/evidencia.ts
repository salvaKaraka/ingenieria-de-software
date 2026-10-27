// La evidencia la fija el comercio y el envío la copia al crearse (B-3): se muestra igual en
// el alta, en la confirmación y en el detalle.
export function describirEvidencia({ requiereFoto, requiereDni }: { requiereFoto: boolean; requiereDni: boolean }) {
  return [requiereFoto && 'foto', requiereDni && 'DNI del receptor'].filter(Boolean).join(' y ') || 'no exige'
}
