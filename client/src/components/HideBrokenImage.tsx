import { useState, type ImgHTMLAttributes } from "react";

export function HideBrokenImage({ onError, ...imageProps }: ImgHTMLAttributes<HTMLImageElement>) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    <img
      {...imageProps}
      onError={event => {
        onError?.(event);
        setFailed(true);
      }}
    />
  );
}
