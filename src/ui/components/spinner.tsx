import React, { useEffect, useState } from "react";
import { Text } from "ink";
import type { Theme } from "../theme.js";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export interface SpinnerProps {
  readonly theme: Theme;
  readonly label?: string;
}

export function Spinner({ theme, label }: SpinnerProps): JSX.Element {
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setFrameIndex((idx) => (idx + 1) % FRAMES.length);
    }, 80);
    return () => clearInterval(id);
  }, []);

  const frame = FRAMES[frameIndex];

  return (
    <Text color={theme.accentSoft}>
      {frame} {label ?? ""}
    </Text>
  );
}

