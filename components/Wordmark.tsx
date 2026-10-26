import Image from "next/image";

export function Wordmark() {
  return (
    <h1 className="brandmark">
      <Image src="/mazzari-logo.png" width={500} height={500} alt="MAZZARI" priority />
    </h1>
  );
}
