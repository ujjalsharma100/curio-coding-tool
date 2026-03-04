import React from "react";
import { Box, Text } from "ink";
import type { Theme } from "../theme.js";

export interface NotificationItem {
  readonly id: string;
  readonly level: "info" | "warning" | "error";
  readonly text: string;
}

export interface NotificationProps {
  readonly item: NotificationItem;
  readonly theme: Theme;
}

const LEVEL_LABEL: Record<NotificationItem["level"], string> = {
  info: "ℹ ",
  warning: "⚠ ",
  error: "✗ ",
};

export function Notification({ item, theme }: NotificationProps): JSX.Element {
  const colorMap: Record<NotificationItem["level"], string> = {
    info: theme.info,
    warning: theme.warning,
    error: theme.danger,
  };

  return (
    <Box>
      <Text color={colorMap[item.level]}>
        {LEVEL_LABEL[item.level]}
        {item.text}
      </Text>
    </Box>
  );
}
