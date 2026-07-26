import React from "react";
import { useIsFocused } from "@react-navigation/native";

/**
 * Wraps a screen so it only renders while focused. This ensures inactive
 * tab screens don't paint over each other (react-navigation keeps them
 * mounted by default and our transparent theme lets them bleed through).
 */
export function withFocusGate<P extends object>(
  Inner: React.ComponentType<P>
): React.ComponentType<P> {
  return function FocusedOnly(props: P) {
    const focused = useIsFocused();
    if (!focused) return null;
    return <Inner {...props} />;
  };
}
