const INTERACT_ACK_KEY = "pricing-workbook-interact-ack";

export function buildInteractAckKey(refresh: string | null | undefined) {
  return `${INTERACT_ACK_KEY}:${refresh || "unknown"}`;
}
