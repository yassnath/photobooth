import QRCode from "qrcode";
import { useEffect, useState } from "react";

interface ScannableQRCodeProps {
  value: string;
  size?: number;
  label?: string;
}

export function ScannableQRCode({ value, size = 200, label = "QR code" }: ScannableQRCodeProps) {
  const [source, setSource] = useState("");

  useEffect(() => {
    let active = true;

    void QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#3B0764", light: "#FFFFFF" },
    }).then((nextSource) => {
      if (active) {
        setSource(nextSource);
      }
    });

    return () => {
      active = false;
    };
  }, [size, value]);

  return (
    <div className="grid place-items-center overflow-hidden bg-white" style={{ width: size, height: size }}>
      {source ? <img src={source} alt={label} width={size} height={size} className="block h-full w-full" /> : <div className="h-full w-full animate-pulse bg-pink-50" />}
    </div>
  );
}
