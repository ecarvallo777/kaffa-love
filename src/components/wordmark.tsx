import Image from "next/image";
import logo from "../../public/brand/logo-horizontal.png";

/**
 * Logo de Kaffa Love Roasters 11:11, versión horizontal armada con las piezas del logo original de
 * Canva (public/brand/logo-original-canva.png). La altura se controla con className (h-*); el ancho
 * se ajusta solo.
 *
 * Los colores del logo no se cambian nunca y el logo no lleva placa ni etiqueta: va directo sobre
 * fondos claros (paper o paper-2). Donde había un fondo oscuro, se cambió el fondo.
 */
export function Wordmark({ className = "h-10", priority = false }: { className?: string; priority?: boolean }) {
  return <Image src={logo} alt="Kaffa Love Roasters 11:11" priority={priority} className={`w-auto ${className}`} sizes="280px" />;
}
