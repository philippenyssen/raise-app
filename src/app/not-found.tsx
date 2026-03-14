import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "var(--surface-0)",
        color: "var(--text-primary)",
        padding: "var(--space-8)",
        textAlign: "center",
      }}
    >
      <span style={{ fontSize: "var(--font-size-3xl)", fontWeight: 700, letterSpacing: "-0.02em" }}>
        404
      </span>
      <p style={{ color: "var(--text-secondary)", fontSize: "var(--font-size-md)", marginTop: "var(--space-2)" }}>
        Page not found
      </p>
      <div style={{ display: "flex", gap: "var(--space-4)", marginTop: "var(--space-6)" }}>
        <Link
          href="/"
          style={{
            padding: "var(--space-2) var(--space-4)",
            background: "var(--accent)",
            color: "white",
            borderRadius: "var(--radius-md)",
            fontSize: "var(--font-size-sm)",
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          Dashboard
        </Link>
        <Link
          href="/today"
          style={{
            padding: "var(--space-2) var(--space-4)",
            background: "var(--surface-2)",
            color: "var(--text-secondary)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-md)",
            fontSize: "var(--font-size-sm)",
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          Today
        </Link>
      </div>
    </div>
  );
}
