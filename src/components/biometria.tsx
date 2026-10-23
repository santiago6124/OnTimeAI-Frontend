"use client";

/**
 * Las dos superficies de la entrada con Face ID: la oferta que aparece una vez
 * después de entrar y el interruptor de Ajustes.
 *
 * Las dos arrancan sin dibujar nada y aparecen recién cuando
 * `lib/native/biometria.ts` confirma que corresponde. En la web y en Android esa
 * respuesta es siempre `null`, así que ahí no se pinta ni un píxel nuevo —y
 * Android importa, porque carga esta misma web desde Cloud Run—.
 *
 * Cada una tiene un contenedor (el que pregunta y guarda) y una vista sin
 * estado: la vista es lo que se puede renderizar en una prueba sin teléfono.
 */

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { TipoBiometria } from "@/lib/native/biometria";

const biometria = () => import("@/lib/native/biometria");

/**
 * Resuelve una consulta asíncrona al montar y la expone como estado. Un error
 * se lee como "no corresponde": ninguna de las dos superficies es tan
 * importante como para mostrar un fallo propio.
 */
function useAlMontar<T>(consulta: () => Promise<T | null>) {
  const [valor, setValor] = React.useState<T | null>(null);
  React.useEffect(() => {
    let vivo = true;
    consulta()
      .then((v) => vivo && setValor(v))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
    // Una sola vez por montaje: la capacidad del teléfono no cambia en vivo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return [valor, setValor] as const;
}

// --- Oferta -----------------------------------------------------------------

export function OfertaBiometriaVista({
  tipo,
  ocupado,
  onAceptar,
  onRechazar,
}: {
  tipo: TipoBiometria;
  ocupado: boolean;
  onAceptar: () => void;
  onRechazar: () => void;
}) {
  return (
    // Abajo y sin tapar la pantalla: es una propuesta, no un paso obligatorio.
    // `safe-bottom` la separa de la barra de gestos (ver globals.css).
    <div className="safe-bottom fixed inset-x-0 bottom-0 z-50 px-4 pb-4">
      <div
        role="dialog"
        aria-labelledby="oferta-biometria-titulo"
        className="mx-auto max-w-md space-y-3 rounded-xl border bg-background p-4 shadow-lg"
      >
        <div className="space-y-1">
          <p id="oferta-biometria-titulo" className="text-sm font-semibold">
            Usar {tipo} para entrar
          </p>
          <p className="text-sm text-muted-foreground">
            La próxima vez que tu sesión venza, entrás con {tipo} en lugar de
            escribir la contraseña. Lo podés cambiar en Ajustes.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onRechazar} disabled={ocupado}>
            Ahora no
          </Button>
          <Button onClick={onAceptar} disabled={ocupado}>
            Usar {tipo}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function OfertaBiometria() {
  const [tipo, setTipo] = useAlMontar(() =>
    biometria().then((m) => m.biometriaParaOfrecer()),
  );
  const [ocupado, setOcupado] = React.useState(false);

  if (!tipo) return null;
  const nombre = tipo;

  async function responder(aceptar: boolean) {
    setOcupado(true);
    const m = await biometria();
    // Si la cara no pasa al aceptar no se guarda nada: la oferta vuelve en el
    // próximo arranque en vez de quedar activada sin haber andado nunca.
    if (aceptar) await m.activarBiometria(nombre);
    else await m.desactivarBiometria();
    setTipo(null);
  }

  return (
    <OfertaBiometriaVista
      tipo={nombre}
      ocupado={ocupado}
      onAceptar={() => void responder(true)}
      onRechazar={() => void responder(false)}
    />
  );
}

// --- Ajuste -----------------------------------------------------------------

export function AjusteBiometriaVista({
  tipo,
  activada,
  ocupado,
  onCambiar,
}: {
  tipo: TipoBiometria;
  activada: boolean;
  ocupado: boolean;
  onCambiar: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Entrar con {tipo}</CardTitle>
        <CardDescription>
          Cuando tu sesión vence, te pide {tipo} en lugar de la contraseña. Al
          cerrar sesión se desactiva.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant={activada ? "outline" : "default"}
          role="switch"
          aria-checked={activada}
          onClick={onCambiar}
          disabled={ocupado}
        >
          {activada ? `Desactivar ${tipo}` : `Activar ${tipo}`}
        </Button>
      </CardContent>
    </Card>
  );
}

export function AjusteBiometria() {
  const [estado, setEstado] = useAlMontar(() =>
    biometria().then((m) => m.estadoDelAjuste()),
  );
  const [ocupado, setOcupado] = React.useState(false);

  if (!estado) return null;
  const { tipo, activada } = estado;

  async function cambiar() {
    setOcupado(true);
    const m = await biometria();
    const ahora = activada
      ? (await m.desactivarBiometria(), false)
      : await m.activarBiometria(tipo);
    setEstado({ tipo, activada: ahora });
    setOcupado(false);
  }

  return (
    <AjusteBiometriaVista
      tipo={tipo}
      activada={activada}
      ocupado={ocupado}
      onCambiar={() => void cambiar()}
    />
  );
}
