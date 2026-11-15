import Image from "next/image";
import logo from "../../public/brand/logo-horizontal.png";

/**
 * Logo de Kaffa Love Roasters 11:11, versión horizontal armada con las piezas del logo original de
 * Canva (public/brand/logo-original-canva.png). La altura se controla con className (h-*); el ancho
 * se ajusta solo.
 *
 * Los colores del logo no se cambian nunca. Sobre fondos oscuros (pie de página, barra de la feria)
 * se usa plate: el logo va sobre una placa crema para que el marrón se vea.
 */
export function Wordmark({ className = "h-10", plate = false, priority = false }: { className?: string; plate?: boolean; priority?: boolean }) {
  const img = <Image src={logo} alt="Kaffa Love Roasters 11:11" priority={priority} className={`w-auto ${className}`} sizes="280px" />;
  if (!plate) return img;
  return <span className="inline-flex rounded-xl bg-paper px-3 py-2">{img}</span>;
}
