import Image from "next/image";
import logo from "../../public/brand/logo-horizontal.png";
import logoClaro from "../../public/brand/logo-horizontal-claro.png";

/**
 * Logo de Kaffa Love Roasters 11:11, versión horizontal armada con las piezas del logo original de
 * Canva (public/brand/logo-original-canva.png). La altura se controla con className (h-*); el ancho
 * se ajusta solo. light: marrones en crema, para fondos oscuros (pie de página y feria).
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
