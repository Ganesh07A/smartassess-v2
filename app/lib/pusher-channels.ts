/**
 * Channel names shared by the client and the server.
 *
 * These MUST stay `private-` prefixed: Pusher public channels can be subscribed to by anyone
 * holding the (public) app key, and the payloads on this channel contain student names, PRNs and
 * IP addresses. The subscription is authorized per-request in `app/api/pusher/auth/route.ts`.
 */
export function examChannel(examId: string) {
  return `private-exam-${examId}`;
}

/** Reserved for direct teacher → student commands (messages, time extensions). */
export function studentSessionChannel(sessionId: string) {
  return `private-session-${sessionId}`;
}
