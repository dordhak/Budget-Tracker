/** Re-mounts on every navigation, so each page fades in softly instead of snapping. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade-in">{children}</div>;
}
