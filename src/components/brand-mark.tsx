/**
 * La marca, centrada, para las pantallas que están fuera del dashboard.
 *
 * Usa `/icon.png` y no `/logopagina.png`, que es la misma figura en 1024px y
 * 1,4 MB: acá pesaría veinte veces más para verse a 48px. El navbar usa el mismo,
 * por el mismo motivo.
 *
 * El dibujo es blanco sobre transparente, así que sobre el fondo claro
 * desaparecería. `brightness-0` lo lleva a negro sin tocar la transparencia,
 * así que no aparece ningún recuadro. Antes esto convivía con
 * `dark:brightness-100`; con un solo tema esa variante ya no se dispara nunca.
 */
export function BrandMark({ showName = true }: { showName?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element --
          `next/image` haria pasar el icono por el optimizador en tiempo de
          ejecucion, justo en la primera pantalla que carga alguien que todavia
          no inicio sesion. Son 73 KB para un dibujo de 48px: no compensa. El
          navbar usa `<img>` por lo mismo. */}
      <img
        src="/icon.png"
        alt={showName ? "" : "OnTimeAI"}
        width={48}
        height={48}
        className="size-12 brightness-0"
      />
      {/* La figura sola no dice el nombre, y el login es la primera pantalla
          que ve alguien que todavía no sabe dónde está. Se apaga donde el
          título ya lo nombra, para no escribirlo dos veces seguidas. */}
      {showName && (
        <span className="text-sm font-semibold tracking-tight">OnTimeAI</span>
      )}
    </div>
  );
}
