import logoLatamAvif from "@/assets/logo-latam-dark-sm.avif";
import logoLatam from "@/assets/logo-latam-dark-sm.png";

export default function Spinner() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <picture>
        <source srcSet={logoLatamAvif} type="image/avif" />
        <img
          src={logoLatam}
          width={625}
          height={1009}
          className="animate-blink h-auto w-12"
          alt="Lafken"
          loading="eager"
          decoding="async"
          fetchPriority="high"
        />
      </picture>
    </div>
  );
}
