import Image from "next/image";
import logo from "../../public/brand/logo-horizontal.png";
import logoClaro from "../../public/brand/logo-horizontal-claro.png";

/**
 * Logo de Kaffa Love Roasters 11:11, versión horizontal armada con las piezas del logo original
 * (public/brand/logo-cuadrado.png). La altura se controla con className (h-*); el ancho se ajusta solo.
 * light: texto en crema, para fondos oscuros (pie de página).
 */
export function Wordmark({ className = "h-10", light = false, priority = false }: { className?: string; light?: boolean; priority?: boolean }) {
  return (
    <Image
      src={light ? logoClaro : logo}
      alt="Kaffa Love Roasters 11:11"
      priority={priority}
      className={`w-auto ${className}`}
      sizes="280px"
    />
  );
}
